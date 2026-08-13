import { z } from "zod";

/**
 * Datas históricas não são datas comuns: precisam aceitar granularidade
 * variável (só o ano, ano-mês, ou completa) e anos de menos de 4 dígitos.
 * `Date` e `z.string().datetime()` não servem para 843.
 */
const RE_DATA = /^(\d{1,4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/;

export const DataHistorica = z
  .string()
  .regex(RE_DATA, "data deve ser AAAA, AAAA-MM ou AAAA-MM-DD");

export type DataHistorica = z.infer<typeof DataHistorica>;

/** Ano numérico, para ordenar e comparar independente da granularidade. */
export function anoDe(data: string): number {
  const m = RE_DATA.exec(data);
  if (!m) throw new Error(`data inválida: ${data}`);
  return Number(m[1]);
}

/** Identificador estável usado em referências entre arquivos. */
export const Id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "id deve ser minúsculo, sem espaço, separado por hífen");

export type Id = z.infer<typeof Id>;
