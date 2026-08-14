// @vitest-environment jsdom
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PeriodoPage from "./page";
import { semAnoCru } from "@/components/testes/dom";
import { carregarAcervo } from "@/lib/conteudo/carregar";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

async function pagina(iso: string, periodo: string) {
  return render(await PeriodoPage({ params: Promise.resolve({ iso, periodo }) }));
}

/** Todos os pares país × período do acervo. */
const todos = acervo.paises.flatMap((p) =>
  p.periodos.map((per) => [p.iso, per.id, per.rotulo] as const)
);

describe("página de período", () => {
  it.each(todos)("%s/%s (%s) rende sem deixar ano cru na tela", async (iso, id) => {
    const { container } = await pagina(iso, id);
    semAnoCru(container);
  });

  it("mostra o texto INTEIRO, não o resumo do índice", async () => {
    const colonia = acervo.paises
      .find((p) => p.iso === "BRA")!
      .periodos.find((p) => p.id === "br-colonia")!;
    const paragrafos = colonia.textoMdx!.split("\n\n");
    expect(paragrafos.length).toBeGreaterThan(3);

    const { container } = await pagina("BRA", "br-colonia");
    // O último parágrafo é o que o índice corta fora.
    const ultimo = paragrafos.at(-1)!.replace(/[*_]/g, "").slice(0, 60);
    expect(container.textContent).toContain(ultimo);
  });

  it("traz o intervalo e o regime no cabeçalho", async () => {
    const { container } = await pagina("BRA", "br-regime-militar");
    expect(container.querySelector("h1")?.textContent).toBe("Regime Militar");
    expect(container.textContent).toContain("1964–1985");
    expect(container.textContent).toContain("ditadura militar");
  });

  it("período a.C. mostra o intervalo formatado", async () => {
    const { container } = await pagina("CHN", "cn-shang");
    semAnoCru(container);
    expect(container.textContent).toContain("1600 a.C.–1046 a.C.");
  });

  it("período aberto termina em traço, não em data inventada", async () => {
    const { container } = await pagina("BRA", "br-nova-republica");
    expect(container.textContent).toMatch(/1985–(?!\d)/);
  });

  it("território dividido abre os Estados e explica a hachura", async () => {
    const { container } = await pagina("DEU", "de-divisao");
    expect(container.textContent).toContain("República Federal da Alemanha");
    expect(container.textContent).toContain("República Democrática Alemã");
    expect(container.textContent).toMatch(/geometria histórica/);
  });

  it("lista só os eventos que caem dentro do período", async () => {
    const { container } = await pagina("DEU", "de-divisao");
    expect(container.textContent).toContain("Queda do Muro de Berlim");

    // O mesmo evento não pode reaparecer no período seguinte.
    const { container: depois } = await pagina("DEU", "de-reunificada");
    expect(depois.textContent).not.toContain("Queda do Muro de Berlim");
  });

  it("evento na virada pertence ao período que começa, não ao que termina", async () => {
    /*
     * Início inclusivo, fim exclusivo — a mesma regra do periodoVigente. Sem
     * ela um evento numa virada apareceria nos dois períodos de uma vez.
     */
    const { dentroDoPeriodo } = await import("@/lib/conteudo/pais");
    const brasil = acervo.paises.find((p) => p.iso === "BRA")!;
    const imperio = brasil.periodos.find((p) => p.id === "br-imperio")!;
    const colonia = brasil.periodos.find((p) => p.id === "br-colonia")!;

    expect(dentroDoPeriodo(imperio, "1822")).toBe(true);
    expect(dentroDoPeriodo(colonia, "1822")).toBe(false);
  });

  it("lista quem teve cargo no período, inclusive mandato que o atravessa", async () => {
    const { container } = await pagina("BRA", "br-nova-republica");
    expect(container.textContent).toContain("Figuras com cargo no período");
    expect(container.textContent).toContain("Luiz Inácio Lula da Silva");
    expect(container.textContent).toContain("Jair Messias Bolsonaro");

    const { container: colonia } = await pagina("BRA", "br-colonia");
    expect(colonia.textContent).not.toContain("Luiz Inácio Lula da Silva");
  });

  it("navega para o período anterior e o seguinte", async () => {
    const { container } = await pagina("BRA", "br-era-vargas");
    const hrefs = [...container.querySelectorAll("nav a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toEqual([
      "/pais/BRA/br-republica-velha",
      "/pais/BRA/br-republica-de-46",
    ]);
  });

  it("o primeiro período não oferece anterior, e o último não oferece seguinte", async () => {
    const { container: primeiro } = await pagina("BRA", "br-colonia");
    expect(primeiro.textContent).not.toContain("anterior");

    const { container: ultimo } = await pagina("BRA", "br-nova-republica");
    expect(ultimo.textContent).not.toContain("seguinte");
  });

  it("volta para o dossiê do país", async () => {
    const { container } = await pagina("BRA", "br-imperio");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/pais/BRA");
    expect(container.textContent).toContain("Brasil");
  });

  it("gera uma rota por período do acervo", async () => {
    const { default: _ } = await import("./page");
    const { generateStaticParams } = await import("./page");
    const rotas = await generateStaticParams();
    expect(rotas).toHaveLength(todos.length);
    expect(rotas).toContainEqual({ iso: "CHN", periodo: "cn-qin" });
  });
});
