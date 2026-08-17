import { describe, it, expect } from "vitest";
import { semFrontmatter, temFrontmatter } from "./frontmatter";

describe("semFrontmatter", () => {
  it("remove o cabeçalho de nota de livro do cofre", () => {
    const bruto = [
      "---",
      "Tag: 📚Book",
      "Título: A Arte da guerra",
      "Autor:",
      "  - Sun Tzu",
      "Capa: http://books.google.com/books/content?id=e0wWDQAAQBAJ",
      "---",
      "",
      "**Sun Tzu** escreve durante os Reinos Combatentes.",
    ].join("\n");

    expect(semFrontmatter(bruto)).toBe(
      "**Sun Tzu** escreve durante os Reinos Combatentes."
    );
  });

  it("aceita CRLF — o cofre é Windows", () => {
    expect(semFrontmatter("---\r\ntags:\r\n  - clippings\r\n---\r\n\r\nTexto.")).toBe(
      "Texto."
    );
  });

  it("aceita `...` como fechamento, que o YAML também permite", () => {
    expect(semFrontmatter("---\ntitle: X\n...\nTexto.")).toBe("Texto.");
  });

  it("texto sem cabeçalho passa intacto", () => {
    const nota = "**Roma** cai em 476.\n\nE o resto segue.";
    expect(semFrontmatter(nota)).toBe(nota);
  });

  it("preserva `---` de divisória no meio da nota", () => {
    // Sem a âncora no início, isto viraria perda de texto silenciosa.
    const nota = "Primeira parte.\n\n---\n\nSegunda parte.";
    expect(semFrontmatter(nota)).toBe(nota);
  });

  it("nota que ABRE com divisória não perde o texto até a próxima", () => {
    /*
     * O caso que justifica exigir o bloco fechado com linha própria: aqui não
     * há cabeçalho nenhum, só uma divisória logo no começo.
     */
    const nota = "---\n\nAbre com divisória e segue.";
    expect(semFrontmatter(nota)).toBe(nota);
  });

  it("remove um bloco só — dois seguidos é arquivo corrompido, não some", () => {
    const bruto = "---\na: 1\n---\n---\nb: 2\n---\nTexto.";
    expect(semFrontmatter(bruto)).toBe("---\nb: 2\n---\nTexto.");
  });

  it("cabeçalho de valor vazio, como o `Status:` do cofre", () => {
    expect(semFrontmatter("---\nCompleto: true\nStatus:\n---\nTexto.")).toBe("Texto.");
  });
});

describe("temFrontmatter", () => {
  it("reconhece o que semFrontmatter remove, e nada além", () => {
    const casos = [
      "---\na: 1\n---\nTexto.",
      "---\r\na: 1\r\n---\r\nTexto.",
      "Texto puro.",
      "Antes.\n\n---\n\nDepois.",
      "---\n\nAbre com divisória.",
    ];
    for (const c of casos) {
      expect(temFrontmatter(c)).toBe(semFrontmatter(c) !== c.trimStart());
    }
  });
});
