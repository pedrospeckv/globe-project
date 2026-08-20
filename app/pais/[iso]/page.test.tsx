// @vitest-environment jsdom
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import PaisPage from "./page";
import { semAnoCru } from "@/components/testes/dom";
import { carregarAcervo } from "@/lib/conteudo/carregar";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));

async function dossie(iso: string) {
  return render(await PaisPage({ params: Promise.resolve({ iso }) }));
}

describe("dossiê de país", () => {
  /*
   * Este é o teste que faltava.
   *
   * Duas vezes um período antes de Cristo chegou à tela como `-300`: uma nas
   * pontas da barra de tempo, outra aqui, no Japão. Nas duas a suíte inteira
   * passava — `rotuloDeData` estava certo, quem renderizava é que não a
   * chamava. Rodar contra o acervo real, e não contra fixture, é o que faz
   * este teste quebrar quando alguém escrever o próximo período a.C. numa
   * página que esqueceu o formatador.
   */
  it.each(acervo.paises.map((p) => p.iso))(
    "%s não deixa ano negativo cru na tela",
    async (iso) => {
      const { container } = await dossie(iso);
      semAnoCru(container);
    }
  );

  it("Japão mostra 300 a.C.–300, não -300–300", async () => {
    const { container } = await dossie("JPN");
    expect(container.textContent).toContain("300 a.C.");
    expect(container.textContent).toContain("Yayoi");
  });

  it("China abre no período Qin com as duas pontas formatadas", async () => {
    const { container } = await dossie("CHN");
    expect(container.textContent).toContain("221 a.C.–202 a.C.");
  });

  it("lista todos os períodos do país, na ordem do acervo", async () => {
    const brasil = acervo.paises.find((p) => p.iso === "BRA")!;
    const { container } = await dossie("BRA");
    const titulos = [...container.querySelectorAll("section article h3")].map(
      (h) => h.textContent
    );
    expect(titulos).toEqual(brasil.periodos.map((p) => p.rotulo));
  });

  it("período aberto termina em traço, não em data inventada", async () => {
    const { container } = await dossie("BRA");
    const ultimo = [...container.querySelectorAll("section article")].at(-1);
    expect(ultimo?.textContent).toMatch(/1985–?$|1985–/);
  });

  it("o índice sinaliza território dividido sem abrir o detalhe", async () => {
    // O detalhe dos Estados mora na página do período; aqui só a marca.
    const { container } = await dossie("DEU");
    expect(container.textContent).toContain("Estados neste território");
    expect(container.textContent).not.toContain("República Democrática Alemã");
  });

  it("mostra só o primeiro parágrafo de cada período", async () => {
    const brasil = acervo.paises.find((p) => p.iso === "BRA")!;
    const colonia = brasil.periodos.find((p) => p.id === "br-colonia")!;
    const [primeiro, segundo] = colonia.textoMdx!.split("\n\n");

    const { container } = await dossie("BRA");
    expect(container.textContent).toContain(primeiro.slice(0, 60));
    // O segundo parágrafo é da página do período, não do índice.
    expect(container.textContent).not.toContain(
      segundo.replace(/\*\*/g, "").slice(0, 60)
    );
  });

  it("cada período do índice aponta para a própria página", async () => {
    const brasil = acervo.paises.find((p) => p.iso === "BRA")!;
    const { container } = await dossie("BRA");
    const hrefs = [...container.querySelectorAll("a[href^='/pais/BRA/']")].map((a) =>
      a.getAttribute("href")
    );
    for (const p of brasil.periodos) {
      expect(hrefs).toContain(`/pais/BRA/${p.id}`);
    }
  });

  it("país sem divisão não mostra o bloco de Estados", async () => {
    const { container } = await dossie("JPN");
    expect(container.textContent).not.toContain("Estados neste território");
  });

  it("cada figura do país vira link para o próprio dossiê", async () => {
    const { container } = await dossie("BRA");
    const figuras = acervo.figuras.filter((f) => f.paisIso === "BRA");
    const hrefs = [...container.querySelectorAll("a[href^='/figura/']")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs.sort()).toEqual(figuras.map((f) => `/figura/${f.id}`).sort());
  });

  it("mostra os indicadores do país com a fonte resolvida", async () => {
    const { container } = await dossie("BRA");
    const doBrasil = acervo.indicadores.filter((i) => i.paisIso === "BRA");
    expect(doBrasil.length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Indicadores");
    for (const i of doBrasil) {
      expect(container.textContent).toContain(i.nome);
      // A fonte precisa chegar resolvida, não como id solto.
      const fonte = acervo.fontes.find((f) => f.id === i.fonte)!;
      expect(container.textContent).toContain(fonte.titulo);
    }
  });

  it("a Rússia explica a Crimeia com a mesma nota que o mapa usa", async () => {
    const { DISPUTAS } = await import("@/lib/geo/disputas");
    const crimeia = DISPUTAS.find((d) => d.id === "crimeia")!;
    const { container } = await dossie("RUS");
    expect(container.textContent).toContain("soberania disputada");
    expect(container.textContent).toContain(crimeia.nome);
    // A nota inteira, não um resumo reescrito que pudesse divergir do mapa.
    expect(container.textContent).toContain(crimeia.nota);
  });

  it("país sem disputa não ganha a seção", async () => {
    const { container } = await dossie("JPN");
    expect(container.textContent).not.toContain("soberania disputada");
  });

  it("não inventa seção de indicador para país sem série", async () => {
    const semSerie = acervo.paises.find(
      (p) => !acervo.indicadores.some((i) => i.paisIso === p.iso)
    )!;
    const { container } = await dossie(semSerie.iso);
    expect(container.textContent).not.toContain("Indicadores");
  });
});

/**
 * Os cartões do topo — a única navegação que o leitor vê sem rolar.
 *
 * Existem porque Episódios e Eleições passaram a existir como seção sem
 * existir como cartão: o conteúdo estava na página e não havia como chegar
 * nele senão rolando o dossiê inteiro até topar com a seção. Um cartão que
 * aponta para lugar nenhum é a mesma falha vista do outro lado, e o primeiro
 * teste aqui cobre as duas direções de uma vez.
 */
describe("as alas da central", () => {
  function alas(container: HTMLElement) {
    return [...container.querySelectorAll("section.grid > a")];
  }

  it.each(acervo.paises.map((p) => p.iso))(
    "%s: toda âncora de cartão cai numa seção que existe",
    async (iso) => {
      const { container } = await dossie(iso);
      const ancoras = alas(container)
        .map((a) => a.getAttribute("href")!)
        .filter((h) => h.startsWith("#"));

      expect(ancoras.length).toBeGreaterThan(0);
      for (const href of ancoras) {
        expect(container.querySelector(href)).not.toBeNull();
      }
    }
  );

  it.each(acervo.paises.map((p) => p.iso))(
    "%s: toda seção nova do dossiê tem cartão apontando para ela",
    async (iso) => {
      const { container } = await dossie(iso);
      const destinos = new Set(alas(container).map((a) => a.getAttribute("href")));

      /*
         Episódios e Eleições e nada mais: Períodos e Figuras têm cartão
         mesmo vazios, e Livros cai na biblioteca geral quando a estante do
         país está vazia. Estas duas só aparecem quando há conteúdo, e é
         justamente aí que o cartão precisa aparecer junto.
      */
      for (const id of ["#episodios", "#eleicoes"]) {
        if (!container.querySelector(id)) continue;
        const direto = id === "#eleicoes" && [...destinos].some((h) => h?.startsWith("/eleicao/"));
        expect(destinos.has(id) || direto).toBe(true);
      }
    }
  );

  it("o Brasil ganhou cartão de eleição, e ele entra direto na página", async () => {
    const { container } = await dossie("BRA");
    const cartao = alas(container).find((a) =>
      a.textContent?.includes("Eleições")
    );
    expect(cartao).toBeDefined();
    // Uma eleição só: a seção seria um clique a mais para o mesmo lugar.
    expect(cartao!.getAttribute("href")).toBe("/eleicao/2026-presidencial");
    expect(cartao!.textContent).toContain("13 chapas");
  });

  it("país sem eleição nem episódio não ganha cartão morto", async () => {
    const iso = acervo.paises.find(
      (p) =>
        !acervo.eleicoes.some((e) => e.paisIso === p.iso) &&
        !acervo.episodios.some((e) => e.paises.includes(p.iso))
    )!.iso;
    const { container } = await dossie(iso);
    const textos = alas(container).map((a) => a.querySelector("h3")?.textContent);
    expect(textos).not.toContain("Eleições");
    expect(textos).not.toContain("Episódios");
  });
});
