#!/usr/bin/env tsx
/**
 * Monta o pacote de um lote de ILUSTRAÇÃO — os países sem imagem de época.
 *
 *   pnpm lote-imagens            # os 10 primeiros da fila
 *   pnpm lote-imagens --todos    # a fila inteira, repartida
 *
 * Script separado do `preparar-lote.ts`, e não um modo dele, porque só a
 * repartição é comum: a fila é outra (cobertura de imagem, não registro de
 * prosa), o corpo do pacote é outro e o formato da resposta é outro.
 * Parametrizar as quatro funções daquele arquivo daria mais código do que
 * este arquivo inteiro tem.
 *
 * ## A diferença que muda tudo em relação ao lote de reescrita
 *
 * Reescrever registro não cria afirmação nova: o texto já existia e as fontes
 * também. **Ilustrar cria.** Cada imagem traz três afirmações que ninguém
 * tinha feito antes — que o arquivo existe naquele endereço, que a licença é
 * aquela, e que a peça é do período. A primeira o `pnpm conferir-links` já
 * confere. A terceira é editorial e não tem máquina.
 *
 * A segunda é a perigosa: publicar uma foto sob CC BY-SA sem a atribuição
 * certa é violação de licença, não descuido de layout. Por isso o pacote não
 * pede que o modelo *escreva* a licença de memória — pede que ele a **copie da
 * resposta da API do Commons**, cuja chamada vai escrita ali dentro.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { carregarAcervo } from "../lib/conteudo/carregar";
import { repartir } from "./preparar-lote";
import type { Pais } from "../lib/conteudo/pais";

const RAIZ = path.join(process.cwd(), "conteudo");
const DESTINO = path.join(process.cwd(), "lotes");
const TAMANHO = 10;

/**
 * A fila: países sem imagem nenhuma, do que tem menos períodos ao que tem mais.
 *
 * A ordem é por CUSTO, e não por importância, porque a unidade de entrega é o
 * país inteiro — `pnpm validar` trata país pela metade como defeito, não como
 * dívida. Um país de 2 períodos fecha com 2 imagens; um de 10 pede 10 e trava
 * o lote inteiro se faltar uma. Começar pelos baratos fecha mais países por
 * rodada, e país fechado é o que sai da lista.
 */
export function filaDeIlustracao(paises: readonly Pais[]): Pais[] {
  return paises
    .filter((p) => p.periodos.every((x) => !x.imagem))
    .sort((a, b) => a.periodos.length - b.periodos.length);
}

