import { z } from "zod";
import { DataHistorica, Id, comparaData } from "./primitivos";
import { Imagem } from "./imagem";

/**
 * Um momento narrado: data, título, prosa e, quando existe uma licenciada,
 * imagem de época.
 *
 * Nasceu dentro de `Episodio` e saiu de lá quando a figura passou a precisar
 * do mesmo objeto. São a mesma coisa vista de dois ângulos — o episódio conta
 * um recorte de território, a figura conta uma pessoa —, e duplicar o schema
 * faria as duas divergirem no primeiro campo novo.
 *
 * O que NÃO subiu para cá foi a obrigação de fonte. Ela vive em quem contém os
 * blocos, porque a regra difere: o episódio exige fonte sempre; a figura exige
 * só quando tem trajetória escrita, já que figura sem prosa nenhuma — só nome,
 * cargo e alegações com lastro próprio — não afirma nada por conta.
 */
export const Bloco = z.object({
  id: Id,
  /**
   * A data do bloco. Ordena e valida; o que aparece na tela pode ser outra
   * coisa, ver `rotulo`.
   */
  data: DataHistorica,
  /**
   * O que a coluna da data mostra, quando a data exata mentiria.
   *
   * "1630–1637", "c. 1640", "1975–1980" são honestos onde o ano sozinho
   * afirmaria um dia que a fonte não dá. O campo existe para que a precisão do
   * rótulo acompanhe a precisão do que se sabe, sem abrir mão da ordenação.
   */
  rotulo: z.string().min(1).optional(),
  titulo: z.string().min(1, "bloco precisa de título"),
  textoMdx: z.string().min(1, "bloco sem texto não é bloco"),
  imagem: Imagem.optional(),
});

export type Bloco = z.infer<typeof Bloco>;

/**
 * Os blocos estão em ordem cronológica?
 *
 * Datas iguais são permitidas: três facetas do mesmo ano — o governo de
 * Nassau, a cidade que ele mandou construir e a tolerância religiosa dele —
 * empatam de propósito, e a ordem entre elas é a do arquivo.
 *
 * A ordem do arquivo é a ordem da tela, sempre. A página não reordena nada,
 * porque reordenar em silêncio esconderia o erro de digitação em vez de
 * mostrá-lo — e é por isso que esta checagem existe.
 */
export function emOrdem(blocos: readonly Bloco[]): boolean {
  return blocos.every(
    (b, i) => i === 0 || comparaData(b.data, blocos[i - 1].data) >= 0
  );
}

/** Quantos blocos trazem imagem — o número que a capa anuncia. */
export function comImagem(blocos: readonly Bloco[]): number {
  return blocos.filter((b) => b.imagem).length;
}
