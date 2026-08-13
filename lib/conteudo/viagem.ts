import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";

/** [longitude, latitude] — ordem GeoJSON, que é a que o d3-geo espera. */
export const Coordenada = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

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
  })
  .refine(
    (v) =>
      v.paradas.every(
        (p, i) => i === 0 || comparaData(p.data, v.paradas[i - 1].data) >= 0
      ),
    { message: "paradas devem estar em ordem cronológica", path: ["paradas"] }
  );

export type Coordenada = z.infer<typeof Coordenada>;
export type Parada = z.infer<typeof Parada>;
export type Viagem = z.infer<typeof Viagem>;

/** Coordenadas na ordem das paradas — vira o LineString do geoPath. */
export function coordenadasDe(v: Viagem): Coordenada[] {
  return v.paradas.map((p) => p.coords);
}
