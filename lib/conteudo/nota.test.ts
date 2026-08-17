import { describe, it, expect } from "vitest";
import path from "node:path";
import { Nota, notasDoAlvo } from "./nota";
import { temFrontmatter } from "./frontmatter";
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

  it("nenhuma nota publicada veio de fora da triagem", async () => {
    /*
     * Leitura e Podcast misturam estudo histórico com saúde, negócios, fé
     * pessoal e anotações sobre conversas de terceiros nomeados. Só entra o
     * que está na seleção versionada — e este teste é o que impede uma
     * reimportação distraída de publicar o resto.
     */
    const fs = await import("node:fs/promises");
    const { titulos } = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "scripts", "selecao-obsidian.json"),
        "utf8"
      )
    );

    const daTriagem = acervo.notas.filter((n) => n.pasta === "Leitura");
    expect(daTriagem.length).toBeGreaterThan(0);
    for (const n of daTriagem) expect(titulos).toContain(n.titulo);
  });

  it("nenhuma nota é só esqueleto de capítulos", () => {
    /*
     * O modelo de nota de livro do cofre nasce com "### Insights" e
     * "Capítulo 1" a "Capítulo 5" e nada mais. Três dessas foram publicadas
     * porque o filtro de tamanho media o arquivo bruto, e o cabeçalho YAML
     * sozinho passava dos 400 bytes — a página abria com uma lista de
     * capítulos vazios sob o aviso de "anotação pessoal de estudo".
     *
     * Livro lido e resumo não escrito é estado normal e volta quando o texto
     * existir; o que não pode é o esqueleto virar página. O vínculo com o
     * atlas fica guardado em scripts/selecao-obsidian.json enquanto isso.
     */
    for (const n of acervo.notas) {
      const util = n.corpo
        .split("\n")
        .map((l) => l.trim().replace(/^[-*+]\s*/, ""))
        .filter((l) => l && !/^#{1,6}\s/.test(l) && !/^Cap[íi]tulo\s*\d+$/i.test(l));
      expect(util.join(" ").length, `${n.id} não tem texto além dos cabeçalhos`)
        .toBeGreaterThan(200);
    }
  });

  it("nenhuma nota carrega o cabeçalho YAML do cofre", () => {
    for (const n of acervo.notas) expect(temFrontmatter(n.corpo)).toBe(false);
  });
});
