import { feature } from "topojson-client";
import type { Feature, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import indice from "./fatias-indice.json";

/**
 * Camada de fundo: as fronteiras aproximadas do mundo numa data.
 *
 * O globo desenha nove países modernos com dossiê escrito. Isto é o CONTEXTO
 * — o que mais existia naquele momento. Não é clicável e não tem id do atlas,
 * e é por isso que não precisa entrar no espaço de nomes de `iso.ts`: nada
 * aponta para um polígono daqui, então nenhum link pode apodrecer.
 *
 * Gerado por `scripts/construir-fatias-historicas.ts`. Ver a licença em
 * `public/geo/fatias/LICENCA.md` — CC-BY-SA, share-alike, crédito obrigatório.
 */

export interface FatiaIndice {
  /** Nome do arquivo do upstream, mantido para rastreabilidade. */
  nome: string;
  ano: number;
  feicoes: number;
  bytes: number;
  /** Distribuição de precisão de fronteira declarada pela fonte. */
  precisoes: Record<string, number>;
}

export interface PropsFatia {
  /** Nome da entidade política. */
  n?: string;
  /** A quem era subordinada; ausente quando é a própria. */
  s?: string;
  /** Precisão da fronteira segundo a fonte. Quanto menor, menos confiável. */
  p?: number;
}

export type FatiaFeature = Feature<Geometry, PropsFatia>;

/*
 * O JSON é lido através desta forma porque o TypeScript infere dos literais
 * um tipo por combinação de chaves de `precisoes` — `{"1": number, "3"?:
 * undefined}` e outras cinco variantes —, e nenhuma delas casa com
 * `Record<string, number>`. A forma declarada é a que o código usa.
 */
const dados = indice as unknown as {
  atribuicao: { fonte: string; autor: string; url: string; licenca: string };
  simplificacao: { quantil: number; quantizacao: number };
  fatias: FatiaIndice[];
};

export const ATRIBUICAO = dados.atribuicao;

/** As fatias disponíveis, da mais antiga para a mais recente. */
export const FATIAS: readonly FatiaIndice[] = dados.fatias;

/**
 * Precisão a partir da qual a fronteira é tratada como firme.
 *
 * A distribuição no conjunto é quase binária — 11 mil polígonos em 1 e 6,5
 * mil em 3 —, então o corte em 2 separa exatamente as duas populações: as
 * fatias antigas, onde a linha é conjectura, das modernas, onde é registro.
 */
export const PRECISAO_FIRME = 2;

/**
 * O nome da entidade, ou `undefined` quando a fonte não atribui nenhuma.
 *
 * Cerca de 17% dos polígonos são anônimos — em `bc323`, metade. São terras
 * que o dataset desenha sem dono conhecido, e a tela deve desenhá-las e não
 * rotulá-las nem torná-las alvo de hover: inventar rótulo para um polígono
 * anônimo é afirmar um Estado que a fonte não afirma.
 */
export function rotuloDaFatia(f: FatiaFeature): string | undefined {
  return f.properties?.n || undefined;
}

/** A fronteira deste polígono é conjectura, e a tela deve dizer isso. */
export function precisaoBaixa(f: FatiaFeature): boolean {
  const p = f.properties?.p;
  return p === undefined || p < PRECISAO_FIRME;
}

/**
 * A fatia vigente numa data: a mais recente que não passa dela.
 *
 * É "a última anterior ou igual", e não "a mais próxima", de propósito. Em
 * 1490 a mais próxima seria 1492, e o mapa mostraria arranjos pós-colombianos
 * dois anos antes de existirem. Preferir a anterior atrasa o mapa, o que é
 * visível e honesto, em vez de adiantá-lo, o que é invisível e falso.
 *
 * Quem chama precisa dizer na tela de que ano é a fatia que está vendo — é a
 * mesma regra do §12: declarar a limitação em vez de escondê-la.
 */
export function fatiaPara(anoFrac: number): FatiaIndice {
  let escolhida = FATIAS[0];
  for (const f of FATIAS) {
    if (f.ano <= anoFrac) escolhida = f;
    else break;
  }
  return escolhida;
}

/**
 * Quanto a fatia está defasada em relação à data pedida, em anos.
 *
 * Serve para a interface graduar o aviso: 8 anos de defasagem em 1492 é
 * detalhe, 900 anos entre duas fatias antigas é outra conversa.
 */
export function defasagemDaFatia(anoFrac: number): number {
  return Math.max(0, Math.round(anoFrac - fatiaPara(anoFrac).ano));
}

/**
 * Cache de PROMESSAS, não de resultados.
 *
 * Guardar o resultado deixava dois chamadores simultâneos errarem o cache,
 * porque nenhum dos dois havia resolvido ainda — e o efeito apareceu na
 * primeira medição: `2010.json` foi buscado duas vezes num único load. Com a
 * promessa no cache, o segundo pedido entra na requisição que já está no ar.
 *
 * Promessa que rejeita é retirada do mapa, senão o primeiro erro de rede
 * ficaria memoizado e nenhuma tentativa posterior teria chance.
 */
const cache = new Map<string, Promise<FatiaFeature[]>>();

/**
 * Busca uma fatia e devolve as feições.
 *
 * Só roda no cliente: o caminho é relativo à origem, e são 4,5 MB no total
 * que não podem entrar no bundle nem no payload de SSG. Uma fatia por vez,
 * ~85 kB em média, guardada em memória depois da primeira vez — arrastar a
 * barra de tempo de um lado a outro busca no máximo 53 arquivos pequenos, e
 * ir e voltar não busca nada.
 */
export function carregarFatia(nome: string): Promise<FatiaFeature[]> {
  const emCache = cache.get(nome);
  if (emCache) return emCache;

  const pedido = (async () => {
    const resposta = await fetch(`/geo/fatias/${nome}.json`);
    if (!resposta.ok) {
      throw new Error(`fatia ${nome}: HTTP ${resposta.status}`);
    }
    const topologia = (await resposta.json()) as Topology;
    const colecao = topologia.objects.mundo as GeometryCollection;
    return feature(topologia, colecao).features as FatiaFeature[];
  })().catch((e: unknown) => {
    cache.delete(nome);
    throw e;
  });

  cache.set(nome, pedido);
  return pedido;
}

/** Esquece as fatias em memória. Existe para o teste, não para a tela. */
export function limparCacheDeFatias(): void {
  cache.clear();
}
