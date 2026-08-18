import { geoArea, geoCentroid, geoContains, geoPath, type GeoProjection } from "d3-geo";
import type { Polygon, Position } from "geojson";
import type { FatiaFeature } from "./fatias";

/**
 * Nomes escritos sobre o mapa.
 *
 * ## Por que só no mapa plano
 *
 * No globo não dá: metade do mundo está do outro lado, e a cada grau de giro os
 * nomes teriam de ser recolocados — a colocação é o passo caro, e pagá-lo por
 * quadro não se sustenta. O mapa é fixo por decisão (ver `Atlas.tsx`), então a
 * conta é feita uma vez e vale enquanto a fatia e o tamanho não mudarem.
 *
 * ## O limite, medido antes de escrever
 *
 * Rótulo dentro do território não nomeia um mundo inteiro, e isso é propriedade
 * de mapa-múndi, não defeito desta implementação. Medido na fatia de 2018, com
 * 176 entidades:
 *
 * | largura do mapa | nomes colocados |
 * |-----------------|-----------------|
 * | 900 px          | 25 (14%)        |
 * | 1200 px         | 41 (23%)        |
 * | 1600 px         | 58 (33%)        |
 * | 2600 px         | 86 (49%)        |
 *
 * Ou seja: nem dobrando o mapa se passa da metade. Quem fica de fora são os
 * países pequenos, e para eles o hover já responde. O ganho real está na faixa
 * do meio — a 1600 px entram França, Alemanha, Egito, Nigéria, Quênia, Polônia
 * e Marrocos, que são exatamente os nomes por onde alguém se orienta ao estudar.
 * Atlas de papel resolve o resto com linha-guia e com prancha regional; nenhum
 * dos dois cabe aqui ainda.
 *
 * O critério é ELE CABER, e não a área do país: nome curto em país estreito
 * entra (Chile não, Peru sim), e escrever por cima da fronteira do vizinho seria
 * afirmar território errado.
 */

export interface Rotulo {
  nome: string;
  /** Centro do texto, em pixels do canvas. */
  x: number;
  y: number;
}

export interface OpcoesRotulos {
  feicoes: readonly FatiaFeature[];
  projecao: GeoProjection;
  /**
   * Largura do texto em pixels.
   *
   * Injetada porque só quem tem o contexto do canvas sabe medir de verdade, e
   * porque assim o teste roda sem canvas — no jsdom `measureText` não existe.
   */
  medir: (texto: string) => number;
  /** Altura da linha, em pixels. */
  fonte: number;
}

/**
 * O maior polígono de uma feição, isolado.
 *
 * O rótulo vai na maior parte, não no conjunto: o centroide dos Estados Unidos
 * com o Alasca somado cai no Canadá, e o de um país com ilha distante cai no
 * mar. Uma parte só, a maior, é sempre um lugar que existe.
 */
export function maiorPoligono(f: FatiaFeature): Polygon | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Polygon") return g as Polygon;
  if (g.type !== "MultiPolygon") return null;

  let melhor: Polygon | null = null;
  let area = -1;
  for (const aneis of g.coordinates as Position[][][]) {
    const p: Polygon = { type: "Polygon", coordinates: aneis };
    const a = geoArea(p);
    if (a > area) {
      area = a;
      melhor = p;
    }
  }
  return melhor;
}

/** Quantas divisões a grade de recurso usa em cada eixo. */
const GRADE = 24;

/**
 * Um ponto DENTRO do polígono, para o texto não flutuar no mar.
 *
 * O centroide serve na grande maioria, e falha justamente nas formas em que
 * falharia à mão: em 2018 são Croácia, Haiti, Israel e Vietnã — países em
 * crescente ou em fita, cujo centro geométrico cai fora do próprio território.
 * Em 1492, com muitas entidades de forma irregular, são 290.
 *
 * O recurso é uma varredura em grade pela caixa envolvente, escolhendo o ponto
 * interior mais afastado das bordas. É um "polo de inacessibilidade" pobre —
 * mede folga contra a caixa e não contra a fronteira real —, e é barato o
 * bastante para rodar só nos poucos casos que chegam aqui. Devolver `null` é
 * resposta legítima: melhor um país sem nome que um nome no lugar errado.
 */
