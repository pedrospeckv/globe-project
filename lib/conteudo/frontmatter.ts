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

/**
 * Um campo do cabeçalho, aceitando as duas formas que o cofre usa.
 *
 * `Páginas: 457` e `Autor:\n  - Jostein Gaarder` querem dizer a mesma coisa
 * para o Obsidian — escalar ou lista de um item, conforme o campo tenha sido
 * criado a mão ou pelo plugin de importação de livro. Ler só a primeira forma
 * perderia justamente o autor, que quase sempre vem como lista.
 */
function campo(yaml: string, chave: string): string | undefined {
  const escalar = yaml.match(new RegExp(`^${chave}:[ \\t]*(.+)$`, "m"));
  if (escalar) return escalar[1].trim() || undefined;
  const lista = yaml.match(
    new RegExp(`^${chave}:[ \\t]*\\r?\\n[ \\t]*-[ \\t]*(.+)$`, "m")
  );
  return lista?.[1].trim() || undefined;
}

/**
 * `07-05-2025 17:16:35` (com ou sem hora) para `2025-05-07`.
 *
 * O cofre grava dia-mês-ano, invertido em relação ao resto do acervo. Quem
 * não reconhecer a forma volta indefinido em vez de arriscar: data trocada de
 * mês por dia é erro silencioso, e uma data ausente é só uma data ausente.
 */
function dataDoCofre(bruto: string | undefined): string | undefined {
  const m = bruto?.match(/^(\d{2})-(\d{2})-(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

/**
 * A capa em https, e na resolução que serve.
 *
 * Três consertos no endereço que o cofre grava, todos verificados contra o
 * servidor do Google Books:
 *
 * 1. `http://` para `https://`. A página é servida por https, e o navegador
 *    bloqueia imagem em texto claro dentro dela — a capa não apareceria, e sem
 *    erro visível. O mesmo endereço responde em https.
 * 2. `zoom=1` para `zoom=2`. O padrão do cofre entrega 128 px de largura, que
 *    numa caixa de 96 px em tela de densidade dupla sai visivelmente mole.
 *    `zoom=2` entrega 300 px pelo mesmo caminho; `zoom=3` chega a 575 px e não
 *    paga o peso para o tamanho em que a capa aparece.
 * 3. Fora `edge=curl`, que desenha uma dobra de página falsa na borda direita
 *    da imagem. É enfeite de leitor de e-book de 2010 e briga com a estante.
 */
export function capaSegura(bruto: string | undefined): string | undefined {
  if (!bruto) return undefined;
  let url = bruto.replace(/^http:\/\//, "https://");
  if (!url.startsWith("https://")) return undefined;

  if (url.includes("books.google.com")) {
    url = url
      .replace(/([?&])zoom=1(?=&|$)/, "$1zoom=2")
      .replace(/([?&])edge=curl(?=&|$)/, "$1")
      .replace(/&&+/g, "&")
      .replace(/[?&]$/, "");
  }
  return url;
}

export interface LivroDoCofre {
  titulo: string;
  autor: string;
  editora?: string;
  publicado?: string;
  paginas?: number;
  capa?: string;
  terminadoEm?: string;
}

/**
 * O livro descrito no cabeçalho, quando houver um.
 *
 * Este metadado é a razão de o reconhecedor e o removedor morarem no mesmo
 * arquivo. A primeira versão só removia o cabeçalho, e com ele ia embora
 * título, autor, editora, número de páginas e o endereço da capa — exatamente
 * o que a ala de livros precisa. Remover do corpo e guardar como dado são a
 * mesma operação, feita uma vez.
 *
 * Exige título e autor. Sem os dois não é ficha de livro: é o cabeçalho de
 * organização que o cofre põe em qualquer nota, e tratá-lo como livro criaria
 * ficha sem nome na estante.
 */
export function livroDoFrontmatter(texto: string): LivroDoCofre | undefined {
  const yaml = texto.match(RE_FRONTMATTER)?.[1];
  if (!yaml) return undefined;

  const titulo = campo(yaml, "Título") ?? campo(yaml, "Titulo");
  const autor = campo(yaml, "Autor");
  if (!titulo || !autor) return undefined;

  const paginas = Number(campo(yaml, "Páginas") ?? campo(yaml, "Paginas"));

  return {
    titulo,
    autor,
    editora: campo(yaml, "Publicadora"),
    publicado: campo(yaml, "Publicado"),
    paginas: Number.isInteger(paginas) && paginas > 0 ? paginas : undefined,
    capa: capaSegura(campo(yaml, "Capa")),
    terminadoEm: dataDoCofre(campo(yaml, "Terminei")),
  };
}
