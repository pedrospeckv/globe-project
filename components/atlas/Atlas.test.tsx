// @vitest-environment jsdom
import path from "node:path";
import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import {
  Atlas,
  VIAGENS_NO_MAPA,
  limitarDeslocamento,
  tamanhoDoMapa,
} from "./Atlas";
import { semAnoCru } from "@/components/testes/dom";
import { carregarAcervo } from "@/lib/conteudo/carregar";
import { carregarMundo } from "@/lib/geo/mundo";
import { anoFracionarioDe } from "@/lib/conteudo/tempo";

const acervo = await carregarAcervo(path.join(process.cwd(), "conteudo"));
const mundo = await carregarMundo();

function montar() {
  const utils = render(
    <Atlas
      mundo={mundo}
      paises={acervo.paises}
      viagens={acervo.viagens}
      eventos={acervo.eventos}
      fontes={acervo.fontes}
    />
  );
  const barra = utils.container.querySelector(
    "input[type=range]"
  ) as HTMLInputElement;

  /** ISO dos países desenhados na camada interativa neste instante. */
  const acesos = () =>
    [...utils.container.querySelectorAll("svg > g[data-camada=paises] > path title")]
      .map((t) => t.textContent?.split(" ")[0] ?? "")
      .sort();

  const irPara = (data: string) =>
    fireEvent.change(barra, { target: { value: String(anoFracionarioDe(data)) } });

  /**
   * Pelo papel, não pelo texto: o botão da viagem e o <title> da rota
   * desenhada carregam exatamente o mesmo nome.
   */
  const botao = (nome: string | RegExp) =>
    utils.getByRole("button", { name: nome });

  return { ...utils, barra, acesos, irPara, botao };
}

