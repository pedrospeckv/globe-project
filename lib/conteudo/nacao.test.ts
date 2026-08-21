import path from "node:path";
import { describe, it, expect } from "vitest";
import { Nacao, nacoesDoPais, nacoesDoPeriodo } from "./nacao";
import { carregarAcervo } from "./carregar";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

/** Uma nação mínima que passa, para os testes a deformarem de um campo por vez. */
function base() {
  return {
    id: "teste",
    nome: "Nação de teste",
    anfitriao: "GBR",
    ponto: [-4, 56],
    reconhecimento: {
      instrumento: "Lei de teste",
      data: "1998",
      textoMdx: "O que a lei diz.",
      fontes: ["alguma-fonte"],
    },
    abertura: "Abertura.",
    episodios: ["algum-episodio"],
  };
}

describe("schema da nação", () => {
  it("aceita o caso mínimo", () => {
    expect(Nacao.safeParse(base()).success).toBe(true);
  });

  it("recusa nação sem fonte no reconhecimento — é ele o critério de entrada", () => {
    const n = base();
    n.reconhecimento.fontes = [];
    const r = Nacao.safeParse(n);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("critério de entrada");
  });

  it("recusa nação sem reconhecimento nenhum", () => {
    const { reconhecimento: _, ...sem } = base();
    expect(Nacao.safeParse(sem).success).toBe(false);
  });

  it("recusa nação sem episódio — ficha de identidade não é verbete", () => {
    const r = Nacao.safeParse({ ...base(), episodios: [] });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("ao menos um episódio");
  });

  it("recusa anfitrião que não é ISO alpha-3", () => {
    expect(Nacao.safeParse({ ...base(), anfitriao: "gb" }).success).toBe(false);
    expect(Nacao.safeParse({ ...base(), anfitriao: "826" }).success).toBe(false);
  });

  it("recusa ponto fora do globo", () => {
    expect(Nacao.safeParse({ ...base(), ponto: [-4, 95] }).success).toBe(false);
    expect(Nacao.safeParse({ ...base(), ponto: [200, 56] }).success).toBe(false);
  });

  it("aceita nação sem legislatura — reconhecida pode não ter casa própria", () => {
    expect(Nacao.safeParse(base()).success).toBe(true);
  });

  it("recusa competência fora do enum", () => {
    const n = {
      ...base(),
      legislatura: { nome: "X", desde: "1998", competencia: "parcial" },
    };
    expect(Nacao.safeParse(n).success).toBe(false);
  });
});

describe("nações no acervo", () => {
  it("Escócia e Gales estão registradas sob o Reino Unido", () => {
    const nomes = nacoesDoPais(acervo.nacoes, "GBR").map((n) => n.nome);
    expect(nomes).toContain("Escócia");
    expect(nomes).toContain("País de Gales");
  });

  it("toda nação aponta para episódio que existe", () => {
    const ids = new Set(acervo.episodios.map((e) => e.id));
    for (const n of acervo.nacoes) {
      for (const id of n.episodios) expect(ids.has(id)).toBe(true);
    }
  });

  it("toda nação aponta para país anfitrião que existe", () => {
    const isos = new Set(acervo.paises.map((p) => p.iso));
    for (const n of acervo.nacoes) expect(isos.has(n.anfitriao)).toBe(true);
  });

  it("todo período citado existe no país anfitrião", () => {
    for (const n of acervo.nacoes) {
      const pais = acervo.paises.find((p) => p.iso === n.anfitriao)!;
      const ids = new Set(pais.periodos.map((p) => p.id));
      for (const id of n.periodos) expect(ids.has(id)).toBe(true);
    }
  });

  it("nacoesDoPeriodo devolve as duas no período atual do Reino Unido", () => {
    const achadas = nacoesDoPeriodo(acervo.nacoes, "gb-reino-unido-atual").map((n) => n.id);
    expect(achadas).toEqual(["escocia", "pais-de-gales"]);
  });

  /*
   * A diferença entre as duas leis de 1998 é o fato institucional mais
   * interessante que este schema guarda, e um copiar-e-colar entre os dois
   * arquivos a apagaria sem que nada mais acusasse.
   */
  it("Escócia tem competência primária e Gales começou delegada", () => {
    const escocia = acervo.nacoes.find((n) => n.id === "escocia")!;
    const gales = acervo.nacoes.find((n) => n.id === "pais-de-gales")!;
    expect(escocia.legislatura?.competencia).toBe("primaria");
    expect(gales.legislatura?.competencia).toBe("primaria");
    expect(gales.legislatura?.nota).toMatch(/delegad/i);
  });
});
