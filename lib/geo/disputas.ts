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
 */
interface DisputaBase {
  id: string;
  nome: string;
  /** Antes disto o atlas não marca o território como disputado. */
  desde: string;
  nota: string;
}

/**
 * Disputa cujo território a base cartográfica já separa num polígono próprio.
 *
 * É o caso da Crimeia: o Natural Earth a desenha como um polígono à parte,
 * atribuído à Rússia. Dá para recortá-lo e hachurá-lo sem tocar no resto do
 * país — a marca é do polígono, não do país.
 */
export interface DisputaRecortada extends DisputaBase {
  recorte: "poligono";
  /** Ponto dentro do polígono, usado para achá-lo na base cartográfica. */
  ponto: [number, number];
  /** A quem a BASE atribui o polígono — não é a posição do atlas. */
  atribuidoNaBase: Alpha3;
}

/**
 * Disputa cujo território a base NÃO separa: ele vem fundido ao corpo dos
 * países que o administram.
 *
 * É o caso da Caxemira, e a diferença não é de grau. Medido nas três
 * resoluções que o world-atlas distribui, o ponto de Srinagar cai no mesmo
 * polígono de Nova Délhi e o de Aksai Chin no mesmo polígono de Pequim.
 * Aplicar aqui o recorte da Crimeia não hachuraria a Caxemira: hachuraria a
 * Índia inteira e a China inteira, afirmando no mapa que 12,5 milhões de km²
 * são de soberania contestada.
 *
 * Por isso esta variante não tem polígono. Ela põe um marcador num ponto e
 * escreve a nota nos dossiês de todos os países envolvidos. Um ponto não
 * afirma fronteira; um polígono desenhado por nós afirmaria — e desenhar a
 * Linha de Controle à mão seria tomar partido justamente sobre o que está
 * em disputa.
 */
export interface DisputaSemRecorte extends DisputaBase {
  recorte: "nenhum";
  /** Onde pôr o marcador. Não é fronteira nem centroide: é um alfinete. */
  centro: [number, number];
  /** Países do atlas que administram parte do território. */
  paises: readonly Alpha3[];
  /** Quem mais administra parte dele e não está no atlas. */
  forasteiros?: readonly string[];
}

export type Disputa = DisputaRecortada | DisputaSemRecorte;

/**
 * Fração do país acima da qual um recorte deixou de ser um território e
 * virou o país inteiro.
 *
 * Existe porque o erro é fácil e silencioso: basta apontar um `ponto` para
 * dentro do corpo principal de um país e o mecanismo hachura tudo, sem
 * reclamar. A Crimeia é 0,2% da Rússia; a Caxemira seria 100% da Índia. O
 * teste recusa qualquer disputa recortada acima deste limite.
 */
export const FRACAO_MAXIMA_RECORTE = 0.05;

/**
 * A Crimeia vem atribuída à Rússia no Natural Earth, que é a base do
 * world-atlas. Herdar essa atribuição em silêncio seria tomar partido por
 * omissão; trocá-la em silêncio também. O atlas mostra a disputa.
 */
export const DISPUTAS: readonly Disputa[] = [
  {
    id: "crimeia",
    recorte: "poligono",
    nome: "Crimeia e Sebastopol",
    ponto: [34, 45.2],
    atribuidoNaBase: "RUS",
    desde: "2014",
    nota:
      "A Rússia anexou a península em março de 2014, após um referendo realizado sob ocupação militar. A Resolução 68/262 da Assembleia Geral da ONU, de 27 de março de 2014, afirmou a integridade territorial da Ucrânia e considerou o referendo sem validade — aprovada com 100 votos a favor, 11 contra e 58 abstenções. A maior parte dos Estados não reconhece a anexação. A base cartográfica usada por este atlas, o Natural Earth, atribui o polígono à Rússia; o atlas não herda essa atribuição em silêncio nem a troca em silêncio.",
  },
  {
    id: "caxemira",
    recorte: "nenhum",
    nome: "Caxemira",
    centro: [76.5, 34.6],
    paises: ["IND", "CHN"],
    forasteiros: ["Paquistão"],
    desde: "1947",
    nota:
      "O principado de Jammu e Caxemira aderiu à Índia em outubro de 1947, sob invasão, e a guerra que se seguiu terminou numa linha de cessar-fogo em 1949 que nenhuma das partes reconhece como fronteira. O território é administrado hoje por três Estados: Índia no vale e em Jammu, Paquistão no Azad Caxemira e no Gilgit-Baltistão, China no Aksai Chin e no vale de Shaksgam. Houve novas guerras em 1965 e 1999 e confrontos recorrentes na Linha de Controle. Em 2019 a Índia revogou o estatuto especial do território e o dividiu em duas unidades administradas diretamente por Délhi; Paquistão e China contestaram a medida. A base cartográfica deste atlas não separa a região em polígono próprio — ela vem fundida ao corpo da Índia e ao da China —, e por isso o mapa marca a Caxemira com um alfinete e não com uma área. Desenhar a Linha de Controle à mão seria decidir, num traço, exatamente o que está em disputa.",
  },
];

/** Países do atlas envolvidos numa disputa, seja qual for o tipo dela. */
export function paisesDaDisputa(d: Disputa): readonly Alpha3[] {
  return d.recorte === "poligono" ? [d.atribuidoNaBase] : d.paises;
}

export interface TerritorioDisputado {
  alpha3: Alpha3;
  feature: PaisFeature;
  disputa: DisputaRecortada;
}

function poligonosDe(f: PaisFeature): Position[][][] {
  const g = f.geometry;
  if (g.type === "MultiPolygon") return g.coordinates as Position[][][];
  if (g.type === "Polygon") return [(g as Polygon).coordinates as Position[][]];
  return [];
}

/** Só as disputas que a base separa em polígono próprio. */
export function disputasRecortadas(): DisputaRecortada[] {
  return DISPUTAS.filter((d): d is DisputaRecortada => d.recorte === "poligono");
}

/** A disputa cujo ponto cai dentro deste polígono, se houver. */
export function disputaDoPoligono(
  coordinates: Position[][],
  alpha3: Alpha3
): DisputaRecortada | undefined {
  const poly: Polygon = { type: "Polygon", coordinates };
  return disputasRecortadas().find(
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
  return disputasRecortadas()
    .filter((d) => disputaVigente(d, anoFrac))
    .map((d) => d.id);
}

/**
 * Disputas sem polígono que já estão em vigor neste instante.
 *
 * Vão para a camada de marcadores, e não para a de áreas. É devolvida a
 * disputa inteira, e não só o id, porque o marcador precisa do ponto e do
 * nome — e são duas ou três, não duzentas.
 */
export function disputasSemRecorteVigentes(anoFrac: number): DisputaSemRecorte[] {
  return DISPUTAS.filter(
    (d): d is DisputaSemRecorte => d.recorte === "nenhum" && disputaVigente(d, anoFrac)
  );
}
