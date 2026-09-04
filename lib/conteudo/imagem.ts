import { z } from "zod";
import { anoDe } from "./primitivos";

/**
 * Uma imagem histórica, com o crédito e a licença que ela exige.
 *
 * Crédito e licença são OBRIGATÓRIOS, e é a mesma decisão que fez `Alegacao`
 * exigir fonte: a obrigação existe fora do código, e um campo opcional viraria
 * um campo vazio. Uma foto sob CC BY-SA publicada sem atribuição é violação de
 * licença, não descuido de layout — então quem esquece o crédito não consegue
 * publicar a imagem, porque o `pnpm validar` para o build.
 *
 * O template que serviu de referência para esta parte do atlas — o memorial da
 * Segunda Guerra — faz hotlink de imagens da Britannica, do New York Times, do
 * Guardian e da NPR. Serve como demonstração e não serve como site publicado:
 * são imagens de imprensa sem licença de uso, servidas do CDN de terceiro, que
 * podem sair do ar ou trocar de conteúdo sem aviso. Por isso o atlas usa
 * Wikimedia Commons, onde cada arquivo declara a própria licença.
 *
 * `alt` também é obrigatório. Imagem histórica costuma ser o documento em si —
 * a carta, a assinatura, a praça — e descrever o que ela mostra é a diferença
 * entre a página funcionar ou não para quem usa leitor de tela.
 */
/**
 * Formatos que um `<img>` desenha.
 *
 * Lista de permissão, e não de recusa, porque o erro aqui é silencioso dos
 * dois lados: o arquivo existe, responde 200, tem licença livre e passa em
 * tudo que este projeto confere — e a página mostra um ícone quebrado.
 *
 * Aconteceu com três peças do primeiro lote de ilustração: dois PDFs de atos
 * do parlamento britânico (Áustria e Lesoto) e um TIFF do arquivo nacional
 * americano (Síria). Todas são o documento certo, no Commons, sob licença
 * livre. Nenhuma aparece.
 *
 * O conserto nunca é trocar de arquivo: o Commons **gera miniatura JPG** de
 * PDF, TIFF e DjVu, e é ela que vai no `url`. Sai da mesma resposta de API que
 * o resto dos campos, no campo `thumburl`.
 */
const RENDERIZAVEIS = /\.(?:jpe?g|png|gif|webp|avif|svg)$/i;

export const Imagem = z.object({
  /** Sempre https: imagem em texto claro é bloqueada dentro de página segura. */
  url: z
    .string()
    .url()
    .startsWith("https://")
    .refine((u) => RENDERIZAVEIS.test(u.split("?")[0]), {
      message:
        "formato que o navegador não desenha (.pdf, .tif e afins) — use a " +
        "miniatura JPG do Commons, o campo `thumburl` da resposta da API",
    }),
  alt: z.string().min(1, "imagem precisa de descrição para leitor de tela"),
  /** Autor, instituição ou acervo — o que a licença manda atribuir. */
  credito: z.string().min(1, "imagem precisa de crédito"),
  /** "Domínio público", "CC BY-SA 4.0". Texto curto, como o Commons declara. */
  licenca: z.string().min(1, "imagem precisa de licença declarada"),
  /** A página do arquivo, para quem quiser conferir a licença na origem. */
  origem: z.string().url().optional(),
  /** Legenda própria, quando a imagem pede contexto que o `alt` não dá. */
  legenda: z.string().optional(),
});

export type Imagem = z.infer<typeof Imagem>;

/**
 * O endereço do Commons sem os parâmetros de rastreio.
 *
 * A API devolve a miniatura com `?utm_source=...&utm_campaign=imageinfo`
 * grudado, que é telemetria da própria consulta e não parte do endereço da
 * imagem. Guardar isso no acervo mandaria o rastreio para todo leitor.
 */
export function semRastreio(url: string): string {
  const [base] = url.split("?");
  return base;
}

/**
 * 1839: o daguerreótipo é anunciado em Paris.
 *
 * O corte não é exato — há heliografias de 1826 e a difusão real leva
 * décadas —, mas serve para o que esta data decide: se pode ou não existir
 * fotografia feita dentro do período.
 */
export const ANO_DA_FOTOGRAFIA = 1839;

/**
 * O período acabou antes de a fotografia existir?
 *
 * Serve a uma ressalva que o atlas passou a dever quando ganhou imagem em
 * todos os 824 períodos. A regra editorial pede peça **de época** — feita
 * dentro do período que ilustra —, e para os 165 períodos anteriores a 1839
 * isso é impossível de cumprir ao pé da letra: uma moeda de 1138 só chega ao
 * leitor através de uma fotografia moderna dela.
 *
 * O acervo resolveu do único jeito possível, e em duas formas com estatuto
 * diferente:
 *
 * - **objeto portátil fotografado** — a moeda, o manuscrito, o selo, a
 *   escultura de museu. A peça é de época; a fotografia é só o meio de
 *   olhá-la.
 * - **edifício ainda de pé fotografado hoje** — o Taj Mahal, o Qutb Minar, o
 *   Kinkaku-ji. Aqui a fotografia mostra o prédio como ele está agora, com
 *   restauros e entorno de hoje, e não como era no período.
 *
 * A segunda forma é uma concessão, e o projeto declara concessão em vez de
 * escondê-la — a mesma decisão das três limitações que o mapa já anuncia. Por
 * isso a ressalva aparece SÓ nos períodos em que ela é verdadeira: dizê-la
 * sob uma fotografia de 1960 seria um aviso falso, que é pior que nenhum.
 *
 * Período em curso (`fim` ausente) chega até hoje e nunca é anterior.
 */
export function anteriorAFotografia(fim?: string): boolean {
  return fim !== undefined && anoDe(fim) < ANO_DA_FOTOGRAFIA;
}
