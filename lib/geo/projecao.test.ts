import { describe, it, expect } from "vitest";
import { geoPath } from "d3-geo";
import {
  criarProjecao,
  escalaPara,
  anguloDeCorte,
  pontoVisivel,
} from "./projecao";

const LARGURA = 800;
const ALTURA = 500;

describe("criarProjecao", () => {
  it("em alpha=0 projeta como globo — o ponto central fica no meio da tela", () => {
    const p = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 0 });
    const frente = p([0, 0]);
    expect(frente).not.toBeNull();
    expect(frente![0]).toBeCloseTo(LARGURA / 2, 0);
    expect(frente![1]).toBeCloseTo(ALTURA / 2, 0);
  });

  it("em alpha=1 projeta como mapa plano — longitudes viram x lineares", () => {
    const p = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 1 });
    const oeste = p([-90, 0])!;
    const centro = p([0, 0])!;
    const leste = p([90, 0])!;
    expect(oeste[0]).toBeLessThan(centro[0]);
    expect(centro[0]).toBeLessThan(leste[0]);
    // Equiretangular é linear em longitude: os dois passos são iguais
    expect(centro[0] - oeste[0]).toBeCloseTo(leste[0] - centro[0], 4);
  });

  it("globo e mapa projetam a MESMA longitude em x diferentes", () => {
    const globo = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 0 });
    const mapa = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 1 });
    expect(globo([60, 0])![0]).not.toBeCloseTo(mapa([60, 0])![0], 1);
  });

  /*
   * O modo mapa do atlas é este alpha com rotação zerada, e o que se cobra dele
   * é ser um mapa-múndi de verdade: proporção 2:1, mundo inteiro dentro da tela e
   * centrado no cruzamento de Greenwich com o equador. Sem isto o modo criado
   * para estudar mostraria um mundo cortado ou fora de esquadro.
   */
  it("em alpha=1 o mundo inteiro cabe na tela, em proporção 2:1 e centrado", () => {
    const p = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha: 1,
      rotacao: [0, 0],
    });
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds({ type: "Sphere" } as never);

    expect((x1 - x0) / (y1 - y0)).toBeCloseTo(2, 2);
    expect(x1 - x0).toBeCloseTo(2 * Math.PI * escalaPara(1, LARGURA), 0);

    /* Dentro da tela, com folga nas quatro bordas. */
    expect(x0).toBeGreaterThan(0);
    expect(y0).toBeGreaterThan(0);
    expect(x1).toBeLessThan(LARGURA);
    expect(y1).toBeLessThan(ALTURA);

    /* Centrado, e o ponto (0,0) no meio. */
    expect((x0 + x1) / 2).toBeCloseTo(LARGURA / 2, 1);
    expect((y0 + y1) / 2).toBeCloseTo(ALTURA / 2, 1);
    expect(p([0, 0])).toEqual([LARGURA / 2, ALTURA / 2]);

    /* E as duas pontas do antimeridiano caem nas bordas opostas. */
    expect(p([-180, 0])![0]).toBeCloseTo(x0, 0);
    expect(p([180, 0])![0]).toBeCloseTo(x1, 0);
  });

  /*
   * O tamanho real do atlas, e não o deste arquivo de teste: 900 × 560. Fica
   * escrito porque é o número que se vê na tela — 848 × 424 de mapa, com 26 px
   * de folga nas laterais e 68 px acima e abaixo.
   */
  it("no tamanho do atlas, o mapa mede 848 × 424", () => {
    const p = criarProjecao({ largura: 900, altura: 560, alpha: 1, rotacao: [0, 0] });
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds({ type: "Sphere" } as never);
    expect(x1 - x0).toBeCloseTo(848.2, 0);
    expect(y1 - y0).toBeCloseTo(424.1, 0);
    expect([x0, y0]).toEqual([expect.closeTo(25.9, 0), expect.closeTo(67.9, 0)]);
  });

  it("é contínua — alpha intermediário fica ENTRE os extremos", () => {
    const ponto: [number, number] = [60, 0];
    const x = (a: number) =>
      criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: a })(ponto)![0];
    const meio = x(0.5);
    const min = Math.min(x(0), x(1));
    const max = Math.max(x(0), x(1));
    expect(meio).toBeGreaterThanOrEqual(min);
    expect(meio).toBeLessThanOrEqual(max);
  });

  it("centraliza no tamanho informado", () => {
    const p = criarProjecao({ largura: 1000, altura: 600, alpha: 1 });
    const centro = p([0, 0])!;
    expect(centro[0]).toBeCloseTo(500, 0);
    expect(centro[1]).toBeCloseTo(300, 0);
  });

  it("aplica rotação", () => {
    const semRot = criarProjecao({ largura: LARGURA, altura: ALTURA, alpha: 1 });
    const comRot = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha: 1,
      rotacao: [90, 0],
    });
    expect(comRot([0, 0])![0]).not.toBeCloseTo(semRot([0, 0])![0], 1);
  });
});

