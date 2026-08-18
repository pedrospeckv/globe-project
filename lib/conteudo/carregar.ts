import fs from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { Fonte } from "./fonte";
import { Figura } from "./figura";
import { Pais } from "./pais";
import { Viagem } from "./viagem";
import { Ilha } from "./ilha";
import { Indicador } from "./indicador";
import { Evento } from "./evento";
import { Nota } from "./nota";
import type { Acervo } from "./integridade";

async function lerJsonDoDiretorio<T extends z.ZodTypeAny>(
  dir: string,
  schema: T
): Promise<z.infer<T>[]> {
  let arquivos: string[];
  try {
    arquivos = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return []; // diretório ausente é coleção vazia, não erro
  }

  const itens: z.infer<T>[] = [];

  for (const arquivo of arquivos.sort()) {
    const caminho = path.join(dir, arquivo);
    const texto = await fs.readFile(caminho, "utf8");

    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch (e) {
      const motivo = e instanceof Error ? e.message : String(e);
      throw new Error(`JSON malformado em ${arquivo}\n  ${motivo}`);
    }

    const lista = Array.isArray(bruto) ? bruto : [bruto];

    for (const item of lista) {
      const r = schema.safeParse(item);
      if (!r.success) {
        const detalhe = r.error.issues
          .map((i) => `  ${i.path.join(".") || "(raiz)"}: ${i.message}`)
          .join("\n");
        throw new Error(`conteúdo inválido em ${arquivo}\n${detalhe}`);
      }
      itens.push(r.data);
    }
  }

  return itens;
}

/**
 * Lê `conteudo/` do disco e devolve um Acervo tipado.
 * Lança com mensagem citando o arquivo e o campo culpados — é o que torna o
 * erro de build acionável em vez de críptico.
 */
export async function carregarAcervo(raiz: string): Promise<Acervo> {
  const [fontes, paises, figuras, viagens, indicadores, eventos, notas, ilhas] =
    await Promise.all([
    lerJsonDoDiretorio(path.join(raiz, "fontes"), Fonte),
    lerJsonDoDiretorio(path.join(raiz, "paises"), Pais),
    lerJsonDoDiretorio(path.join(raiz, "figuras"), Figura),
    lerJsonDoDiretorio(path.join(raiz, "viagens"), Viagem),
    lerJsonDoDiretorio(path.join(raiz, "indicadores"), Indicador),
    lerJsonDoDiretorio(path.join(raiz, "eventos"), Evento),
    lerJsonDoDiretorio(path.join(raiz, "notas"), Nota),
    lerJsonDoDiretorio(path.join(raiz, "ilhas"), Ilha),
  ]);
  return { fontes, paises, figuras, viagens, indicadores, eventos, notas, ilhas };
}
