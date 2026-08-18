import { feature, neighbors } from "topojson-client";
import { geoArea } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import { atribuirBaldes, type Adjacencia } from "./cores";
import { nomeCanonico } from "./nomes";
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

export interface Atribuicao {
  fonte: string;
  autor: string;
  url?: string;
  licenca: string;
}

export interface FatiaIndice {
  /** Nome do arquivo do upstream, mantido para rastreabilidade. */
  nome: string;
  ano: number;
  feicoes: number;
  bytes: number;
  /** Distribuição de precisão de fronteira declarada pela fonte. */
  precisoes: Record<string, number>;
  /**
   * Geometria própria do atlas, e não baixada.
   *
   * Existe porque o vão entre as fatias do upstream é grande — 70 anos de
   * mediana depois de 500 a.C., e nada entre 2010 e hoje. Ver
   * `scripts/fatias-locais.ts` e `conteudo/fatias/manifesto.json`.
   */
  local?: boolean;
  /** Impressão digital do `.geojson` de origem. Só nas locais. */
  hash?: string;
  /** Procedência própria. Ausente quer dizer a do upstream. */
  atribuicao?: Atribuicao;
}

export interface PropsFatia {
  /** Nome da entidade política. */
  n?: string;
  /** A quem era subordinada; ausente quando é a própria. */
  s?: string;
  /** Precisão da fronteira segundo a fonte. Quanto menor, menos confiável. */
  p?: number;
  /**
   * Terra sem soberano: desenha como terra, com nome, e sem cor de identidade.
   *
   * Existe por causa da Antártida, que é o único caso conhecido. Ela não é
   * anônima — a base a nomeia — mas também não é de ninguém: o Tratado da
   * Antártida de 1959 suspende as reivindicações, e dar-lhe uma cor de
   * identidade como a de Brasil ou Chile afirmaria uma soberania que nenhum
   * Estado exerce.
   *
   * As duas alternativas foram piores. Retirá-la do mapa — o que esta base já
   * fez uma vez, por um erro meu — faz um continente desaparecer e afirma que
   * ali não há terra. Deixá-la sem nome devolveria "sem atribuição na fonte" no
   * hover, o que é falso: a fonte atribui um nome, só não atribui um dono.
   */
  ss?: boolean;
}

export type FatiaFeature = Feature<Geometry, PropsFatia>;

/*
 * O JSON é lido através desta forma porque o TypeScript infere dos literais
 * um tipo por combinação de chaves de `precisoes` — `{"1": number, "3"?:
 * undefined}` e outras cinco variantes —, e nenhuma delas casa com
 * `Record<string, number>`. A forma declarada é a que o código usa.
 */
const dados = indice as unknown as {
  atribuicao: Atribuicao;
  simplificacao: { quantil: number; quantizacao: number };
  fatias: FatiaIndice[];
};

export const ATRIBUICAO: Atribuicao = dados.atribuicao;

/**
 * A quem creditar a geometria que está na tela.
 *
 * A fatia local NÃO vem do upstream, e creditá-la a ele seria atribuição falsa
 * — o oposto do que a obrigação de crédito existe para garantir. A legenda
 * pergunta por fatia, e não uma vez para o mapa todo.
 */
export function atribuicaoDaFatia(f: FatiaIndice): Atribuicao {
  return f.atribuicao ?? ATRIBUICAO;
}

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
 * A próxima fatia depois da vigente, ou `null` se já é a última.
 *
 * A interface a usa para dizer até quando o mapa fica congelado. Saber que a
 * base é de 1400 é menos útil que saber que a seguinte é 1492: é isso que
 * informa que os 92 anos no meio aparecem todos iguais.
 */
export function proximaFatia(anoFrac: number): FatiaIndice | null {
  const vigente = fatiaPara(anoFrac);
  const i = FATIAS.indexOf(vigente);
  return i >= 0 && i + 1 < FATIAS.length ? FATIAS[i + 1] : null;
}

export type FaixaDeDefasagem = "exata" | "proxima" | "distante" | "remota";

/**
 * Limites das faixas, em anos, ancorados na densidade real do conjunto.
 *
 * De 500 a.C. em diante o vão MEDIANO entre fatias é 70 anos, com máximo de
 * 101. Antes disso os vãos vão de 500 a 3.000 anos, e o primeiro salta 113 mil.
 *
 * Daí os cortes: 40 anos é menos que metade do vão mediano, ou seja o melhor
 * que este dado consegue oferecer — avisar é honesto, alarmar seria ruído.
 * Acima de 150 anos a defasagem passou de duas fatias inteiras da faixa densa,
 * e o mapa deixou de ser retrato do ano escolhido.
 */