describe("lado oculto do globo", () => {
  /** Vista centrada em Brasília. Pequim fica a ~152° dali. */
  const ROTACAO: [number, number] = [47.9, 15.8];
  const BRASILIA: [number, number] = [-47.9, -15.8];
  const PEQUIM: [number, number] = [116.4, 39.9];

  const olhandoBrasil = (alpha: number) =>
    criarProjecao({ largura: LARGURA, altura: ALTURA, alpha, rotacao: ROTACAO });

  /**
   * O corte age sobre o fluxo de geometria do `geoPath`, não sobre um par de
   * coordenadas solto — daí desenhar de verdade em vez de projetar o ponto.
   */
  const desenha = (alpha: number, coordinates: [number, number]) =>
    geoPath(olhandoBrasil(alpha))({ type: "Point", coordinates });

  it("no globo, o que está atrás não é desenhado", () => {
    // Sem o corte, a China era desenhada espelhada sobre a América do Sul.
    expect(desenha(0, BRASILIA)).not.toBeNull();
    expect(desenha(0, PEQUIM)).toBeNull();
  });

  it("no mapa plano, o mundo inteiro aparece", () => {
    expect(desenha(1, BRASILIA)).not.toBeNull();
    expect(desenha(1, PEQUIM)).not.toBeNull();
  });

  it("a calota abre junto com o desenrolar, sem salto no fim", () => {
    const angulos = [0, 0.25, 0.5, 0.75, 1].map(anguloDeCorte);
    expect(angulos[0]).toBe(90);
    expect(angulos.at(-1)).toBeLessThan(180);
    expect(angulos.every((a, i) => i === 0 || a > angulos[i - 1])).toBe(true);
  });

  it("o ponto oposto volta durante a transição, não de repente no fim", () => {
    expect(desenha(0.5, PEQUIM)).toBeNull();
    expect(desenha(0.8, PEQUIM)).not.toBeNull();
  });
});

