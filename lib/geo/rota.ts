import type { Feature, LineString } from "geojson";
import { comparaData } from "@/lib/conteudo/primitivos";
import type { Viagem, Parada } from "@/lib/conteudo/viagem";

export type RotaFeature = Feature<LineString, { viagemId: string; titulo: string }>;

function paraFeature(viagem: Viagem, paradas: Parada[]): RotaFeature {
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: paradas.map((p) => p.coords),
    },
    properties: { viagemId: viagem.id, titulo: viagem.titulo },
  };
}

export function rotaCompleta(viagem: Viagem): RotaFeature {
  return paraFeature(viagem, viagem.paradas);
}

/** Paradas que já tinham acontecido na data informada. */
export function paradasAte(viagem: Viagem, data: string): Parada[] {
  return viagem.paradas.filter((p) => comparaData(p.data, data) <= 0);
}

/**
 * Trecho percorrido até a data — é o que faz a rota se desenhar conforme a
 * barra de tempo avança, em vez de aparecer inteira de uma vez.
 *
 * `null` com menos de duas paradas: uma linha de um ponto só não existe.
 */
export function rotaAte(viagem: Viagem, data: string): RotaFeature | null {
  const paradas = paradasAte(viagem, data);
  return paradas.length < 2 ? null : paraFeature(viagem, paradas);
}
