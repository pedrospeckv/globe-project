import { describe, expect, it } from "vitest";
import { anteriorAFotografia, Imagem } from "./imagem";

describe("formato que o navegador desenha", () => {
  const base = {
    url: "https://upload.wikimedia.org/wikipedia/commons/a/ab/X.jpg",
    alt: "o que se vê",
    credito: "Autor",
    licenca: "Public domain",
  };

  it("aceita os formatos de imagem que um <img> desenha", () => {
    for (const ext of ["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]) {
      const r = Imagem.safeParse({ ...base, url: `https://upload.wikimedia.org/a/X.${ext}` });
      expect(r.success, ext).toBe(true);
    }
  });

  /*
   * Os três casos reais do primeiro lote de ilustração: dois PDFs de atos do
   * parlamento britânico e um TIFF do arquivo nacional americano. Documento
   * certo, licença livre, HTTP 200 — e ícone quebrado na página.
   */
  it("recusa PDF, TIFF e DjVu, que existem e não aparecem", () => {
    for (const ext of ["pdf", "tif", "tiff", "djvu"]) {
      const r = Imagem.safeParse({ ...base, url: `https://upload.wikimedia.org/a/X.${ext}` });
      expect(r.success, ext).toBe(false);
    }
  });

  it("ignora o rastreio que a API do Commons gruda no fim", () => {
    const r = Imagem.safeParse({
      ...base,
      url: "https://upload.wikimedia.org/a/X.jpg?utm_source=commons.wikimedia.org",
    });
    expect(r.success).toBe(true);
  });
});

describe("anteriorAFotografia", () => {
  it("período que termina antes de 1839 é anterior à fotografia", () => {
    expect(anteriorAFotografia("1533")).toBe(true);
    expect(anteriorAFotografia("-0044")).toBe(true);
    expect(anteriorAFotografia("1838-12-31")).toBe(true);
  });

  it("período que alcança a era fotográfica não recebe a ressalva", () => {
    expect(anteriorAFotografia("1839")).toBe(false);
    expect(anteriorAFotografia("1910")).toBe(false);
  });

  /*
   * Aviso falso é pior que aviso nenhum: um período em curso chega até hoje,
   * e dizer que ali não podia haver fotografia seria mentira.
   */
  it("período em curso nunca é anterior", () => {
    expect(anteriorAFotografia(undefined)).toBe(false);
  });
});
