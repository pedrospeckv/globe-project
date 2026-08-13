import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";

export const TipoFonte = z.enum([
  "decisao-judicial",
  "documento-oficial",
  "livro",
  "artigo-academico",
  "reportagem",
  "dataset",
]);

/**
 * Fonte é entidade com id próprio, não string inline: a mesma sentença citada
 * em cinco alegações existe uma vez só. Isso permite responder "tudo que
 * depende desta fonte" — barato agora, impossível de retroajustar depois.
 */
export const Fonte = z.object({
  id: Id,
  tipo: TipoFonte,
  titulo: z.string().min(1, "fonte precisa de título"),
  autor: z.string().optional(),
  publicacao: z.string().optional(),
  data: DataHistorica.optional(),
  url: z.string().url().optional(),
  citacao: z.string().optional(),
});

export type Fonte = z.infer<typeof Fonte>;
export type TipoFonte = z.infer<typeof TipoFonte>;
