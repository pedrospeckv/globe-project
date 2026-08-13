import { describe, it, expect } from "vitest";
import { Fonte } from "./fonte";

const valida = {
  id: "stf-hc-193726",
  tipo: "decisao-judicial",
  titulo: "HC 193.726 — Segunda Turma",
  publicacao: "Supremo Tribunal Federal",
  data: "2021-03-23",
  url: "https://portal.stf.jus.br/exemplo",
};

describe("Fonte", () => {
  it("aceita uma fonte completa", () => {
    expect(Fonte.safeParse(valida).success).toBe(true);
  });

  it("exige título", () => {
    expect(Fonte.safeParse({ ...valida, titulo: "" }).success).toBe(false);
  });

  it("rejeita tipo fora do enum", () => {
    expect(Fonte.safeParse({ ...valida, tipo: "post-de-rede-social" }).success).toBe(
      false
    );
  });

  it("rejeita url malformada", () => {
    expect(Fonte.safeParse({ ...valida, url: "portal.stf.jus.br" }).success).toBe(
      false
    );
  });

  it("aceita fonte sem url — livro impresso não tem link", () => {
    const { url: _url, ...semUrl } = valida;
    expect(Fonte.safeParse({ ...semUrl, tipo: "livro" }).success).toBe(true);
  });

  it("rejeita id fora do formato", () => {
    expect(Fonte.safeParse({ ...valida, id: "STF HC 193726" }).success).toBe(false);
  });

  it("rejeita data em formato não histórico", () => {
    expect(Fonte.safeParse({ ...valida, data: "23/03/2021" }).success).toBe(false);
  });
});