describe("emenda do mapa", () => {
  /**
   * Largura do MAIOR sub-caminho isolado. Um país que cruza a emenda vira
   * duas peças, uma em cada borda — então a caixa envolvente das duas dá a
   * largura inteira do mapa e não denuncia nada. O que denuncia é uma peça
   * SÓ atravessando a tela.
   */
  function maiorPedaco(d: string | null): number {
    if (!d) return -1;
    let larg = 0;
    for (const trecho of d.split("M").slice(1)) {
      const xs = [...trecho.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => +m[1]);
      if (xs.length) larg = Math.max(larg, Math.max(...xs) - Math.min(...xs));
    }
    return larg;
  }

  /**
   * Alasca cruza os 140°O, que é onde cai a emenda com a vista centrada em
   * 40°L — a rotação padrão da página. Com `clipAngle` sozinho os Estados
   * Unidos eram desenhados como uma faixa de 848px, a largura inteira do
   * mapa, na altura do paralelo 38.
   */
  const ALASCA_ATE_FLORIDA: Parameters<ReturnType<typeof geoPath>>[0] = {
    type: "Polygon",
    coordinates: [
      [
        [-170, 52],
        [-130, 55],
        [-80, 25],
        [-125, 35],
        [-170, 52],
      ],
    ],
  };

  const LARGURA_DO_MAPA = 2 * Math.PI * escalaPara(1, LARGURA);

  it("país que cruza a emenda não vira faixa atravessando a tela", () => {
    const p = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha: 1,
      rotacao: [-40, -10],
    });
    const larg = maiorPedaco(geoPath(p)(ALASCA_ATE_FLORIDA));
    expect(larg).toBeGreaterThan(0);
    expect(larg).toBeLessThan(LARGURA_DO_MAPA / 2);
  });

  it("também não vira faixa no meio da transição", () => {
    for (const alpha of [0.5, 0.75, 0.9]) {
      const p = criarProjecao({
        largura: LARGURA,
        altura: ALTURA,
        alpha,
        rotacao: [-40, -10],
      });
      expect(maiorPedaco(geoPath(p)(ALASCA_ATE_FLORIDA))).toBeLessThan(
        LARGURA_DO_MAPA / 2
      );
    }
  });

  it("os Estados Unidos de verdade, na rotação padrão da página", async () => {
    // O caso relatado, com a geometria real do world-atlas em vez de um
    // polígono de mentira: faixa de 848px na altura do paralelo 38.
    const { carregarMundo } = await import("./mundo");
    const { alpha3De } = await import("./iso");
    const mundo = await carregarMundo();
    const usa = mundo.find(
      (f) => f.id !== undefined && alpha3De(f.id as string) === "USA"
    )!;

    const p = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha: 1,
      rotacao: [-40, -10],
    });
    expect(maiorPedaco(geoPath(p)(usa))).toBeLessThan(LARGURA_DO_MAPA / 3);
  });

  it("costurar a emenda não desfaz o corte do lado oculto", () => {
    // As duas regras valem ao mesmo tempo: é o ponto de compor os cortes.
    const p = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha: 0,
      rotacao: [47.9, 15.8], // olhando o Brasil
    });
    expect(geoPath(p)({ type: "Point", coordinates: [116.4, 39.9] })).toBeNull();
  });
});

describe("pontoVisivel", () => {
  /*
   * O `clipAngle` age no fluxo do `geoPath`; chamar a projeção direto com um
   * par de coordenadas escapa do corte. Foi assim que o marcador de evento
   * continuou vazando depois de o país já estar corrigido.
   */
  const daBrasilia = { alpha: 0, rotacao: [47.9, 15.8] as [number, number] };

  it("a projeção direta NÃO corta — por isso este teste existe", () => {
    const p = criarProjecao({ largura: LARGURA, altura: ALTURA, ...daBrasilia });
    const pequim = p([116.4, 39.9]);
    expect(pequim).not.toBeNull();
    expect(Number.isFinite(pequim![0])).toBe(true);
  });

  it("separa a face de frente do lado oculto", () => {
    expect(pontoVisivel([-47.9, -15.8], daBrasilia)).toBe(true);
    expect(pontoVisivel([116.4, 39.9], daBrasilia)).toBe(false);
  });

  it("acompanha a abertura da calota ao desenrolar", () => {
    const pequim: [number, number] = [116.4, 39.9];
    expect(pontoVisivel(pequim, { ...daBrasilia, alpha: 0.5 })).toBe(false);
    expect(pontoVisivel(pequim, { ...daBrasilia, alpha: 1 })).toBe(true);
  });

  it("sem rotação, o centro da vista é a intersecção do equador com Greenwich", () => {
    expect(pontoVisivel([0, 0], { alpha: 0 })).toBe(true);
    expect(pontoVisivel([180, 0], { alpha: 0 })).toBe(false);
  });
});

describe("escalaPara", () => {
  it("encolhe ao virar mapa, para o mundo inteiro caber", () => {
    expect(escalaPara(1, LARGURA)).toBeLessThan(escalaPara(0, LARGURA));
  });

  it("cresce junto com a largura disponível", () => {
    expect(escalaPara(0, 1600)).toBeGreaterThan(escalaPara(0, 800));
  });

  it("é monotônica no alpha", () => {
    const s = (a: number) => escalaPara(a, LARGURA);
    expect(s(0)).toBeGreaterThan(s(0.5));
    expect(s(0.5)).toBeGreaterThan(s(1));
  });
});
