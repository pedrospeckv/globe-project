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
    // Nenhuma ligação pode chegar à tela como colchete.
    expect(container.textContent).not.toContain("[[");
  });

  it("a ligação vira link de verdade, com o rótulo escrito", async () => {
    const { container } = await pagina("BRA", "br-nova-republica");
    const links = [...container.querySelectorAll("article a")].map((a) => ({
      texto: a.textContent,
      href: a.getAttribute("href"),
    }));
    expect(links).toContainEqual({ texto: "Lula", href: "/figura/lula" });
    expect(links).toContainEqual({
      texto: "Jair Bolsonaro",
      href: "/figura/bolsonaro",
    });
  });

  it("ligação entre períodos usa o rótulo do alvo quando não há um escrito", async () => {
    const { container } = await pagina("BRA", "br-republica-velha");
    const link = [...container.querySelectorAll("article a")].find(
      (a) => a.getAttribute("href") === "/pais/BRA/br-era-vargas"
    );
    expect(link?.textContent).toBe("Era Vargas");
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

  it("mostra as fontes do período, resolvidas do acervo", async () => {
    const brasil = acervo.paises.find((p) => p.iso === "BRA")!;
    const militar = brasil.periodos.find((p) => p.id === "br-regime-militar")!;
    expect(militar.fontes.length).toBeGreaterThan(0);

    const { container } = await pagina("BRA", "br-regime-militar");
    for (const id of militar.fontes) {
      const f = acervo.fontes.find((x) => x.id === id)!;
      expect(container.textContent).toContain(f.titulo);
    }
    // O id cru nunca aparece — quem lê vê a obra, não a chave.
    expect(container.textContent).not.toContain("cnv-relatorio");
  });

  it("todo período com texto mostra fonte — a dívida chegou a zero", async () => {
    /*
     * Este teste já verificou o contrário: que um período SEM fonte não
     * inventava a seção. Ele deixou de ter caso quando todos os períodos
     * passaram a ter lastro, e virou a afirmação positiva — que é a que
     * agora precisa ser defendida contra regressão.
     *
     * O número subiu de 84 para 85 quando a Colônia foi partida em 1808 e o
     * Reino Unido de Portugal, Brasil e Algarves ganhou período próprio. É a
     * contagem que precisa ser atualizada de propósito a cada período novo —
     * afrouxá-la para `toBeGreaterThan` deixaria passar período entrando sem
     * fonte, que é justamente o que ela existe para pegar.
     */
    const comTexto = acervo.paises.flatMap((p) =>
      p.periodos.filter((per) => per.textoMdx).map((per) => [p.iso, per] as const)
    );
    expect(comTexto.length).toBe(85);

    for (const [iso, per] of comTexto) {
      expect(per.fontes.length).toBeGreaterThan(0);
      for (const id of per.fontes) {
        expect(acervo.fontes.some((f) => f.id === id)).toBe(true);
      }
      // Amostra na tela, para não renderizar 84 páginas neste teste.
      if (per.id === "de-nazista" || per.id === "cn-shang") {
        const { container } = await pagina(iso, per.id);
        const titulos = [...container.querySelectorAll("h2")].map((h) => h.textContent);
        expect(titulos.some((t) => t === "Fonte" || t === "Fontes")).toBe(true);
      }
    }
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
