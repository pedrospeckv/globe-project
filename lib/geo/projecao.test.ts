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
