import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";

/**
 * Um retrato datado de um país — a unidade de conteúdo do atlas.
 * "França 1420" e "França 2026" são dois Periodo do mesmo Pais, o que faz
 * geopolítica atual ser o último período da timeline, não um módulo separado.
 */
export const Periodo = z
  .object({
    id: Id,
    inicio: DataHistorica,
    /** Ausente significa período em curso. */
    fim: DataHistorica.optional(),
    /**
     * Nome da entidade política na época — "Reino da Inglaterra",
     * "Grã-Bretanha". É o que mantém a precisão histórica apesar de a
     * geometria ser sempre a moderna (ver §12 do spec).
     */
    rotulo: z.string().min(1),
    regime: z.string().min(1),
    textoMdx: z.string().optional(),
  })
  .refine((p) => !p.fim || comparaData(p.fim, p.inicio) >= 0, {
    message: "período não pode terminar antes de começar",
    path: ["fim"],
  });

export const Pais = z.object({
  iso: z.string().regex(/^[A-Z]{3}$/, "iso deve ter 3 letras maiúsculas"),
  nome: z.string().min(1),
  periodos: z.array(Periodo).min(1, "país precisa de ao menos um período"),
});

export type Periodo = z.infer<typeof Periodo>;
export type Pais = z.infer<typeof Pais>;
