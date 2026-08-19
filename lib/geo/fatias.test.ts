import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import { geoArea, geoBounds } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import {
  ATRIBUICAO,
  FATIAS,
  PRECISAO_FIRME,
  DEFASAGEM_DISTANTE,
  DEFASAGEM_PROXIMA,
  defasagemDaFatia,
  faixaDeDefasagem,
  fatiaPara,
  proximaFatia,
  feicaoAbsurda,
  feicoesUteis,
  repararFeicao,
  precisaoBaixa,
  rotuloDaFatia,
  type FatiaFeature,
} from "./fatias";

const PASTA = path.join(process.cwd(), "public", "geo", "fatias");

describe("índice de fatias", () => {
  it("está ordenado do mais antigo para o mais recente", () => {
    const anos = FATIAS.map((f) => f.ano);
    expect(anos).toEqual([...anos].sort((a, b) => a - b));
  });

  it("não tem ano zero — não existe no calendário histórico", () => {
    expect(FATIAS.map((f) => f.ano)).not.toContain(0);
  });

  it("não repete ano", () => {
    expect(new Set(FATIAS.map((f) => f.ano)).size).toBe(FATIAS.length);
  });

  /*
   * Este é o teste que importa. O índice é gerado por um script de rede, e
   * uma entrada sem arquivo no disco quebraria só quando o usuário arrastasse
   * a barra até aquele ano — erro de tela, longe da causa. Aqui quebra no
   * `pnpm test`, que é onde erro de conteúdo quebra no resto do projeto.
   */
  /*
   * O caminho depende de a fatia ser local, e é resolvido aqui do mesmo jeito que
   * `carregarFatia` resolve. Fatia local mora em `locais/` porque uma que CORRIGE
   * uma baixada tem o mesmo nome dela — 1938 e 1945 são os casos — e no mesmo
   * diretório uma sobrescreveria a outra.
   */
  const caminhoDaFatia = (f: { nome: string; local?: boolean }) =>
    f.local
      ? path.join(PASTA, "locais", `${f.nome}.json`)
      : path.join(PASTA, `${f.nome}.json`);

  it("toda entrada tem arquivo no disco, com o tamanho declarado", () => {
    for (const f of FATIAS) {
      const caminho = caminhoDaFatia(f);
      expect(fs.existsSync(caminho), `falta ${f.nome}.json`).toBe(true);
      expect(fs.statSync(caminho).size, `tamanho de ${f.nome}`).toBe(f.bytes);
    }
  });

  /*
   * A baixada que foi substituída CONTINUA no disco, e não é órfã: é dela que a
   * corrigida é derivada, e apagá-la tornaria a correção irreproduzível.
   */
  it("a baixada substituída fica no disco, fora do índice", () => {
    for (const nome of ["1938", "1945"]) {
      expect(fs.existsSync(path.join(PASTA, `${nome}.json`)), nome).toBe(true);
      const noIndice = FATIAS.find((f) => f.nome === nome)!;
      expect(noIndice.local, `${nome} no índice tem de ser a local`).toBe(true);
    }
  });

  it("não há arquivo órfão na pasta servida", () => {
    const noDisco = fs
      .readdirSync(PASTA)
      .filter((a) => a.endsWith(".json"))
      .map((a) => a.replace(/\.json$/, ""))
      .sort();
    expect(noDisco).toEqual([...FATIAS.map((f) => f.nome)].sort());
  });

  /* Share-alike sem crédito é violação de licença, não descuido de estilo. */
  it("carrega atribuição e licença", () => {
    expect(ATRIBUICAO.autor).toBeTruthy();
    expect(ATRIBUICAO.url).toMatch(/^https:\/\//);
    expect(ATRIBUICAO.licenca).toBe("CC-BY-SA-4.0");
    expect(fs.existsSync(path.join(PASTA, "LICENCA.md"))).toBe(true);
  });
});

describe("fatiaPara", () => {
  it("escolhe a última fatia anterior ou igual à data", () => {
    expect(fatiaPara(1900).ano).toBe(1900);
    expect(fatiaPara(1901).ano).toBe(1900);
    expect(fatiaPara(1913).ano).toBe(1900);
    expect(fatiaPara(1914).ano).toBe(1914);
  });

  /*
   * O caso que motivou a regra: 1490 não pode mostrar 1492. Adiantar o mapa
   * inventaria arranjos pós-colombianos antes de eles existirem.
   */
  it("não adianta o mapa — 1490 vê 1400, não 1492", () => {
    expect(fatiaPara(1490).ano).toBe(1400);
    expect(fatiaPara(1492).ano).toBe(1492);
  });

  it("lida com datas a.C.", () => {
    expect(fatiaPara(-323).ano).toBe(-323);
    expect(fatiaPara(-300).ano).toBe(-300);
    expect(fatiaPara(-310).ano).toBe(-323);
    expect(fatiaPara(-1).ano).toBe(-1);
  });

  it("antes da fatia mais antiga, devolve a mais antiga", () => {
    expect(fatiaPara(-500000).ano).toBe(FATIAS[0].ano);
  });

  it("depois da mais recente, devolve a mais recente", () => {
    expect(fatiaPara(3000).ano).toBe(FATIAS[FATIAS.length - 1].ano);
  });
});

describe("defasagemDaFatia", () => {
  it("é zero em cima de uma fatia", () => {
    expect(defasagemDaFatia(1900)).toBe(0);
  });

  it("mede a distância até a fatia usada", () => {
    expect(defasagemDaFatia(1913)).toBe(13);
    expect(defasagemDaFatia(1491)).toBe(91);
  });

  it("nunca é negativa", () => {
    expect(defasagemDaFatia(-500000)).toBe(0);
  });
});

describe("precisaoBaixa", () => {
  const com = (p?: number): FatiaFeature =>
    ({ type: "Feature", geometry: null, properties: { p } }) as unknown as FatiaFeature;

  it("trata precisão abaixo do corte como conjectura", () => {
    expect(precisaoBaixa(com(1))).toBe(true);
    expect(precisaoBaixa(com(0))).toBe(true);
  });

  it("trata precisão no corte ou acima como firme", () => {
    expect(precisaoBaixa(com(PRECISAO_FIRME))).toBe(false);
    expect(precisaoBaixa(com(3))).toBe(false);
  });

  /* Ausente é desconhecido, e desconhecido não pode passar por firme. */
  it("trata ausência como conjectura", () => {
    expect(precisaoBaixa(com(undefined))).toBe(true);
  });
});

describe("geometria das fatias", () => {
  const amostra = ["bc323", "1492", "1900", "2010"];

  it.each(amostra)("%s tem topologia legível com objeto 'mundo'", (nome) => {
    const topo = JSON.parse(
      fs.readFileSync(path.join(PASTA, `${nome}.json`), "utf8")
    ) as Topology;
    expect(topo.type).toBe("Topology");
    expect(topo.objects.mundo).toBeDefined();

    const feicoes = feature(topo, topo.objects.mundo as GeometryCollection)
      .features as FatiaFeature[];
    expect(feicoes.length).toBeGreaterThan(100);

    /*
     * Parte das feições é anônima de propósito — a fonte desenha território
     * sem atribuir Estado. O que não pode existir é ausência escrita de duas
     * formas: `null` e string vazia obrigariam todo leitor a testar os dois.
     * A poda omite a chave, então ausente é ausente.
     */
    for (const f of feicoes) {
      expect(f.properties).not.toHaveProperty("n", null);
      expect(f.properties).not.toHaveProperty("n", "");
    }
    expect(feicoes.some((f) => rotuloDaFatia(f))).toBe(true);
  });

  it("nomeia a maioria nas fatias modernas e menos nas antigas", () => {
    const proporcao = (nome: string) => {
      const topo = JSON.parse(
        fs.readFileSync(path.join(PASTA, `${nome}.json`), "utf8")
      ) as Topology;
      const fs2 = feature(topo, topo.objects.mundo as GeometryCollection)
        .features as FatiaFeature[];
      return fs2.filter((f) => rotuloDaFatia(f)).length / fs2.length;
    };
    /* 2010 é registro; bc323 é conjectura, e metade do mundo não tem dono. */
    expect(proporcao("2010")).toBeGreaterThan(0.8);
    expect(proporcao("bc323")).toBeLessThan(proporcao("2010"));
  });

  /*
   * A topologia foi extraída ANTES de simplificar para que fronteira entre
   * vizinhos fosse um arco só e os dois lados continuassem coincidentes. Se
   * alguém invertesse essa ordem no script, o número de arcos despencaria em
   * relação ao de feições e apareceria fenda branca entre países.
   */
  it("1900 compartilha arcos entre vizinhos", () => {
    const topo = JSON.parse(
      fs.readFileSync(path.join(PASTA, "1900.json"), "utf8")
    ) as Topology;
    /*
     * O indicador NÃO é "menos arcos que anéis": a topologia corta cada anel
     * em todas as junções, então ela normalmente produz mais arcos que anéis.
     * A partilha aparece na contagem de referências — um arco de fronteira
     * entre dois países é guardado uma vez e citado duas.
     */
    const refs = new Map<number, number>();
    const contar = (a: unknown): void => {
      if (typeof a === "number") {
        const i = a < 0 ? ~a : a;
        refs.set(i, (refs.get(i) ?? 0) + 1);
      } else if (Array.isArray(a)) {
        for (const x of a) contar(x);
      }
    };
    for (const g of (topo.objects.mundo as GeometryCollection).geometries) {
      contar((g as { arcs?: unknown }).arcs);
    }

    const compartilhados = [...refs.values()].filter((n) => n > 1).length;
    expect(refs.size).toBeGreaterThan(0);
    expect(compartilhados).toBeGreaterThan(refs.size * 0.2);
  });
});

describe("a Antártida", () => {
  /*
   * A regressão que o Pedro pegou olhando o mapa. Eu havia RETIRADO a Antártida
   * da fatia local de 2018, com a justificativa — falsa, afirmada sem conferir —
   * de que o upstream de 2010 também não a trazia. Todas as fatias a trazem, e o
   * efeito do erro era um continente desaparecer da tela de 2018 em diante.
   *
   * O teste cobre TODAS as fatias, porque o defeito nasceu de uma fatia só ter
   * sido tratada de forma diferente das outras sem ninguém notar.
   */
  it("está desenhada em todas as fatias menos a única que o upstream esqueceu", () => {
    const semAntartida: string[] = [];
    for (const f of FATIAS) {
      const topo = JSON.parse(
        fs.readFileSync(path.join(PASTA, `${f.nome}.json`), "utf8")
      ) as Topology;
      const feicoes = feicoesUteis(
        feature(topo, topo.objects.mundo as GeometryCollection)
          .features as FatiaFeature[]
      );
      /* O continente tem ~14 milhões de km²; a base desenha ~12,2. */
      const km2 = feicoes
        .filter((x) => x.geometry && geoBounds(x)[1][1] < -60)
        .reduce((soma, x) => soma + geoArea(x) * 6371 * 6371, 0);
      if (km2 / 1e6 < 10) semAntartida.push(f.nome);
    }
    /*
     * A exceção fica FIXA em vez de o limite ser afrouxado. `bc5000` não traz a
     * Antártida no upstream — é lacuna de lá, e consertá-la exigiria copiar
     * geometria de outra fatia, o que a regra da fatia local proíbe. Listada
     * assim, se qualquer OUTRA fatia perder o continente, este teste cai.
     */
    expect(semAntartida).toEqual(["bc5000"]);
  });

  /* E na fatia local ela é nomeada e marcada como terra sem soberano. */
  it("é nomeada e sem soberano na fatia de 2018", () => {
    const topo = JSON.parse(
      fs.readFileSync(path.join(PASTA, "2018.json"), "utf8")
    ) as Topology;
    const feicoes = feature(topo, topo.objects.mundo as GeometryCollection)
      .features as FatiaFeature[];
    const anta = feicoes.find((f) => f.properties?.n === "Antarctica");
    expect(anta).toBeDefined();
    expect(anta!.properties?.ss).toBe(true);
  });
});

describe("feições absurdas", () => {
  /*
   * Esta é a regressão que mais importa do arquivo. O defeito não era visível
   * como erro: o mapa continuava desenhando, e a única pista era o oceano com
   * cor de terra. A consulta por hover é que o expôs, respondendo "Alemanha"
   * no meio do Pacífico.
   */
  it("nenhuma fatia entrega feição cobrindo mais de 1 sr", () => {
    for (const f of FATIAS) {
      const topo = JSON.parse(
        fs.readFileSync(path.join(PASTA, `${f.nome}.json`), "utf8")
      ) as Topology;
      const todas = feature(topo, topo.objects.mundo as GeometryCollection)
        .features as FatiaFeature[];
      const uteis = feicoesUteis(todas);
      expect(
        uteis.filter((x) => feicaoAbsurda(x)),
        `${f.nome} deixou passar feição absurda`
      ).toHaveLength(0);
    }
  });

  /*
   * O conserto, que é o que resolveu a pendência das três tentativas falhadas.
   * O diagnóstico antigo era "anel destruído"; o certo é "anel invertido", e
   * inversão se desfaz. Estes números são o argumento: 96,7% voltam.
   */
  it("conserta quase tudo, e o que sobra não é país nomeado", () => {
    let absurdas = 0;
    let consertadas = 0;
    const perdidasNomeadas: string[] = [];
    for (const f of FATIAS) {
      const topo = JSON.parse(
        fs.readFileSync(path.join(PASTA, `${f.nome}.json`), "utf8")
      ) as Topology;
      const todas = feature(topo, topo.objects.mundo as GeometryCollection)
        .features as FatiaFeature[];
      for (const g of todas) {
        if (!feicaoAbsurda(g)) continue;
        absurdas++;
        if (!feicaoAbsurda(repararFeicao(g))) consertadas++;
        else if (g.properties?.n) perdidasNomeadas.push(`${f.nome}:${g.properties.n}`);
      }
    }
    expect(absurdas).toBeGreaterThan(100);
    expect(consertadas / absurdas).toBeGreaterThan(0.95);
    /* O que importa: nenhum país nomeado desaparece mais do mapa. */
    expect(perdidasNomeadas).toEqual([]);
  });

  /*
   * A regressão concreta que o Pedro viu: a Alemanha sumia de 1994, 2000 e 2010 e
   * reaparecia em 2018. O conserto devolve a área certa, não só uma área sã —
   * 349.600 km² contra os 357.600 reais, e a diferença é a simplificação.
   */
  it("devolve a Alemanha de 2010 com o tamanho da Alemanha", () => {
    const topo = JSON.parse(
      fs.readFileSync(path.join(PASTA, "2010.json"), "utf8")
    ) as Topology;
    const todas = feature(topo, topo.objects.mundo as GeometryCollection)
      .features as FatiaFeature[];
    const crua = todas.find((f) => f.properties?.n === "Germany")!;
    expect(feicaoAbsurda(crua)).toBe(true);

    const uteis = feicoesUteis(todas);
    const alema = uteis.find((f) => f.properties?.n === "Germany");
    expect(alema, "a Alemanha tem de sobreviver ao carregamento").toBeDefined();
    const km2 = geoArea(alema!) * 6371 * 6371;
    expect(km2).toBeGreaterThan(330000);
    expect(km2).toBeLessThan(370000);
  });

  /*
   * O filtro tem de custar pouco, senão esconde história em vez de artefato.
   * Medido no conjunto: 151 feições descartadas de 17.521, ou 0,86%. A pior
   * fatia é `bc323`, com 5 de 149 — 3,4%. O limite de 4% é folga sobre isso,
   * e serve para acusar se uma reconstrução do dado piorar o estrago.
   */
  it("descarta pouco — no máximo 4% das feições de cada fatia", () => {
    for (const f of FATIAS) {
      const topo = JSON.parse(
        fs.readFileSync(path.join(PASTA, `${f.nome}.json`), "utf8")
      ) as Topology;
      const todas = feature(topo, topo.objects.mundo as GeometryCollection)
        .features as FatiaFeature[];
      const perdidas = todas.length - feicoesUteis(todas).length;
      expect(
        perdidas / todas.length,
        `${f.nome} perdeu ${perdidas} de ${todas.length}`
      ).toBeLessThan(0.04);
    }
  });

  it("mantém as feições normais", () => {
    const topo = JSON.parse(
      fs.readFileSync(path.join(PASTA, "1900.json"), "utf8")
    ) as Topology;
    const todas = feature(topo, topo.objects.mundo as GeometryCollection)
      .features as FatiaFeature[];
    /* 1900 é uma das 15 fatias sãs: nada deve ser descartado nela. */
    expect(feicoesUteis(todas)).toHaveLength(todas.length);
  });
});

describe("proximaFatia", () => {
  it("diz até quando o mapa fica congelado", () => {
    /* Em 1450 a base é 1400 e a seguinte é 1492: 92 anos aparecem iguais. */
    expect(fatiaPara(1450).ano).toBe(1400);
    expect(proximaFatia(1450)?.ano).toBe(1492);
  });

  it("devolve null na última fatia", () => {
    const ultima = FATIAS[FATIAS.length - 1].ano;
    expect(proximaFatia(ultima)).toBeNull();
    expect(proximaFatia(ultima + 500)).toBeNull();
  });

  it("é sempre posterior à vigente", () => {
    for (const f of FATIAS) {
      const prox = proximaFatia(f.ano);
      if (prox) expect(prox.ano).toBeGreaterThan(f.ano);
    }
  });
});

describe("faixaDeDefasagem", () => {
  /*
   * Os cortes vêm da densidade medida do conjunto: de 500 a.C. em diante o vão
   * mediano é 70 anos. 40 é menos que metade disso — o melhor que o dado
   * oferece. Acima de 150 já se passaram duas fatias da faixa densa.
   */
  it("gradua nas quatro faixas", () => {
    expect(faixaDeDefasagem(0)).toBe("exata");
    expect(faixaDeDefasagem(1)).toBe("proxima");
    expect(faixaDeDefasagem(DEFASAGEM_PROXIMA)).toBe("proxima");
    expect(faixaDeDefasagem(DEFASAGEM_PROXIMA + 1)).toBe("distante");
    expect(faixaDeDefasagem(DEFASAGEM_DISTANTE)).toBe("distante");
    expect(faixaDeDefasagem(DEFASAGEM_DISTANTE + 1)).toBe("remota");
  });

  it("trata defasagem negativa como exata — o mapa nunca adianta", () => {
    expect(faixaDeDefasagem(-5)).toBe("exata");
  });

  /*
   * O caso que motivou tudo: 1913 e 3000 a.C. recebiam a mesma frase. Agora
   * caem em faixas diferentes, e a interface pode falar em tons diferentes.
   */
  it("separa o detalhe do engano", () => {
    expect(faixaDeDefasagem(defasagemDaFatia(1913))).toBe("proxima");
    expect(faixaDeDefasagem(defasagemDaFatia(1491))).toBe("distante");
    expect(faixaDeDefasagem(defasagemDaFatia(-2500))).toBe("remota");
  });

  it("em cima de uma fatia é sempre exata", () => {
    for (const f of FATIAS) {
      expect(faixaDeDefasagem(defasagemDaFatia(f.ano)), String(f.ano)).toBe("exata");
    }
  });
});
