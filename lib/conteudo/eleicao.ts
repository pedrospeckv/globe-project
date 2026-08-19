import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";

/**
 * Lista fechada, e pelo mesmo motivo de `StatusAlegacao`: a distinção que o
 * debate mais confunde precisa viver no rótulo, não diluída na prosa.
 *
 *   registro-protocolado ≠ registro-deferido
 *     pedido entregue ao tribunal ≠ candidatura aprovada
 *   registro-deferido ≠ elegível
 *     o registro pode ser deferido e a inelegibilidade seguir discutida
 *   registro-indeferido ≠ fim da disputa
 *     cabe recurso, e o candidato concorre sub judice até o trânsito
 *
 * "É candidato" é das frases mais repetidas e menos precisas do noticiário
 * eleitoral. O enum obriga quem escreve a dizer qual dos estados é o caso.
 */
export const SituacaoDaCandidatura = z.enum([
  "registro-protocolado",
  "registro-deferido",
  "registro-indeferido",
  "registro-impugnado",
  "renuncia",
]);

export const Chapa = z.object({
  id: Id,
  candidato: z.string().min(1, "chapa precisa de candidato"),
  /** Ausente enquanto o vice não foi indicado ou não consta do pedido. */
  vice: z.string().min(1).optional(),
  /** Sigla do partido que encabeça o pedido de registro. */
  partido: z.string().min(1, "chapa precisa de partido"),
  situacao: SituacaoDaCandidatura,
  /**
   * Explica a situação quando ela precisa de explicação — é o campo que
   * carrega "registrado E inelegível ao mesmo tempo", que o rótulo sozinho
   * não consegue dizer.
   */
  nota: z.string().optional(),
  /** Liga à `Figura` do acervo, quando existe uma. Quase nunca existe. */
  figura: Id.optional(),
});

export const Eleicao = z
  .object({
    id: Id,
    titulo: z.string().min(1),
    paisIso: z.string().regex(/^[A-Z]{3}$/, "paisIso deve ter 3 letras maiúsculas"),
    cargo: z.string().min(1),
    primeiroTurno: DataHistorica,
    segundoTurno: DataHistorica.optional(),
    /** O prazo que fecha a lista — é ele que torna a contagem verificável. */
    prazoDeRegistro: DataHistorica.optional(),
    abertura: z.string().min(1, "eleição precisa de abertura"),
    /**
     * A ordem do arquivo é a ordem da tela, como em todo lugar deste acervo.
     *
     * Aqui isso é decisão editorial pesada: qualquer ordenação de candidatos
     * insinua ranking. A regra do atlas é ordem alfabética pelo nome do
     * candidato, dita em voz alta na página — e não pesquisa, não tamanho de
     * partido, não tempo de televisão. Um teste confere.
     */
    chapas: z.array(Chapa).min(2, "eleição precisa de ao menos duas chapas"),
    fecho: z.string().min(1).optional(),
    /**
     * OBRIGATÓRIA. Eleição em curso é o assunto mais volátil que este acervo
     * cobre: a lista muda por decisão judicial, por renúncia e por
     * substituição, e um texto sem procedência envelhece sem deixar rastro de
     * quando estava certo.
     */
    fontes: z.array(Id).min(1, "eleição precisa de ao menos uma fonte"),
    /**
     * Quando esta lista foi conferida.
     *
     * Não é enfeite: é o que separa "está errado" de "mudou depois". Sem a
     * data, o leitor não tem como saber se olha um retrato ou um erro.
     */
    conferidoEm: DataHistorica,
  })
  .refine(
    (e) => !e.segundoTurno || comparaData(e.segundoTurno, e.primeiroTurno) > 0,
    { message: "segundo turno não pode vir antes do primeiro", path: ["segundoTurno"] }
  )
  .refine(
    (e) =>
      !e.prazoDeRegistro ||
      comparaData(e.prazoDeRegistro, e.primeiroTurno) <= 0,
    {
      message: "prazo de registro não pode ser depois da votação",
      path: ["prazoDeRegistro"],
    }
  );

export type SituacaoDaCandidatura = z.infer<typeof SituacaoDaCandidatura>;
export type Chapa = z.infer<typeof Chapa>;
export type Eleicao = z.infer<typeof Eleicao>;

/** Como cada situação aparece na tela. Curto, e sem eufemismo. */
export const ROTULO_DA_SITUACAO: Record<SituacaoDaCandidatura, string> = {
  "registro-protocolado": "registro protocolado",
  "registro-deferido": "registro deferido",
  "registro-indeferido": "registro indeferido",
  "registro-impugnado": "registro impugnado",
  renuncia: "renúncia",
};

/** Eleições de um país, da mais recente para a mais antiga. */
export function eleicoesDoPais(eleicoes: Eleicao[], iso: string): Eleicao[] {
  return eleicoes
    .filter((e) => e.paisIso === iso)
    .sort((a, b) => comparaData(b.primeiroTurno, a.primeiroTurno));
}

/**
 * As chapas estão em ordem alfabética pelo nome do candidato?
 *
 * Usa `localeCompare` em pt-BR para que acento não jogue "Ângela" para depois
 * de "Zema", que é o que a comparação de código de caractere faria.
 */
export function emOrdemAlfabetica(chapas: readonly Chapa[]): boolean {
  return chapas.every(
    (c, i) =>
      i === 0 || chapas[i - 1].candidato.localeCompare(c.candidato, "pt-BR") <= 0
  );
}
