// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { BlocoNarrado } from "./BlocoNarrado";
import type { BlocoDeEpisodio } from "@/lib/conteudo/episodio";

/*
 * O que este arquivo cobre é a ponta que a função pura não alcança: se o
 * efeito de fato lê o DOM, agenda o quadro e escreve o `style`. A conta em si
 * está em `lib/ui/paralaxe.test.ts`.
 *
 * Ele existe porque o efeito NÃO é observável no navegador de verificação: sem
 * janela visível a página não compõe quadros, `requestAnimationFrame` nunca é
 * chamado e nenhum transform aparece. Aqui o rAF é síncrono e o resultado é
 * verificável.
 */

const TELA = 800;
const ALTURA_MOLDURA = 400;
const ALTURA_IMAGEM = 512; // 128% da moldura, como a classe do componente pede

const bloco: BlocoDeEpisodio = {
  id: "teste",
  data: "1637",
  titulo: "Um momento",
  textoMdx: "Texto do bloco.",
  imagem: {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/x.jpg",
    alt: "Descrição da imagem para leitor de tela.",
    credito: "Acervo",
    licenca: "Domínio público",
  },
};

/** Põe a moldura numa posição da tela e devolve os elementos para inspeção. */
function montar(topo: number) {
  window.innerHeight = TELA;

  // rAF síncrono: o efeito agenda e o teste vê o resultado no mesmo tick.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});

  const r = render(
    <ul>
      <BlocoNarrado bloco={bloco} alvos={{}} rotulo="1637" />
    </ul>
  );

  const moldura = r.container.querySelector("figure > div") as HTMLElement;
  const img = r.container.querySelector("figure img") as HTMLImageElement;

  moldura.getBoundingClientRect = () =>
    ({
      top: topo,
      bottom: topo + ALTURA_MOLDURA,
      height: ALTURA_MOLDURA,
      left: 0,
      right: 600,
      width: 600,
      x: 0,
      y: topo,
      toJSON: () => ({}),
    }) as DOMRect;

  Object.defineProperty(img, "offsetHeight", {
    value: ALTURA_IMAGEM,
    configurable: true,
  });

  /*
   * O efeito já posicionou uma vez na montagem, e ali o `getBoundingClientRect`
   * ainda era o do jsdom — tudo zero. Limpar aqui faz cada teste medir apenas o
   * que a rolagem produziu com o retângulo que ele mesmo declarou.
   */
  img.style.transform = "";
  moldura.style.transform = "";

  return { moldura, img, container: r.container };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("o bloco narrado", () => {
  it("escreve transform na foto e na moldura quando a página rola", () => {
    const { moldura, img } = montar(200);

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(img.style.transform).toMatch(/^translate3d\(0, -?\d+\.\d\dpx, 0\)$/);
    expect(moldura.style.transform).toMatch(/^scale\(\d\.\d{4}\)$/);
  });

  it("centralizado, a foto não desliza e a moldura fica no tamanho cheio", () => {
    // Centro do bloco no centro da tela: 400 - 200 = 200.
    const { moldura, img } = montar(200);
    act(() => window.dispatchEvent(new Event("scroll")));

    expect(img.style.transform).toBe("translate3d(0, 0.00px, 0)");
    expect(moldura.style.transform).toBe("scale(1.0100)");
  });

  it("acima e abaixo do centro o deslize troca de sinal", () => {
    const acima = montar(-200);
    act(() => window.dispatchEvent(new Event("scroll")));
    const valorAcima = Number(
      acima.img.style.transform.match(/(-?[\d.]+)px/)![1]
    );
    cleanup();

    const abaixo = montar(600);
    act(() => window.dispatchEvent(new Event("scroll")));
    const valorAbaixo = Number(
      abaixo.img.style.transform.match(/(-?[\d.]+)px/)![1]
    );

    expect(valorAcima).toBeGreaterThan(0);
    expect(valorAbaixo).toBeLessThan(0);
  });

  it("bloco inteiramente fora da tela não recebe transform nenhum", () => {
    const { moldura, img } = montar(TELA + 500);
    act(() => window.dispatchEvent(new Event("scroll")));

    expect(img.style.transform).toBe("");
    expect(moldura.style.transform).toBe("");
  });

  it("com prefers-reduced-motion o efeito não roda", () => {
    vi.stubGlobal(
      "matchMedia",
      () => ({ matches: true }) as unknown as MediaQueryList
    );
    const { moldura, img } = montar(200);
    act(() => window.dispatchEvent(new Event("scroll")));

    expect(img.style.transform).toBe("");
    expect(moldura.style.transform).toBe("");
  });

  it("sem matchMedia no ambiente, o efeito roda em vez de quebrar", () => {
    vi.stubGlobal("matchMedia", undefined);
    const { img } = montar(200);
    act(() => window.dispatchEvent(new Event("scroll")));

    expect(img.style.transform).toBe("translate3d(0, 0.00px, 0)");
  });

  it("solta os ouvintes ao desmontar", () => {
    const remover = vi.spyOn(window, "removeEventListener");
    const { container } = montar(200);
    expect(container).toBeTruthy();
    cleanup();

    const eventos = remover.mock.calls.map((c) => c[0]);
    expect(eventos).toContain("scroll");
    expect(eventos).toContain("resize");
    remover.mockRestore();
  });

  it("a legenda traz crédito e licença — a imagem não passa sem eles", () => {
    const { container } = montar(200);
    expect(container.textContent).toContain("Acervo");
    expect(container.textContent).toContain("Domínio público");
  });
});
