import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";
import { Imagem } from "./imagem";

/**
 * Fonte no período é OPCIONAL, e a assimetria com a alegação é deliberada.
 *
 * Alegação é afirmação contestada: sem lastro não pode existir, e o schema
 * exige. Período é recorte cronológico, e um período sem prosa — só rótulo,
 * datas e regime — não afirma nada que precise de fonte.
 *
 * Mas prosa que cita 4,8 milhões de desembarcados ou 8.350 mortos afirma
 * muito. Por isso o validador conta a cobertura e diz quantos períodos com
 * texto seguem sem fonte: a dívida fica visível e contável em vez de
 * invisível, que é o que era até agora.
 */
const FontesDoTexto = z.array(Id).default([]);

/**
 * Um Estado soberano que dividiu o território do país durante um período.
 *
 * Existe porque a espinha dorsal do atlas são países MODERNOS, e país moderno
 * é uma fotografia de hoje: sempre que um território abrigou mais de um
 * Estado — Alemanha 1949–1990, Vietnã 1954–1976, Iêmen até 1990 — o par
 * país × período sozinho não consegue dizer isso.
 *
 * Entidade não tem geometria própria de propósito. Desenhar a fronteira
 * interalemã exigiria GeoJSON histórico, que é item de v2 (§12). Em vez de
 * fingir uma forma que não temos, o globo hachura o país e admite a
 * limitação.
 */
export const Entidade = z.object({
  nome: z.string().min(1),
  regime: z.string().min(1),
  textoMdx: z.string().optional(),
  fontes: FontesDoTexto,
});

/**
 * Um retrato datado de um país — a unidade de conteúdo do atlas.
 * "França 1420" e "França 2026" são dois Periodo do mesmo Pais, o que faz
 * geopolítica atual ser o último período da timeline, não um módulo separado.
 */
export const Periodo = z
  .object({
    id: Id,
    inicio: DataHistorica,
    /** Ausente significa período em curso. */
    fim: DataHistorica.optional(),
    /**
     * Nome da entidade política na época — "Reino da Inglaterra",
     * "Grã-Bretanha". É o que mantém a precisão histórica apesar de a
     * geometria ser sempre a moderna (ver §12 do spec).
     */
    rotulo: z.string().min(1),
    regime: z.string().min(1),
    textoMdx: z.string().optional(),
    fontes: FontesDoTexto,
    /**
     * Uma imagem feita DURANTE o período, e não uma que o represente.
     *
     * A distinção não é preciosismo: "Independência ou Morte" é de 1888 e
     * mostra 1822 como o Império quis ser lembrado no fim da vida; "Primeira
     * Missa no Brasil" é de 1860 e inventa uma cena de 1500. As duas são
     * quadros sobre a memória do período, não documentos dele, e postas como
     * ilustração de período passam por documento sem que nada na página diga
     * que não são. O schema não consegue conferir a data da imagem — quem
     * confere é `imagensDoPeriodo` nos testes, contra o intervalo declarado.
     */
    imagem: Imagem.optional(),
    /** Vazio no caso normal; 2 ou mais quando o território esteve dividido. */
    entidades: z.array(Entidade).default([]),
  })
  .refine((p) => !p.fim || comparaData(p.fim, p.inicio) >= 0, {
    message: "período não pode terminar antes de começar",
    path: ["fim"],
  })
  .refine((p) => p.entidades.length !== 1, {
    message:
      "período dividido precisa de ao menos duas entidades — uma só é o próprio período",
    path: ["entidades"],
  });

export const Pais = z.object({
  iso: z.string().regex(/^[A-Z]{3}$/, "iso deve ter 3 letras maiúsculas"),
  /**
   * O ISO 3166-1 NUMÉRICO, que é como o mapa identifica país.
   *
   * Mora aqui, no arquivo do próprio país, e não numa tabela central — e a razão
   * é de projeto aberto, não de gosto. Era `lib/geo/iso.ts`, escrita à mão: o
   * único arquivo compartilhado que um PR de país precisava tocar. Com 165 países
   * por escrever, é onde os PRs colidiriam uns com os outros, e um contribuidor
   * gastaria a primeira meia hora resolvendo conflito num arquivo que não é o
   * dele. Agora país novo é UM arquivo novo e nada mais.
   *
   * O número não é palavra do contribuidor: `scripts/validar-conteudo.ts` confere
   * que existe uma feição com este código na geometria que o projeto empacota. Se
   * o país não estiver lá, o build para — que é a mesma regra da alegação sem
   * fonte, aplicada a código de país.
   */
  isoNumerico: z
    .string()
    .regex(/^\d{3}$/, "isoNumerico deve ter 3 dígitos — o ISO 3166-1 numérico, como \"076\""),
  nome: z.string().min(1),
  periodos: z.array(Periodo).min(1, "país precisa de ao menos um período"),
});

export type Entidade = z.infer<typeof Entidade>;
export type Periodo = z.infer<typeof Periodo>;
export type Pais = z.infer<typeof Pais>;

/** O território abrigava mais de um Estado neste período. */
/**
 * A data cai dentro do período?
 *
 * Início inclusivo, fim exclusivo — a mesma regra do `periodoVigente`, que é
 * o que faz 1822 pertencer ao Império e não à Colônia. Sem isso, um evento
 * numa virada apareceria nos dois períodos de uma vez.
 */
export function dentroDoPeriodo(periodo: Periodo, data: string): boolean {
  if (comparaData(data, periodo.inicio) < 0) return false;
  return !periodo.fim || comparaData(data, periodo.fim) < 0;
}

/**
 * Primeiro parágrafo do texto, para o índice do país.
 *
 * O dossiê deixou de empilhar a prosa inteira quando o Brasil chegou a
 * 19 mil caracteres e sete mil pixels de rolagem.
 */
export function resumoDe(periodo: Periodo): string | undefined {
  return periodo.textoMdx?.split("\n\n")[0];
}

/** Períodos anterior e seguinte, para atravessar o país lendo. */
export function vizinhosDe(
  pais: Pais,
  id: string
): { anterior: Periodo | null; proximo: Periodo | null } {
  const i = pais.periodos.findIndex((p) => p.id === id);
  if (i === -1) return { anterior: null, proximo: null };
  return {
    anterior: pais.periodos[i - 1] ?? null,
    proximo: pais.periodos[i + 1] ?? null,
  };
}

export function estaDividido(periodo: Periodo): boolean {
  return periodo.entidades.length >= 2;
}
