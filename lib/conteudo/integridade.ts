import type { Fonte } from "./fonte";
import type { Figura } from "./figura";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";
import type { Indicador } from "./indicador";
import type { Evento } from "./evento";
// `ligacoes` importa só o TIPO Acervo daqui, então o ciclo some na compilação.
import { verificarLigacoes } from "./ligacoes";

export interface Acervo {
  fontes: Fonte[];
  paises: Pais[];
  figuras: Figura[];
  viagens: Viagem[];
  indicadores: Indicador[];
  eventos: Evento[];
}

function duplicados(ids: string[]): string[] {
  const vistos = new Set<string>();
  const dup = new Set<string>();
  for (const id of ids) {
    if (vistos.has(id)) dup.add(id);
    vistos.add(id);
  }
  return [...dup];
}

/**
 * Checagens que nenhum schema isolado consegue fazer, por cruzarem arquivos.
 *
 * Sem isto, a regra de fonte obrigatória seria contornável digitando um id
 * inventado — e toda a garantia editorial cairia junto.
 *
 * Retorna TODOS os erros em vez de parar no primeiro, para que uma rodada
 * mostre tudo que precisa ser corrigido.
 */
export function verificarIntegridade(acervo: Acervo): string[] {
  const erros: string[] = [];

  const idsFonte = new Set(acervo.fontes.map((f) => f.id));
  const isoPaises = new Set(acervo.paises.map((p) => p.iso));

  for (const id of duplicados(acervo.fontes.map((f) => f.id))) {
    erros.push(`fonte com id duplicado: ${id}`);
  }
  for (const id of duplicados(acervo.figuras.map((f) => f.id))) {
    erros.push(`figura com id duplicado: ${id}`);
  }
  for (const iso of duplicados(acervo.paises.map((p) => p.iso))) {
    erros.push(`país com iso duplicado: ${iso}`);
  }
  for (const id of duplicados(acervo.viagens.map((v) => v.id))) {
    erros.push(`viagem com id duplicado: ${id}`);
  }
  for (const id of duplicados(acervo.indicadores.map((i) => i.id))) {
    erros.push(`indicador com id duplicado: ${id}`);
  }

  for (const figura of acervo.figuras) {
    if (!isoPaises.has(figura.paisIso)) {
      erros.push(
        `figura "${figura.id}" referencia país ${figura.paisIso}, que não está no atlas`
      );
    }
    for (const alegacao of figura.alegacoes) {
      for (const fonteId of alegacao.fontes) {
        if (!idsFonte.has(fonteId)) {
          erros.push(`alegação "${alegacao.id}" cita fonte inexistente: ${fonteId}`);
        }
      }
    }
  }

  for (const viagem of acervo.viagens) {
    for (const fonteId of viagem.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`viagem "${viagem.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
  }

  for (const id of duplicados(acervo.eventos.map((e) => e.id))) {
    erros.push(`evento com id duplicado: ${id}`);
  }

  for (const evento of acervo.eventos) {
    for (const iso of evento.paises) {
      if (!isoPaises.has(iso)) {
        erros.push(
          `evento "${evento.id}" referencia país ${iso}, que não está no atlas`
        );
      }
    }
    for (const fonteId of evento.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`evento "${evento.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
  }

  for (const indicador of acervo.indicadores) {
    if (!isoPaises.has(indicador.paisIso)) {
      erros.push(
        `indicador "${indicador.id}" referencia país ${indicador.paisIso}, que não está no atlas`
      );
    }
    if (!idsFonte.has(indicador.fonte)) {
      erros.push(
        `indicador "${indicador.id}" cita fonte inexistente: ${indicador.fonte}`
      );
    }
  }

  erros.push(...verificarLigacoes(acervo));

  return erros;
}
