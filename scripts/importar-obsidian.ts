/**
 * Traz notas do cofre do Obsidian para o acervo.
 *
 *   pnpm tsx scripts/importar-obsidian.ts "Estudos pessoais/História"
 *   pnpm tsx scripts/importar-obsidian.ts --listar "Estudos pessoais/Leitura"
 *
 * O cofre fica FORA do repositório, e a nota importada é copiada para
 * `conteudo/notas/`. Ler do cofre em tempo de build amarraria o site à
 * máquina do autor: sem o cofre montado, a página sumiria em silêncio.
 *
 * `--listar` não escreve nada. Existe porque estas notas são pessoais e o
 * site é público: a triagem do que pode ser publicado é decisão de pessoa,
 * não de script.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  livroDoFrontmatter,
  semFrontmatter,
  type LivroDoCofre,
} from "../lib/conteudo/frontmatter";

const COFRE =
  process.env.COFRE_OBSIDIAN ?? path.join("C:", "Users", "Ana Speck", "MinhaCabeca");
const DESTINO = path.join(process.cwd(), "conteudo", "notas");

/**
 * Rascunho vazio ou quase — não vira nota.
 *
 * Medido no texto, depois de tirar o cabeçalho: o metadado de leitura do cofre
 * sozinho passa de 700 bytes, e contá-lo faria uma nota de duas linhas entrar
 * como se tivesse conteúdo.
 */
const TAMANHO_MINIMO = 400;

function paraId(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function arquivosMd(dir: string): Promise<string[]> {
  const saida: string[] = [];
  for (const entrada of await fs.readdir(dir, { withFileTypes: true })) {
    if (entrada.name.startsWith(".")) continue;
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) saida.push(...(await arquivosMd(caminho)));
    else if (entrada.name.endsWith(".md")) saida.push(caminho);
  }
  return saida;
}

interface Candidata {
  id: string;
  titulo: string;
  pasta: string;
  corpo: string;
  atualizadaEm: string;
  bytes: number;
  /**
   * A ficha lida do cabeçalho antes de ele ser removido.
   *
   * As duas coisas acontecem na mesma passagem de propósito. A primeira versão
   * só removia, e levava embora título, autor, editora, páginas e capa junto —
   * o metadado que a estante precisa, jogado fora por ser "organização do
   * cofre". Remover do corpo e guardar como dado é uma operação, não duas.
   */
  livro?: LivroDoCofre;
}

async function candidatas(pastaRelativa: string): Promise<Candidata[]> {
  const base = path.join(COFRE, pastaRelativa);
  const arquivos = await arquivosMd(base);
  const saida: Candidata[] = [];

  for (const arquivo of arquivos) {
    const bruto = await fs.readFile(arquivo, "utf8");
    const info = await fs.stat(arquivo);
    const titulo = path.basename(arquivo, ".md");
    const relativo = path.relative(base, path.dirname(arquivo));
    const limpo = bruto.trim();
    const corpo = semFrontmatter(limpo).trim();

    saida.push({
      id: paraId(titulo),
      titulo,
      pasta: relativo || pastaRelativa.split("/").pop() || pastaRelativa,
      corpo,
      atualizadaEm: info.mtime.toISOString().slice(0, 10),
      bytes: Buffer.byteLength(corpo),
      livro: livroDoFrontmatter(limpo),
    });
  }

  return saida.sort((a, b) => b.bytes - a.bytes);
}

/**
 * Triagem versionada.
 *
 * Uma pasta como Leitura mistura estudo histórico com saúde, negócios, fé
 * pessoal e anotações sobre conversas de terceiros nomeados. Passar títulos
 * na linha de comando resolveria a importação e não deixaria registro de
 * quem decidiu o quê — e isso aqui é decisão de curadoria, não de execução.
 */
async function selecao(): Promise<{
  titulos: Set<string>;
  /** Vínculo guardado de nota que ainda não tem texto — ver `_leiaAlvos`. */
  alvosGuardados: Record<string, string[]>;
}> {
  const bruto = await fs.readFile(
    path.join(process.cwd(), "scripts", "selecao-obsidian.json"),
    "utf8"
  );
  const json = JSON.parse(bruto);
  return {
    titulos: new Set<string>(json.titulos),
    alvosGuardados: json.alvosGuardados ?? {},
  };
}

