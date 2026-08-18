import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { feature } from "topojson-client";
import { geoPath } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import {
  AREA_MINIMA_PARA_COR,
  BALDES,
  NEUTRO,
  PALETA,
  atribuirBaldes,
  baldeBase,
  corDaFeicao,
  corDoBalde,
  hashDoNome,
  oklchParaHex,
  semCorPropria,
} from "./cores";
import { FATIAS, adjacenciaPorNome, feicoesUteis, type FatiaFeature } from "./fatias";
import { criarProjecao } from "./projecao";

const PASTA = path.join(process.cwd(), "public", "geo", "fatias");

/** Luminância relativa da WCAG, para medir claro aparente de verdade. */
function luminancia(hex: string): number {
  const canais = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

const carregar = (nome: string) => {
  const topo = JSON.parse(
    fs.readFileSync(path.join(PASTA, `${nome}.json`), "utf8")
  ) as Topology;
  const colecao = topo.objects.mundo as GeometryCollection;
  const feicoes = feature(topo, colecao).features as FatiaFeature[];
  return { feicoes, geometrias: colecao.geometries };
};

describe("paleta", () => {
  it("tem um balde para cada cor e nenhuma repetida", () => {
    expect(PALETA).toHaveLength(BALDES);
    expect(new Set(PALETA).size).toBe(BALDES);
  });

  it("são todas hexadecimais válidas", () => {
    for (const c of PALETA) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });

  /*
   * Este é o teste que justifica a conversão de OKLCH em vez de usar HSL
   * direto. Em HSL, 24 matizes na mesma "lightness" declarada abrem uma faixa
   * de luminância real de mais de 4 para 1: o amarelo salta e o azul afunda, e
   * meia dúzia de países viram destaque sem que nada no dado os destaque.
   */
  it("mantém a luminância uniforme entre matizes", () => {
    const ls = PALETA.map(luminancia);
    expect(Math.max(...ls) / Math.min(...ls)).toBeLessThan(2);
  });

  /* Rótulo é branco. Abaixo de 4,5:1 ele deixa de ser legível sobre a cor. */
  it("aceita rótulo branco por cima", () => {
    for (const c of PALETA) {
      expect(1.05 / (luminancia(c) + 0.05), c).toBeGreaterThan(4.5);
    }
  });

  /* Terra tem de se distinguir de mar sem depender do traço da fronteira. */
  it("separa terra de oceano", () => {
    const oceano = luminancia("#0b1220");
    for (const c of PALETA) expect(luminancia(c)).toBeGreaterThan(oceano * 3);
    expect(luminancia(NEUTRO)).toBeGreaterThan(oceano * 3);
  });

  /*
   * Croma zero é o recado do anônimo: não é uma cor de identidade, é a
   * ausência de uma. E a luminância tem de ficar na banda da paleta — a
   * primeira versão usava um cinza-azulado escuro e a terra sem dono conhecido
   * lia como mar, esvaziando `bc323`, onde metade das feições é anônima.
   */
  it("dá cinza puro, e não escuro, à terra sem dono", () => {
    expect(NEUTRO).toMatch(/^#([0-9a-f]{2})\1\1$/);
    const ls = PALETA.map(luminancia);
    expect(luminancia(NEUTRO)).toBeGreaterThan(Math.min(...ls) * 0.8);
  });

  it("converte OKLCH para dentro do gamute", () => {
    expect(oklchParaHex(0, 0, 0)).toBe("#000000");
    expect(oklchParaHex(1, 0, 0)).toBe("#ffffff");
    /*
     * Croma que não existe em sRGB é cortado canal por canal, e não devolve
     * preto: `oklch(0 0.2 120)` sai `#000b00`. O que importa é que nunca saia
     * fora da faixa — `NaN` ou negativo viraria `fillStyle` inválido, e
     * `fillStyle` inválido é ignorado em silêncio pelo canvas, pintando o país
     * com a cor do país anterior.
     */
    for (const [L, C, h] of [[0, 0.2, 120], [1, 0.4, 300], [0.5, 0.9, 30]]) {
      expect(oklchParaHex(L, C, h)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("devolve o neutro para balde inexistente", () => {
    expect(corDoBalde(undefined)).toBe(NEUTRO);
    expect(corDoBalde(-1)).toBe(NEUTRO);
    expect(corDoBalde(BALDES)).toBe(NEUTRO);
    expect(corDoBalde(1.5)).toBe(NEUTRO);
  });
});

describe("hash do nome", () => {
  /*
   * Os valores estão travados de propósito. A cor de cada entidade É este
   * hash, então mudar a função repinta o mapa inteiro — e a promessa do
   * subsistema é que Roma continue da mesma cor de uma sessão para a outra e
   * de uma versão para a outra. Se este teste cair, a mudança tem de ser
   * deliberada.
   */
  it("é estável para os nomes que já estão na tela", () => {
    expect(baldeBase("Roman Empire")).toBe(hashDoNome("Roman Empire") % BALDES);
    expect(hashDoNome("Roman Empire")).toBe(2446778238);
    expect(hashDoNome("Portugal")).toBe(646750087);
    expect(hashDoNome("Brazil")).toBe(2156656503);
  });

  it("não depende de estado entre chamadas", () => {
    expect(hashDoNome("Persia")).toBe(hashDoNome("Persia"));
  });

  it("distribui os nomes reais pelos baldes sem deixar nenhum vazio", () => {
    const { feicoes } = carregar("1900");
    const usados = new Set(
      feicoes.map((f) => f.properties?.n).filter(Boolean).map((n) => baldeBase(n!))
    );
    expect(usados.size).toBe(BALDES);
  });
});

describe("atribuirBaldes", () => {
  const grafo = (pares: [string, string][]) => {
    const adj = new Map<string, Set<string>>();
    const liga = (a: string, b: string) => {
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a)!.add(b);
    };
    for (const [a, b] of pares) {
      liga(a, b);
      liga(b, a);
    }
    return adj;
  };

  it("deixa cada nome na cor do próprio hash quando ninguém colide", () => {
    const baldes = atribuirBaldes(["Portugal", "Brazil"], new Map());
    expect(baldes.get("Portugal")).toBe(baldeBase("Portugal"));
    expect(baldes.get("Brazil")).toBe(baldeBase("Brazil"));
  });

  it("separa vizinhos que caíram no mesmo balde", () => {
    /* Dois nomes com o mesmo balde base, forçados a fazer fronteira. */
    const a = "aa";
    const b = [...Array(4000).keys()]
      .map((i) => `b${i}`)
      .find((n) => baldeBase(n) === baldeBase(a))!;
    expect(baldeBase(b)).toBe(baldeBase(a));

    const baldes = atribuirBaldes([a, b], grafo([[a, b]]));
    expect(baldes.get(a)).not.toBe(baldes.get(b));
  });

  it("não muda de resultado se a ordem da lista mudar", () => {
    const nomes = ["Persia", "Media", "Lydia", "Egypt", "Nubia"];
    const adj = grafo([
      ["Persia", "Media"],
      ["Media", "Lydia"],
      ["Persia", "Egypt"],
      ["Egypt", "Nubia"],
    ]);
    const direto = atribuirBaldes(nomes, adj);
    const invertido = atribuirBaldes([...nomes].reverse(), adj);
    expect([...invertido.entries()].sort()).toEqual(
      [...direto.entries()].sort()
    );
  });

  it("termina mesmo quando os vizinhos ocupam todos os baldes", () => {
    /*
     * Pior caso: um nome cercado por 24 vizinhos de cores distintas. Nunca
     * aconteceu no conjunto atual, e precisa terminar de qualquer forma porque
     * uma fatia local futura pode ser mais emaranhada que qualquer uma de hoje.
     * A saída é aceitar repetir a cor de um vizinho — feio, e melhor que travar.
     */
    const porBalde = new Map<number, string>();
    for (let i = 0; porBalde.size < BALDES && i < 100000; i++) {
      const n = `a${i}`;
      if (!porBalde.has(baldeBase(n))) porBalde.set(baldeBase(n), n);
    }
    expect(porBalde.size).toBe(BALDES);

    const cercado = "zz";
    const vizinhos = [...porBalde.values()];
    const baldes = atribuirBaldes(
      [...vizinhos, cercado],
      grafo(vizinhos.map((v) => [cercado, v] as [string, string]))
    );
    expect(baldes.get(cercado)).toBe(baldeBase(cercado));
    /* E os 24 de fora, que não se tocam, ficaram cada um no seu. */
    for (const v of vizinhos) expect(baldes.get(v)).toBe(baldeBase(v));
  });

  it("ignora vizinho que não recebeu cor", () => {
    /* Nome citado na adjacência mas ausente da lista — feição descartada pelo
       filtro de área não deve proibir a cor de ninguém. */
    const baldes = atribuirBaldes(["Portugal"], grafo([["Portugal", "?"]]));
    expect(baldes.get("Portugal")).toBe(baldeBase("Portugal"));
  });
});

describe("corDaFeicao", () => {
  const feicao = (n?: string) =>
    ({ type: "Feature", geometry: null, properties: n ? { n } : {} }) as unknown as FatiaFeature;

  it("dá o neutro para feição anônima", () => {
    expect(corDaFeicao(feicao(), new Map())).toBe(NEUTRO);
  });

  it("dá o neutro para nome sem balde atribuído", () => {
    expect(corDaFeicao(feicao("Atlantis"), new Map())).toBe(NEUTRO);
  });

  it("dá a cor do balde quando há", () => {
    expect(corDaFeicao(feicao("Portugal"), new Map([["Portugal", 7]]))).toBe(
      PALETA[7]
    );
  });
});

describe("cor só para quem tem tamanho", () => {
  it("corta abaixo do limiar e não em cima dele", () => {
    expect(semCorPropria(AREA_MINIMA_PARA_COR - 1)).toBe(true);
    expect(semCorPropria(AREA_MINIMA_PARA_COR)).toBe(false);
    expect(semCorPropria(0)).toBe(true);
  });

  /*
   * A medição que justifica o limiar: ele tem de morder onde está o confete e
   * poupar o mapa moderno. Num mapa de 1472 px, 88% dos 375 territórios
   * australianos de 1650 ficam abaixo dele, contra 23% dos 176 países de 2018.
   *
   * A área é a PROJETADA, porque é ela que se vê: a esférica subestimaria os
   * países de latitude alta, que a equirretangular estica.
   */
  it("morde o confete e poupa o mapa moderno", () => {
    const proporcaoSemCor = (nome: string) => {
      const { feicoes } = carregar(nome);
      const p = criarProjecao({
        largura: 1472,
        altura: 780,
        alpha: 1,
        rotacao: [0, 0],
      });
      const caminho = geoPath(p);
      const area = new Map<string, number>();
      for (const f of feicoesUteis(feicoes)) {
        const n = f.properties?.n;
        if (!n) continue;
        area.set(n, (area.get(n) ?? 0) + Math.abs(caminho.area(f)));
      }
      const total = area.size;
      let pequenos = 0;
      for (const a of area.values()) if (semCorPropria(a)) pequenos++;
      return pequenos / total;
    };

    expect(proporcaoSemCor("1650")).toBeGreaterThan(0.6);
    expect(proporcaoSemCor("1492")).toBeGreaterThan(0.6);
    /* E o mapa de hoje segue quase todo colorido. */
    expect(proporcaoSemCor("2018")).toBeLessThan(0.35);
  });
});

describe("cores contra o dado real", () => {
  /** Cores de uma fatia, do jeito que o carregador faz. */
  const coresDe = (nome: string) => {
    const { feicoes, geometrias } = carregar(nome);
    const adj = adjacenciaPorNome(feicoes, geometrias);
    const nomes = new Set(
      feicoes.map((f) => f.properties?.n).filter(Boolean) as string[]
    );
    return { baldes: atribuirBaldes(nomes, adj), adj };
  };

  /*
   * O teste que sustenta o subsistema. É ele que garante que nenhuma fronteira
   * do atlas fica invisível por dois vizinhos terem sorteado a mesma cor — com
   * hash puro, seriam 407 fronteiras em 9.668 pares.
   */
  it("nenhuma fatia deixa dois vizinhos com a mesma cor", () => {
    for (const f of FATIAS) {
      const { baldes, adj } = coresDe(f.nome);
      const colisoes: string[] = [];
      for (const [a, vizinhos] of adj) {
        for (const b of vizinhos) {
          if (baldes.get(a) !== undefined && baldes.get(a) === baldes.get(b)) {
            colisoes.push(`${a}|${b}`);
          }
        }
      }
      expect(colisoes, `${f.nome}: ${colisoes.slice(0, 5).join(", ")}`).toEqual(
        []
      );
    }
  });

  /*
   * A contrapartida: o desempate não pode sair caro. Medido no conjunto, 4,05%
   * dos grupos saem do balde do hash. O limite de 10% acusa se uma paleta menor
   * ou uma fatia nova transformar a exceção em regra — porque cada grupo movido
   * é um grupo cuja cor passa a depender da vizinhança, e não só do nome.
   */
  it("move poucos grupos para fora do balde do hash", () => {
    let movidos = 0;
    let total = 0;
    for (const f of FATIAS) {
      const { baldes } = coresDe(f.nome);
      for (const [n, b] of baldes) {
        total++;
        if (b !== baldeBase(n)) movidos++;
      }
    }
    expect(movidos / total).toBeLessThan(0.1);
  });

  /*
   * A segunda exigência do subsistema: identidade no tempo. Arrastando a barra,
   * a mesma entidade tem de guardar a cor de uma fatia para a seguinte, senão a
   * tela pisca e o olho perde o sujeito que estava acompanhando. Medido: 1,59%
   * trocam. O limite de 5% acusa perda de estabilidade.
   */
  it("mantém a cor da mesma entidade entre fatias consecutivas", () => {
    let comuns = 0;
    let trocam = 0;
    let anterior: Map<string, number> | null = null;
    for (const f of FATIAS) {
      const { baldes } = coresDe(f.nome);
      if (anterior) {
        for (const [n, b] of anterior) {
          const agora = baldes.get(n);
          if (agora === undefined) continue;
          comuns++;
          if (agora !== b) trocam++;
        }
      }
      anterior = baldes;
    }
    expect(comuns).toBeGreaterThan(1000);
    expect(trocam / comuns).toBeLessThan(0.05);
  });
});

describe("adjacenciaPorNome", () => {
  it("acha vizinhos reais numa fatia moderna", () => {
    const { feicoes, geometrias } = carregar("2010");
    const adj = adjacenciaPorNome(feicoes, geometrias);
    expect(adj.get("Portugal")).toContain("Spain");
    expect(adj.get("Spain")).toContain("Portugal");
    /* Ilha não faz fronteira com ninguém por terra. */
    expect(adj.get("Iceland") ?? new Set()).toHaveLength(0);
  });

  it("não relaciona uma entidade consigo mesma", () => {
    const { feicoes, geometrias } = carregar("2010");
    const adj = adjacenciaPorNome(feicoes, geometrias);
    for (const [n, vizinhos] of adj) expect(vizinhos.has(n)).toBe(false);
  });

  it("é simétrica", () => {
    const { feicoes, geometrias } = carregar("1900");
    const adj = adjacenciaPorNome(feicoes, geometrias);
    for (const [a, vizinhos] of adj) {
      for (const b of vizinhos) expect(adj.get(b)?.has(a)).toBe(true);
    }
  });

  /*
   * A salvaguarda. Os índices de `geometries` casam com os de `features` nas 53
   * fatias, mas foi assumir correspondência posicional que fez fracassar a
   * tentativa 3 de consertar a geometria (ver `fatias.ts`). Se o alinhamento
   * quebrar, é melhor perder o desempate — que custa 4% de colisão — do que
   * cruzar o nome de um país com os vizinhos de outro.
   */
  it("devolve vazio quando as listas não se alinham", () => {
    const { feicoes, geometrias } = carregar("2010");
    expect(adjacenciaPorNome(feicoes, geometrias.slice(1)).size).toBe(0);
  });
});
