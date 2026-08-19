import type { Fonte } from "./fonte";
import type { Figura } from "./figura";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";
import type { Indicador } from "./indicador";
import type { Evento } from "./evento";
import type { Episodio } from "./episodio";
import type { Nota } from "./nota";
import type { Ilha } from "./ilha";
// `ligacoes` importa só o TIPO Acervo daqui, então o ciclo some na compilação.
import { verificarLigacoes, indexarAlvos } from "./ligacoes";

export interface Acervo {
  fontes: Fonte[];
  paises: Pais[];
  figuras: Figura[];
  viagens: Viagem[];
  indicadores: Indicador[];
  eventos: Evento[];
  episodios: Episodio[];
  notas: Nota[];
  ilhas: Ilha[];
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
    /*
     * As fontes da trajetória. O schema já exige que existam quando há bloco;
     * o que só se pode conferir aqui é se elas apontam para fonte de verdade —
     * sem isto, a regra seria contornável digitando um id inventado.
     */
    for (const fonteId of figura.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`figura "${figura.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
    for (const id of duplicados(figura.trajetoria.map((b) => b.id))) {
      erros.push(`figura "${figura.id}" tem bloco de trajetória duplicado: ${id}`);
    }
  }

  for (const pais of acervo.paises) {
    for (const periodo of pais.periodos) {
      for (const fonteId of periodo.fontes) {
        if (!idsFonte.has(fonteId)) {
          erros.push(`período "${periodo.id}" cita fonte inexistente: ${fonteId}`);
        }
      }
      for (const entidade of periodo.entidades) {
        for (const fonteId of entidade.fontes) {
          if (!idsFonte.has(fonteId)) {
            erros.push(
              `entidade "${entidade.nome}" em "${periodo.id}" cita fonte inexistente: ${fonteId}`
            );
          }
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

  for (const id of duplicados(acervo.episodios.map((e) => e.id))) {
    erros.push(`episódio com id duplicado: ${id}`);
  }

  /*
   * O episódio é o único texto longo do acervo cuja fonte o schema já exige.
   * O que sobra para cá é o que cruza arquivo: o país precisa existir, o
   * período apontado precisa existir, e o id do bloco não pode repetir dentro
   * do mesmo episódio — âncora duplicada levaria o leitor ao bloco errado.
   */
  const idsPeriodo = new Set(
    acervo.paises.flatMap((p) => p.periodos.map((per) => per.id))
  );

  for (const episodio of acervo.episodios) {
    for (const iso of episodio.paises) {
      if (!isoPaises.has(iso)) {
        erros.push(
          `episódio "${episodio.id}" referencia país ${iso}, que não está no atlas`
        );
      }
    }
    for (const periodoId of episodio.periodos) {
      if (!idsPeriodo.has(periodoId)) {
        erros.push(
          `episódio "${episodio.id}" aponta para período inexistente: ${periodoId}`
        );
      }
    }
    for (const fonteId of episodio.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`episódio "${episodio.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
    for (const id of duplicados(episodio.blocos.map((b) => b.id))) {
      erros.push(`episódio "${episodio.id}" tem bloco com id duplicado: ${id}`);
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

  for (const id of duplicados(acervo.notas.map((n) => n.id))) {
    erros.push(`nota com id duplicado: ${id}`);
  }

  /*
   * O alvo da nota usa o mesmo espaço de nomes das ligações `[[...]]`, e
   * vale a mesma regra: apontar para o que não existe é erro de build. Sem
   * isso, renomear um período deixaria notas órfãs apontando para o vazio.
   */
  const alvos = indexarAlvos(acervo);
  for (const nota of acervo.notas) {
    for (const alvo of nota.alvos) {
      if (!(alvo in alvos)) {
        erros.push(`nota "${nota.id}" aponta para alvo inexistente: ${alvo}`);
      }
    }
    for (const fonteId of nota.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`nota "${nota.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
  }

  /*
   * Ilhas. Elas existem porque a base cartográfica não as desenha, então a
   * única garantia de que a soberania afirmada tem lastro é a fonte — não há
   * polígono de origem para conferir contra. Por isso a checagem é mais dura
   * aqui: além de a fonte precisar existir, TODO trecho de soberania precisa
   * de ao menos uma, e ilha sem id único quebraria a referência do mapa.
   */
  for (const id of duplicados(acervo.ilhas.map((i) => i.id))) {
    erros.push(`id de ilha duplicado: ${id}`);
  }
  for (const ilha of acervo.ilhas) {
    for (const fonteId of ilha.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`ilha "${ilha.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
    for (const trecho of ilha.soberania) {
      if (trecho.fontes.length === 0) {
        erros.push(
          `ilha "${ilha.id}": trecho de ${trecho.desde} (${trecho.poder}) está sem fonte`
        );
      }
      for (const fonteId of trecho.fontes) {
        if (!idsFonte.has(fonteId)) {
          erros.push(
            `ilha "${ilha.id}" cita fonte inexistente em ${trecho.desde}: ${fonteId}`
          );
        }
      }
    }
  }

  erros.push(...verificarLigacoes(acervo));

  return erros;
}

export interface Cobertura {
  comTexto: number;
  comFonte: number;
  /** Períodos que afirmam algo em prosa e não dizem de onde. */
  semFonte: string[];
}

/**
 * Quanto da prosa do acervo tem lastro.
 *
 * NÃO é erro: exigir fonte de todo período quebraria os 84 de uma vez, e a
 * saída fácil para destravar o build seria inventar fonte — pior que não
 * ter nenhuma. O que o projeto pode fazer honestamente é contar a dívida e
 * mostrá-la a cada validação, para ela encolher em vez de sumir de vista.
 */
export function coberturaDeFontes(acervo: Acervo): Cobertura {
  const semFonte: string[] = [];
  let comTexto = 0;

  for (const pais of acervo.paises) {
    for (const periodo of pais.periodos) {
      if (!periodo.textoMdx) continue;
      comTexto++;
      if (periodo.fontes.length === 0) semFonte.push(`${pais.iso}/${periodo.id}`);
    }
  }

  return { comTexto, comFonte: comTexto - semFonte.length, semFonte };
}

/**
 * Quantas notas já passaram pela revisão com fonte.
 *
 * As 29 vieram do cofre como rascunho de estudo, e a página avisava que era
 * isso. A decisão de revisá-las e dar lastro tira o aviso — e cria um estado
 * intermediário perigoso, em que a página não avisa mais nada e parte do
 * texto continua cru. Contar aqui é o que impede esse meio-termo de passar
 * despercebido: enquanto `semFonte` não zerar, toda validação diz quantas
 * faltam e quais são.
 */
export function coberturaDeNotas(acervo: Acervo): Cobertura {
  const semFonte = acervo.notas.filter((n) => n.fontes.length === 0).map((n) => n.id);
  return {
    comTexto: acervo.notas.length,
    comFonte: acervo.notas.length - semFonte.length,
    semFonte,
  };
}
