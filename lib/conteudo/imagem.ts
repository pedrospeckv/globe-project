import { z } from "zod";

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
export const Imagem = z.object({
  /** Sempre https: imagem em texto claro é bloqueada dentro de página segura. */
  url: z.string().url().startsWith("https://"),
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
