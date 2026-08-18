import type { FatiaFeature } from "./fatias";

/**
 * A cor de cada entidade política no globo.
 *
 * ## O problema
 *
 * Até aqui a fatia histórica era desenhada com um preenchimento só. O mapa
 * mostrava onde havia terra com dono e onde não havia, mas não mostrava a
 * EXTENSÃO de ninguém: em 1500 a Europa era uma mancha única, e não se via
 * onde acabava Castela e começava a França. Fronteira desenhada como traço
 * de 0,5 px sobre preenchimento idêntico dos dois lados é fronteira invisível.
 *
 * ## As duas exigências que se contradizem
 *
 * 1. **Vizinho tem que ser distinguível de vizinho** — é para isso que a cor
 *    existe.
 * 2. **A mesma entidade tem que guardar a mesma cor ao longo do tempo** —
 *    arrastando a linha do tempo, Roma crescendo de 200 a.C. a 100 d.C. tem de
 *    ser reconhecível como Roma. Se a cor mudar a cada fatia, a tela pisca e o
 *    olho perde o sujeito.
 *
 * Cor derivada do índice da feição satisfaz (1) e destrói (2): o índice de Roma
 * muda de arquivo para arquivo. Cor derivada do nome satisfaz (2) e falha em
 * (1) por colisão de hash — medido no conjunto: 4,2% dos 9.668 pares de
 * vizinhos caem no mesmo balde, ou seja 407 fronteiras que leriam como um país
 * só.
 *
 * ## A saída, medida
 *
 * Hash do NOME para escolher o balde, e a adjacência real da topologia só para
 * desempatar quem colidiu. Contra as 53 fatias:
 *
 * - colisões entre vizinhos que sobram: **0**
 * - grupos que saem do balde do hash: **402 de 9.921 = 4,05%**
 * - entidades que trocam de cor entre fatias consecutivas: **105 de 6.595 = 1,59%**
 *
 * Isto é, 96% das entidades ficam na cor do próprio nome, 98,4% atravessam o
 * tempo sem piscar, e nenhuma fronteira fica invisível. Ordenar os grupos por
 * nome antes de resolver é o que garante os 98,4%: se a ordem fosse a das
 * feições, mudar a ordem do arquivo mudaria as cores.
 */

/**
 * Quantos baldes de cor.
 *
 * Com 24, a resolução de conflito quase nunca precisa andar mais de um passo,
 * e o grau máximo de vizinhança do conjunto (113, no emaranhado do Sacro
 * Império em 1700) nunca esgotou os baldes. Menos que isso piora: com 12, a
 * colisão bruta dobra para 8,4%.
 */
export const BALDES = 24;

/** Traço entre polígonos. Escuro, para a fronteira aparecer sem gritar. */
export const TRACO = "#0a1020";

/*
 * ## Por que OKLCH e não HSL
 *
 * Em HSL, `hsl(60 40% 38%)` e `hsl(240 40% 38%)` declaram a mesma "lightness"
 * e o amarelo sai visivelmente mais claro que o azul — a escala de HSL não é
 * perceptual. Numa paleta de 24 matizes isso produz meia dúzia de países que
 * saltam da tela e meia dúzia que somem no oceano, sem que nenhum deles seja
 * mais importante que os outros.
 *
 * OKLCH é uniforme: mesmo `L` significa mesmo claro aparente em qualquer
 * matiz. A conversão é feita aqui, uma vez, na carga do módulo, e o que vai
 * para o canvas é hexadecimal comum — `fillStyle = "oklch(...)"` depende do
 * navegador e falha em silêncio (mantém a cor anterior) onde não houver
 * suporte, e cor errada por silêncio é o pior modo de falhar.
 */

/** OKLab para sRGB linear. Matriz de Björn Ottosson. */
function oklabParaLinear(L: number, a: number, b: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function gama(v: number): number {
  const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, Math.round(c * 255)));
}

