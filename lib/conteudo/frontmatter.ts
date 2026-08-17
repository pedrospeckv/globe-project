/**
 * Cabeçalho YAML do Obsidian — reconhecer e remover.
 *
 * O cofre guarda metadado de leitura no topo do arquivo (`Tag`, `Autor`,
 * `Capa`, `Comecei`...). Isso é organização do cofre, não texto da nota, e
 * chegou à página como se fosse: onze notas abriam com um bloco de YAML antes
 * da primeira frase, URL de capa do Google Books inclusive.
 *
 * O reconhecedor mora junto do removedor de propósito. O importador remove; o
 * schema da nota recusa o que sobrou. Se o removedor falhar um dia — cofre com
 * variação de sintaxe que não previmos —, o erro aparece no `pnpm validar` em
 * vez de aparecer na página publicada.
 */

/**
 * Um bloco fechado, ancorado no começo do texto.
 *
 * Ancorar importa: `---` isolado no meio da nota é linha divisória do Markdown
 * e tem que continuar sendo. Exigir o fechamento importa pelo mesmo motivo —
 * sem ele, uma nota que começasse com divisória perderia tudo até a próxima.
 *
 * A linha de fechamento aceita `---` e `...`, os dois marcadores de fim de
 * documento do YAML.
 */
const RE_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/;

/** Verdadeiro se o texto abre com cabeçalho YAML. */
export function temFrontmatter(texto: string): boolean {
  return RE_FRONTMATTER.test(texto);
}

/**
 * O texto sem o cabeçalho. Sem cabeçalho, devolve o texto como está.
 *
 * Remove um bloco só: dois cabeçalhos seguidos são arquivo corrompido, e
 * remover ambos em silêncio esconderia isso.
 */
export function semFrontmatter(texto: string): string {
  return texto.replace(RE_FRONTMATTER, "").trimStart();
}
