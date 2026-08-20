/**
 * O world-atlas identifica país por ISO 3166-1 numérico ("076"); o conteúdo do
 * atlas usa alpha-3 ("BRA"). Este módulo traduz entre os dois.
 *
 * ## Era uma tabela, e virou uma tradução construída
 *
 * Até 2026-08-19 aqui morava `ISO_NUMERICO`, um objeto escrito à mão com os nove
 * países do atlas, e `Alpha3` era `keyof typeof` dele — um tipo FECHADO. Funcionava
 * enquanto o atlas era de uma pessoa.
 *
 * O que quebrou foi abrir o projeto. Com 165 países por escrever, esta tabela seria
 * o único arquivo compartilhado que todo PR de país precisaria tocar: 165 PRs
 * colidindo no mesmo lugar, e cada contribuidor gastando a primeira meia hora num
 * conflito de um arquivo que não é o dele. Pior, o tipo fechado fazia o compilador
 * exigir mudança em cascata a cada país novo.
 *
 * Agora o número mora no arquivo do próprio país (`Pais.isoNumerico`) e a tradução
 * é MONTADA a partir do conteúdo carregado. País novo é um arquivo novo e nada
 * mais.
 *
 * ## Por que a tradução é injetada, e não global
 *
 * `criarTraducaoIso` recebe os países e devolve as consultas. Não há tabela global
 * porque `lib/geo` não deve importar `lib/conteudo` — a camada da geometria não
 * conhece o acervo, ela recebe o que precisa. O efeito colateral bom é testar sem
 * mexer no conteúdo de verdade: monta-se a tradução de mentira e pronto.
 */

/**
 * Código alpha-3 de país. Era união fechada dos nove; hoje é `string`, porque a
 * lista legítima é a do conteúdo e é conferida em tempo de execução — pelo schema
 * do `Pais`, que exige três maiúsculas, e pelo validador do build, que exige que o
 * mapa tenha aquele país. Continua tendo nome próprio porque `Alpha3` diz o que a
 * string é, e `string` não diz nada.
 */
export type Alpha3 = string;

/** O mínimo que este módulo precisa saber de um país. */
export interface PaisIdentificado {
  iso: Alpha3;
  isoNumerico: string;
}

/**
 * Três dígitos com zero à esquerda.
 *
 * Existe porque o topojson não é consistente: o mesmo campo aparece como `"076"`,
 * `"76"` e `76` conforme a fatia e a versão da base.
 */
export function normalizarNumerico(numerico: string | number): string {
  return String(numerico).padStart(3, "0");
}

export interface TraducaoIso {
  /** Alpha-3 do país com este código numérico, se ele estiver no atlas. */
  alpha3De(numerico: string | number): Alpha3 | undefined;
  /** O país está no atlas? */
  temPais(iso: string): boolean;
  /** Os alpha-3 do acervo, na ordem em que os países vieram. */
  readonly paises: readonly Alpha3[];
}

/**
 * Monta a tradução a partir dos países do acervo.
 *
 * Código numérico repetido é ERRO e estoura aqui, em vez de fazer um país
 * sobrescrever o outro em silêncio — dois países com o mesmo número significa que
 * um deles está com o código errado, e o efeito visível seria um dossiê acendendo
 * no polígono do vizinho.
 */
export function criarTraducaoIso(
  paises: readonly PaisIdentificado[]
): TraducaoIso {
  const porNumerico = new Map<string, Alpha3>();
  for (const p of paises) {
    const num = normalizarNumerico(p.isoNumerico);
    const jaTem = porNumerico.get(num);
    if (jaTem && jaTem !== p.iso) {
      throw new Error(
        `código numérico ${num} declarado por ${jaTem} e por ${p.iso} — ` +
          `um dos dois está errado`
      );
    }
    porNumerico.set(num, p.iso);
  }
  const isos = new Set(paises.map((p) => p.iso));

  return {
    alpha3De: (numerico) => porNumerico.get(normalizarNumerico(numerico)),
    temPais: (iso) => isos.has(iso),
    paises: paises.map((p) => p.iso),
  };
}