const PEDIDO = `## O que fazer

Para **cada período** de cada país abaixo, achar uma imagem **de época** no
Wikimedia Commons: uma peça feita DENTRO do período que ela ilustra.

**País é tudo ou nada.** \`pnpm validar\` trata país com metade dos períodos
ilustrados como defeito, não como dívida — meio país some da vista de quem
revisa. Se um único período não tiver imagem livre possível, **entregue o país
inteiro como não feito** e diga por quê. Isso é resposta aceitável e esperada.

### O que é imagem de época

O que precisa ser do período é a **PEÇA**, não o arquivo digital. Peça é a
fotografia, o cartaz, a moeda, o mapa, o manuscrito, a pintura do próprio
século, a nota de dinheiro, o selo, a gravura de jornal.

**Não serve:** pintura do século XIX retratando a Idade Média; reconstituição;
mapa feito hoje sobre o passado; retrato de um monarca pintado 200 anos depois
da morte dele. Em todos esses a peça é posterior ao que ela mostra.

### Período anterior a 1839, quando a fotografia não existia

Aqui a peça é sempre vista através de uma imagem moderna, e isso é esperado —
não é plano B. Mas há duas formas com estatuto diferente, e a ordem de
preferência importa:

1. **Objeto portátil fotografado** — a moeda com o perfil do rei, a estela, o
   manuscrito, o selo cilíndrico, a escultura de museu. A peça é de época e a
   fotografia é só o meio de olhá-la. **É a primeira escolha.**
2. **Representação de época do lugar** — a gravura, a miniatura, o desenho de
   viajante feito no período. Também é peça de época, e mostra o lugar como
   era.
3. **Fotografia moderna de um edifício ainda de pé** — o Taj Mahal, o Qutb
   Minar, o Kinkaku-ji. **Último recurso.** Ela mostra o prédio como está
   hoje, com restauros e entorno que o período não tinha. Só use quando 1 e 2
   não existirem, e saiba que a página vai declarar a ressalva ao leitor.

Não troque um objeto de museu por uma foto bonita de monumento: a foto do
monumento é a opção mais fácil de achar e a mais fraca das três.

### Como buscar — a parte em que a primeira rodada falhou

**Busca curta, de 2 a 4 palavras. Nunca uma frase descritiva.** A busca do
Commons é por palavra-chave: uma frase longa cai em digitalizações de livros do
Internet Archive e devolve nada de útil. Medido:

| consulta | resultado |
|---|---|
| \`Rwanda Nyiginya kingdom 19th century mwami\` | **0 achados** |
| \`Rwanda mwami\` | o Palácio do Mwami em Nyanza |
| \`Mali empire manuscript Timbuktu 16th century\` | **0 achados** |
| \`Timbuktu manuscript\` | os manuscritos de astronomia e matemática |

Se a busca não achar, **não conclua que a imagem não existe** — quase sempre
ela existe. Vá pela categoria, que é curada à mão e é o caminho mais confiável
para período antigo:

\`\`\`
https://commons.wikimedia.org/w/api.php?action=query&format=json&list=categorymembers&cmtitle=Category:History%20of%20Rwanda&cmtype=subcat|file&cmlimit=50
\`\`\`

As subcategorias dizem o que existe: *Kandyan period frescoes*, *Banknotes of
the Emirate of Bukhara*, *Flags of the King of Kandy*, *Emirs of Bukhara*.
Desça por elas até o arquivo. Bons pontos de partida:
\`Category:History of <país>\`, \`Category:<dinastia ou reino>\`,
\`Category:<país> in the <século>\`.

### Depois de escolher: copie a licença da resposta, não da memória

Publicar CC BY-SA sem a atribuição correta é violação de licença, e é o único
erro deste lote com consequência fora do repositório.

\`\`\`
https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=SUA%20BUSCA&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1920
\`\`\`

Da resposta saem os quatro campos:

- \`imageinfo[0].thumburl\` → \`url\` (a versão de 1920px; sem \`?\` nem parâmetro no fim)
- \`imageinfo[0].descriptionurl\` → \`origem\` (a página \`File:\` do Commons)
- \`extmetadata.LicenseShortName.value\` → \`licenca\`
- \`extmetadata.Artist.value\` → \`credito\` (só o nome, sem HTML; some o acervo se houver)

Se \`LicenseShortName\` não existir ou disser algo como *fair use*, o arquivo
não serve. Só entra o que o Commons declara livre — domínio público ou CC.

**\`url\` tem que ser o \`thumburl\`, e não o arquivo original.** PDF, TIFF e
DjVu existem no Commons, respondem 200, têm licença livre — e um \`<img>\` não
desenha nenhum dos três. O \`thumburl\` é sempre a miniatura JPG que o próprio
Commons gera, inclusive para esses formatos. O schema recusa o resto.

### O \`alt\`

Descreva **o que se vê**, para quem usa leitor de tela. Não interprete e não
repita a legenda: "Fotografia em preto e branco de homens de terno assinando
um documento numa mesa comprida" serve; "A assinatura do tratado que mudou a
história" não.

## Formato da resposta

\`\`\`json
{
  "imagens": {
    "id-do-periodo": {
      "url": "https://upload.wikimedia.org/...",
      "alt": "o que se vê na imagem",
      "credito": "Autor · Acervo",
      "licenca": "CC BY-SA 4.0",
      "origem": "https://commons.wikimedia.org/wiki/File:...",
      "legenda": "contexto que o alt não dá — opcional"
    }
  }
}
\`\`\`

\`origem\` é obrigatória neste lote, mesmo sendo opcional no schema: é a página
onde outra pessoa confere a licença que você declarou.

Ao final, **fora do JSON**, liste os países que você NÃO conseguiu fechar e o
período que faltou em cada um.`;

