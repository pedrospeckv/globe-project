import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";
import { Bloco, comImagem, emOrdem } from "./bloco";

/**
 * Um recorte geopolítico narrado em blocos, com imagem de época em cada um.
 *
 * Existe porque a unidade país × período não dá conta de tudo que o atlas
 * quer contar. O Brasil holandês durou 24 anos dentro de um período colonial
 * de três séculos, aconteceu em quatro capitanias e envolveu dois Estados
 * europeus — é episódio, não período, e transformá-lo em período fatiaria a
 * Colônia em pedaços que só existem para acomodar um caso.
 *
 * As alternativas descartadas, e por quê:
 *
 * - **`Evento`** — é ponto no mapa numa data, e tem fonte OPCIONAL de
 *   propósito (§5 do spec: acontecimento datado e consolidado). Episódio é
 *   narrativa longa que afirma causa, número e intenção. Fonte aqui é
 *   obrigatória, como na alegação, e pelo mesmo motivo.
 * - **`Nota`** — é rascunho de estudo declarado, sem revisão. O oposto disto.
 * - **`Entidade` do período** — serve para território dividido, mas vale para
 *   o período inteiro. Marcar a Colônia como dividida de 1500 a 1822 mentiria
 *   sobre 297 dos 322 anos.
 */
export const Episodio = z
  .object({
    id: Id,
    titulo: z.string().min(1),
    subtitulo: z.string().min(1).optional(),
    inicio: DataHistorica,
    fim: DataHistorica.optional(),
    /** ISO alpha-3 dos países do atlas a que o episódio pertence. */
    paises: z
      .array(z.string().regex(/^[A-Z]{3}$/))
      .min(1, "episódio precisa de ao menos um país"),
    /** Períodos em que ele cabe, para o dossiê do período apontar de volta. */
    periodos: z.array(Id).default([]),
    /** O parágrafo de entrada, antes do primeiro bloco. */
    abertura: z.string().min(1, "episódio precisa de abertura"),
    blocos: z.array(Bloco).min(2, "episódio precisa de ao menos dois blocos"),
    /**
     * O fecho, no lugar que o memorial da Segunda Guerra reserva ao
     * "In Memoriam": o que ficou, o que segue em disputa, o que o atlas não
     * resolve. Opcional porque nem todo episódio termina em ressalva.
     */
    fecho: z.string().min(1).optional(),
    /**
     * OBRIGATÓRIA, ao contrário do evento e do período.
     *
     * Um episódio é prosa longa sobre um assunto escolhido por ser curioso, e
     * é justamente aí que a narrativa escorrega sem que ninguém note. O
     * schema recusa o texto sem lastro em vez de contar a dívida depois.
     */
    fontes: z.array(Id).min(1, "episódio precisa de ao menos uma fonte"),
  })
  .refine((e) => !e.fim || comparaData(e.fim, e.inicio) >= 0, {
    message: "episódio não pode terminar antes de começar",
    path: ["fim"],
  })
  .refine((e) => emOrdem(e.blocos), {
    message: "blocos fora de ordem cronológica",
    path: ["blocos"],
  });

export type Episodio = z.infer<typeof Episodio>;

/** Episódios de um país, do mais antigo para o mais recente. */
export function episodiosDoPais(episodios: Episodio[], iso: string): Episodio[] {
  return episodios
    .filter((e) => e.paises.includes(iso))
    .sort((a, b) => comparaData(a.inicio, b.inicio));
}

/** Episódios ancorados num período, para o dossiê dele apontar. */
export function episodiosDoPeriodo(
  episodios: Episodio[],
  periodoId: string
): Episodio[] {
  return episodios
    .filter((e) => e.periodos.includes(periodoId))
    .sort((a, b) => comparaData(a.inicio, b.inicio));
}

/** Quantas imagens o episódio traz — o número que a capa anuncia. */
export function imagensDe(episodio: Episodio): number {
  return comImagem(episodio.blocos);
}
