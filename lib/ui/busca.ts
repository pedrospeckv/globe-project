/**
 * A busca por texto do atlas, separada de qualquer componente.
 *
 * Mesma razão de `paralaxe.ts` existir: o que pode estar errado aqui é a
 * regra de casamento, não o `<input>`. Uma função pura põe a regra onde ela é
 * verificável, e deixa o componente com o que não erra em silêncio.
 *
 * **Acento é a parte que importa.** Metade dos nomes que este atlas guarda tem
 * um — Luiz Inácio, Fábio Luís, João Maurício, Antônio Filipe. Uma busca que
 * compare os caracteres crus faz "ines" não achar "Inácio" e "luis" não achar
 * "Luís", e quem digita não tem como saber que o problema é o acento. Por isso
 * a normalização vem antes de qualquer comparação, dos dois lados.
 */

/**
 * Texto reduzido à forma comparável: sem acento, minúsculo, sem espaço sobrando.
 *
 * `NFD` separa a letra do diacrítico ("á" vira "a" + U+0301), e o intervalo
 * `̀-ͯ` remove os diacríticos soltos. É o único jeito de fazer isso
 * sem uma tabela de conversão à mão.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A consulta casa com o texto?
 *
 * Cada palavra da consulta precisa aparecer em algum lugar do texto, e a
 * ordem não importa: "lula silva" acha "Luiz Inácio Lula da Silva", e "silva
 * lula" também. Exigir a frase inteira na ordem faria quem lembra do nome
 * pelo meio não achar ninguém.
 *
 * Consulta vazia casa com tudo — é o estado inicial do campo, e ali a lista
 * completa é a resposta certa.
 */
export function casa(texto: string, consulta: string): boolean {
  const alvo = normalizar(texto);
  const termos = normalizar(consulta).split(" ").filter(Boolean);
  return termos.every((t) => alvo.includes(t));
}

/**
 * Os itens que casam, na ordem em que chegaram.
 *
 * NÃO reordena por relevância de propósito: a ordem de origem é editorial —
 * figuras vêm ordenadas por quem tem mais alegações, períodos por cronologia —
 * e um ranking por número de acertos embaralharia isso sem avisar. Filtrar é
 * esconder o que não serve, não reorganizar o que serve.
 */
export function filtrar<T>(
  itens: readonly T[],
  consulta: string,
  textoDe: (item: T) => string
): T[] {
  if (!normalizar(consulta)) return [...itens];
  return itens.filter((i) => casa(textoDe(i), consulta));
}
