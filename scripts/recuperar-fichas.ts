#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { livroDoFrontmatter } from "../lib/conteudo/frontmatter";

/**
 * Devolve às notas a ficha de livro que o commit 709f5ab jogou fora.
 *
 * Aquele commit removeu o cabeçalho YAML do cofre do corpo das notas, e estava
 * certo em remover — era metadado publicado como se fosse texto. Só que o
 * mesmo cabeçalho continha título, autor, editora, número de páginas e o
 * endereço da capa no Google Books, que é exatamente o que a estante precisa.
 * Removeu e não guardou.
 *
 * O importador já faz as duas coisas juntas agora. Este script é o conserto
 * retroativo, para não exigir o cofre à mão numa máquina que não o tenha: lê o
 * corpo anterior direto do git e extrai a ficha com o mesmo leitor.
 *
 * É de uso único. Depois que as fichas estiverem nos arquivos, reimportar o
 * cofre mantém tudo em dia e este script não tem mais função.
 */

const COMMIT_ANTES = "709f5ab^";
const DESTINO = path.join(process.cwd(), "conteudo", "notas");

function corpoAntigo(id: string): string | undefined {
  try {
    const bruto = execSync(`git show "${COMMIT_ANTES}:conteudo/notas/${id}.json"`, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(bruto).corpo;
  } catch {
    // nota criada depois daquele commit, ou renomeada
    return undefined;
  }
}

async function main() {
  const arquivos = (await fs.readdir(DESTINO)).filter((a) => a.endsWith(".json"));
  const achadas: string[] = [];

  for (const arquivo of arquivos) {
    const caminho = path.join(DESTINO, arquivo);
    const nota = JSON.parse(await fs.readFile(caminho, "utf8"));
    if (nota.livro) continue;

    const antigo = corpoAntigo(nota.id);
    if (!antigo) continue;

    const livro = livroDoFrontmatter(antigo);
    if (!livro) continue;

    nota.livro = livro;
    await fs.writeFile(caminho, `${JSON.stringify(nota, null, 2)}\n`, "utf8");
    achadas.push(
      `${nota.id} — "${livro.titulo}" de ${livro.autor}` +
        (livro.paginas ? `, ${livro.paginas}p` : "") +
        (livro.capa ? ", com capa" : ", SEM capa")
    );
  }

  console.log(`✓ ${achadas.length} fichas recuperadas`);
  for (const a of achadas) console.log(`  · ${a}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
