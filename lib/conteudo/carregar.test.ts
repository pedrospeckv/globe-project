import { describe, it, expect } from "vitest";
import path from "node:path";
import { carregarAcervo } from "./carregar";

const fixture = (nome: string) => path.join(__dirname, "__fixtures__", nome);

describe("carregarAcervo", () => {
  it("carrega um acervo válido", async () => {
    const acervo = await carregarAcervo(fixture("valido"));
    expect(acervo.paises).toHaveLength(1);
    expect(acervo.paises[0].nome).toBe("Brasil");
    expect(acervo.fontes[0].id).toBe("ibge-pnad");
  });

  it("aceita tanto objeto solto quanto array no arquivo", async () => {
    const acervo = await carregarAcervo(fixture("valido"));
    // paises/brasil.json é um objeto; fontes/fontes.json é um array
    expect(acervo.paises).toHaveLength(1);
    expect(acervo.fontes).toHaveLength(1);
  });

  it("devolve coleções vazias para diretórios ausentes", async () => {
    const acervo = await carregarAcervo(fixture("valido"));
    expect(acervo.viagens).toEqual([]);
    expect(acervo.figuras).toEqual([]);
  });

  it("lança apontando o ARQUIVO quando o schema não bate", async () => {
    await expect(carregarAcervo(fixture("quebrado"))).rejects.toThrow(/brasil\.json/);
  });

  it("inclui o campo culpado na mensagem de erro", async () => {
    await expect(carregarAcervo(fixture("quebrado"))).rejects.toThrow(/iso/);
  });

  it("lança apontando o arquivo quando o JSON é malformado", async () => {
    await expect(carregarAcervo(fixture("json-invalido"))).rejects.toThrow(
      /fontes\.json/
    );
  });

  it("devolve acervo vazio para raiz inexistente", async () => {
    const acervo = await carregarAcervo(fixture("nao-existe"));
    expect(acervo).toEqual({
      fontes: [],
      paises: [],
      figuras: [],
      viagens: [],
      indicadores: [],
      eventos: [],
      episodios: [],
      eleicoes: [],
      notas: [],
      ilhas: [],
  nacoes: [],
    });
  });
});
