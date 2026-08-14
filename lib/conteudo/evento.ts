import { z } from "zod";
import { Coordenada, DataHistorica, Id, comparaData } from "./primitivos";
import { anoFracionarioDe } from "./tempo";

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