function secaoDoPais(pais: Pais): string {
  const l: string[] = [];
  l.push(`### ${pais.nome} (\`${pais.iso}\`) — ${pais.periodos.length} imagens`);
  l.push("");
  for (const p of pais.periodos) {
    const ate = p.fim ? `–${p.fim}` : " em diante";
    l.push(`#### \`${p.id}\` — ${p.rotulo} · ${p.regime}`);
    l.push("");
    l.push(`**Janela da imagem: ${p.inicio}${ate}.** Fora dela não serve.`);
    l.push("");
    if (p.textoMdx) {
      l.push("O que o período conta (para escolher o que ilustrar):");
      l.push("");
      l.push("```");
      l.push(p.textoMdx);
      l.push("```");
      l.push("");
    }
  }
  return l.join("\n");
}

function comoAplicar(indice: number, isos: readonly string[]): string {
  const n = String(indice).padStart(2, "0");
  return `## Como aplicar

\`\`\`bash
pnpm tsx scripts/aplicar-lote.ts lotes/imagens-${n}.json --ensaio
pnpm tsx scripts/aplicar-lote.ts lotes/imagens-${n}.json
pnpm validar          # país pela metade aparece aqui
pnpm conferir-links   # os endereços existem mesmo?
\`\`\`

Os quatro comandos, nesta ordem. \`conferir-links\` é o que pega endereço
inventado: ele bate em cada URL e reprova em 404.

Os países deste lote são **só seus** — \`${isos.join(", ")}\`. Nenhum outro lote
toca nesses arquivos.`;
}

async function main(): Promise<void> {
  const todos = process.argv.includes("--todos");
  const acervo = await carregarAcervo(RAIZ);
  const fila = filaDeIlustracao(acervo.paises);

  if (fila.length === 0) {
    console.log("✓ nenhum país sem imagem — a fila de ilustração está vazia");
    return;
  }

  const lotes = todos ? repartir(fila, TAMANHO) : [fila.slice(0, TAMANHO)];
  await fs.mkdir(DESTINO, { recursive: true });

  const linhasIndice: string[] = [
    "# Índice dos lotes de ilustração",
    "",
    `**${fila.length} países sem imagem nenhuma**, repartidos em ${lotes.length} lotes.`,
    "Nenhum país está em dois lotes. A unidade de entrega é o país inteiro:",
    "meio país ilustrado reprova em `pnpm validar`.",
    "",
    "| lote | países | imagens a achar |",
    "|---|---|---|",
  ];

  for (const [i, lote] of lotes.entries()) {
    const imagens = lote.reduce((n, p) => n + p.periodos.length, 0);
    const nome = `imagens-${String(i + 1).padStart(2, "0")}.md`;
    const partes = [
      `# Lote de ilustração ${i + 1} de ${lotes.length}`,
      "",
      `**${lote.length} países, ${imagens} imagens a achar.** ` +
        lote.map((p) => `${p.nome} (\`${p.iso}\`, ${p.periodos.length})`).join(" · "),
      "",
      PEDIDO,
      "",
      "---",
      "",
      comoAplicar(i + 1, lote.map((p) => p.iso)),
      "",
      "---",
      "",
      "## Os países deste lote",
      "",
      ...lote.map(secaoDoPais),
    ];
    await fs.writeFile(path.join(DESTINO, nome), `${partes.join("\n")}\n`, "utf8");
    linhasIndice.push(
      `| \`${nome}\` | ${lote.map((p) => p.iso).join(" ")} | ${imagens} |`
    );
    console.log(
      `  ${nome}  ${String(lote.length).padStart(2)} países, ` +
        `${String(imagens).padStart(3)} imagens  ·  ${lote.map((p) => p.iso).join(" ")}`
    );
  }

  if (todos) {
    await fs.writeFile(
      path.join(DESTINO, "INDICE-IMAGENS.md"),
      `${linhasIndice.join("\n")}\n`,
      "utf8"
    );
    console.log(`\n✓ ${lotes.length} lotes e o índice em lotes/`);
  }
}

if (process.argv[1]?.includes("preparar-lote-imagens")) {
  void main();
}