export const DEFASAGEM_PROXIMA = 40;
export const DEFASAGEM_DISTANTE = 150;

/**
 * Gradua a defasagem, para a interface poder avisar na medida.
 *
 * Existe porque a legenda dizia "17 anos atrás desta data" no mesmo tom em que
 * diria "900 anos". Com vão mediano de 70 anos, tratar os dois igual é o tipo
 * de engano silencioso que o §12 do spec manda evitar: não é uma informação
 * ausente, é uma informação apresentada como se fosse melhor do que é.
 */
export function faixaDeDefasagem(anos: number): FaixaDeDefasagem {
  if (anos <= 0) return "exata";
  if (anos <= DEFASAGEM_PROXIMA) return "proxima";
  if (anos <= DEFASAGEM_DISTANTE) return "distante";
  return "remota";
}

/**
 * Área acima da qual a feição é artefato, não território.
 *
 * Um esterradiano é ~8% da esfera. Nenhuma entidade histórica desta base
 * chega perto: a maior, o Império Britânico de 1920, fica bem abaixo.
 */
const AREA_ABSURDA = 1.0;

/**
 * Feições que a redução corrompeu, e que precisam ser ignoradas na tela.
 *
 * ## O defeito, medido
 *
 * `simplify` e `quantize` — os dois passos que fazem o conjunto caber em
 * 4,4 MB em vez de 85 MB — degeneram anéis pequenos. Anel de área zero na
 * esfera não é inofensivo: dependendo do sentido em que é percorrido, o
 * `d3-geo` o lê como TODO O PLANETA. A feição inteira passa a medir ~4π.
 *
 * O caso que denunciou: a Alemanha de 2010, com `geoArea` de 12,575 sr, ou
 * 100,1% da esfera. Como é o índice 184 de 240, pintava por cima de tudo
 * desenhado antes dela — e no hover respondia "Alemanha" em qualquer ponto do
 * mundo, inclusive no meio do Pacífico. Está em 38 das 53 fatias.
 *
 * ## Por que filtrar aqui, e não consertar o dado
 *
 * Porque três tentativas de consertar na origem falharam, e vale registrar
 * quais para ninguém repetir:
 *
 * 1. Rebobinar os anéis invertidos antes da topologia — os anéis NÃO estão
 *    invertidos na fonte. Sem reduzir nada, a fonte não tem nenhuma feição
 *    absurda. O estrago nasce na redução.
 * 2. Remover anéis degenerados na entrada — removeu 24 em 2010 e a Alemanha
 *    continuou cobrindo o globo, pelo mesmo motivo: ainda não degeneraram.
 * 3. Remover os anéis da topologia já quantizada, pelos índices de arco —
 *    `feature()` descarta polígonos vazios, então a correspondência
 *    posicional entre a geometria decodificada e `geometries[].arcs`
 *    desalinha. Apagou a Sicília e a Sardenha e não apagou o defeito.
 *
 * O filtro por área é o oposto disso: não tenta adivinhar qual anel está
 * errado, mede o resultado final e descarta o que é geometricamente
 * impossível. É barato, é verificável, e falha para o lado seguro — na pior
 * hipótese esconde uma feição, em vez de pintar o mundo com ela.
 *
 * Consertar a geometria de verdade continua pendente. O caminho que sobra é
 * guardar a versão íntegra, sem reduzir, das poucas feições que a redução
 * corrompe — são de uma a sete por fatia.
 */
export function feicaoAbsurda(f: FatiaFeature): boolean {
  return f.geometry !== null && geoArea(f) > AREA_ABSURDA;
}

/** As feições desenháveis: tudo que não é artefato de redução. */
export function feicoesUteis(
  fatia: readonly FatiaFeature[]
): FatiaFeature[] {
  return fatia.filter((f) => !feicaoAbsurda(f));
}

/**
 * Quem faz fronteira com quem, por NOME de entidade.
 *
 * A adjacência sai da topologia e não da geometria: em TopoJSON, dois
 * polígonos que dividem uma fronteira dividem literalmente o mesmo arco, então
 * `neighbors` acha os vizinhos comparando índices de arco, sem testar
 * interseção de nada. É exato e é barato — vale até para as 1.946 feições de
 * 1492.
 *
 * A chave é o nome, e não o índice, porque quem consome é a cor, e a cor é do
 * país e não do polígono: a Itália aparece em 5 feições e as 5 têm de sair
 * iguais. Anônimos ficam fora dos dois lados — não têm identidade para
 * defender nem para disputar.
 *
 * Os índices de `geometries` casam com os de `features`, verificado nas 53
 * fatias. Se algum dia deixarem de casar, esta função devolve vazio em vez de
 * cruzar nomes errados: sem adjacência a cor cai no hash puro, o que reintroduz
 * 4% de colisão entre vizinhos — feio, e muito melhor que pintar a Pérsia com a
 * cor que o algoritmo calculou para a Gália.
 */
