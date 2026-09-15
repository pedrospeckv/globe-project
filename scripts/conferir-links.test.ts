import { describe, expect, it } from "vitest";
import {
  agruparPorHost,
  causaDe,
  classificar,
  coletarUrls,
  hostDe,
  proximaPausa,
  vencido,
  type Registro,
} from "./conferir-links";

describe("coletarUrls", () => {
  it("acha endereço em campo raso e diz onde está", () => {
    const achados = coletarUrls(
      { id: "x", url: "https://exemplo.org/a" },
      "conteudo/fontes/fontes.json"
    );
    expect(achados).toEqual([
      {
        url: "https://exemplo.org/a",
        arquivo: "conteudo/fontes/fontes.json",
        campo: "url",
      },
    ]);
  });

  /*
   * O caso que motivou a varredura genérica: a imagem do período mora três
   * níveis abaixo da raiz, e o caminho é o que faz a mensagem ser útil.
   */
  it("acha endereço aninhado e monta o caminho com índice de lista", () => {
    const pais = {
      iso: "BRA",
      periodos: [
        { id: "a" },
        {
          id: "b",
          imagem: {
            url: "https://upload.wikimedia.org/x.jpg",
            origem: "https://commons.wikimedia.org/wiki/File:X.jpg",
          },
        },
      ],
    };
    const achados = coletarUrls(pais, "conteudo/paises/brasil.json");
    expect(achados.map((a) => a.campo)).toEqual([
      "periodos[1].imagem.url",
      "periodos[1].imagem.origem",
    ]);
  });

  it("ignora string que não é endereço", () => {
    const achados = coletarUrls(
      { titulo: "Gulag: A History", citacao: "ver p. 40" },
      "f.json"
    );
    expect(achados).toEqual([]);
  });

  it("varre lista na raiz — é a forma de fontes.json", () => {
    const achados = coletarUrls(
      [{ id: "a" }, { id: "b", url: "http://exemplo.org" }],
      "conteudo/fontes/fontes.json"
    );
    expect(achados).toHaveLength(1);
    expect(achados[0].campo).toBe("[1].url");
  });
});

describe("classificar", () => {
  it("2xx e 3xx estão vivos — redirecionar é manutenção do site", () => {
    for (const s of [200, 204, 301, 302, 308]) {
      expect(classificar(s)).toBe("vivo");
    }
  });

  it("404 e 410 estão mortos", () => {
    expect(classificar(404)).toBe("morto");
    expect(classificar(410)).toBe("morto");
  });

  /*
   * O teste que protege o contribuidor: um 403 do Cloudflare não é prova de
   * fonte inventada, e tratá-lo como morto faria alguém apagar conteúdo bom
   * para destravar o build.
   */
  it("barreira de robô e defeito de servidor ficam incertos, nunca mortos", () => {
    for (const s of [401, 403, 429, 500, 502, 503]) {
      expect(classificar(s)).toBe("incerto");
    }
  });
});

describe("agruparPorHost", () => {
  /*
   * O agrupamento existe por causa de uma medição: a primeira execução do
   * script tomou 169 respostas 429 porque oito requisições simultâneas contra
   * a fila embaralhada são oito requisições simultâneas contra o Commons —
   * 355 dos 391 endereços do acervo estão em dois servidores da Wikimedia.
   */
  it("junta endereços do mesmo servidor e separa os de servidores diferentes", () => {
    const grupos = agruparPorHost([
      "https://commons.wikimedia.org/wiki/File:A.jpg",
      "https://upload.wikimedia.org/a.jpg",
      "https://commons.wikimedia.org/wiki/File:B.jpg",
      "https://portal.stf.jus.br/x",
    ]);
    expect([...grupos.keys()]).toEqual([
      "commons.wikimedia.org",
      "upload.wikimedia.org",
      "portal.stf.jus.br",
    ]);
    expect(grupos.get("commons.wikimedia.org")).toHaveLength(2);
  });

  it("endereço ilegível vira o próprio grupo, e não derruba o agrupamento", () => {
    expect(hostDe("nem-endereco")).toBe("nem-endereco");
    expect(agruparPorHost(["nem-endereco"]).size).toBe(1);
  });
});

