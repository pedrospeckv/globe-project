import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";
import { Alegacao } from "./alegacao";
import { Bloco, comImagem, emOrdem } from "./bloco";
import type { Periodo } from "./pais";

export const Cargo = z.object({
  titulo: z.string().min(1),
  inicio: DataHistorica,
  /** Ausente significa cargo em curso. */
  fim: DataHistorica.optional(),
});

export const Figura = z
  .object({
    id: Id,
    nome: z.string().min(1),
    paisIso: z.string().regex(/^[A-Z]{3}$/, "paisIso deve ter 3 letras maiúsculas"),
    cargos: z.array(Cargo).default([]),
    alegacoes: z.array(Alegacao).default([]),
    textoMdx: z.string().optional(),
    /**
     * A vida narrada em blocos datados com imagem — o mesmo objeto do episódio,
     * porque é a mesma coisa vista de outro ângulo: ali um recorte de
     * território, aqui uma pessoa.
     *
     * Vazia é o caso normal, e continua sendo. Trajetória é o gênero de texto
     * em que a biografia escorrega para hagiografia ou para dossiê de acusação
     * sem que ninguém note, e escrever uma exige tempo e lastro que a maioria
     * das figuras do acervo ainda não tem. Melhor a página dizer só os cargos
     * do que contar uma vida por aproximação.
     *
     * **Nunca substitui a alegação.** A alegação tem status processual fechado
     * e fonte obrigatória por schema justamente para que o que é contestado não
     * seja diluído em prosa. Trajetória é o contexto por cima; se um fato está
     * em disputa, ele é alegação, e o bloco aponta para ela.
     */
    trajetoria: z.array(Bloco).default([]),
    /**
     * Fontes da trajetória — não das alegações, que carregam as suas.
     *
     * Obrigatória assim que houver um bloco, pela regra do episódio: prosa
     * longa sobre pessoa viva é exatamente onde a narrativa escorrega. Sem
     * bloco nenhum, a figura não afirma nada por conta própria e não deve nada.
     */
    fontes: z.array(Id).default([]),
  })
  .refine((f) => emOrdem(f.trajetoria), {
    message: "blocos da trajetória fora de ordem cronológica",
    path: ["trajetoria"],
  })
  .refine((f) => f.trajetoria.length === 0 || f.fontes.length > 0, {
    message: "figura com trajetória escrita precisa de ao menos uma fonte",
    path: ["fontes"],
  });

export type Cargo = z.infer<typeof Cargo>;
export type Figura = z.infer<typeof Figura>;

/**
 * Figuras do país que ocuparam cargo durante o período.
 *
 * Compara INTERVALOS, não datas soltas: um mandato que começa antes e
 * termina dentro conta, e um que atravessa o período inteiro também. Testar
 * só o início deixaria de fora justamente quem governou o período todo.
 */
export function figurasDoPeriodo(
  figuras: Figura[],
  iso: string,
  periodo: Periodo
): Figura[] {
  return figuras.filter(
    (f) =>
      f.paisIso === iso &&
      f.cargos.some((c) => {
        const comecouAntesDoFim =
          !periodo.fim || comparaData(c.inicio, periodo.fim) < 0;
        const terminouDepoisDoInicio =
          !c.fim || comparaData(c.fim, periodo.inicio) >= 0;
        return comecouAntesDoFim && terminouDepoisDoInicio;
      })
  );
}

/**
 * O cargo mais recente da figura, ou o em curso quando há um.
 *
 * Serve para distinguir na lista quem tem nome parecido — o atlas já guarda
 * "Luiz Inácio Lula da Silva" e "Fábio Luís Lula da Silva" —, e entra no que a
 * busca varre, para "presidente" achar quem governou sem exigir o nome.
 *
 * Cargo em curso ganha precedência sobre qualquer encerrado, mesmo que este
 * tenha começado depois: quem está no posto agora é o que identifica a pessoa
 * hoje. Entre encerrados, vence o de início mais recente.
 */
export function cargoMaisRecente(figura: Figura): Cargo | undefined {
  const emCurso = figura.cargos.filter((c) => !c.fim);
  const encerrados = figura.cargos.filter((c) => c.fim);
  const pilha = emCurso.length > 0 ? emCurso : encerrados;
  return pilha.reduce<Cargo | undefined>(
    (melhor, c) =>
      !melhor || comparaData(c.inicio, melhor.inicio) > 0 ? c : melhor,
    undefined
  );
}

/** Quantas imagens a trajetória traz — o número que o cabeçalho anuncia. */
export function imagensDaTrajetoria(figura: Figura): number {
  return comImagem(figura.trajetoria);
}
