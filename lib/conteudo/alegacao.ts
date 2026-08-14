import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";

/**
 * Lista fechada, definida na §6 do spec.
 *
 * As distinções que os campos políticos mais confundem vivem aqui, no rótulo,
 * em vez de diluídas na prosa:
 *   anulado   ≠ inocentado  (caiu por vício, não por mérito)
 *   prescrito ≠ desmentido  (extinto por prazo, não refutado)
 *   investigacao ≠ em-julgamento (apuração aberta ≠ denúncia aceita)
 *   investigacao-arquivada ≠ desmentido (apuração encerrada por
 *     insuficiência de prova ≠ refutação documental do fato)
 */
export const StatusAlegacao = z.enum([
  "transito-julgado",
  "em-julgamento",
  "investigacao",
  "investigacao-arquivada",
  "anulado",
  "prescrito",
  "alegacao-sem-processo",
  "desmentido",
]);

export const Alegacao = z.object({
  id: Id,
  enunciado: z.string().min(1, "alegação precisa de enunciado"),
  status: StatusAlegacao,
  /**
   * Ids de Fonte. Nunca vazio — é a promessa editorial do projeto, e a razão
   * de a validação viver no build: conteúdo sem lastro não chega ao ar porque
   * o deploy falha.
   */
  fontes: z.array(Id).min(1, "alegação precisa de ao menos uma fonte"),
  data: DataHistorica.optional(),
  /** Explica por que o status é esse. Ex: por que anulado ≠ inocentado. */
  nota: z.string().optional(),
});

export type Alegacao = z.infer<typeof Alegacao>;
export type StatusAlegacao = z.infer<typeof StatusAlegacao>;
