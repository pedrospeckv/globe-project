import type { Fonte } from "./fonte";
import type { Figura } from "./figura";
import type { Pais } from "./pais";
import type { Viagem } from "./viagem";
import type { Indicador } from "./indicador";
import type { Evento } from "./evento";
import type { Episodio } from "./episodio";
import type { Eleicao } from "./eleicao";
import type { Nota } from "./nota";
import type { Ilha } from "./ilha";
import type { Nacao } from "./nacao";
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
  eleicoes: Eleicao[];
  notas: Nota[];
  ilhas: Ilha[];
  nacoes: Nacao[];
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

/** Um `**` que embrulha o parágrafo do começo ao fim. DOTALL: pode ter linha dentro. */
const PARAGRAFO_EMBRULHADO = /^\*\*([\s\S]+)\*\*$/;

/**
 * Parágrafos onde o negrito embrulha o texto INTEIRO — que não é ênfase.
 *
 * No `Prosa` o `strong` vira `font-semibold text-slate-100`, um tom mais claro
 * que os `text-slate-300` em volta. Num parágrafo inteiro isso não destaca
 * nada: só deixa o bloco mais claro e mais pesado que os vizinhos, e a página
 * vira faixas de brilho alternadas. Nos dossiês escritos à mão o negrito lifta
 * uma FRASE — um nome, uma data, o número que importa — e a medição separa os
 * dois usos com nitidez: os nove primeiros países têm 0,6 negritos por
 * parágrafo e zero parágrafos embrulhados; nos 157 escritos em lote, 469
 * parágrafos vinham embrulhados, até 62% dos de um mesmo país.
 *
 * Por que no validador e não no schema: o Zod olha um campo por vez e este é
 * um defeito de REGISTRO, não de forma — o texto é markdown válido e o período
 * é válido. É a mesma razão que põe a fonte inexistente aqui.
 *
 * `**A** e **B**` fica: tem `**` dentro do que foi capturado, então é ênfase
 * de frase e passa.
 */
