import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";
import { Alegacao } from "./alegacao";

export const Cargo = z.object({
  titulo: z.string().min(1),
  inicio: DataHistorica,
  /** Ausente significa cargo em curso. */
  fim: DataHistorica.optional(),
});

export const Figura = z.object({
  id: Id,
  nome: z.string().min(1),
  paisIso: z.string().regex(/^[A-Z]{3}$/, "paisIso deve ter 3 letras maiúsculas"),
  cargos: z.array(Cargo).default([]),
  alegacoes: z.array(Alegacao).default([]),
  textoMdx: z.string().optional(),
});

export type Cargo = z.infer<typeof Cargo>;
export type Figura = z.infer<typeof Figura>;
