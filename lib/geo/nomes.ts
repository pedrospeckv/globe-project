/**
 * Uma grafia por entidade, para o mapa não trocar de cor sem que nada mude.
 *
 * ## O problema
 *
 * A cor de cada polígono vem do NOME (ver `cores.ts`), e é isso que faz a mesma
 * entidade guardar a mesma cor ao longo do tempo. A consequência é que duas
 * grafias da mesma entidade são duas entidades para o mapa: em 2010 a base diz
 * "Tanzania, United Republic of" e em 2018 diz "Tanzania", e o país troca de cor
 * ao cruzar a fronteira entre as duas fatias sem que nada tenha acontecido.
 *
 * Não é só o encontro das duas bases. O upstream é inconsistente consigo mesmo:
 * escreve "United States of America" em 1783, 1800, 1880 e 1900, e "United
 * States" em 1815 e de 1914 em diante. Os Estados Unidos já trocavam de cor três
 * vezes ao longo da linha do tempo antes de existir fatia local nenhuma.
 *
 * ## O que esta tabela é, e o que ela recusa ser
 *
 * É uma tabela de GRAFIA, não de história. Renomear pelo nome só é seguro quando
 * as duas formas designam a mesma coisa no mesmo momento — e há casos em que não
 * designam:
 *
 * - **"Zaire" é certo em 1994 e errado em 2010.** O Zaire existiu de 1971 a 1997.
 *   Daí o campo `desde`: a troca vale de 1997 em diante e deixa 1994 como estava.
 * - **"Burma" é certo em 1783 e errado em 1994**, porque a renomeação para
 *   Myanmar é de 1989.
 * - **"Trinidad" em 1715 não é o Estado de Trinidad e Tobago**, que só existe
 *   como tal desde a independência de 1962.
 *
 * ## Três casos deixados de fora de propósito
 *
 * 1. **Swaziland (até 2010) e eSwatini (2018)** — a renomeação é de abril de 2018.
 *    Cada grafia está certa na sua data, e unificá-las mostraria eSwatini antes de
 *    o nome existir. O país troca de cor ali, e trocar é o comportamento correto.
 * 2. **Czech Republic (até 2010) e Czechia (2018)** — mesmo raciocínio, com a
 *    mudança em 2016. Note que "Czechoslovakia" (1920–1960) é outra entidade, não
 *    outra grafia.
 * 3. **"N. Cyprus" e "Turkish Cypriot-administered area"; "Falkland Is."** —
 *    soberania contestada. A escolha da grafia AQUI seria a escolha de um lado, e
 *    isso é matéria de `alegacao` e de `Ilha.disputada`, com fonte, e não de uma
 *    tabela de normalização silenciosa. As duas ficam como a fonte as escreveu.
 *
 * A grafia canônica preferida é a forma inteira e não a abreviada — "Central
 * African Republic" em vez de "Central African Rep." —, porque quem lê a etiqueta
 * está estudando, e abreviação de atlas impresso existia para caber na folha.
 */

export interface Renomeacao {
  /** A grafia como aparece em alguma fatia. */
  de: string;
  /** A grafia canônica. */
  para: string;
  /**
   * Ano a partir do qual a troca vale. Ausente quer dizer sempre.
   *
   * Só é ausente quando as duas formas designam a mesma coisa em qualquer data —
   * ou seja, quando a diferença é de grafia e não de história.
   */
  desde?: number;
  /** Por que a troca é legítima. Obrigatório: sem razão, é preferência. */
  razao: string;
}

