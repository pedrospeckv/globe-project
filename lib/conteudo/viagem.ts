import { z } from "zod";
import { Coordenada, DataHistorica, Id, comparaData } from "./primitivos";

export { Coordenada };

export const Parada = z.object({
  local: z.string().min(1),
  data: DataHistorica,
  coords: Coordenada,
  textoMdx: z.string().optional(),
});

/**
 * A linha é derivada das paradas, nunca digitada. Como cada parada tem data
 * própria, o cliente consegue desenhar a rota até onde a frota havia chegado
 * conforme a barra de tempo avança (§8 do spec).
 */
export const Viagem = z
  .object({
    id: Id,
    titulo: z.string().min(1),
    paradas: z.array(Parada).min(2, "viagem precisa de ao menos duas paradas"),
    fontes: z.array(Id).default([]),
    /**
     * Contexto da viagem. Existe porque o traço no mapa não comporta ressalva:
     * a rota do Colombo desenha um desembarque em 12 de outubro de 1492 cuja
     * ilha é disputada até hoje, e a linha sozinha afirmaria uma certeza que
     * as fontes não têm.
     */
    textoMdx: z.string().optional(),
  })
  .refine(
    (v) =>
      v.paradas.every(
        (p, i) => i === 0 || comparaData(p.data, v.paradas[i - 1].data) >= 0
      ),
    { message: "paradas devem estar em ordem cronológica", path: ["paradas"] }
  );

export type Parada = z.infer<typeof Parada>;
export type Viagem = z.infer<typeof Viagem>;

/** Coordenadas na ordem das paradas — vira o LineString do geoPath. */
export function coordenadasDe(v: Viagem): Coordenada[] {
  return v.paradas.map((p) => p.coords);
}
