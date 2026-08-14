// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlegacaoCard } from "./AlegacaoCard";
import { semAnoCru } from "@/components/testes/dom";
import type { Alegacao } from "@/lib/conteudo/alegacao";
import type { Fonte } from "@/lib/conteudo/fonte";

const acordao: Fonte = {
  id: "stf-hc-193726",
  tipo: "decisao-judicial",
  titulo: "HC 193.726 — incompetência da 13ª Vara de Curitiba",
  publicacao: "STF",
  data: "2021-04-15",
  url: "https://portal.stf.jus.br/",
};

const semUrl: Fonte = {
  id: "livro-x",
  tipo: "livro",
  titulo: "História do Brasil República",
  autor: "Fulana de Tal",
};

const base: Alegacao = {
  id: "triplex",
  enunciado: "Recebeu o triplex do Guarujá como propina da OAS.",
  status: "anulado",
  fontes: ["stf-hc-193726"],
};

describe("AlegacaoCard", () => {
  it("mostra enunciado e o estágio da apuração", () => {
    render(<AlegacaoCard alegacao={base} fontes={[acordao, semUrl]} />);
    expect(screen.getByText(base.enunciado)).toBeTruthy();
    expect(screen.getByText("Anulado")).toBeTruthy();
  });

  it("nunca renderiza a lista de fontes vazia", () => {
    // A promessa editorial do projeto: o schema exige fonte, a integridade
    // garante que o id existe, e aqui se confirma que ela CHEGA à tela.
    const { container } = render(
      <AlegacaoCard alegacao={base} fontes={[acordao, semUrl]} />
    );
    const itens = container.querySelectorAll("footer li");
    expect(itens.length).toBeGreaterThan(0);
    expect(screen.getByText(/Fonte/)).toBeTruthy();
  });

  it("cita só as fontes referenciadas, não o acervo inteiro", () => {
    render(<AlegacaoCard alegacao={base} fontes={[acordao, semUrl]} />);
    expect(screen.getByText(acordao.titulo)).toBeTruthy();
    expect(screen.queryByText(semUrl.titulo)).toBeNull();
  });

  it("fonte com url vira link; sem url, vira texto", () => {
    const { container: comLink } = render(
      <AlegacaoCard alegacao={base} fontes={[acordao]} />
    );
    const a = comLink.querySelector("footer a");
    expect(a?.getAttribute("href")).toBe(acordao.url);
    expect(a?.getAttribute("rel")).toContain("noreferrer");

    const { container: semLink } = render(
      <AlegacaoCard
        alegacao={{ ...base, fontes: [semUrl.id] }}
        fontes={[semUrl]}
      />
    );
    expect(semLink.querySelector("footer a")).toBeNull();
    expect(semLink.textContent).toContain(semUrl.titulo);
  });

  it("mostra a nota — é ela que carrega o que a decisão NÃO diz", () => {
    const nota =
      "Anulação por incompetência do juízo; o STF não julgou o mérito, " +
      "então a decisão não equivale a declaração de inocência.";
    render(<AlegacaoCard alegacao={{ ...base, nota }} fontes={[acordao]} />);
    expect(screen.getByText(nota)).toBeTruthy();
  });

  it("omite o bloco de data quando a alegação não tem data", () => {
    const { container } = render(
      <AlegacaoCard alegacao={base} fontes={[{ ...acordao, data: undefined }]} />
    );
    expect(container.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("formata data antes de Cristo em vez de deixar o sinal vazar", () => {
    const { container } = render(
      <AlegacaoCard
        alegacao={{
          ...base,
          enunciado: "Atravessou o Rubicão marchando sobre Roma.",
          data: "-49-01-10",
          fontes: ["livro-x"],
        }}
        fontes={[{ ...semUrl, data: "-44" }]}
      />
    );
    semAnoCru(container);
    expect(container.textContent).toContain("49 a.C.");
    expect(container.textContent).toContain("44 a.C.");
  });

  it("cada status fechado tem rótulo próprio na tela", () => {
    const status = [
      "transito-julgado",
      "em-julgamento",
      "investigacao",
      "investigacao-arquivada",
      "anulado",
      "prescrito",
      "alegacao-sem-processo",
      "desmentido",
    ] as const;

    const vistos = status.map((s) => {
      const { container } = render(
        <AlegacaoCard alegacao={{ ...base, status: s }} fontes={[acordao]} />
      );
      return container.querySelector("header span")?.textContent ?? "";
    });

    expect(vistos.every((t) => t.length > 0)).toBe(true);
    expect(new Set(vistos).size).toBe(status.length);
  });
});
