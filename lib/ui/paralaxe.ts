/**
 * A matemática da paralaxe do episódio, separada do componente de propósito.
 *
 * O efeito depende de `requestAnimationFrame`, que só dispara enquanto a
 * página compõe quadros — num navegador sem janela visível ele simplesmente
 * não é chamado, e não há como observar o resultado de fora. Uma função pura
 * move a parte que pode estar errada para onde ela é verificável: dado onde o
 * bloco está na tela, quanto a foto desliza e quanto a moldura cresce.
 *
 * O componente fica com o que sobra — ler o DOM, agendar o quadro, escrever o
 * `style` —, que é justamente o que não tem como dar errado em silêncio.
 */

/** Fração da folga de altura da imagem que o deslize consome de ponta a ponta. */
export const CURSO = 0.9;

/** Escala da moldura no centro da tela e nas pontas do percurso. */
const ESCALA_MINIMA = 0.985;
const GANHO_DE_ESCALA = 0.025;

export interface PosicaoNaTela {
  /** `top` do retângulo do bloco, em pixels, com zero no alto da janela. */
  topo: number;
  /** Altura do recorte visível — a moldura, não a imagem. */
  altura: number;
  /** Altura da janela. */
  alturaDaTela: number;
  /** Quanto a imagem excede a moldura: `offsetHeight` menos `altura`. */
  folga: number;
}

/**
 * −1 quando o bloco está entrando pelo rodapé, 0 no centro exato da tela,
 * +1 quando está saindo pelo topo.
 *
 * É a única grandeza do efeito: dela saem o deslize e a escala. O
 * denominador soma meia tela com meio bloco porque o percurso vai de
 * "encostando embaixo" a "encostando em cima", e não de borda a borda da
 * janela — sem isso, blocos altos nunca alcançariam os extremos.
 */
export function progressoNaTela({ topo, altura, alturaDaTela }: PosicaoNaTela): number {
  const centroDoBloco = topo + altura / 2;
  const meiaTela = alturaDaTela / 2;
  const percurso = meiaTela + altura / 2;
  if (percurso <= 0) return 0;
  return Math.max(-1, Math.min(1, (meiaTela - centroDoBloco) / percurso));
}

export interface Paralaxe {
  /** Deslocamento vertical da imagem dentro da moldura, em pixels. */
  deslize: number;
  /** Escala da moldura: perto de 1 no centro, menor nas pontas. */
  escala: number;
}

export function paralaxeDe(posicao: PosicaoNaTela): Paralaxe {
  const progresso = progressoNaTela(posicao);
  /*
   * Metade da folga para cada lado: no extremo o deslize é `folga/2 * CURSO`,
   * e com CURSO < 1 sobra margem para a borda da imagem nunca aparecer.
   */
  const deslize = (progresso * Math.max(0, posicao.folga) * CURSO) / 2;
  const proximidade = 1 - Math.abs(progresso);
  return { deslize, escala: ESCALA_MINIMA + proximidade * GANHO_DE_ESCALA };
}