describe("causaDe", () => {
  /*
   * O caso real que fez esta função existir: três decisões do STF e a página
   * da Comissão Nacional da Verdade falham com certificado ICP-Brasil que o
   * Node não valida de fábrica. O servidor está no ar. Relatar "não
   * respondeu" mandaria alguém caçar um link que não está quebrado.
   */
  it("cadeia de certificado que não fecha é dita pelo nome", () => {
    const e = new TypeError("fetch failed");
    (e as { cause?: unknown }).cause = { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" };
    expect(causaDe(e)).toBe("certificado não verificado");
  });

  it("domínio que não resolve é distinto de servidor que demorou", () => {
    const sumiu = new TypeError("fetch failed");
    (sumiu as { cause?: unknown }).cause = { code: "ENOTFOUND" };
    expect(causaDe(sumiu)).toBe("servidor não existe");

    expect(causaDe({ name: "TimeoutError" })).toBe("estourou o tempo");
  });

  it("causa desconhecida não é inventada", () => {
    expect(causaDe(new Error("qualquer coisa"))).toBe("sem resposta");
  });
});

describe("proximaPausa", () => {
  it("dobra a cada 429", () => {
    expect(proximaPausa(150, 429)).toBe(300);
    expect(proximaPausa(300, 429)).toBe(600);
  });

  it("não passa do teto, por mais 429 que venham", () => {
    expect(proximaPausa(4000, 429)).toBe(4000);
    expect(proximaPausa(3000, 429)).toBe(4000);
  });

  /*
   * Encolher importa tanto quanto crescer: sem isso, uma rajada de limite no
   * começo prenderia o servidor no passo mais lento pelo resto da execução.
   */
  it("encolhe quando o servidor volta a responder", () => {
    expect(proximaPausa(1000, 200)).toBe(900);
  });

  it("nunca desce abaixo da pausa mínima", () => {
    expect(proximaPausa(150, 200)).toBe(150);
    expect(proximaPausa(160, 200)).toBe(150);
  });
});

describe("vencido", () => {
  const hoje = new Date("2026-08-21T12:00:00Z");
  const vivo = (em: string): Registro => ({ veredito: "vivo", status: 200, em });

  it("endereço nunca conferido está vencido", () => {
    expect(vencido(undefined, hoje)).toBe(true);
  });

  it("vivo e recente é dispensado", () => {
    expect(vencido(vivo("2026-08-20"), hoje)).toBe(false);
  });

  it("vivo e velho volta à fila", () => {
    expect(vencido(vivo("2026-06-01"), hoje)).toBe(true);
  });

  it("na fronteira exata dos 30 dias, confere de novo", () => {
    expect(vencido(vivo("2026-07-22"), hoje)).toBe(true);
  });

  /*
   * Morto e incerto voltam SEMPRE, por motivos opostos e igualmente
   * importantes: o link consertado precisa parar de reprovar hoje, e o 403 de
   * limite de taxa não pode virar veredito permanente por ter caído numa hora
   * ruim.
   */
  it("morto volta à fila mesmo conferido hoje", () => {
    expect(
      vencido({ veredito: "morto", status: 404, em: "2026-08-21" }, hoje)
    ).toBe(true);
  });

  it("incerto volta à fila mesmo conferido hoje", () => {
    expect(
      vencido({ veredito: "incerto", status: 403, em: "2026-08-21" }, hoje)
    ).toBe(true);
  });

  it("data ilegível no cache é tratada como vencida, não como válida", () => {
    expect(vencido(vivo("ontem"), hoje)).toBe(true);
  });
});
