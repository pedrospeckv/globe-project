// @vitest-environment jsdom
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import FiguraPage from "./page";
import { semAnoCru } from "@/components/testes/dom";
import { carregarAcervo } from "@/lib/conteudo/carregar";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

async function dossie(id: string) {
  return render(await FiguraPage({ params: Promise.resolve({ id }) }));
}

describe("dossiê de figura", () => {
  it.each(acervo.figuras.map((f) => f.id))(
    "%s não deixa ano negativo cru na tela",
    async (id) => {
      const { container } = await dossie(id);
      semAnoCru(container);
    }
  );

  it("toda alegação da tela chega com ao menos uma fonte", async () => {
    // A regra central do projeto, verificada onde ela importa: na tela.
    // O schema já exige fonte e a integridade já garante que o id existe —
    // falta provar que a página não descarta a lista no caminho.
    for (const figura of acervo.figuras) {
      const { container } = await dossie(figura.id);
      const cartoes = [...container.querySelectorAll("article")];
      expect(cartoes).toHaveLength(figura.alegacoes.length);
      for (const cartao of cartoes) {
        expect(cartao.querySelectorAll("footer li").length).toBeGreaterThan(0);
      }
    }
  });

  it("figura sem alegação declara o vazio em vez de omitir a seção", async () => {
    const vazia = acervo.figuras.find((f) => f.alegacoes.length === 0);
    if (!vazia) return; // o acervo pode não ter nenhuma; o teste não força.
    const { container } = await dossie(vazia.id);
    expect(container.textContent).toContain("Nenhuma alegação registrada");
    expect(container.textContent).toContain("fonte verificada");
  });

  it("cargos aparecem com intervalo, e o mandato em curso fica aberto", async () => {
    const comCargo = acervo.figuras.find((f) => f.cargos.length > 0)!;
    const { container } = await dossie(comCargo.id);
    /*
     * `ol` e não `ul`: os cargos viraram o trilho do memorial, e trilho é
     * lista ORDENADA — a ordem cronológica ali é informação, não arranjo.
     *
     * E a seção precisa ser encontrada pelo título, não pela posição: a
     * trajetória usa o MESMO trilho logo abaixo, e um seletor por estrutura
     * passou a casar com as duas de uma vez no dia em que a primeira figura
     * ganhou blocos.
     */
    const secaoDeCargos = [...container.querySelectorAll("section")].find(
      (s) => s.querySelector("h2")?.textContent === "Cargos"
    )!;
    const linhas = [...secaoDeCargos.querySelectorAll("ol > li")];
    expect(linhas).toHaveLength(comCargo.cargos.length);
    for (const [i, c] of comCargo.cargos.entries()) {
      expect(linhas[i].textContent).toContain(c.titulo);
      if (!c.fim) expect(linhas[i].textContent).toMatch(/–$/);
    }
  });

  it("volta para o país da figura, não para a raiz", async () => {
    const f = acervo.figuras[0];
    const { container } = await dossie(f.id);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      `/pais/${f.paisIso}`
    );
  });
});