async function main() {
  const args = process.argv.slice(2);
  const soListar = args.includes("--listar");
  const usarSelecao = args.includes("--selecao");
  const pastas = args.filter((a) => !a.startsWith("--"));

  if (pastas.length === 0) {
    console.error("informe ao menos uma pasta do cofre");
    process.exit(1);
  }

  const todas: Candidata[] = [];
  for (const pasta of pastas) todas.push(...(await candidatas(pasta)));

  let elegiveis = todas;
  let alvosGuardados: Record<string, string[]> = {};
  if (usarSelecao) {
    const permitidos = await selecao();
    alvosGuardados = permitidos.alvosGuardados;
    const faltando = [...permitidos.titulos].filter(
      (t) => !todas.some((c) => c.titulo === t)
    );
    if (faltando.length) {
      console.error(`✗ na seleção mas não achado no cofre: ${faltando.join(", ")}`);
      process.exit(1);
    }
    elegiveis = todas.filter((c) => permitidos.titulos.has(c.titulo));
  }

  const boas = elegiveis.filter((c) => c.bytes >= TAMANHO_MINIMO);
  const magras = elegiveis.filter((c) => c.bytes < TAMANHO_MINIMO);

  if (soListar) {
    console.log(`\n${todas.length} notas em ${pastas.join(", ")}\n`);
    for (const c of boas) {
      console.log(`  ${String(Math.round(c.bytes / 1024)).padStart(3)} KB  ${c.titulo}`);
    }
    console.log(`\n  ${magras.length} descartadas por serem rascunho vazio ou curto`);
    console.log("\nnada foi escrito — tire o --listar para importar\n");
    return;
  }

  await fs.mkdir(DESTINO, { recursive: true });
  const vistos = new Map<string, string>();
  const revisadasPreservadas: string[] = [];

  for (const c of boas) {
    if (vistos.has(c.id)) {
      console.error(
        `✗ id repetido "${c.id}": "${c.titulo}" e "${vistos.get(c.id)}" — renomeie uma no cofre`
      );
      process.exit(1);
    }
    vistos.set(c.id, c.titulo);

    const destino = path.join(DESTINO, `${c.id}.json`);

    /*
     * Preserva `alvos` de uma importação anterior. O vínculo com o atlas é
     * trabalho humano — reimportar o cofre não pode apagá-lo.
     *
     * Não havendo importação anterior, cai no vínculo guardado na triagem:
     * é o caso da nota que foi tirada do acervo por ser só esqueleto de
     * capítulos e voltou depois que o resumo foi escrito.
     */
    let alvos: string[] = alvosGuardados[c.titulo] ?? [];

    /*
     * Nota revisada não volta a ser o rascunho do cofre.
     *
     * A revisão com fonte acontece AQUI, no repositório, não no Obsidian: o
     * texto é conferido, corrigido e ganha lastro, e nada disso volta para o
     * cofre. Como este script regenera `corpo` a partir do arquivo .md, uma
     * reimportação desatenta desfaria a revisão inteira em silêncio — o pior
     * tipo de perda, porque o build continuaria passando.
     *
     * Ter fonte é o que marca a nota como revisada, então é o que protege o
     * texto. O que continua vindo do cofre é a ficha do livro, que melhora lá
     * quando o plugin completa o metadado.
     */
    let corpo = c.corpo;
    let fontes: string[] = [];
    try {
      const antigo = JSON.parse(await fs.readFile(destino, "utf8"));
      alvos = antigo.alvos ?? alvos;
      fontes = antigo.fontes ?? [];
      if (fontes.length > 0) {
        corpo = antigo.corpo;
        revisadasPreservadas.push(c.id);
      }
    } catch {
      // primeira importação desta nota
    }

    const nota = {
      id: c.id,
      titulo: c.titulo,
      pasta: c.pasta,
      corpo,
      atualizadaEm: c.atualizadaEm,
      alvos,
      fontes,
      ...(c.livro ? { livro: c.livro } : {}),
    };
    await fs.writeFile(destino, `${JSON.stringify(nota, null, 2)}\n`, "utf8");
  }

  console.log(`✓ ${boas.length} notas importadas para conteudo/notas/`);
  console.log(`  ${magras.length} descartadas (menos de ${TAMANHO_MINIMO} bytes)`);
  const comLivro = boas.filter((c) => c.livro).length;
  if (comLivro) console.log(`  ${comLivro} com ficha de livro no cabeçalho`);
  if (revisadasPreservadas.length) {
    console.log(
      `  ${revisadasPreservadas.length} já revisadas — texto do repositório preservado, cofre ignorado:`
    );
    for (const id of revisadasPreservadas) console.log(`    · ${id}`);
  }
  const semAlvo = boas.filter((c) => !vistos.has(c.id));
  if (semAlvo.length) console.log(`  ${semAlvo.length} sem vínculo com o atlas`);
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
