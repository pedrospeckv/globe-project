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

/** Ano numérico, para agrupar por ano independente da granularidade. */
export function anoDe(data: string): number {
  return partesDe(data)[0];
}

/**
 * [ano, mês, dia], com as partes ausentes em 0.
 * "1500" vira [1500, 0, 0], que ordena antes de qualquer data específica
 * daquele ano — o que é a semântica desejada para períodos com granularidade
 * grossa.
 */
export function partesDe(data: string): [number, number, number] {
  const m = RE_DATA.exec(data);
  if (!m) throw new Error(`data inválida: ${data}`);
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/**
 * Comparador cronológico completo. Negativo se `a` vem antes de `b`.
 *
 * Comparar só o ano não basta: a frota de Cabral saiu de Lisboa em março e
 * chegou a Porto Seguro em abril do MESMO ano, e essa ordem precisa ser
 * verificável.
 */
export function comparaData(a: string, b: string): number {
  const [anoA, mesA, diaA] = partesDe(a);
  const [anoB, mesB, diaB] = partesDe(b);
  return anoA - anoB || mesA - mesB || diaA - diaB;
}

/**
 * [longitude, latitude] — ordem GeoJSON, que é a que o d3-geo espera.
 * Vive aqui, e não em viagem.ts, porque evento e viagem usam a mesma.
 */
export const Coordenada = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

export type Coordenada = z.infer<typeof Coordenada>;

/** Identificador estável usado em referências entre arquivos. */
export const Id = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "id deve ser minúsculo, sem espaço, separado por hífen");

export type Id = z.infer<typeof Id>;
