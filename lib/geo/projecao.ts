import {
  geoProjectionMutator,
  geoOrthographicRaw,
  geoEquirectangularRaw,
  geoDistance,
  type GeoProjection,
} from "d3-geo";

export interface OpcoesProjecao {
  largura: number;
  altura: number;
  /** 0 = globo, 1 = mapa plano. */
  alpha: number;
  /** [lambda, phi] em graus. */
  rotacao?: [number, number];
}

/**
 * Escala em função do alpha: o globo ocupa mais tela que o mapa desenrolado,
 * senão o mundo plano vaza pelas bordas.
 */
export function escalaPara(alpha: number, largura: number): number {
  const base = largura / 4;
  return base * (1 - 0.4 * alpha);
}

/**
 * Meia esfera no globo, esfera inteira no mapa.
 *
 * O `geoOrthographic()` pronto do d3 já vem com `clipAngle(90)`; o mutator
 * não herda nada disso, e sem o corte a projeção devolve coordenada FINITA
 * para o lado oculto — o país não some, ele aparece espelhado por cima do
 * hemisfério visível. Com o Brasil no centro, China e Japão eram desenhados
 * a menos de 120px do meio da tela.
 *
 * A calota abre junto com o desenrolar em vez de saltar no fim: enquanto é
 * globo esconde o que está atrás, e quando vira mapa mostra o mundo inteiro.
 * Não chega a 180° porque o corte precisa de um ponto antípoda para costurar
 * o recorte — a folga de 0,1° fica abaixo de um pixel na tela.
 */
export function anguloDeCorte(alpha: number): number {
  return 90 + 89.9 * alpha;
}

/**
 * Interpola linearmente entre duas projeções BRUTAS (raw) do d3.
 *
 * Precisa ser no espaço raw, antes de escala e translação: interpolar as
 * projeções já compostas produziria distorção em vez de desenrolamento.
 *
 * É a assinatura visual do projeto — o mecanismo pelo qual o leitor sai de
 * "olhando o mundo" para "acompanhando a rota rente à costa".
 */
/**
 * O ponto está na face de frente?
 *
 * O `clipAngle` só age no fluxo do `geoPath` — chamar a projeção direto com
 * um par de coordenadas passa por fora do corte e devolve posição para o lado
 * oculto. Quem projeta ponto avulso, como o marcador de evento, precisa
 * perguntar aqui antes de desenhar.
 */
export function pontoVisivel(
  ponto: [number, number],
  opcoes: Pick<OpcoesProjecao, "alpha" | "rotacao">
): boolean {
  const [lambda, phi] = opcoes.rotacao ?? [0, 0];
  // `rotate` recebe o giro aplicado à esfera; o centro da vista é o oposto.
  const centro: [number, number] = [-lambda, -phi];
  return geoDistance(centro, ponto) <= (anguloDeCorte(opcoes.alpha) * Math.PI) / 180;
}

export function criarProjecao(opcoes: OpcoesProjecao): GeoProjection {
  const { largura, altura, alpha, rotacao = [0, 0] } = opcoes;

  /*
   * O @types/d3-geo declara o mutator como `() => GeoProjection`, sem
   * parâmetros. A tipagem está imprecisa: em runtime o d3 faz
   * `projectAt.apply(this, arguments)`, então os argumentos passados ao mutate
   * chegam ao factory. O cast reflete o comportamento real.
   */
  const mutate = geoProjectionMutator(
    (t: number) => (x: number, y: number) => {
      const [x0, y0] = geoOrthographicRaw(x, y);
      const [x1, y1] = geoEquirectangularRaw(x, y);
      return [x0 + t * (x1 - x0), y0 + t * (y1 - y0)];
    }
  ) as unknown as (t: number) => GeoProjection;

  return mutate(alpha)
    .scale(escalaPara(alpha, largura))
    .translate([largura / 2, altura / 2])
    .rotate([rotacao[0], rotacao[1]])
    .clipAngle(anguloDeCorte(alpha))
    .precision(0.5);
}