export function ancoraDe(pol: Polygon): [number, number] | null {
  const centro = geoCentroid(pol);
  if (geoContains(pol, centro)) return centro;

  let x0 = 180;
  let y0 = 90;
  let x1 = -180;
  let y1 = -90;
  for (const anel of pol.coordinates) {
    for (const [x, y] of anel as Position[]) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }

  let melhor: [number, number] | null = null;
  let folgaMaxima = -1;
  for (let i = 1; i < GRADE; i++) {
    for (let j = 1; j < GRADE; j++) {
      const p: [number, number] = [
        x0 + ((x1 - x0) * i) / GRADE,
        y0 + ((y1 - y0) * j) / GRADE,
      ];
      if (!geoContains(pol, p)) continue;
      const folga = Math.min(p[0] - x0, x1 - p[0], p[1] - y0, y1 - p[1]);
      if (folga > folgaMaxima) {
        folgaMaxima = folga;
        melhor = p;
      }
    }
  }
  return melhor;
}

interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const seCruzam = (a: Caixa, b: Caixa) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Folga entre dois rótulos, em pixels, para não se encostarem. */
const RESPIRO = 2;

/**
 * Escolhe e posiciona os nomes que cabem.
 *
 * A ordem é por área decrescente e é o que decide os empates: quando dois nomes
 * disputam o mesmo espaço, fica o do país maior. Sem uma ordem fixa, a mesma
 * fatia produziria mapas diferentes a cada carga.
 *
 * O teste de caber vem ANTES da busca de âncora, e não por elegância: em 1492
 * são 1.307 entidades, e procurar âncora para todas custaria mais de cem mil
 * testes de contenção para depois descartar 985 por não caber o nome.
 */
export function colocarRotulos({
  feicoes,
  projecao,
  medir,
  fonte,
}: OpcoesRotulos): Rotulo[] {
  const caminho = geoPath(projecao);

  /* Uma entidade, um rótulo: a Itália aparece em 5 feições e se nomeia uma vez. */
  const porNome = new Map<string, { pol: Polygon; area: number }>();
  for (const f of feicoes) {
    const nome = f.properties?.n;
    if (!nome) continue;
    const pol = maiorPoligono(f);
    if (!pol) continue;
    const area = geoArea(pol);
    const atual = porNome.get(nome);
    if (!atual || area > atual.area) porNome.set(nome, { pol, area });
  }

  const candidatos: (Rotulo & { area: number; caixa: Caixa })[] = [];
  for (const [nome, { pol, area }] of porNome) {
    const largura = medir(nome);
    const [[bx0, by0], [bx1, by1]] = caminho.bounds(pol);
    if (!Number.isFinite(bx0) || largura > bx1 - bx0 || fonte > by1 - by0) continue;

    const ancora = ancoraDe(pol);
    if (!ancora) continue;
    const xy = projecao(ancora);
    if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) continue;

    const [x, y] = xy;
    candidatos.push({
      nome,
      x,
      y,
      area,
      caixa: {
        x0: x - largura / 2 - RESPIRO,
        y0: y - fonte / 2 - RESPIRO,
        x1: x + largura / 2 + RESPIRO,
        y1: y + fonte / 2 + RESPIRO,
      },
    });
  }

  candidatos.sort((a, b) => b.area - a.area || a.nome.localeCompare(b.nome));

  const postos: Caixa[] = [];
  const rotulos: Rotulo[] = [];
  for (const c of candidatos) {
    if (postos.some((p) => seCruzam(c.caixa, p))) continue;
    postos.push(c.caixa);
    rotulos.push({ nome: c.nome, x: c.x, y: c.y });
  }
  return rotulos;
}
