import { z } from "zod";
import { Id } from "./primitivos";

export const Ponto = z.object({ ano: z.number().int(), valor: z.number() });

/**
 * Série temporal com atribuição obrigatória.
 *
 * A regra da §7 do spec: ninguém escreve "conquistas". Plota-se a série e
 * sombreia-se quem estava no poder. A curva não é do autor — e por isso a
 * fonte não é opcional.
 */
export const Indicador = z.object({
  id: Id,
  paisIso: z.string().regex(/^[A-Z]{3}$/, "paisIso deve ter 3 letras maiúsculas"),
  nome: z.string().min(1),
  unidade: z.string().min(1, "indicador precisa de unidade"),
  /** Id de Fonte. Gráfico sem atribuição é opinião com eixo. */
  fonte: Id,
  serie: z.array(Ponto).min(1, "indicador precisa de ao menos um ponto"),
});

export type Ponto = z.infer<typeof Ponto>;
export type Indicador = z.infer<typeof Indicador>;

/** CSV mínimo: cabeçalho `ano,valor`. Sem aspas, sem separador decimal local. */
export function parseSerieCsv(texto: string): Ponto[] {
  const linhas = texto
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  if (linhas.length === 0) throw new Error("CSV vazio");

  const cab = linhas[0].split(",").map((c) => c.trim().toLowerCase());
  const iAno = cab.indexOf("ano");
  const iValor = cab.indexOf("valor");
  if (iAno === -1) throw new Error('CSV precisa da coluna "ano"');
  if (iValor === -1) throw new Error('CSV precisa da coluna "valor"');

  const pontos = linhas.slice(1).map((linha) => {
    const col = linha.split(",");
    const ano = Number(col[iAno]);
    const valor = Number(col[iValor]);
    if (!Number.isFinite(ano)) throw new Error(`ano inválido: ${col[iAno]}`);
    if (!Number.isFinite(valor)) {
      throw new Error(`valor inválido no ano ${col[iAno]}: ${col[iValor]}`);
    }
    return { ano, valor };
  });

  return pontos.sort((a, b) => a.ano - b.ano);
}

/**
 * Valor exato daquele ano, ou null.
 *
 * Nunca interpola: inventar um ponto que não foi medido é mentir com
 * aparência de dado, que é justamente o que este módulo existe para evitar.
 */
export function valorEm(serie: Ponto[], ano: number): number | null {
  return serie.find((p) => p.ano === ano)?.valor ?? null;
}
