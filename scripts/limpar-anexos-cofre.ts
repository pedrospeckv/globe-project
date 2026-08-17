#!/usr/bin/env tsx
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Remove das notas as ligações que apontam para anexo do cofre do Obsidian.
 *
 * `[[IMG_8543.jpeg]]`, `![[Pasted image 20251020161626.png]]`,
 * `[[Organização/Prints e PDFs/image.jpg]]` — são arquivos que existem dentro
 * do cofre e em nenhum outro lugar. Publicados, chegam à tela como colchete
 * cru, porque não há alvo para resolver e não há imagem para servir.
 *
 * Isto não é o mesmo caso das referências entre notas. `[[Judaísmo]]` aponta
 * para conteúdo que existe no acervo e virou link de verdade quando a nota
 * passou a ser alvo em `indexarAlvos`. Anexo não tem para onde apontar.
 *
 * A verificação de ligações agora cobre a prosa das notas, então uma que
 * escape daqui quebra o `pnpm validar` em vez de aparecer publicada.
 */

const DESTINO = path.join(process.cwd(), "conteudo", "notas");

/**
 * Extensões de anexo que o cofre embute.
 *
 * O apelido depois da barra vertical é opcional e precisa estar previsto: o
 * Obsidian usa esse lugar para dimensão — `![[IMG_8478.jpeg|700x933]]` —, e a
 * primeira versão deste padrão exigia a extensão colada no fecho, deixando
 * escapar exatamente os anexos redimensionados.
 */
const RE_ANEXO =
  /!?\[\[[^\]|]*\.(?:jpe?g|png|gif|webp|svg|pdf|mp4|mov|mp3|wav)(?:\|[^\]]*)?\]\]/gi;

async function main() {
  const arquivos = (await fs.readdir(DESTINO)).filter((a) => a.endsWith(".json"));
  const tocadas: string[] = [];
  let total = 0;

  for (const arquivo of arquivos) {
    const caminho = path.join(DESTINO, arquivo);
    const nota = JSON.parse(await fs.readFile(caminho, "utf8"));
    const achados = nota.corpo.match(RE_ANEXO);
    if (!achados) continue;

    /*
     * Some a ligação e a linha some com ela quando não sobrar nada.
     * Um anexo sozinho numa linha deixaria linha vazia, e várias seguidas
     * deixariam o buraco que já existia em outras notas.
     */
    nota.corpo = nota.corpo
      .replace(RE_ANEXO, "")
      .replace(/^[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    await fs.writeFile(caminho, `${JSON.stringify(nota, null, 2)}\n`, "utf8");
    tocadas.push(`${nota.id} (${achados.length})`);
    total += achados.length;
  }

  console.log(`✓ ${total} anexos do cofre removidos de ${tocadas.length} notas`);
  for (const t of tocadas) console.log(`  · ${t}`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
