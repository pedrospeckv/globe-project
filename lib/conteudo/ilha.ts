import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";
import { anoFracionarioDe } from "./tempo";

/** Mesma forma usada em `pais.ts`: referência por id ao acervo de fontes. */
const FontesDoTexto = z.array(Id).default([]);

/**
 * Ilha pequena que a base cartográfica não desenha.
 *
 * ## Por que existe um registro separado
 *
 * As fatias históricas têm 240 feições em 2010 e param no que é Estado-ilha
 * habitado: Jamaica, Barbados, Fiji, Tonga. Santa Helena, Malvinas, Tristão da
 * Cunha, Açores, Cabo Verde e Fernando de Noronha simplesmente não estão lá —
 * verificado contra o arquivo cru, que tem as mesmas 240 feições do processado.
 *
 * Também não é o caso de `disputas.ts`, que tem dois mecanismos e nenhum serve:
 * "recortar polígono da base" pressupõe que o polígono exista, e "alfinete
 * sobre território fundido" pressupõe que o território esteja dentro de outro
 * país. Ilha ausente do mapa precisa de posição própria.
 *
 * ## Por que ponto e não polígono
 *
 * Fernando de Noronha tem 18 km². Na escala de um globo de 900 px, isso é
 * fração de pixel — um polígono fiel seria invisível, e um polígono visível
 * seria falso, com a ilha desenhada centenas de vezes maior do que é. O
 * marcador diz "existe algo aqui" sem afirmar forma nem extensão.
 *
 * ## Por que a soberania é uma lista e não um campo
 *
 * É a mesma razão de o atlas ter país × período em vez de país: "de quem é"
 * não tem resposta única. Santa Helena passou de portuguesa a inglesa da
 * Companhia das Índias e depois a colônia da Coroa; Cabo Verde deixou de ser
 * de alguém. A lista responde por data, e cada trecho carrega a sua fonte.
 */

export const Soberania = z
  .object({
    desde: DataHistorica,
    /** Ausente significa que este trecho é o vigente. */
    ate: DataHistorica.optional(),
    /**
     * Quem exercia. Texto livre, e não código ISO, de propósito: Companhia
     * Inglesa das Índias Orientais e Capitania de Fernão de Loronha não são
     * Estados e nunca terão código. Forçar ISO aqui obrigaria a mentir.
     */
    poder: z.string().min(1),
    /** O que aconteceu, quando o trecho precisa de explicação. */
    nota: z.string().optional(),
    fontes: FontesDoTexto,
  })
  .refine((s) => !s.ate || s.ate >= s.desde, {
    message: "trecho de soberania não pode terminar antes de começar",
    path: ["ate"],
  });

export const Ilha = z
  .object({
    id: Id,
    nome: z.string().min(1),
    /**
     * Os outros nomes, incluindo o usado por quem disputa.
     *
     * Registrar "Falkland Islands" e "Islas Malvinas" lado a lado é a posição
     * editorial: nomear por um lado só já é tomar partido, e o atlas não faz
     * isso em alegação contestada.
     */
    outrosNomes: z.array(z.string().min(1)).default([]),
    /** [longitude, latitude] em graus decimais. */
    ponto: z.tuple([
      z.number().min(-180).max(180),
      z.number().min(-90).max(90),
    ]),
    soberania: z.array(Soberania).min(1, "ilha precisa de ao menos um trecho"),
    /** Soberania contestada por mais de um Estado, hoje. */
    disputada: z.boolean().default(false),
    nota: z.string().optional(),
    fontes: FontesDoTexto,
  })
  /*
   * A lista precisa estar em ordem. Ela é lida de trás para frente por
   * `soberaniaEm`, e fora de ordem devolveria o trecho errado sem que nada
   * acusasse — o tipo de erro que só aparece na tela, muito depois.
   */
  .refine(
    (i) =>
      i.soberania.every(
        (s, k) => k === 0 || s.desde >= i.soberania[k - 1].desde
      ),
    { message: "trechos de soberania devem estar em ordem de início", path: ["soberania"] }
  )
  /*
   * Marcar disputa e não dizer nada é o que o projeto recusa em alegação
   * contestada. Aqui vale igual: a nota é onde a disputa é descrita sem que o
   * mapa tenha de escolher um lado.
   */
  .refine((i) => !i.disputada || (i.nota && i.nota.length > 0), {
    message: "ilha disputada precisa de nota explicando a disputa",
    path: ["nota"],
  });

export type Soberania = z.infer<typeof Soberania>;
export type Ilha = z.infer<typeof Ilha>;

/**
 * Quem exercia soberania nesta data, ou `null` antes do primeiro trecho.
 *
 * Início inclusivo e fim exclusivo, a mesma regra de `dentroDoPeriodo` — é o
 * que impede uma data de virada de pertencer a dois poderes ao mesmo tempo.
 *
 * Lacuna entre trechos é permitida e significativa: Tristão da Cunha ficou
 * três séculos avistada e desabitada, e preencher esse vazio com um dono
 * inventaria posse que ninguém exercia.
 */
export function soberaniaEm(ilha: Ilha, anoFrac: number): Soberania | null {
  for (let k = ilha.soberania.length - 1; k >= 0; k--) {
    const s = ilha.soberania[k];
    if (anoFrac < anoFracionarioDe(s.desde)) continue;
    if (s.ate && anoFrac >= anoFracionarioDe(s.ate)) return null;
    return s;
  }
  return null;
}

/** A ilha já era conhecida nesta data? Antes disso, não entra no mapa. */
export function conhecidaEm(ilha: Ilha, anoFrac: number): boolean {
  return anoFrac >= anoFracionarioDe(ilha.soberania[0].desde);
}
