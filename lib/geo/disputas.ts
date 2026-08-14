import { geoContains } from "d3-geo";
import type { Polygon, Position } from "geojson";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";
import type { PaisFeature } from "./mundo";
import type { Alpha3 } from "./iso";

/**
 * Território cuja soberania está em disputa aberta.
 *
 * Isto NÃO é o mesmo que o `entidades` do período, que marca o país inteiro
 * como dividido — foi feito para a Alemanha de 1949, onde o território todo
 * abrigava dois Estados. Aplicar aquele mecanismo aqui hachuraria a Sibéria
 * por causa da Crimeia, e o mapa afirmaria algo muito maior que a disputa.
 *
 * Aqui a marca é do polígono, não do país.
 */
export interface Disputa {
  id: string;
  nome: string;
  /** Ponto dentro do polígono, usado para achá-lo na base cartográfica. */
  ponto: [number, number];
  /** A quem a BASE atribui o polígono — não é a posição do atlas. */
  atribuidoNaBase: Alpha3;
  /** Antes disto o atlas não desenha o território como parte do país. */
  desde: string;
  nota: string;
}

/**
 * A Crimeia vem atribuída à Rússia no Natural Earth, que é a base do
 * world-atlas. Herdar essa atribuição em silêncio seria tomar partido por
 * omissão; trocá-la em silêncio também. O atlas mostra a disputa.
 */
export const DISPUTAS: readonly Disputa[] = [
  {
    id: "crimeia",
    nome: "Crimeia e Sebastopol",
    ponto: [34, 45.2],
    atribuidoNaBase: "RUS",
    desde: "2014",
    nota:
      "A Rússia anexou a península em março de 2014, após um referendo realizado sob ocupação militar. A Resolução 68/262 da Assembleia Geral da ONU, de 27 de março de 2014, afirmou a integridade territorial da Ucrânia e considerou o referendo sem validade — aprovada com 100 votos a favor, 11 contra e 58 abstenções. A maior parte dos Estados não reconhece a anexação. A base cartográfica usada por este atlas, o Natural Earth, atribui o polígono à Rússia; o atlas não herda essa atribuição em silêncio nem a troca em silêncio.",
  },
];

export interface TerritorioDisputado {
  alpha3: Alpha3;
  feature: PaisFeature;
  disputa: Disputa;
}

function poligonosDe(f: PaisFeature): Position[][][] {
  const g = f.geometry;
  if (g.type === "MultiPolygon") return g.coordinates as Position[][][];
  if (g.type === "Polygon") return [(g as Polygon).coordinates as Position[][]];
  return [];
}

/** A disputa cujo ponto cai dentro deste polígono, se houver. */
export function disputaDoPoligono(
  coordinates: Position[][],
  alpha3: Alpha3
): Disputa | undefined {
  const poly: Polygon = { type: "Polygon", coordinates };
  return DISPUTAS.find(
    (d) => d.atribuidoNaBase === alpha3 && geoContains(poly, d.ponto)
  );
}

/**
 * Recorta os territórios disputados do país. NÃO depende do tempo.
 *
 * Qual polígono é a Crimeia não muda com o ano — só muda se ele conta como
 * disputado naquele instante. Separar as duas coisas é o que permite fazer
 * este recorte uma vez só, na carga, em vez de a cada mexida na barra.
 */
export function extrairDisputados(
  f: PaisFeature,
  alpha3: Alpha3
): { resto: PaisFeature; disputados: TerritorioDisputado[] } {
  const partes = poligonosDe(f);

  const dentro: Position[][][] = [];
  const disputados: TerritorioDisputado[] = [];

  for (const coordinates of partes) {
    const disputa = disputaDoPoligono(coordinates, alpha3);
    if (!disputa) {
      dentro.push(coordinates);
      continue;
    }
    disputados.push({
      alpha3,
      disputa,
      feature: {
        type: "Feature",
        properties: f.properties,
        geometry: { type: "Polygon", coordinates },
      },
    });
  }

  if (disputados.length === 0) return { resto: f, disputados };

  return {
    resto: {
      type: "Feature",
      properties: f.properties,
      geometry: { type: "MultiPolygon", coordinates: dentro },
    },
    disputados,
  };
}

/**
 * A disputa já começou neste instante?
 *
 * Antes disso o polígono não acende como parte do país — o atlas não
 * desenharia a Crimeia como russa em 1800. Ele desce para o fundo, pelo
 * mesmo critério do ultramar: continua sendo terra, sem ser atribuído.
 */
export function disputaVigente(d: Disputa, anoFrac: number): boolean {
  return anoFrac >= anoFracionarioDe(d.desde);
}

/**
 * Ids das disputas em vigor neste instante.
 *
 * Devolve ids, e não o instante, porque isso muda pouquíssimo: uma vez, em
 * 2014. É o que permite a tela redesenhar o mundo só quando algo de fato
 * mudou, em vez de a cada ano que a barra atravessa.
 */
export function idsDeDisputasVigentes(anoFrac: number): string[] {
  return DISPUTAS.filter((d) => disputaVigente(d, anoFrac)).map((d) => d.id);
}
