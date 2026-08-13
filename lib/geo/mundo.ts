import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { alpha3De, type Alpha3 } from "./iso";

export type PaisFeature = Feature<Geometry, { name?: string }>;

export interface PaisCurado {
  alpha3: Alpha3;
  feature: PaisFeature;
}

/**
 * Carrega o world-atlas 110m do pacote — não da rede. Isso mantém o build
 * offline e o teste determinístico.
 */
export async function carregarMundo(): Promise<PaisFeature[]> {
  const mod = await import("world-atlas/countries-110m.json");
  const topology = ((mod as { default?: unknown }).default ?? mod) as Topology;
  const colecao = topology.objects.countries as GeometryCollection;
  return feature(topology, colecao).features as PaisFeature[];
}

/**
 * Divide o mundo em duas listas: os países do atlas (que vão para o SVG
 * interativo) e todo o resto (que vai para o canvas decorativo).
 *
 * A divisão técnica coincide com a curadoria — o que é interativo é
 * exatamente o que está aceso.
 */
export function separarPaises(
  mundo: PaisFeature[],
  doAtlas: readonly Alpha3[]
): { curados: PaisCurado[]; fundo: PaisFeature[] } {
  const alvo = new Set<string>(doAtlas);
  const curados: PaisCurado[] = [];
  const fundo: PaisFeature[] = [];

  for (const f of mundo) {
    const a3 = f.id === undefined ? undefined : alpha3De(f.id as string | number);
    if (a3 && alvo.has(a3)) {
      curados.push({ alpha3: a3, feature: f });
    } else {
      fundo.push(f);
    }
  }

  return { curados, fundo };
}
