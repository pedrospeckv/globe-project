import { describe, it, expect } from "vitest";
import path from "node:path";
import { Nota, notasDoAlvo } from "./nota";
import { carregarAcervo } from "./carregar";
import { indexarAlvos } from "./ligacoes";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

describe("Nota", () => {
  it("recusa nota vazia — rascunho não vira publicação", () => {
    const r = Nota.safeParse({
      id: "x",
      titulo: "T",
      pasta: "P",
      corpo: "",
      atualizadaEm: "2025-01-01",
    });
    expect(r.success).toBe(false);
  });

  it("alvos é opcional — a maioria das notas não tem correspondente", () => {
    const r = Nota.safeParse({
      id: "x",
      titulo: "T",
      pasta: "P",
      corpo: "conteúdo",
      atualizadaEm: "2025-01-01",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.alvos).toEqual([]);
  });
});

describe("notas importadas do cofre", () => {
  it("o acervo tem notas, e nenhuma vazia", () => {
    expect(acervo.notas.length).toBeGreaterThan(0);
    for (const n of acervo.notas) expect(n.corpo.length).toBeGreaterThan(0);
  });

  it("todo alvo de nota existe no atlas", () => {
    // Mesma regra das ligações: apontar para o que não existe é erro.
    const alvos = indexarAlvos(acervo);
    for (const n of acervo.notas) {
      for (const a of n.alvos) expect(alvos[a]).toBeDefined();
    }
  });

  it("a nota de Joana d'Arc encontra a figura que já existia", () => {
    const joana = acervo.notas.find((n) => n.id === "historia-de-joana-d-arc");
    expect(joana?.alvos).toContain("joana-darc");
    expect(notasDoAlvo(acervo.notas, "joana-darc").map((n) => n.id)).toContain(
      "historia-de-joana-d-arc"
    );
  });

  it("notasDoAlvo devolve em ordem alfabética e só as do alvo", () => {
    const daRussia = notasDoAlvo(acervo.notas, "RUS");
    expect(daRussia.length).toBeGreaterThan(1);
    const titulos = daRussia.map((n) => n.titulo);
    expect(titulos).toEqual([...titulos].sort((a, b) => a.localeCompare(b, "pt-BR")));
    for (const n of daRussia) expect(n.alvos).toContain("RUS");
  });

  it("alvo sem nota devolve lista vazia, não erro", () => {
    expect(notasDoAlvo(acervo.notas, "alvo-inexistente")).toEqual([]);
  });
});