export function adjacenciaPorNome(
  feicoes: readonly FatiaFeature[],
  geometrias: readonly unknown[]
): Adjacencia {
  const adj = new Map<string, Set<string>>();
  if (geometrias.length !== feicoes.length) return adj;

  const vizinhos = neighbors(geometrias as Parameters<typeof neighbors>[0]);
  const nomeDe = feicoes.map((f) => f.properties?.n || null);

  for (let i = 0; i < vizinhos.length; i++) {
    const a = nomeDe[i];
    if (!a) continue;
    for (const j of vizinhos[i]) {
      const b = nomeDe[j];
      if (!b || b === a) continue;
      let ligados = adj.get(a);
      if (!ligados) adj.set(a, (ligados = new Set()));
      ligados.add(b);
    }
  }
  return adj;
}

/**
 * Uma fatia carregada: a geometria e as cores das entidades que ela contém.
 *
 * As cores vêm em mapa por nome, e não em array paralelo às feições, de
 * propósito — array paralelo impõe um invariante de alinhamento a todo mundo
 * que filtrar a lista, e este arquivo já tem a cicatriz disso: a tentativa 3
 * de consertar a geometria falhou exatamente por assumir correspondência
 * posicional que `feature()` não preserva.
 */
export interface Fatia {
  feicoes: FatiaFeature[];
  /** Balde de cor por nome de entidade. Ver `lib/geo/cores.ts`. */
  cores: ReadonlyMap<string, number>;
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
const cache = new Map<string, Promise<Fatia>>();

/**
 * Busca uma fatia e devolve as feições.
 *
 * Só roda no cliente: o caminho é relativo à origem, e são 4,5 MB no total
 * que não podem entrar no bundle nem no payload de SSG. Uma fatia por vez,
 * ~85 kB em média, guardada em memória depois da primeira vez — arrastar a
 * barra de tempo de um lado a outro busca no máximo 53 arquivos pequenos, e
 * ir e voltar não busca nada.
 */
export function carregarFatia(fatia: FatiaIndice): Promise<Fatia> {
  const { nome, ano } = fatia;
  const emCache = cache.get(nome);
  if (emCache) return emCache;

  const pedido = (async () => {
    const resposta = await fetch(`/geo/fatias/${nome}.json`);
    if (!resposta.ok) {
      throw new Error(`fatia ${nome}: HTTP ${resposta.status}`);
    }
    const topologia = (await resposta.json()) as Topology;
    const colecao = topologia.objects.mundo as GeometryCollection;
    const todas = feature(topologia, colecao).features as FatiaFeature[];

    /*
     * Grafia canônica ANTES de tudo o que depende do nome — cor, adjacência,
     * etiqueta. Feito aqui, num lugar só, é impossível a tela mostrar uma grafia
     * e a cor ter sido calculada com outra. Recebe a entrada do índice inteira, e
     * não só o nome do arquivo, porque a normalização é datada: "Zaire" é certo
     * em 1994 e errado em 2010.
     */
    for (const f of todas) {
      const p = f.properties;
      if (!p) continue;
      if (p.n) p.n = nomeCanonico(p.n, ano);
      if (p.s) p.s = nomeCanonico(p.s, ano);
    }

    /*
     * A adjacência é calculada sobre a lista INTEIRA, porque é ela que casa
     * com os índices de `geometries`. As cores são atribuídas só aos nomes que
     * sobrevivem ao filtro — feição descartada não deve reservar cor nem
     * proibir a de ninguém.
     */
    const adjacencia = adjacenciaPorNome(todas, colecao.geometries);
    /*
     * Filtrado JÁ AQUI, e não em quem desenha. São dois consumidores — o
     * canvas e o seletor de hover — e se o filtro morasse neles, esquecer num
     * deles faria a tela e a consulta discordarem sobre o que existe.
     */
    const feicoes = feicoesUteis(todas);
    const nomes = new Set<string>();
    for (const f of feicoes) {
      const n = f.properties?.n;
      if (n) nomes.add(n);
    }

    return { feicoes, cores: atribuirBaldes(nomes, adjacencia) };
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