function paragrafosTodosEmNegrito(texto?: string): string[] {
  if (!texto) return [];
  const achados: string[] = [];
  for (const bruto of texto.split("\n\n")) {
    const casa = PARAGRAFO_EMBRULHADO.exec(bruto.trim());
    if (casa && !casa[1].includes("**")) {
      achados.push(casa[1].slice(0, 60) + (casa[1].length > 60 ? "…" : ""));
    }
  }
  return achados;
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
      for (const paragrafo of paragrafosTodosEmNegrito(periodo.textoMdx)) {
        erros.push(
          `período "${periodo.id}" tem parágrafo inteiro em negrito: "${paragrafo}"`
        );
      }
      for (const entidade of periodo.entidades) {
        for (const fonteId of entidade.fontes) {
          if (!idsFonte.has(fonteId)) {
            erros.push(
              `entidade "${entidade.nome}" em "${periodo.id}" cita fonte inexistente: ${fonteId}`
            );
          }
        }
        for (const paragrafo of paragrafosTodosEmNegrito(entidade.textoMdx)) {
          erros.push(
            `entidade "${entidade.nome}" em "${periodo.id}" tem parágrafo inteiro em negrito: "${paragrafo}"`
          );
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

  for (const id of duplicados(acervo.eleicoes.map((e) => e.id))) {
    erros.push(`eleição com id duplicado: ${id}`);
  }

  /*
   * A eleição é o conteúdo mais volátil do acervo, e o que mais depende de
   * referência cruzada correta: chapa que aponta para figura inexistente
   * publicaria link morto num assunto em que o leitor confere.
   */
  const idsFigura = new Set(acervo.figuras.map((f) => f.id));

  for (const eleicao of acervo.eleicoes) {
    if (!isoPaises.has(eleicao.paisIso)) {
      erros.push(
        `eleição "${eleicao.id}" referencia país ${eleicao.paisIso}, que não está no atlas`
      );
    }
    for (const fonteId of eleicao.fontes) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`eleição "${eleicao.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
    for (const id of duplicados(eleicao.chapas.map((c) => c.id))) {
      erros.push(`eleição "${eleicao.id}" tem chapa com id duplicado: ${id}`);
    }
    for (const chapa of eleicao.chapas) {
      if (chapa.figura && !idsFigura.has(chapa.figura)) {
        erros.push(
          `chapa "${chapa.id}" em "${eleicao.id}" aponta para figura inexistente: ${chapa.figura}`
        );
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

  /*
   * A nação carrega três referências que só se conferem cruzando arquivos: o
   * país anfitrião, os períodos dele em que ela aparece, e o episódio que conta
   * a história dela. A do episódio é a que mais importa — o schema exige a
   * lista não vazia, mas um id errado ali deixaria a página sem narrativa
   * nenhuma, que é justamente o verbete raso que a entidade existe para evitar.
   */
  for (const id of duplicados(acervo.nacoes.map((n) => n.id))) {
    erros.push(`id de nação duplicado: ${id}`);
  }
  const idsEpisodio = new Set(acervo.episodios.map((e) => e.id));
  for (const nacao of acervo.nacoes) {
    const anfitriao = acervo.paises.find((p) => p.iso === nacao.anfitriao);
    if (!anfitriao) {
      erros.push(
        `nação "${nacao.id}" cita país anfitrião inexistente: ${nacao.anfitriao}`
      );
    } else {
      const idsPeriodo = new Set(anfitriao.periodos.map((p) => p.id));
      for (const periodoId of nacao.periodos) {
        if (!idsPeriodo.has(periodoId)) {
          erros.push(
            `nação "${nacao.id}" cita período inexistente em ${nacao.anfitriao}: ${periodoId}`
          );
        }
      }
    }
    for (const episodioId of nacao.episodios) {
      if (!idsEpisodio.has(episodioId)) {
        erros.push(
          `nação "${nacao.id}" cita episódio inexistente: ${episodioId}`
        );
      }
    }
    for (const fonteId of [...nacao.fontes, ...nacao.reconhecimento.fontes]) {
      if (!idsFonte.has(fonteId)) {
        erros.push(`nação "${nacao.id}" cita fonte inexistente: ${fonteId}`);
      }
    }
  }

  /*
   * Id repetido ENTRE tipos, que é o defeito que a nação quase introduziu.
   *
   * `indexarAlvos` põe tudo num Record plano, e ali `escocia` a nação e
   * `escocia` o episódio não convivem: o último a ser indexado apaga o
   * primeiro, sem erro nenhum. O sintoma seria um `[[escocia]]` levando à
   * página errada — e nada no build acusaria, porque as duas entradas são
   * válidas em separado.
   *
   * A nota fica de fora de propósito: ela já cede o nome quando colide, e essa
   * precedência é a regra escrita em `ligacoes.ts`, não um acidente.
   */
  const donoDoId = new Map<string, string>();
  const reivindicar = (id: string, tipo: string) => {
    const dono = donoDoId.get(id);
    if (dono && dono !== tipo) {
      erros.push(`id "${id}" é usado por ${dono} e por ${tipo} ao mesmo tempo`);
    } else {
      donoDoId.set(id, tipo);
    }
  };
  for (const pais of acervo.paises) {
    reivindicar(pais.iso, "país");
    for (const periodo of pais.periodos) reivindicar(periodo.id, "período");
  }
  for (const f of acervo.figuras) reivindicar(f.id, "figura");
  for (const e of acervo.eventos) reivindicar(e.id, "evento");
  for (const e of acervo.episodios) reivindicar(e.id, "episódio");
  for (const e of acervo.eleicoes) reivindicar(e.id, "eleição");
  for (const v of acervo.viagens) reivindicar(v.id, "viagem");
  for (const n of acervo.nacoes) reivindicar(n.id, "nação");

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

export interface CoberturaDeImagens {
  /** Países com imagem em todos os períodos. */
  completos: string[];
  /** Países sem imagem em nenhum período — dívida declarada, não defeito. */
  vazios: string[];
  /** Países com uns períodos ilustrados e outros não. É este o defeito. */
  pelaMetade: string[];
  periodos: number;
  comImagem: number;
}

/**
 * Quanto do acervo tem imagem de época, contado por país.
 *
 * A distinção entre "vazio" e "pela metade" é a razão de esta função existir.
 *
 * País sem nenhuma imagem é dívida declarada: entrou pela cobertura em largura
 * e ainda não passou pela curadoria de imagem, que é lenta — cada período pede
 * uma peça feita DENTRO do período, sob licença livre, com descrição que
 * permita escrever o texto alternativo sem inventar o que a foto mostra.
 * Exigir isso de todo país novo travaria a largura, que é a prioridade
 * declarada do projeto.
 *
 * País pela metade é outra coisa. Significa que alguém começou a ilustrar e
 * parou, e ninguém notou — porque o buraco não aparece em lugar nenhum até um
 * leitor abrir justamente aquele período. É o único dos três estados que não
 * se explica sozinho, e por isso é o que o teste recusa.
 */
export function coberturaDeImagens(acervo: Acervo): CoberturaDeImagens {
  const completos: string[] = [];
  const vazios: string[] = [];
  const pelaMetade: string[] = [];
  let periodos = 0;
  let comImagem = 0;

  for (const pais of acervo.paises) {
    const com = pais.periodos.filter((p) => p.imagem).length;
    periodos += pais.periodos.length;
    comImagem += com;
    if (com === 0) vazios.push(pais.iso);
    else if (com === pais.periodos.length) completos.push(pais.iso);
    else pelaMetade.push(`${pais.iso} (${com}/${pais.periodos.length})`);
  }

  return { completos, vazios, pelaMetade, periodos, comImagem };
}
