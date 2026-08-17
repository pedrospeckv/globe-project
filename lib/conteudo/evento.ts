import { z } from "zod";
import { Coordenada, DataHistorica, Id, comparaData } from "./primitivos";
import { anoFracionarioDe } from "./tempo";
import { dentroDoPeriodo, type Periodo } from "./pais";
import { Imagem } from "./imagem";

/**
 * Um acontecimento datado num ponto do mapa.
 *
 * `fontes` é OPCIONAL, ao contrário de Alegacao. A diferença é deliberada e
 * carrega o sentido do modelo: alegação é afirmação contestada, e sem lastro
 * não pode ser publicada; evento é acontecimento datado e consolidado.
 * Exigir fonte dos dois borraria a linha que o projeto existe para traçar.
 *
 * Quando um acontecimento é disputado, ele não é evento — é alegação.
 */
export const Evento = z.object({
  id: Id,
  data: DataHistorica,
  titulo: z.string().min(1, "evento precisa de título"),
  ponto: Coordenada,
  /** ISO alpha-3 dos países envolvidos. Nunca vazio. */
  paises: z.array(z.string().regex(/^[A-Z]{3}$/)).min(1, "evento precisa de ao menos um país"),
  textoMdx: z.string().optional(),
  fontes: z.array(Id).default([]),
  /**
   * A imagem do acontecimento, quando existe uma licenciada.
   *
   * Opcional e vai continuar sendo: a maior parte do que o atlas cobre não tem
   * registro visual disponível sob licença livre, e pôr uma foto aproximada no
   * lugar — a praça hoje em vez do dia, um quadro do século seguinte — ilustra
   * ao custo de enganar. Sem imagem o período se lê igual; com imagem errada,
   * não.
   */
  imagem: Imagem.optional(),
});

export type Evento = z.infer<typeof Evento>;

function porData(a: Evento, b: Evento): number {
  return comparaData(a.data, b.data);
}

/**
 * Eventos dentro de uma janela de anos em torno do instante atual.
 *
 * Janela, e não "tudo que já aconteceu": o globo é o retrato de um momento,
 * e acumular sete séculos de marcadores até 2026 entulharia o mapa sem
 * comunicar nada.
 */
export function eventosEm(
  eventos: Evento[],
  anoFrac: number,
  janelaEmAnos: number
): Evento[] {
  return eventos
    .filter((e) => Math.abs(anoFracionarioDe(e.data) - anoFrac) <= janelaEmAnos)
    .sort(porData);
}

/** Eventos que envolvem um país, ordenados cronologicamente. */
export function eventosDoPais(eventos: Evento[], iso: string): Evento[] {
  return eventos.filter((e) => e.paises.includes(iso)).sort(porData);
}

/** Eventos de um país dentro de um período dele. */
export function eventosDoPeriodo(
  eventos: Evento[],
  iso: string,
  periodo: Periodo
): Evento[] {
  return eventosDoPais(eventos, iso).filter((e) =>
    dentroDoPeriodo(periodo, e.data)
  );
}
