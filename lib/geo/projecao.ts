import {
  geoProjectionMutator,
  geoOrthographicRaw,
  geoEquirectangularRaw,
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
 * Interpola linearmente entre duas projeções BRUTAS (raw) do d3.
 *
 * Precisa ser no espaço raw, antes de escala e translação: interpolar as
 * projeções já compostas produziria distorção em vez de desenrolamento.
 *
 * É a assinatura visual do projeto — o mecanismo pelo qual o leitor sai de
 * "olhando o mundo" para "acompanhando a rota rente à costa".
 */
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
    .precision(0.5);
}
