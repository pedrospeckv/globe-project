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
});

export type Nota = z.infer<typeof Nota>;

/** Notas ligadas a um alvo do atlas, em ordem alfabética. */
export function notasDoAlvo(notas: Nota[], alvo: string): Nota[] {
  return notas
    .filter((n) => n.alvos.includes(alvo))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}
