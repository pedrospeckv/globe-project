// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import { GradeDeFiguras, type FiguraNaGrade } from "./GradeDeFiguras";

const FIGURAS: FiguraNaGrade[] = [
  {
    id: "fabio-luis",
    nome: "Fábio Luís Lula da Silva",
    cargo: undefined,
    alegacoes: 4,
  },
  {
    id: "bolsonaro",
    nome: "Jair Messias Bolsonaro",
    cargo: "Presidente da República",
    alegacoes: 3,
  },
  {
    id: "lula",
    nome: "Luiz Inácio Lula da Silva",
    cargo: "Presidente da República",
    alegacoes: 2,
  },
];

function montar(figuras = FIGURAS) {
  return render(<GradeDeFiguras figuras={figuras} />);
}

const campo = () => screen.getByRole("searchbox");
const nomes = (c: HTMLElement) =>
  [...c.querySelectorAll("li a")].map((a) => a.querySelector("span span")?.textContent);

afterEach(cleanup);

describe("a grade de figuras", () => {
  it("mostra todas e conta as pessoas antes de qualquer busca", () => {
    const { container } = montar();
    expect(nomes(container)).toHaveLength(3);
    expect(container.textContent).toContain("3 PESSOAS");
  });

  it("tem campo de busca com rótulo para leitor de tela", () => {
    montar();
    expect(campo()).toBeTruthy();
    expect(
      screen.getByLabelText("Buscar figura por nome ou cargo")
    ).toBe(campo());
  });

  it("filtra pelo nome enquanto se digita", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "bolso" } });
    expect(nomes(container)).toEqual(["Jair Messias Bolsonaro"]);
  });

  it("acha sem acento o nome que tem acento", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "fabio luis" } });
    expect(nomes(container)).toEqual(["Fábio Luís Lula da Silva"]);
  });

  it("separa os dois Lula da Silva pelo primeiro nome", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "lula da silva" } });
    expect(nomes(container)).toHaveLength(2);
    fireEvent.change(campo(), { target: { value: "luiz" } });
    expect(nomes(container)).toEqual(["Luiz Inácio Lula da Silva"]);
  });

  it("acha pelo cargo", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "presidente" } });
    expect(nomes(container)).toHaveLength(2);
  });

  it("o contador passa a dizer quantas de quantas", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "bolso" } });
    expect(container.textContent).toContain("1 DE 3 PESSOAS");
  });

  it("sem resultado diz que não achou, repete o termo e lembra quantas existem", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "churchill" } });
    expect(container.querySelectorAll("li")).toHaveLength(0);

    const aviso = screen.getByRole("status");
    expect(within(aviso).getByText("churchill")).toBeTruthy();
    expect(aviso.textContent).toContain("3");
    // "não achei" nunca pode ser lido como "não tem".
    expect(aviso.textContent).toContain("registradas");
  });

  it("o botão de limpar só existe quando há o que limpar", () => {
    montar();
    expect(screen.queryByText("Limpar busca")).toBeNull();
    fireEvent.change(campo(), { target: { value: "lula" } });
    expect(screen.getByText("Limpar busca")).toBeTruthy();
  });

  it("limpar devolve a lista inteira e o foco ao campo", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "lula" } });
    fireEvent.click(screen.getByText("Limpar busca"));

    expect(nomes(container)).toHaveLength(3);
    expect((campo() as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(campo());
  });

  it("Escape limpa a busca", () => {
    const { container } = montar();
    fireEvent.change(campo(), { target: { value: "lula" } });
    fireEvent.keyDown(campo(), { key: "Escape" });

    expect((campo() as HTMLInputElement).value).toBe("");
    expect(nomes(container)).toHaveLength(3);
  });

  it("cada cartão aponta para a página da figura e diz quantas alegações", () => {
    const { container } = montar();
    const links = [...container.querySelectorAll("li a")];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/figura/fabio-luis",
      "/figura/bolsonaro",
      "/figura/lula",
    ]);
    expect(links[0].textContent).toContain("4 ALEGAÇÃO(ÕES)");
  });

  it("figura sem alegação diz isso em vez de mostrar zero", () => {
    const { container } = montar([
      { id: "x", nome: "Alguém", alegacoes: 0 },
    ]);
    expect(container.textContent).toContain("SEM ALEGAÇÕES");
    expect(container.textContent).toContain("1 PESSOA");
  });
});