export const RENOMEACOES: readonly Renomeacao[] = [
  /* --- Abreviações do Natural Earth, expandidas. Mesma entidade, sempre. --- */
  {
    de: "Bosnia and Herz.",
    para: "Bosnia and Herzegovina",
    razao: "abreviação do Natural Earth; o upstream escreve inteiro em 1994–2010",
  },
  {
    de: "Central African Rep.",
    para: "Central African Republic",
    razao: "abreviação do Natural Earth; o upstream escreve inteiro em 1945–2010",
  },
  {
    de: "Dominican Rep.",
    para: "Dominican Republic",
    razao: "abreviação do Natural Earth; o upstream escreve inteiro em 1880–2010",
  },
  {
    de: "Eq. Guinea",
    para: "Equatorial Guinea",
    razao: "abreviação do Natural Earth; o upstream escreve inteiro em 1914–2010",
  },
  {
    de: "W. Sahara",
    para: "Western Sahara",
    razao: "abreviação do Natural Earth; o upstream escreve inteiro em 1945–2010",
  },
  {
    de: "S. Sudan",
    para: "South Sudan",
    razao: "abreviação do Natural Earth; sem forma concorrente nas outras fatias",
  },
  {
    de: "Solomon Is.",
    para: "Solomon Islands",
    razao: "abreviação do Natural Earth; sem forma concorrente nas outras fatias",
  },
  {
    de: "Dem. Rep. Congo",
    para: "Democratic Republic of the Congo",
    razao:
      "abreviação do Natural Earth. A forma inteira também separa do 'Congo' que " +
      "aparece de 1492 a 2018 e é outra entidade",
  },

  /* --- Formas de catálogo do upstream, invertidas para a ordem de leitura. --- */
  {
    de: "Gambia, The",
    para: "Gambia",
    razao:
      "forma de índice alfabético. O próprio upstream escreve 'Gambia' em 1880 e " +
      "1900, então a canônica unifica 13 fatias",
  },
  {
    de: "Tanzania, United Republic of",
    para: "Tanzania",
    razao: "forma de catálogo ISO; a curta é a que o Natural Earth usa em 2018",
  },
  {
    de: "Korea, Democratic People's Republic of",
    para: "North Korea",
    razao: "forma de catálogo ISO; a curta é a que o Natural Earth usa em 2018",
  },
  {
    de: "Korea, Republic of",
    para: "South Korea",
    razao: "forma de catálogo ISO; a curta é a que o Natural Earth usa em 2018",
  },

  /* --- Inconsistência interna do upstream. --- */
  {
    de: "United States of America",
    para: "United States",
    razao:
      "o upstream alterna entre as duas formas — 'of America' em 1783, 1800, 1880 " +
      "e 1900, curta em 1815 e de 1914 em diante. Sem unificar, os Estados Unidos " +
      "trocam de cor três vezes ao longo da linha do tempo",
  },
  {
    de: "Byelarus",
    para: "Belarus",
    razao:
      "transliteração antiga do russo. Só aparece em 1994, 2000 e 2010, todas " +
      "posteriores à independência de 1991, então não há risco de confundir com a " +
      "república soviética",
  },
  {
    de: "Ivory Coast",
    para: "Côte d'Ivoire",
    razao:
      "o país pede a forma francesa em todas as línguas desde 1986, e a colônia " +
      "francesa de 1893 já se chamava assim — as duas pontas do intervalo batem",
  },

  /* --- Renomeações datadas: a troca vale só de um ano em diante. --- */
  {
    de: "Burma",
    para: "Myanmar",
    desde: 1989,
    razao:
      "renomeação de 1989. Fica 'Burma' em 1783, 1800, 1815, 1945 e 1960, que é o " +
      "nome correto naquelas datas, e vira Myanmar em 1994, 2000 e 2010",
  },
  {
    de: "Zaire",
    para: "Democratic Republic of the Congo",
    desde: 1997,
    razao:
      "o Zaire existiu de 1971 a 1997. Fica Zaire em 1994, onde está certo, e vira " +
      "a República Democrática do Congo em 2000 e 2010, onde o upstream errou. As " +
      "fatias de 1945 e 1960 também dizem Zaire e também estão erradas, mas o nome " +
      "certo delas é outro (Congo Belga, Congo-Leopoldville) — isso é reatribuição " +
      "com fonte, não normalização de grafia, e não cabe nesta tabela",
  },
  {
    de: "Trinidad",
    para: "Trinidad and Tobago",
    desde: 1962,
    razao:
      "o Estado soberano existe desde a independência de 1962. Antes disso o " +
      "upstream nomeia a ilha, e em 1715 e 1815 'Trinidad and Tobago' seria " +
      "anacronismo",
  },
];

/*
 * Índice por grafia de origem. Montado uma vez: `carregarFatia` chama
 * `nomeCanonico` uma vez por feição, e são 1.946 na fatia de 1492 — varrer a
 * lista inteira a cada chamada seria trabalho quadrático por nada.
 */
const PorGrafia = new Map<string, Renomeacao>(
  RENOMEACOES.map((r) => [r.de, r])
);

/**
 * A grafia canônica de um nome numa data.
 *
 * O ano é o da FATIA, e não o que o usuário escolheu na barra: a pergunta é como
 * se escrevia o que está desenhado, e o que está desenhado é a fatia.
 */
export function nomeCanonico(nome: string, ano: number): string {
  const r = PorGrafia.get(nome);
  if (!r) return nome;
  if (r.desde !== undefined && ano < r.desde) return nome;
  return r.para;
}

/** As grafias canônicas, para o teste conferir que nenhuma é origem de outra. */
export function canonicas(): Set<string> {
  return new Set(RENOMEACOES.map((r) => r.para));
}
