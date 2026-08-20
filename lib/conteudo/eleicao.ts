import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";
import { Imagem } from "./imagem";

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
  /**
   * O retrato oficial de registro — a foto que o próprio candidato entregou
   * ao tribunal.
   *
   * A escolha da fonte é a decisão editorial, não a de pôr foto. Retrato é a
   * coisa mais fácil de editorializar numa página de eleição: basta dar ao
   * candidato A a foto de palanque e ao candidato B a foto de depoimento, e
   * a página inteira muda de tom sem que uma palavra mude. Vindos todos do
   * mesmo lote oficial, no mesmo enquadramento e no mesmo tamanho, não sobra
   * escolha a fazer — e é por isso que só o retrato de registro serve aqui.
   *
   * Opcional porque nem toda chapa tem um publicado, e uma chapa sem retrato
   * não pode ficar de fora da lista por causa disso. `emRetratoUniforme`
   * confere que o conjunto não virou meia dúzia com foto e meia dúzia sem.
   */
  foto: Imagem.optional(),
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
  )
  .refine((e) => e.chapas.every((c) => c.foto) || e.chapas.every((c) => !c.foto), {
    message:
      "ou todas as chapas têm retrato, ou nenhuma tem — lista mista faz o " +
      "cartão sem foto parecer candidatura menor",
    path: ["chapas"],
  });

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

/**
 * Ou todas as chapas têm retrato, ou nenhuma tem.
 *
 * O meio-termo é o estado ruim, e ele não parece ruim: seis cartões com rosto
 * e sete com um quadro cinza leem como duas categorias de candidato, e o
 * leitor atribui a diferença ao candidato — pequeno, marginal, não-sério —
 * quando ela é só do acervo de imagens. A página que gasta um parágrafo
 * explicando que a ordem não é ranking não pode desmentir isso no primeiro
 * olhar, que é o que a tela dá antes de qualquer texto ser lido.
 *
 * Recusar a lista mista força a decisão para o único lugar onde ela é
 * honesta: achar o retrato que falta, ou tirar os treze.
 */
export function emRetratoUniforme(chapas: readonly Chapa[]): boolean {
  return (
    chapas.every((c) => c.foto) || chapas.every((c) => !c.foto)
  );
}
