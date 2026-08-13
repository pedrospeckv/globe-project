import { describe, it, expect } from "vitest";
import { criarProjecao, escalaPara } from "./projecao";

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
