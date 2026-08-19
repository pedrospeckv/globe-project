import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";
import { Alegacao } from "./alegacao";
import type { Periodo } from "./pais";

export const Cargo = z.object({
  titulo: z.string().min(1),
  inicio: DataHistorica,
  /** Ausente significa cargo em curso. */
  fim: DataHistorica.optional(),
});

export const Figura = z.object({
  id: Id,
  nome: z.string().min(1),
  paisIso: z.string().regex(/^[A-Z]{3}$/, "paisIso deve ter 3 letras maiúsculas"),
  cargos: z.array(Cargo).default([]),
  alegacoes: z.array(Alegacao).default([]),
  textoMdx: z.string().optional(),
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