/** `oklch(L C h)` em hexadecimal sRGB, com clamp no gamute. */
export function oklchParaHex(L: number, C: number, hGraus: number): string {
  const h = (hGraus * Math.PI) / 180;
  const [r, g, b] = oklabParaLinear(L, C * Math.cos(h), C * Math.sin(h));
  const hex = (v: number) => gama(v).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * A paleta, gerada e não escrita à mão.
 *
 * O matiz anda pelo ÂNGULO DE OURO (137,5°) a cada balde, e essa escolha é
 * funcional, não estética: quando o hash colide, a resolução tenta o balde
 * seguinte, e com passo de ouro "o seguinte" fica a 137° de distância no
 * círculo de matiz. Com a paleta ordenada por matiz crescente, o vizinho
 * desempatado receberia a cor mais parecida possível com a que estava
 * proibida — o conflito sairia da lista e continuaria na tela.
 *
 * `L` e `C` variam em ciclos de 3 e 2 para que, depois de 24 passos de 137,5°,
 * os poucos matizes que se aproximam ainda difiram em tom.
 */
export const PALETA: readonly string[] = Array.from({ length: BALDES }, (_, i) => {
  const matiz = (i * 137.508) % 360;
  const L = 0.4 + 0.03 * (i % 3);
  const C = 0.062 + 0.016 * (i % 2);
  return oklchParaHex(L, C, matiz);
});

/**
 * A terra que a fonte não atribui a ninguém: cinza de croma ZERO.
 *
 * São ~17% das feições, e em `bc323` metade. Croma zero é o recado — não é uma
 * cor de identidade, é a ausência de uma. Dar matiz a um polígono anônimo
 * afirmaria um Estado que a fonte não afirma, a mesma regra que já impede
 * `rotuloDaFatia` de inventar rótulo.
 *
 * O `L` é o MESMO da primeira faixa da paleta, e isso corrige um erro que já
 * foi cometido neste arquivo em outra forma: a primeira versão usava um
 * cinza-azulado escuro, de luminância 0,018 contra os 0,06–0,10 da paleta, e
 * com o oceano em 0,006 a terra anônima leria como mar. Em `bc323` o globo
 * ficaria outra vez quase vazio. Terra sem dono conhecido é terra: aparece com
 * o mesmo peso e sem identidade.
 */
export const NEUTRO = oklchParaHex(0.4, 0, 0);

/**
 * FNV-1a de 32 bits.
 *
 * Precisa ser estável entre execuções e entre máquinas, porque é ele que dá a
 * cor: `String.prototype` não tem hash, e qualquer coisa baseada em ordem de
 * inserção mudaria a paleta a cada carga.
 */
export function hashDoNome(nome: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < nome.length; i++) {
    h ^= nome.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** O balde que o nome pede, antes de qualquer desempate. */
export function baldeBase(nome: string): number {
  return hashDoNome(nome) % BALDES;
}

export type Adjacencia = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Distribui os baldes: hash para todos, desempate só para quem colidiu.
 *
 * A ordem de processamento é a alfabética dos nomes, e é ela que sustenta a
 * estabilidade no tempo — a mesma vizinhança produz o mesmo resultado
 * independentemente de como o arquivo lista as feições.
 *
 * Quando um grupo tem vizinhos ocupando todos os 24 baldes, ele volta para o
 * balde do próprio hash e aceita repetir a cor de um vizinho. É o pior caso e
 * nunca ocorreu no conjunto (o grau máximo é 113, mas os vizinhos de um mesmo
 * polígono se repetem muito em cor); mesmo assim precisa terminar, porque uma
 * fatia local futura pode ser mais emaranhada do que qualquer uma de hoje.
 */
export function atribuirBaldes(
  nomes: Iterable<string>,
  adjacencia: Adjacencia
): Map<string, number> {
  const balde = new Map<string, number>();
  for (const nome of [...nomes].sort()) {
    const ocupados = new Set<number>();
    for (const vizinho of adjacencia.get(nome) ?? []) {
      const b = balde.get(vizinho);
      if (b !== undefined) ocupados.add(b);
    }
    const base = baldeBase(nome);
    let escolhido = base;
    for (let passo = 1; passo < BALDES && ocupados.has(escolhido); passo++) {
      escolhido = (base + passo) % BALDES;
    }
    balde.set(nome, ocupados.has(escolhido) ? base : escolhido);
  }
  return balde;
}

/**
 * Área desenhada, em pixels², abaixo da qual a entidade não recebe cor própria.
 *
 * ## O problema que isto resolve
 *
 * Em 1650 a base subdivide a Austrália em 375 territórios de povos aborígenes, e
 * em 1492 a América do Sul em 412. Com uma cor de identidade para cada um, o mapa
 * lia como um retalho de 375 Estados com fronteira — e essa é uma afirmação que a
 * fonte não faz e que a história não sustenta. O ruído não era enfeite: era
 * excesso de precisão política inventada pelo desenho.
 *
 * ## Por que tamanho, e não tipo de entidade
 *
 * Porque tipo de entidade não existe no dado. Medido: `BORDERPRECISION` NÃO
 * separa Estado de povo — é uniforme por fatia, e em 1492 tudo é precisão baixa,
 * inclusive Portugal, França e Inglaterra, enquanto em 1650 tudo é alta, inclusive
 * os 375 polígonos australianos. Classificar quem é Estado seria decidir sobre
 * 3.029 nomes à mão, e isso é matéria de conteúdo com fonte, não de código.
 *
 * Tamanho, por outro lado, é uma regra de LEGIBILIDADE, e verificável: cor só diz
 * "extensão" quando há extensão para ver. 60 px² é um quadrado de ~8 px de lado.
 *
 * ## O corte, medido num mapa de 1472 px
 *
 * | conjunto                     | vira cinza |
 * |------------------------------|------------|
 * | Austrália em 1650 (375)      | 88%        |
 * | América do Sul em 1492 (412) | 76%        |
 * | mundo de 2018 (176)          | 23%        |
 *
 * Ou seja: morde onde está o confete e poupa quase todo o mapa moderno. Os 23% de
 * 2018 são os Estados europeus pequenos e as ilhas — Bélgica tem 57 px², Israel
 * 32 —, e eles voltam a ter cor ao APROXIMAR, porque o limiar é em pixels de tela
 * e a área quadruplica a cada duplicação do zoom. Aproximar passou a revelar
 * detalhe em vez de embaralhá-lo.
 *
 * O nome continua no hover em todos os casos: nada fica escondido, só deixa de
 * receber uma cor que não caberia.
 */
export const AREA_MINIMA_PARA_COR = 60;

/** Pequena demais para a cor dizer algo nesta escala. */
export function semCorPropria(areaPx2: number): boolean {
  return areaPx2 < AREA_MINIMA_PARA_COR;
}

/** A cor de um balde. Fora da faixa, o neutro — nunca `undefined`. */
export function corDoBalde(b: number | undefined): string {
  if (b === undefined || !Number.isInteger(b) || b < 0 || b >= BALDES) {
    return NEUTRO;
  }
  return PALETA[b];
}

/** A cor de uma feição da fatia: a do seu nome, ou o neutro se for anônima. */
export function corDaFeicao(
  f: FatiaFeature,
  baldes: ReadonlyMap<string, number>
): string {
  const n = f.properties?.n;
  return n ? corDoBalde(baldes.get(n)) : NEUTRO;
}
