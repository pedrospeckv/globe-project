import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { geoArea } from "d3-geo";
import {
  AREA_MINIMA_PARA_FORMA,
  areaDaIlhaNaTela,
  desenhoDaIlha,
  temFormaVisivel,
} from "./ilhas";
import { escalaPara } from "./projecao";
import { Ilha } from "@/lib/conteudo/ilha";

const R = 6371;
const PASTA = path.join(process.cwd(), "conteudo", "ilhas");

const ilhas = fs
  .readdirSync(PASTA)
  .filter((f) => f.endsWith(".json"))
  .map((f) => Ilha.parse(JSON.parse(fs.readFileSync(path.join(PASTA, f), "utf8"))));

/** Escala do mapa de 1.472 px, que é o que uma tela de 1080 rende. */
const escalaDoMapa = (zoom = 1) => escalaPara(1, 1472) * zoom;

describe("critério de geometria", () => {
  it("toda ilha declara como achar o próprio desenho, e com razão", () => {
    for (const i of ilhas) {
      expect(i.geometria, i.id).toBeDefined();
      expect(i.geometria!.razao.length, i.id).toBeGreaterThan(10);
    }
  });

  it("toda ilha tem desenho gerado", () => {
    for (const i of ilhas) expect(desenhoDaIlha(i.id), i.id).toBeDefined();
  });

  /*
   * O teste que pegou um critério errado de verdade. Guadalcanal com raio de
   * 100 km media 9.634 km² contra 5.302 reais, porque as ilhas vizinhas ficam mais
   * perto do ponto que a ponta da própria ilha — nenhum raio separa as duas coisas.
   * Sem conferir contra a área real, o mapa mostraria as Salomão inteiras chamadas
   * de Guadalcanal e nada acusaria.
   *
   * As faixas são largas de propósito: a base é o 10m, que engrossa costa e
   * descarta ilhota. O que se cobra é ordem de grandeza, não precisão de cadastro.
   */
  const areaReal: Record<string, [number, number]> = {
    "malvinas-falklands": [10000, 13000],
    guadalcanal: [4800, 5800],
    "cabo-verde": [3300, 4300],
    acores: [2100, 2900],
    okinawa: [1100, 1500],
    madeira: [700, 900],
    guam: [480, 620],
    saipan: [100, 160],
    "santa-helena": [100, 150],
    "tristao-da-cunha": [60, 110],
    tarawa: [20, 45],
    "iwo-jima": [18, 35],
    peleliu: [10, 30],
    "fernando-de-noronha": [15, 30],
    chuuk: [30, 140],
    midway: [2, 10],
    kwajalein: [1, 20],
  };

  it("a área do desenho bate com a área real da ilha", () => {
    for (const i of ilhas) {
      const faixa = areaReal[i.id];
      expect(faixa, `falta a faixa de ${i.id}`).toBeDefined();
      const km2 = geoArea(desenhoDaIlha(i.id)!.geometria) * R * R;
      expect(km2, `${i.id}: ${km2.toFixed(0)} km²`).toBeGreaterThan(faixa[0]);
      expect(km2, `${i.id}: ${km2.toFixed(0)} km²`).toBeLessThan(faixa[1]);
    }
  });

  /* Ilha única é uma parte só. Se virarem duas, o critério pegou a vizinha. */
  it("critério por ponto devolve uma parte só", () => {
    for (const i of ilhas) {
      if (i.geometria?.tipo !== "ponto") continue;
      expect(desenhoDaIlha(i.id)!.geometria.coordinates, i.id).toHaveLength(1);
    }
  });

  /*
   * O ponto registrado tem de cair na caixa do desenho. É a mesma conferência que
   * o gerador faz, repetida sobre o dado que foi de fato versionado — foi ela que
   * revelou que o ponto de Okinawa estava no mar, a 7 km da costa.
   */
  it("o ponto de cada ilha cai na caixa do seu desenho", () => {
    for (const i of ilhas) {
      const g = desenhoDaIlha(i.id)!.geometria;
      let oeste = 180;
      let sul = 90;
      let leste = -180;
      let norte = -90;
      for (const aneis of g.coordinates) {
        for (const anel of aneis) {
          for (const [x, y] of anel) {
            oeste = Math.min(oeste, x);
            leste = Math.max(leste, x);
            sul = Math.min(sul, y);
            norte = Math.max(norte, y);
          }
        }
      }
      const [px, py] = i.ponto;
      expect(px, i.id).toBeGreaterThanOrEqual(oeste - 0.25);
      expect(px, i.id).toBeLessThanOrEqual(leste + 0.25);
      expect(py, i.id).toBeGreaterThanOrEqual(sul - 0.25);
      expect(py, i.id).toBeLessThanOrEqual(norte + 0.25);
    }
  });
});

describe("quando a forma aparece", () => {
  it("não desenha forma para quem não tem desenho", () => {
    expect(temFormaVisivel(undefined, escalaDoMapa(8))).toBe(false);
  });

  it("respeita o limiar", () => {
    const d = desenhoDaIlha("guadalcanal")!;
    /* Uma escala em que a área fica exatamente no limiar. */
    const noLimite = Math.sqrt(
      AREA_MINIMA_PARA_FORMA / (d.areaPlana * (Math.PI / 180) ** 2)
    );
    expect(areaDaIlhaNaTela(d, noLimite)).toBeCloseTo(AREA_MINIMA_PARA_FORMA, 6);
    expect(temFormaVisivel(d, noLimite)).toBe(true);
    expect(temFormaVisivel(d, noLimite * 0.99)).toBe(false);
  });

  /*
   * Os números medidos, que são a razão de o teto de zoom ter subido de 8 para 24:
   * com 8, sete ilhas nunca ganhavam forma — inclusive Fernando de Noronha, que é
   * a primeira que o Pedro pediu.
   */
  it("as grandes têm forma já no mundo inteiro", () => {
    for (const id of ["malvinas-falklands", "guadalcanal"]) {
      expect(temFormaVisivel(desenhoDaIlha(id), escalaDoMapa(1)), id).toBe(true);
    }
  });

  it("Fernando de Noronha só ganha forma além de 8×", () => {
    const d = desenhoDaIlha("fernando-de-noronha")!;
    expect(temFormaVisivel(d, escalaDoMapa(8))).toBe(false);
    expect(temFormaVisivel(d, escalaDoMapa(24))).toBe(true);
  });

  /*
   * Midway e Kwajalein seguem marcador em qualquer zoom, e o limite é da BASE e não
   * da tela: são atóis de anel fino, e o 10m mapeia 4 e 2 km² deles. Desenhar isso
   * como "a ilha" seria pior que o marcador, que ao menos não afirma forma.
   */
  it("os atóis de anel fino continuam marcador mesmo no zoom máximo", () => {
    for (const id of ["midway", "kwajalein"]) {
      expect(temFormaVisivel(desenhoDaIlha(id), escalaDoMapa(24)), id).toBe(false);
    }
  });
});
