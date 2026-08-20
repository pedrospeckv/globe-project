import { feature } from "topojson-client";
import { geoArea, geoDistance } from "d3-geo";
import type { Feature, Geometry, Polygon, Position } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import {
  criarTraducaoIso,
  normalizarNumerico,
  type Alpha3,
  type PaisIdentificado,
} from "./iso";
import { extrairDisputados, type TerritorioDisputado } from "./disputas";

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

/**
 * A parte está a mais de `limite` graus do território principal?
 *
 * Sai no primeiro par próximo em vez de medir a distância exata: a pergunta
 * é binária, e a maioria das partes é vizinha do continente — Sacalina acha
 * um vértice colado nas primeiras comparações e nem chega a varrer o resto.
 */
function separadoPorMaisDe(a: Position[], b: Position[], limite: number): boolean {
  const limiteRad = (limite * Math.PI) / 180;
  for (const p of a) {
    for (const q of b) {
      if (geoDistance(p as [number, number], q as [number, number]) <= limiteRad) {
        return false;
      }
    }
  }
  return true;
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
    const longe = separadoPorMaisDe(
      vertices(parte.coordinates),
      verticesDoMaior,
      SEPARACAO_ULTRAMAR
    );
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
export interface PaisPreparado {
  alpha3: Alpha3;
  /** A feição como veio da base, para quando o país está apagado. */
  original: PaisFeature;
  /** Território principal, já sem ultramar e sem os polígonos disputados. */
  principal: PaisFeature | null;
  ultramar: PaisFeature | null;
  disputados: TerritorioDisputado[];
}

export interface MundoPreparado {
  paises: PaisPreparado[];
  /** Tudo que não é país do atlas. */
  resto: PaisFeature[];
}

/**
 * Decompõe o mundo uma vez só.
 *
 * Esta é a parte cara: o recorte de ultramar compara vértice a vértice. Ela
 * NÃO depende do tempo nem de quem está aceso, e por um período esteve dentro
 * do caminho que roda a cada mexida na barra — 200ms por quadro, a interface
 * inteira emperrada. Separar o que é estático do que é por instante é a razão
 * de esta função existir.
 */
export function prepararMundo(
  mundo: PaisFeature[],
  /**
   * Os países do acervo, com alpha-3 E código numérico.
   *
   * Recebia só os alpha-3 e consultava uma tabela global para traduzir. Passou a
   * receber os dois porque a tradução deixou de ser global: o número agora mora no
   * arquivo de cada país, para que adicionar um não exija tocar em arquivo
   * compartilhado. Ver `lib/geo/iso.ts`.
   */
  doAtlas: readonly PaisIdentificado[]
): MundoPreparado {
  const traducao = criarTraducaoIso(doAtlas);
  const paises: PaisPreparado[] = [];
  const resto: PaisFeature[] = [];

  for (const f of mundo) {
    const a3 = f.id === undefined ? undefined : traducao.alpha3De(f.id as string | number);
    if (!a3) {
      resto.push(f);
      continue;
    }

    const { principal, ultramar } = separarUltramar(f);
    if (!principal) {
      paises.push({
        alpha3: a3,
        original: f,
        principal: null,
        ultramar,
        disputados: [],
      });
      continue;
    }

    const { resto: semDisputa, disputados } = extrairDisputados(principal, a3);
    paises.push({
      alpha3: a3,
      original: f,
      principal: semDisputa,
      ultramar,
      disputados,
    });
  }

  return { paises, resto };
}

/**
 * Escolhe o que desenhar neste instante. Barato de propósito — só olha
 * datas e monta listas, sem tocar em geometria.
 */
export function separarPaises(
  preparado: MundoPreparado,
  acesos: readonly Alpha3[],
  /**
   * Ids das disputas em vigor. Recebe ids, e não o instante, porque isso
   * muda uma vez em toda a linha do tempo — e enquanto não muda, a tela não
   * precisa refazer nada.
   */
  disputasAtivas: readonly string[] = []
): {
  curados: PaisCurado[];
  fundo: PaisFeature[];
  disputados: TerritorioDisputado[];
} {
  const aceso = new Set<string>(acesos);
  const emVigor = new Set<string>(disputasAtivas);
  const curados: PaisCurado[] = [];
  const fundo: PaisFeature[] = [...preparado.resto];
  const disputados: TerritorioDisputado[] = [];

  for (const p of preparado.paises) {
    if (!aceso.has(p.alpha3)) {
      // Apagado: volta inteiro para o fundo, ultramar e disputa incluídos.
      fundo.push(p.original);
      continue;
    }

    if (p.ultramar) fundo.push(p.ultramar);
    if (p.principal) curados.push({ alpha3: p.alpha3, feature: p.principal });

    for (const d of p.disputados) {
      if (emVigor.has(d.disputa.id)) disputados.push(d);
      else fundo.push(d.feature);
    }
  }

  return { curados, fundo, disputados };
}

/** O que o país declarou, e o país do mapa que aquele código realmente aponta. */
export interface CodigoConferido {
  iso: Alpha3;
  isoNumerico: string;
  /** Nome como o `world-atlas` o traz, em inglês. */
  noMapa: string;
}

/**
 * Confere os códigos numéricos dos países contra a geometria empacotada.
 *
 * É o que faz `Pais.isoNumerico` ser afirmação CONFERÍVEL em vez de palavra do
 * contribuidor. Sem isto, tirar a tabela central de `iso.ts` só teria mudado o
 * lugar do erro: um número trocado faria o dossiê acender no polígono do vizinho,
 * ou não acender em lugar nenhum — e das duas, a segunda é a que passa
 * despercebida, porque um país que não acende parece um país que ainda não foi
 * escrito.
 *
 * Devolve a lista de problemas e a lista do que conferiu, em vez de estourar no
 * primeiro: quem roda o build quer saber tudo o que precisa arrumar.
 *
 * O nome do mapa volta junto de propósito. Nenhum programa sabe se o
 * contribuidor QUIS o Peru ou o Chile — mas imprimir `PER 604 → Peru` deixa um
 * humano ver num relance que o código plausível é o código certo.
 */
export function conferirCodigosDePais(
  mundo: readonly PaisFeature[],
  paises: readonly PaisIdentificado[]
): { problemas: string[]; conferidos: CodigoConferido[] } {
  const problemas: string[] = [];
  const conferidos: CodigoConferido[] = [];

  const nomePorNumerico = new Map<string, string>();
  for (const f of mundo) {
    if (f.id === undefined) continue;
    nomePorNumerico.set(
      normalizarNumerico(f.id as string | number),
      f.properties?.name ?? "(sem nome na base)"
    );
  }

  const vistosIso = new Map<string, string>();
  const vistosNumerico = new Map<string, string>();

  for (const p of paises) {
    const num = normalizarNumerico(p.isoNumerico);

    const isoRepetido = vistosIso.get(p.iso);
    if (isoRepetido) {
      problemas.push(
        `${p.iso}: dois países declaram o mesmo alpha-3 (o outro tem numérico ${isoRepetido})`
      );
    }
    vistosIso.set(p.iso, num);

    const numRepetido = vistosNumerico.get(num);
    if (numRepetido) {
      problemas.push(
        `${p.iso}: o código numérico ${num} já é de ${numRepetido} — um dos dois está errado`
      );
    }
    vistosNumerico.set(num, p.iso);

    const noMapa = nomePorNumerico.get(num);
    if (!noMapa) {
      problemas.push(
        `${p.iso}: não existe país com o código numérico ${num} na geometria ` +
          `empacotada, então o dossiê não teria onde acender — confira o ISO 3166-1 ` +
          `numérico (ver docs/adicionar-um-pais.md)`
      );
      continue;
    }
    conferidos.push({ iso: p.iso, isoNumerico: num, noMapa });
  }

  return { problemas, conferidos };
}
