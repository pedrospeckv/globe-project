import { describe, it, expect } from "vitest";
import { criarTraducaoIso, normalizarNumerico } from "./iso";

/*
 * A tradução é montada de países de MENTIRA, e é essa a diferença em relação à
 * versão anterior deste arquivo: ele testava a tabela real de nove entradas, então
 * cada país novo no atlas mexia no teste. Agora o teste é sobre o mecanismo, e o
 * acervo real é conferido no build por `conferirCodigosDePais`.
 */
const BRA = { iso: "BRA", isoNumerico: "076" };
const FRA = { iso: "FRA", isoNumerico: "250" };
const PER = { iso: "PER", isoNumerico: "604" };

describe("normalizarNumerico", () => {
  /* O topojson alterna "076", "76" e 76 conforme a fatia e a versão da base. */
  it("põe três dígitos, venha como vier", () => {
    expect(normalizarNumerico("076")).toBe("076");
    expect(normalizarNumerico("76")).toBe("076");
    expect(normalizarNumerico(76)).toBe("076");
    expect(normalizarNumerico("840")).toBe("840");
  });
});

describe("criarTraducaoIso", () => {
  it("traduz numérico para alpha-3", () => {
    const t = criarTraducaoIso([BRA, FRA]);
    expect(t.alpha3De("076")).toBe("BRA");
    expect(t.alpha3De("250")).toBe("FRA");
  });

  it("normaliza na consulta", () => {
    const t = criarTraducaoIso([BRA]);
    expect(t.alpha3De("76")).toBe("BRA");
    expect(t.alpha3De(76)).toBe("BRA");
  });

  /*
   * Fora do acervo é `undefined`, e não um palpite. É o que faz o país sem dossiê
   * cair na camada de fundo em vez de virar polígono clicável sem destino.
   */
  it("devolve undefined para país que não está no acervo", () => {
    const t = criarTraducaoIso([BRA, FRA]);
    expect(t.alpha3De("604")).toBeUndefined();
    expect(t.temPais("PER")).toBe(false);
    expect(t.temPais("BRA")).toBe(true);
  });

  it("guarda a lista de alpha-3 do acervo", () => {
    expect(criarTraducaoIso([BRA, FRA, PER]).paises).toEqual(["BRA", "FRA", "PER"]);
  });

  /*
   * Código repetido ESTOURA em vez de um país sobrescrever o outro calado. O
   * efeito visível do silêncio seria um dossiê acendendo no polígono do vizinho,
   * que é o tipo de erro que ninguém procura porque o mapa continua bonito.
   */
  it("recusa dois países com o mesmo código numérico", () => {
    expect(() =>
      criarTraducaoIso([BRA, { iso: "ARG", isoNumerico: "076" }])
    ).toThrow(/076 declarado por BRA e por ARG/);
  });

  /* O mesmo país repetido não é conflito — é lista com duplicata, e tolerar é
     melhor que quebrar o mapa por causa de um arquivo lido duas vezes. */
  it("tolera o mesmo país repetido", () => {
    const t = criarTraducaoIso([BRA, BRA]);
    expect(t.alpha3De("076")).toBe("BRA");
  });

  it("aceita acervo vazio", () => {
    const t = criarTraducaoIso([]);
    expect(t.alpha3De("076")).toBeUndefined();
    expect(t.paises).toEqual([]);
  });
});
