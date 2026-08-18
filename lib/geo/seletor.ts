import { geoPath } from "d3-geo";
import { criarProjecao } from "./projecao";
import type { FatiaFeature } from "./fatias";

/**
 * Descobre qual polígono da fatia está sob o ponteiro.
 *
 * ## Por que canvas de cor e não projeção inversa
 *
 * O caminho óbvio seria inverter a projeção — do pixel para lon/lat — e usar
 * `geoContains`, como `disputas.ts` já faz com pontos conhecidos. Não dá: a
 * projeção do atlas é uma interpolação escrita à mão entre a ortográfica e a
 * equirretangular (ver `criarProjecao`), e o raw dela não tem `.invert`.
 * Interpolar duas projeções é fácil; inverter a interpolação não é.
 *
 * Então o teste vira gráfico. Cada feição é pintada num canvas fora da tela
 * com uma cor que É o seu índice, e a consulta lê um pixel. O custo por
 * movimento do mouse é constante, independente de a fatia ter 240 polígonos
 * ou os 1946 de 1492 — e usa a MESMA projeção da tela, então não existe a
 * possibilidade de o alvo do hover discordar do que está desenhado.
 *
 * O canvas é redesenhado só quando a fatia, o giro ou o tamanho mudam.
 * Arrastar o globo custa um redesenho por quadro, que é o mesmo que a camada
 * visível já paga.
 */

/** Índice da feição virando cor. O zero fica livre para "nada aqui". */
function corDoIndice(i: number): string {
  const n = i + 1;
  return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`;
}

function indiceDaCor(r: number, g: number, b: number): number {
  return ((r << 16) | (g << 8) | b) - 1;
}

export interface OpcoesSeletor {
  fatia: readonly FatiaFeature[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  /** Ampliação e deslocamento da vista. Ver `OpcoesProjecao`. */
  zoom?: number;
  deslocamento?: [number, number];
}

export interface Seletor {
  /** A feição sob o ponto, em pixels relativos ao canvas. */
  em(x: number, y: number): FatiaFeature | null;
}

/**
 * Um canvas 2d fora da tela, ou `null` onde não houver.
 *
 * O jsdom dos testes não implementa `getContext`, e o seletor precisa
 * degradar para "não sei quem está aqui" em vez de estourar — hover é
 * enfeite, e enfeite não pode derrubar o mapa.
 */
function contextoOculto(
  largura: number,
  altura: number
): CanvasRenderingContext2D | null {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(largura, altura);
      return c.getContext("2d", {
        willReadFrequently: true,
      }) as unknown as CanvasRenderingContext2D | null;
    }
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = largura;
    c.height = altura;
    return c.getContext("2d", { willReadFrequently: true });
  } catch {
    return null;
  }
}

export function criarSeletor(opcoes: OpcoesSeletor): Seletor {
  const { fatia, largura, altura, alpha, rotacao, zoom, deslocamento } = opcoes;
  const ctx = contextoOculto(largura, altura);

  if (ctx) {
    /*
     * Sem traço, só preenchimento opaco — e o alfa é o que salva a consulta.
     *
     * A borda antisserrilhada mistura as cores de dois vizinhos, e a cor
     * misturada decodifica para um índice VÁLIDO, de um terceiro país
     * qualquer. Medido na tela: passar o mouse pela Ásia de 1500 devolvia
     * "Innu", um povo norte-americano, em cima de uma fronteira. Validar o
     * índice contra o tamanho da lista não pega isso.
     *
     * O que pega é o alfa. Preenchimento opaco deixa o interior com alfa 255
     * e SÓ a franja antisserrilhada com alfa parcial, então recusar tudo que
     * não for 255 descarta exatamente os pixels de mistura. O custo é uma
     * linha morta de um pixel na fronteira, onde a consulta diz "nada" — e
     * dizer nada ali é correto, porque ali realmente não se sabe.
     */
    const path = geoPath(
      criarProjecao({ largura, altura, alpha, rotacao, zoom, deslocamento }),
      ctx
    );
    ctx.clearRect(0, 0, largura, altura);
    for (let i = 0; i < fatia.length; i++) {
      ctx.beginPath();
      path(fatia[i]);
      ctx.fillStyle = corDoIndice(i);
      ctx.fill();
    }
  }

  return {
    em(x, y) {
      if (!ctx) return null;
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= largura || py >= altura) return null;
      try {
        const [r, g, b, a] = ctx.getImageData(px, py, 1, 1).data;
        // Só pixel cheio. Alfa parcial é franja de antisserrilhado, e a cor
        // dela é mistura de dois vizinhos — não é o índice de ninguém.
        if (a !== 255) return null;
        const i = indiceDaCor(r, g, b);
        return i >= 0 && i < fatia.length ? fatia[i] : null;
      } catch {
        return null;
      }
    },
  };
}
