// @vitest-environment jsdom
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import EpisodioPage from "./page";
import { semAnoCru } from "@/components/testes/dom";
import { carregarAcervo } from "@/lib/conteudo/carregar";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

async function pagina(id: string) {
  return render(await EpisodioPage({ params: Promise.resolve({ id }) }));
}

const todos = acervo.episodios.map((e) => [e.id, e.titulo] as const);

describe("página de episódio", () => {
  it.each(todos)("%s (%s) rende sem deixar marcação crua na tela", async (id) => {
    const { container } = await pagina(id);
    semAnoCru(container);
    expect(container.textContent).not.toContain("[[");
    expect(container.textContent).not.toContain("**");
  });

  it("cada bloco com imagem mostra o crédito e a licença abaixo dela", async () => {
    for (const e of acervo.episodios) {
      const { container } = await pagina(e.id);
      const figuras = [...container.querySelectorAll("figure")];
      const comImagem = e.blocos.filter((b) => b.imagem);
      expect(figuras).toHaveLength(comImagem.length);

      for (const b of comImagem) {
        expect(container.textContent).toContain(b.imagem!.credito);
        expect(container.textContent).toContain(b.imagem!.licenca);
      }
    }
  });

  it("a imagem carrega descrição para leitor de tela", async () => {
    const { container } = await pagina("brasil-holandes");
    const imgs = [...container.querySelectorAll("img")];
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img.getAttribute("alt")?.length ?? 0).toBeGreaterThan(10);
      // Fora da primeira dobra ela não deve competir com o conteúdo do topo.
      expect(img.getAttribute("loading")).toBe("lazy");
    }
  });

  it("fecha com as fontes, como o memorial fecha com o In Memoriam", async () => {
    const { container } = await pagina("corte-no-rio");
    const titulos = [...container.querySelectorAll("h2")].map((h) => h.textContent);
    expect(titulos).toContain("Fontes");

    const ep = acervo.episodios.find((e) => e.id === "corte-no-rio")!;
    for (const id of ep.fontes) {
      const fonte = acervo.fontes.find((f) => f.id === id)!;
      expect(container.textContent).toContain(fonte.titulo);
    }
    // O id cru nunca aparece — quem lê vê a obra, não a chave.
    expect(container.textContent).not.toContain("carta-lei-reino-unido-1815");
  });

  it("volta para o país e a ligação do texto vira link de verdade", async () => {
    const { container } = await pagina("corte-no-rio");
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/pais/BRA");
    expect(hrefs).toContain("/pais/BRA/br-reino-unido");
  });

  it("o rótulo do bloco pode ser um intervalo, e é ele que aparece", async () => {
    const { container } = await pagina("brasil-holandes");
    // "1637–1644" é o governo de Nassau; a data que ordena é só "1637".
    expect(container.textContent).toContain("1637–1644");
  });
});

/*
 * Estes dois renderizam páginas grandes do Brasil e recarregam o acervo, e
 * passam dos 5 s padrão do vitest numa máquina fria. O limite maior é do
 * tamanho do que eles fazem, não disfarce de lentidão.
 */
describe("o episódio visto do resto do atlas", { timeout: 30_000 }, () => {
  it("o dossiê do período aponta para os episódios ancorados nele", async () => {
    const { default: PeriodoPage } = await import("@/app/pais/[iso]/[periodo]/page");
    const { container } = render(
      await PeriodoPage({
        params: Promise.resolve({ iso: "BRA", periodo: "br-colonia" }),
      })
    );
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/episodio/brasil-holandes");
  });

  it("a central do país lista os dois episódios do Brasil", async () => {
    const { default: PaisPage } = await import("@/app/pais/[iso]/page");
    const { container } = render(
      await PaisPage({ params: Promise.resolve({ iso: "BRA" }) })
    );
    const hrefs = [...container.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/episodio/brasil-holandes");
    expect(hrefs).toContain("/episodio/corte-no-rio");
  });
});