describe("Atlas", () => {
  it("aceso depende do TEMPO, não de uma lista fixa", () => {
    // A linha mais importante do projeto. Em 843 o Brasil não existe e o
    // globo precisa dizer isso apagando o país, não escondendo a questão.
    const { acesos, irPara } = montar();

    irPara("843");
    expect(acesos()).not.toContain("BRA");
    expect(acesos()).toContain("FRA");

    irPara("1600");
    expect(acesos()).toContain("BRA");
  });

  it("em 300 a.C. só quem já existia está no mapa", () => {
    const { acesos, irPara } = montar();
    irPara("-300");
    expect(acesos()).toEqual(["CHN", "IND", "JPN"]);
  });

  it("a China é a mais antiga do acervo — em 1600 a.C. está sozinha", () => {
    const { acesos, irPara } = montar();
    irPara("-1600");
    expect(acesos()).toEqual(["CHN"]);
  });

  it("a Índia entra no globo em 322 a.C., com os Máuria", () => {
    const { acesos, irPara } = montar();
    irPara("-323");
    expect(acesos()).not.toContain("IND");
    irPara("-322");
    expect(acesos()).toContain("IND");
  });

  it("a Alemanha dividida aparece hachurada só no período certo", () => {
    const { container, irPara } = montar();
    const alemanha = () =>
      [...container.querySelectorAll("svg > g[data-camada=paises] > path")].find((p) =>
        p.querySelector("title")?.textContent?.startsWith("DEU")
      );

    irPara("1970");
    expect(alemanha()?.getAttribute("fill")).toBe("url(#hachura-dividido)");
    expect(alemanha()?.querySelector("title")?.textContent).toContain(
      "território dividido"
    );

    irPara("2000");
    expect(alemanha()?.getAttribute("fill")).not.toContain("hachura");
  });

  it("país selecionado que ainda não existia diz isso em vez de sumir com o texto", () => {
    const { container, irPara, getByText } = montar();
    irPara("1600");
    const bra = [...container.querySelectorAll("svg > g[data-camada=paises] > path")].find(
      (p) => p.querySelector("title")?.textContent === "BRA"
    )!;
    fireEvent.click(bra);
    expect(container.textContent).toContain("Brasil ·");

    irPara("843");
    expect(getByText(/Brasil não existia nesta data/)).toBeTruthy();
  });

  /*
   * Os testes de viagem estão presos a `VIAGENS_NO_MAPA`, não apagados.
   *
   * A camada de rotas saiu da tela quando a fronteira histórica entrou no
   * fundo — dois traçados disputando o mesmo mapa. As regras que estes testes
   * guardam continuam valendo (rota só existe depois da segunda parada, o
   * painel de contexto acompanha a seleção), e voltam a rodar sozinhas no
   * instante em que o flag virar. Apagá-las perderia a regra junto com a
   * camada.
   */
  it.skipIf(!VIAGENS_NO_MAPA)("selecionar uma viagem estreita a barra — senão a rota é invisível", () => {
    const { barra, botao } = montar();
    const largoAntes = Number(barra.max) - Number(barra.min);

    fireEvent.click(botao(acervo.viagens[0].titulo));

    const largoDepois = Number(barra.max) - Number(barra.min);
    expect(largoDepois).toBeLessThan(largoAntes / 100);
    expect(barra.getAttribute("step")).not.toBe("1");
  });

  it.skipIf(!VIAGENS_NO_MAPA)("a rota do Cabral se desenha conforme a barra avança", () => {
    const { container, barra, botao, irPara } = montar();
    fireEvent.click(botao(/Cabral/));
    // Pelo título, não pela posição: com mais de uma viagem no acervo, o
    // primeiro caminho da camada pode ser o de outra frota já concluída.
    const rota = () =>
      [...container.querySelectorAll("svg > g[data-camada=rotas] > path")].find((p) =>
        p.querySelector("title")?.textContent?.includes("Cabral")
      ) ?? null;

    // Antes da segunda parada não existe linha — um ponto só não é rota.
    fireEvent.change(barra, { target: { value: barra.min } });
    expect(rota()).toBeNull();

    irPara("1500-04-24");
    expect(rota()?.getAttribute("d")).toMatch(/^M/);
  });

  it("nenhum instante do acervo deixa ano negativo cru na tela", () => {
    const { container, irPara } = montar();
    for (const data of ["-300", "-221", "-100", "-1", "1", "843", "1500", "2026"]) {
      irPara(data);
      semAnoCru(container);
    }
  });

  it("país do outro lado da Terra não é desenhado por cima do visível", () => {
    /*
     * A projeção do mutator não herda o corte que o `geoOrthographic()` do d3
     * traz pronto. Sem ele o lado oculto não some — ele é espelhado sobre o
     * hemisfério de frente. Com o Brasil no centro, China e Japão apareciam a
     * menos de 120px do meio da tela.
     */
    const { container } = montar();
    const box = container.querySelector(".touch-none")!;

    // Arrasta até o Brasil ficar de frente: a rotação começa em -40 e anda
    // 0,35° por pixel, então +251px levam o centro da vista a ~48°O.
    fireEvent.pointerDown(box, { clientX: 150, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(box, { clientX: 401, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(box, { clientX: 401, clientY: 300, pointerId: 1 });

    const desenhados = [
      ...container.querySelectorAll("svg > g[data-camada=paises] > path title"),
    ].map((t) => t.textContent);

    expect(desenhados).toContain("BRA");
    expect(desenhados).not.toContain("CHN");
    expect(desenhados).not.toContain("JPN");
  });

  it("a França acesa em 1200 não acende na América do Sul", () => {
    /*
     * O contorno desenhado é o de hoje. Para uma fronteira que andou algumas
     * centenas de quilômetros isso é aproximação tolerável; para a Guiana
     * Francesa, a 64° do território principal, o mapa afirmava domínio francês
     * na América do Sul três séculos antes de a Europa chegar lá.
     */
    const { container, irPara } = montar();
    irPara("1200");

    const franca = [
      ...container.querySelectorAll("svg > g[data-camada=paises] > path"),
    ].find((p) => p.querySelector("title")?.textContent === "FRA")!;
    expect(franca).toBeTruthy();

    const xs = [...(franca.getAttribute("d") ?? "").matchAll(/(-?\d+\.?\d*),/g)].map(
      (m) => +m[1]
    );
    const ys = [
      ...(franca.getAttribute("d") ?? "").matchAll(/,(-?\d+\.?\d*)/g),
    ].map((m) => +m[1]);
    // Nada da França desenhada pode cair sobre o Brasil no mesmo instante.
    const brasil = [
      ...container.querySelectorAll("svg > g[data-camada=paises] > path"),
    ].find((p) => p.querySelector("title")?.textContent === "BRA");
    expect(brasil).toBeFalsy(); // em 1200 o Brasil nem existe no atlas
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(300);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(300);
  });

  it("parar em 1890 não lista a Segunda Guerra como evento do momento", () => {
    // A janela acompanhava o tamanho do domínio; com 3.600 anos na barra,
    // meio século entrava como "agora".
    const { container, irPara } = montar();
    irPara("1890");
    const lista = container.querySelector("ul");
    const texto = lista?.textContent ?? "";
    expect(texto).not.toMatch(/Pearl Harbor/i);
    expect(texto).not.toMatch(/Hiroshima/i);
  });

  it("o evento aparece quando a barra chega perto dele de verdade", () => {
    const { container, irPara } = montar();
    irPara("1941-12-07");
    expect(container.querySelector("ul")?.textContent).toMatch(/Pearl Harbor/i);
  });

  it("cada evento vira uma marca alcançável na barra", () => {
    // Com meia década de janela em 3.600 anos, o evento é menos de dois
    // pixels: sem alvo visível ele existiria sem ser alcançável.
    const { container } = montar();
    const marcas = [...container.querySelectorAll("[title]")].filter((e) =>
      (e.getAttribute("class") ?? "").includes("rose")
    );
    expect(marcas).toHaveLength(acervo.eventos.length);
  });

  it("a Crimeia é marcada como disputada sem hachurar a Rússia inteira", () => {
    /*
     * A armadilha que este desenho evita: o mecanismo do território dividido
     * marca o PAÍS, e foi feito para a Alemanha de 1949, onde o território
     * todo abrigava dois Estados. Aplicá-lo aqui hachuraria a Sibéria por
     * causa da Crimeia. A marca é do polígono.
     */
    const { container, irPara } = montar();
    irPara("2020");

    const disputados = [
      ...container.querySelectorAll("svg > g[data-camada=disputados] > path"),
    ];
    expect(disputados).toHaveLength(1);
    expect(disputados[0].querySelector("title")?.textContent).toMatch(
      /Crimeia.*soberania disputada/
    );

    const russia = [
      ...container.querySelectorAll("svg > g[data-camada=paises] > path"),
    ].find((p) => p.querySelector("title")?.textContent === "RUS")!;
    expect(russia.getAttribute("fill")).not.toContain("hachura");
  });

  it("a Crimeia não aparece como russa antes de 2014", () => {
    const { container, irPara } = montar();
    irPara("2000");
    expect(
      container.querySelectorAll("svg > g[data-camada=disputados] > path")
    ).toHaveLength(0);
  });

  it("clicar no território disputado abre o país a que a base o atribui", () => {
    const { container, irPara } = montar();
    irPara("2020");
    const crimeia = container.querySelector(
      "svg > g[data-camada=disputados] > path"
    )!;
    fireEvent.click(crimeia);
    expect(container.textContent).toContain("Rússia ·");
  });

  it.skipIf(!VIAGENS_NO_MAPA)("a viagem selecionada mostra o contexto e as fontes", () => {
    /*
     * O traço no mapa não comporta ressalva. A rota do Colombo desenha um
     * desembarque em 12 de outubro de 1492 cuja ilha é disputada até hoje —
     * a linha sozinha afirmaria uma certeza que as fontes não têm.
     */
    const { container, botao } = montar();
    fireEvent.click(botao(/Colombo/));

    expect(container.textContent).toMatch(/ilha do desembarque.*é disputada/i);
    expect(container.textContent).toMatch(/las Casas/i);
    expect(container.textContent).toMatch(/Fontes?/);
  });

  it.skipIf(!VIAGENS_NO_MAPA)("sem viagem selecionada, não há painel de contexto", () => {
    const { container } = montar();
    expect(container.textContent).not.toMatch(/las Casas/i);
  });

  it.skipIf(!VIAGENS_NO_MAPA)("cada viagem do acervo tem botão próprio", () => {
    const { botao } = montar();
    for (const v of acervo.viagens) expect(botao(v.titulo)).toBeTruthy();
  });

  it.skipIf(!VIAGENS_NO_MAPA)("a rota do Colombo só existe depois que a frota partiu", () => {
    const { container, irPara } = montar();
    const colombo = () =>
      [...container.querySelectorAll("svg > g[data-camada=rotas] > path")].find((p) =>
        p.querySelector("title")?.textContent?.includes("Colombo")
      ) ?? null;

    irPara("1400");
    expect(colombo()).toBeNull();

    irPara("1493");
    expect(colombo()?.getAttribute("d")).toMatch(/^M/);
  });

  /*
   * O aviso do §12 tem DUAS metades desde que a camada de fundo virou
   * histórica, e as duas precisam estar na tela. Antes bastava dizer que todo
   * contorno era o de hoje; agora isso valeria só para os países acesos, e
   * afirmá-lo do mapa inteiro seria mentira — a pior espécie, porque estaria
   * no lugar onde o projeto promete admitir a limitação.
   */
  it("o mapa declara que o país aceso usa contorno de hoje", () => {
    const { container } = montar();
    expect(container.textContent).toMatch(/contorno dos países\s+acesos é o\s+de hoje/);
  });

  /*
   * O aviso de defasagem é GRADUADO, e é isso que precisa ser guardado. A
   * versão anterior dizia "17 anos atrás desta data" no mesmo tom em que diria
   * "900 anos", e com vão mediano de 70 anos entre fatias isso apresentava o
   * dado como melhor do que é. Testar só a frase deixaria a graduação
   * desprotegida — o texto pode mudar, a proporcionalidade não.
   */
  it("declara de que ano é a fronteira do fundo", () => {
    const { container, irPara } = montar();
    /* 2018 é a fatia de geometria própria, a mais recente do índice. */
    expect(container.textContent).toMatch(/Fronteiras de 2018/);
    expect(container.textContent).toMatch(/9 anos antes desta data/);

    irPara("2015");
    expect(container.textContent).toMatch(/Fronteiras de 2010, 5 anos antes/);
  });

  it("não alarma quando a defasagem é pequena", () => {
    const { container, irPara } = montar();
    irPara("1905");
    /* 5 anos sobre a base de 1900: informa e não grita. */
    expect(container.textContent).toMatch(/Fronteiras de 1900, 5 anos antes/);
    expect(container.textContent).not.toMatch(/Atenção/);
  });

  it("avisa e diz até quando o mapa fica congelado numa defasagem grande", () => {
    const { container, irPara } = montar();
    irPara("1450");
    /* 50 anos sobre 1400, com a seguinte em 1492 — o intervalo todo é igual. */
    expect(container.textContent).toMatch(/Atenção: fronteiras de 1400/);
    expect(container.textContent).toMatch(/a base seguinte é 1492/);
  });

  it("na faixa remota, recusa a leitura como fronteira", () => {
    const { container, irPara } = montar();
    irPara("-1200");
    expect(container.textContent).toMatch(/não é retrato do ano escolhido/);
    expect(container.textContent).toMatch(/ordem de grandeza, não como fronteira/);
  });

  /* Crédito e licença da base são condição de uso, não enfeite de rodapé. */
  it("o mapa credita a base cartográfica e a licença", () => {
    const { container, irPara } = montar();
    irPara("2015");
    expect(container.textContent).toMatch(/A\. Ourednik/);
    expect(container.textContent).toMatch(/CC-BY-SA-4\.0/);
  });

  /*
   * O crédito segue a fatia, e não o mapa. A fatia de 2018 é geometria própria,
   * do Natural Earth, e creditá-la ao upstream seria atribuição falsa — o
   * oposto do que a obrigação de crédito existe para garantir. Este teste é o
   * que impede a legenda de voltar a ter uma fonte fixa.
   */
  it("credita a fonte da fatia vigente, e não sempre a mesma", () => {
    const { container, irPara } = montar();
    expect(container.textContent).toMatch(/Geometria própria do atlas/);
    expect(container.textContent).toMatch(/Natural Earth/);
    expect(container.textContent).not.toMatch(/A\. Ourednik/);

    irPara("2015");
    expect(container.textContent).toMatch(/A\. Ourednik/);
    expect(container.textContent).not.toMatch(/Geometria própria do atlas/);
  });

  /*
   * O tamanho do mapa é o que decide quantos nomes de país cabem escritos nele,
   * então a conta merece números concretos. Os dois eixos mandam: num monitor
   * largo e baixo, seguir só a largura deixaria o mapa mais alto que a tela e a
   * barra de tempo fora de vista.
   */
  describe("tamanho do mapa", () => {
    it("cresce com o espaço, limitado pela altura da janela", () => {
      /* Tela de 1080: sobra para 1472 px de mapa. */
      expect(tamanhoDoMapa(1888, 1080)).toEqual({ largura: 1472, altura: 780 });
      /* Janela baixa: a altura é que limita, não a largura. */
      expect(tamanhoDoMapa(1648, 720)).toEqual({ largura: 900, altura: 477 });
    });

    it("não passa do teto nem em monitor enorme", () => {
      expect(tamanhoDoMapa(3000, 1600).largura).toBe(1600);
    });

    /*
     * Em tela cheia sobra mais altura para o mapa, porque a legenda das cores, a
     * lista de eventos, o país selecionado e a nota dos acesos saem da tela — fica
     * só o mapa, a barra de tempo, os controles e o aviso de qual fatia está no ar.
     */
    it("dá mais mapa em tela cheia, com a mesma janela", () => {
      const normal = tamanhoDoMapa(1888, 1080);
      const cheia = tamanhoDoMapa(1888, 1080, 200);
      expect(cheia.largura).toBeGreaterThan(normal.largura);
      expect(cheia.altura).toBeGreaterThan(normal.altura);
    });

    it("não encolhe abaixo do tamanho do globo", () => {
      expect(tamanhoDoMapa(600, 500).largura).toBe(900);
    });

    it("mantém a proporção que deixa o mapa 2:1 caber com folga", () => {
      const { largura, altura } = tamanhoDoMapa(1888, 1080);
      /* O mapa desenhado tem metade da largura em altura; sobra margem. */
      expect(altura).toBeGreaterThan(largura * 0.5);
      expect(altura).toBeLessThan(largura * 0.56);
    });
  });

  describe("tela cheia", () => {
    const botao = (c: HTMLElement) =>
      [...c.querySelectorAll("button")].find((b) =>
        /tela cheia/i.test(b.textContent ?? "")
      )!;

    it("oferece a opção e diz em que estado está", () => {
      const { container } = montar();
      expect(botao(container).textContent).toBe("Tela cheia");
      expect(botao(container).getAttribute("aria-pressed")).toBe("false");
    });

    /*
     * Pede na RAIZ e não só na área do mapa: a raiz leva a barra de tempo junto,
     * e mapa em tela cheia sem linha do tempo seria um mapa mudo. É também a raiz
     * que o ResizeObserver observa, então o mapa cresce sem conta nova.
     */
    it("pede tela cheia no elemento que contém o mapa e a barra", () => {
      const { container } = montar();
      const pedidos: Element[] = [];
      const proto = Element.prototype as unknown as {
        requestFullscreen?: () => Promise<void>;
      };
      const antes = proto.requestFullscreen;
      proto.requestFullscreen = function (this: Element) {
        pedidos.push(this);
        return Promise.resolve();
      };
      try {
        fireEvent.click(botao(container));
      } finally {
        proto.requestFullscreen = antes;
      }
      expect(pedidos).toHaveLength(1);
      const alvo = pedidos[0];
      expect(alvo.querySelector("canvas")).toBeTruthy();
      expect(alvo.querySelector('input[type="range"]')).toBeTruthy();
    });

    /*
     * Em tela cheia entra o mapa e o que serve para navegá-lo. O aviso de qual
     * fatia está no ar FICA: é a limitação mais importante do mapa, e esconder o
     * ano da fronteira faria o atlas afirmar fronteiras que nunca existiram —
     * exatamente o que a nota no código diz que não se pode fazer.
     */
    it("em tela cheia mantém a barra e o aviso da fatia, e tira o resto", () => {
      const { container } = montar();
      const proto = Element.prototype as unknown as {
        requestFullscreen?: () => Promise<void>;
      };
      const antes = proto.requestFullscreen;
      proto.requestFullscreen = () => Promise.resolve();
      try {
        /*
         * Na ordem do navegador: o clique pede, e só DEPOIS de atendido o
         * `fullscreenElement` passa a existir e o evento é emitido. Fazer o
         * contrário — marcar o elemento antes do clique — punha o componente no
         * ramo de SAIR de tela cheia, que é o oposto do que este teste mede.
         */
        fireEvent.click(botao(container));
        Object.defineProperty(document, "fullscreenElement", {
          value: container.firstChild,
          configurable: true,
        });
        fireEvent(document, new Event("fullscreenchange"));
      } finally {
        proto.requestFullscreen = antes;
        Object.defineProperty(document, "fullscreenElement", {
          value: null,
          configurable: true,
        });
      }

      expect(container.querySelector('input[type="range"]')).toBeTruthy();
      expect(container.textContent).toMatch(/Fronteiras de|Atenção: fronteiras/);
      /* A legenda longa das cores sai. */
      expect(container.textContent).not.toContain("territórios de povos");
    });

    /* Recusa do navegador não pode derrubar o mapa. */
    it("engole a recusa do navegador", () => {
      const { container } = montar();
      const proto = Element.prototype as unknown as {
        requestFullscreen?: () => Promise<void>;
      };
      const antes = proto.requestFullscreen;
      proto.requestFullscreen = () => Promise.reject(new Error("não permitido"));
      try {
        expect(() => fireEvent.click(botao(container))).not.toThrow();
      } finally {
        proto.requestFullscreen = antes;
      }
    });
  });

  describe("limite de deslocamento", () => {
    /* Com o mundo inteiro à vista não há para onde arrastar. */
    it("é zero quando o desenho é menor que o canvas", () => {
      expect(
        limitarDeslocamento([300, 300], 900, 477, { meiaLargura: 424, meiaAltura: 212 })
      ).toEqual([0, 0]);
    });

    it("deixa arrastar só até a borda do desenho", () => {
      const e = { meiaLargura: 900, meiaAltura: 500 };
      /* 900 de meia largura contra 450 de meio canvas: sobram 450 de folga. */
      expect(limitarDeslocamento([9999, 9999], 900, 477, e)).toEqual([450, 261.5]);
      expect(limitarDeslocamento([-9999, -9999], 900, 477, e)).toEqual([-450, -261.5]);
    });

    it("não mexe no que já está dentro do limite", () => {
      const e = { meiaLargura: 900, meiaAltura: 500 };
      expect(limitarDeslocamento([100, -50], 900, 477, e)).toEqual([100, -50]);
    });
  });

  /*
   * Globo e mapa são modos, e o controle diz em qual se está — o botão anterior
   * dizia "Desenrolar", que é o gesto, e o rótulo dependia de onde a animação
   * tinha chegado.
   */
  describe("modo de visualização", () => {
    const modo = (c: HTMLElement, nome: string) =>
      [...c.querySelectorAll("button")].find((b) => b.textContent === nome)!;

    it("começa no globo e anuncia o modo ativo", () => {
      const { container } = montar();
      expect(modo(container, "Globo").getAttribute("aria-pressed")).toBe("true");
      expect(modo(container, "Mapa").getAttribute("aria-pressed")).toBe("false");
    });

    it("troca para o mapa e volta", () => {
      const { container } = montar();
      fireEvent.click(modo(container, "Mapa"));
      expect(modo(container, "Mapa").getAttribute("aria-pressed")).toBe("true");
      fireEvent.click(modo(container, "Globo"));
      expect(modo(container, "Globo").getAttribute("aria-pressed")).toBe("true");
    });

    /**
     * O desenho de um país aceso, que muda quando a projeção muda. É a única
     * forma de observar a rotação de fora: ela não aparece no DOM como atributo.
     */
    const traco = (c: HTMLElement) =>
      c.querySelector("svg > g[data-camada=paises] > path")?.getAttribute("d") ?? "";

    const arrastar = (c: HTMLElement) => {
      const alvo = c.querySelector("div.touch-none") as HTMLElement;
      fireEvent.pointerDown(alvo, { clientX: 450, clientY: 280, pointerId: 1 });
      fireEvent.pointerMove(alvo, { clientX: 560, clientY: 300, pointerId: 1 });
      fireEvent.pointerUp(alvo, { clientX: 560, clientY: 300, pointerId: 1 });
    };

    it("no globo, arrastar gira", () => {
      const { container } = montar();
      const antes = traco(container);
      arrastar(container);
      expect(traco(container)).not.toBe(antes);
      expect(antes.length).toBeGreaterThan(10);
    });

    /*
     * No mapa o arrasto não gira — girar a equirretangular deslocaria a emenda do
     * antimeridiano para o meio de um continente. E com o mundo inteiro à vista
     * também não desloca, porque não há para onde ir: o desenho é mais estreito
     * que o canvas, e o limite de deslocamento é zero.
     */
    it("no mapa em zoom 1, arrastar não move nada", () => {
      const { container } = montar();
      fireEvent.click(modo(container, "Mapa"));
      const antes = traco(container);
      arrastar(container);
      expect(traco(container)).toBe(antes);
    });

    /* Ampliado, o arrasto passa a servir para navegar. */
    it("ampliado, arrastar desloca a vista", () => {
      const { container } = montar();
      fireEvent.click(modo(container, "Mapa"));
      const mais = container.querySelector('button[aria-label="Aproximar"]') as HTMLElement;
      fireEvent.click(mais);
      fireEvent.click(mais);
      const antes = traco(container);
      arrastar(container);
      expect(traco(container)).not.toBe(antes);
    });

    it("aproximar e afastar mostram a ampliação, e voltar reenquadra", () => {
      const { container } = montar();
      fireEvent.click(modo(container, "Mapa"));
      const grupo = container.querySelector('[aria-label="Ampliação"]') as HTMLElement;
      expect(grupo.textContent).toContain("1.0×");
      fireEvent.click(grupo.querySelector('button[aria-label="Aproximar"]') as HTMLElement);
      expect(grupo.textContent).toContain("1.5×");
      fireEvent.click(
        [...grupo.querySelectorAll("button")].find((b) => b.textContent === "Mundo inteiro")!
      );
      expect(grupo.textContent).toContain("1.0×");
    });

    /* O zoom é do mapa: no globo, aproximar não revela o que girar não revela. */
    it("não oferece ampliação no globo", () => {
      const { container } = montar();
      expect(container.querySelector('[aria-label="Ampliação"]')).toBeNull();
    });

    /*
     * A vista do mapa é aprumada NA HORA, sem esperar a animação do achatado —
     * que roda em requestAnimationFrame e nem sempre roda. Um mapa enviesado é
     * o defeito que este modo existe para não ter.
     */
    it("o mapa apruma a vista sem depender da animação", () => {
      const { container } = montar();
      const noGlobo = traco(container);
      fireEvent.click(modo(container, "Mapa"));
      expect(traco(container)).not.toBe(noGlobo);
    });

    /* E o giro que o globo tinha volta quando se volta para ele. */
    it("guarda o giro do globo enquanto se está no mapa", () => {
      const { container } = montar();
      arrastar(container);
      const girado = traco(container);
      fireEvent.click(modo(container, "Mapa"));
      fireEvent.click(modo(container, "Globo"));
      expect(traco(container)).toBe(girado);
    });
  });

  it("eventos próximos ao instante aparecem listados", () => {
    const { container, irPara } = montar();
    irPara("-221");
    const lista = container.querySelector("ul");
    expect(within(lista as HTMLElement).getByText(/Qin/)).toBeTruthy();
  });
});
