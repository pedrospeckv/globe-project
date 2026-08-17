import { z } from "zod";
import { temFrontmatter } from "./frontmatter";
import { DataHistorica, Id } from "./primitivos";

/**
 * Uma anotação pessoal, importada do Obsidian.
 *
 * É a única entidade do acervo que NÃO segue a regra da fonte, e isso é
 * declarado em vez de disfarçado. O resto do atlas se sustenta em afirmação
 * com lastro; nota de estudo é o oposto disso por natureza — rascunho,
 * primeira pessoa, sem revisão. As duas coisas podem conviver desde que o
 * leitor saiba, a cada parágrafo, qual delas está lendo.
 *
 * Por isso a nota nunca é misturada à prosa do período. Ela mora em página
 * própria, com aviso, e o período apenas aponta para ela.
 */
/**
 * A ficha do livro que a nota resume, quando a nota é de leitura.
 *
 * Vem do cabeçalho do cofre, que o plugin de livro do Obsidian preenche a
 * partir do Google Books. Título e autor são obrigatórios porque uma estante
 * com ficha anônima não é estante; o resto falta com frequência e faltar é
 * normal.
 */
export const Livro = z.object({
  titulo: z.string().min(1),
  autor: z.string().min(1),
  editora: z.string().min(1).optional(),
  publicado: DataHistorica.optional(),
  paginas: z.number().int().positive().optional(),
  /** Endereço da capa. Sempre https — imagem em texto claro é bloqueada. */
  capa: z.string().url().startsWith("https://").optional(),
  /** Quando Pedro terminou de ler. É o que ordena a estante por leitura. */
  terminadoEm: DataHistorica.optional(),
});

export type Livro = z.infer<typeof Livro>;

export const Nota = z.object({
  id: Id,
  titulo: z.string().min(1),
  /** Subpasta do cofre, preservada para dar contexto de onde a nota nasceu. */
  pasta: z.string().min(1),
  /**
   * O texto da nota, já sem o cabeçalho YAML do cofre. A recusa é a trava:
   * o importador remove, e um erro dele vira falha de `pnpm validar` em vez
   * de um bloco de metadado publicado acima da primeira frase.
   */
  corpo: z
    .string()
    .min(1, "nota vazia não deve ser importada")
    .refine(
      (c) => !temFrontmatter(c),
      "corpo começa com cabeçalho YAML do cofre — reimporte com scripts/importar-obsidian.ts"
    ),
  atualizadaEm: DataHistorica,
  /**
   * Alvos do atlas a que a nota se refere — mesmo espaço de nomes das
   * ligações `[[...]]`. Vazio é normal: a maioria das notas não tem
   * correspondente, e forçar uma associação seria inventar relação.
   */
  alvos: z.array(z.string()).default([]),
  /**
   * Fontes que sustentam o texto, no mesmo espaço de ids do resto do acervo.
   *
   * Vazio enquanto a nota ainda for o rascunho cru que veio do cofre. Deixa
   * de ser assim que o texto passar pela revisão: nota revisada afirma, e o
   * que afirma diz de onde. `coberturaDeNotas` conta as que ainda devem.
   */
  fontes: z.array(Id).default([]),
  /**
   * A ficha do livro, quando a nota é de leitura.
   *
   * Ausente na maioria: nota sobre um assunto não tem livro por trás, e
   * inventar um seria pior que não ter. Só as notas das pastas de leitura do
   * cofre trazem o cabeçalho que a preenche.
   */
  livro: Livro.optional(),
});

export type Nota = z.infer<typeof Nota>;

/** Notas que são leitura de um livro, das mais recentemente lidas em diante. */
export function livros(notas: Nota[]): Nota[] {
  return notas
    .filter((n) => n.livro)
    .sort((a, b) => {
      // Sem data de leitura vai para o fim: a estante começa pelo que foi lido.
      const da = a.livro?.terminadoEm ?? "";
      const db = b.livro?.terminadoEm ?? "";
      if (da && db && da !== db) return db.localeCompare(da);
      if (da !== db) return da ? -1 : 1;
      return a.livro!.titulo.localeCompare(b.livro!.titulo, "pt-BR");
    });
}

/**
 * As primeiras linhas da nota em texto puro, para caber num cartão.
 *
 * O corpo é markdown com ligações `[[...]]`, negrito e itálico. Jogado num
 * cartão com `line-clamp` ele aparece com os asteriscos e os colchetes na tela,
 * porque ali não passa pelo renderizador. Tirar a marcação é o que faz o
 * resumo parecer frase.
 */
export function resumoDaNota(nota: Nota, limite = 180): string {
  const limpo = nota.corpo
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2") // ligação com apelido
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // link markdown
    // Divisória vira espaço, não some: `---` colado no texto produzia
    // "Egito pré-históricoHá muito tempo", duas frases fundidas numa.
    .replace(/^[ \t]*(?:-{3,}|\*{3,}|_{3,})[ \t]*$/gm, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (limpo.length <= limite) return limpo;
  // Corta na palavra, não no meio dela.
  const corte = limpo.slice(0, limite);
  return `${corte.slice(0, corte.lastIndexOf(" "))}…`;
}

/** Notas ligadas a um alvo do atlas, em ordem alfabética. */
export function notasDoAlvo(notas: Nota[], alvo: string): Nota[] {
  return notas
    .filter((n) => n.alvos.includes(alvo))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}
