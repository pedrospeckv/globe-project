import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import {
  ATRIBUICAO,
  FATIAS,
  PRECISAO_FIRME,
  defasagemDaFatia,
  fatiaPara,
  feicaoAbsurda,
  feicoesUteis,
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
  it("toda entrada tem arquivo no disco, com o tamanho declarado", () => {
    for (const f of FATIAS) {
      const caminho = path.join(PASTA, `${f.nome}.json`);
      expect(fs.existsSync(caminho), `falta ${f.nome}.json`).toBe(true);
      expect(fs.statSync(caminho).size, `tamanho de ${f.nome}`).toBe(f.bytes);
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
