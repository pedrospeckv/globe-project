import { feature } from "topojson-client";
import { geoArea, geoDistance } from "d3-geo";
import type { Feature, Geometry, Polygon, Position } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { alpha3De, type Alpha3 } from "./iso";
import { separarDisputados, type TerritorioDisputado } from "./disputas";

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
 * Separação, em graus, a partir da qual uma parte do país é tratada como
 * território ultramarino.
 *
 * Vinte graus deixa passar o Havaí (~37° do continente) e a Guiana Francesa
 * (~65°), e mantém o Alasca, a Crimeia, Kaliningrado, Sacalina, Hainan e as
 * ilhas do Japão, todas coladas ou quase ao território principal.
 */
export const SEPARACAO_ULTRAMAR = 20;

function paraPoligonos(g: Geometry): Position[][][] {
  if (g.type === "MultiPolygon") return g.coordinates as Position[][][];
  if (g.type === "Polygon") return [(g as Polygon).coordinates as Position[][]];
  return [];
}

function vertices(anel: Position[][]): Position[] {
  return anel.flat();
}

/** Menor distância angular, em graus, entre dois conjuntos de vértices. */
function separacao(a: Position[], b: Position[]): number {
  let min = Infinity;
  for (const p of a) {
    for (const q of b) {
      const d = geoDistance(p as [number, number], q as [number, number]);
      if (d < min) min = d;
    }
  }
  return (min * 180) / Math.PI;
}

/**
 * Parte o país entre território principal e ultramar.
 *
 * O atlas não tem geometria histórica: desenha a forma moderna em todos os
 * períodos. Isso é uma aproximação tolerável para uma fronteira que andou
 * algumas centenas de quilômetros, e absurda para um território em outro
 * continente — com a França acesa em 1200, a Guiana Francesa acendia junto,
 * na América do Sul, três séculos antes de a Europa chegar lá.
 *
 * O ultramar não some do mapa: volta para a camada de fundo, desenhado como
 * terra, apenas sem ser atribuído ao país naquele período.
 */
export function separarUltramar(f: PaisFeature): {
  principal: PaisFeature | null;
  ultramar: PaisFeature | null;
} {
  const partes = paraPoligonos(f.geometry);
  if (partes.length <= 1) return { principal: f, ultramar: null };

  const comArea = partes.map((coordinates) => ({
    coordinates,
    area: geoArea({ type: "Polygon", coordinates } as Polygon),
  }));
  const maior = comArea.reduce((a, b) => (b.area > a.area ? b : a));
  const verticesDoMaior = vertices(maior.coordinates);

  const dentro: Position[][][] = [];
  const fora: Position[][][] = [];
  for (const parte of comArea) {
    if (parte === maior) {
      dentro.push(parte.coordinates);
      continue;
    }
    const longe =
      separacao(vertices(parte.coordinates), verticesDoMaior) > SEPARACAO_ULTRAMAR;
    (longe ? fora : dentro).push(parte.coordinates);
  }

  const monta = (coords: Position[][][]): PaisFeature | null =>
    coords.length === 0
      ? null
      : {
          type: "Feature",
          properties: f.properties,
          geometry: { type: "MultiPolygon", coordinates: coords },
        };

  return { principal: monta(dentro), ultramar: monta(fora) };
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
  doAtlas: readonly Alpha3[],
  /** Instante atual. Sem ele, nenhuma disputa é marcada. */
  anoFrac?: number
): {
  curados: PaisCurado[];
  fundo: PaisFeature[];
  disputados: TerritorioDisputado[];
} {
  const alvo = new Set<string>(doAtlas);
  const curados: PaisCurado[] = [];
  const fundo: PaisFeature[] = [];
  const disputados: TerritorioDisputado[] = [];

  for (const f of mundo) {
    const a3 = f.id === undefined ? undefined : alpha3De(f.id as string | number);
    if (!a3 || !alvo.has(a3)) {
      fundo.push(f);
      continue;
    }

    const { principal, ultramar } = separarUltramar(f);
    if (ultramar) fundo.push(ultramar);
    if (!principal) continue;

    if (anoFrac === undefined) {
      curados.push({ alpha3: a3, feature: principal });
      continue;
    }

    const separado = separarDisputados(principal, a3, anoFrac);
    if (separado.principal) curados.push({ alpha3: a3, feature: separado.principal });
    if (separado.aindaNao) fundo.push(separado.aindaNao);
    disputados.push(...separado.disputados);
  }

  return { curados, fundo, disputados };
}
