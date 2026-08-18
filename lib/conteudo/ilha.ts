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

/**
 * A natureza do laço entre o poder e o território.
 *
 * ## Por que não basta o campo `poder`
 *
 * As Carolinas e as Marshall foram mandato japonês da Liga das Nações a partir
 * de 1920 e depois território sob tutela da ONU administrado pelos Estados
 * Unidos. Em nenhum dos dois casos o administrador detinha título soberano —
 * mandato e tutela são regimes de administração fiduciária, com obrigação de
 * prestar contas e, na tutela, de levar o território à autodeterminação.
 *
 * Escrever só "Japão" em 1930 afirmaria posse que os documentos não dão. Este
 * campo é o que permite ao mapa dizer quem manda sem dizer de quem é.
 *
 * `administracao-estrangeira` é o caso do artigo 3 do Tratado de São
 * Francisco: Okinawa e Iwo Jima ficaram sob administração americana com o
 * Japão retendo soberania residual — não era tutela, porque os Estados Unidos
 * nunca submeteram o arranjo à ONU, e não era ocupação de guerra, porque
 * vigorava por tratado de paz.
 *
 * Estado soberano em livre associação — Marshall, Micronésia, Palau — entra
 * como `soberania`, e o acordo fica na nota. São membros da ONU por direito
 * próprio, e classificá-los de outro modo rebaixaria o que eles são.
 */
export const Vinculo = z.enum([
  "soberania",
  "protetorado",
  "mandato",
  "tutela",
  "ocupacao-militar",
  "administracao-estrangeira",
  "nenhum",
]);

export type Vinculo = z.infer<typeof Vinculo>;

/** Como cada vínculo é dito na tela, em minúscula, para compor frase. */
export const ROTULO_VINCULO: Record<Vinculo, string> = {
  soberania: "soberania",
  protetorado: "protetorado",
  mandato: "mandato da Liga das Nações",
  tutela: "tutela da ONU",
  "ocupacao-militar": "ocupação militar",
  "administracao-estrangeira": "administração estrangeira",
  nenhum: "sem soberania exercida",
};

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
    /**
     * A natureza do laço. O padrão é soberania porque é o caso comum; onde
     * for mandato, tutela ou ocupação, precisa estar escrito.
     */
    vinculo: Vinculo.default("soberania"),
    /** O que aconteceu, quando o trecho precisa de explicação. */
    nota: z.string().optional(),
    fontes: FontesDoTexto,
  })
  .refine((s) => !s.ate || s.ate >= s.desde, {
    message: "trecho de soberania não pode terminar antes de começar",
    path: ["ate"],
  });

/**
 * De onde sai o desenho da ilha, e por que desse jeito.
 *
 * Duas formas, porque a base cartográfica agrupa umas entidades e não outras:
 *
 * - `pais` serve quando o Natural Earth já reúne o conjunto sob um nome — Cabo
 *   Verde, Malvinas, Guam, Palau, Kiribati. O agrupamento é da fonte, não meu.
 * - `raio` serve para grupo que a fonte não reúne: Açores e Madeira são parte do
 *   polígono de Portugal e não se separam por nome, então o critério passa a ser
 *   distância a partir do ponto registrado.
 * - `ponto` serve para ILHA ÚNICA: pega o menor polígono que contém o ponto, e
 *   pronto. Existe porque em Guadalcanal o raio falhou de um modo instrutivo — a
 *   ilha tem 150 km de comprimento e as vizinhas ficam a 35 km da costa, então
 *   QUALQUER raio que alcance as duas pontas da ilha também alcança as vizinhas.
 *   O resultado media 9.634 km² contra 5.302 reais. Onde a entidade é uma ilha e
 *   não um grupo, o polígono que contém o ponto é a resposta exata.
 *
 * `razao` é obrigatória nas duas. Num raio ela é indispensável — 600 km em vez de
 * 300 muda o que entra no arquipélago —, e na forma por nome ela registra qual
 * nome da fonte foi usado, que é o que permite conferir sem reabrir o dado.
 */
export const FonteDaGeometria = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("pais"),
    /** O nome exato como está no Natural Earth, não o nome em português. */
    nome: z.string().min(1),
    razao: z.string().min(10),
  }),
  z.object({
    tipo: z.literal("raio"),
    /** Distância a partir de `ponto`, em quilômetros. */
    km: z.number().positive().max(2000),
    razao: z.string().min(10),
  }),
  z.object({
    tipo: z.literal("ponto"),
    razao: z.string().min(10),
  }),
]);

export type FonteDaGeometria = z.infer<typeof FonteDaGeometria>;

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
    /**
     * Como achar o desenho da ilha na base cartográfica.
     *
     * A ilha é registrada como PONTO porque num mapa-múndi é isso que ela é:
     * Fernando de Noronha tem 18 km², e a 1.472 px de mapa ocupa 0,009 px². Mas o
     * mapa agora aproxima até 8×, e nessa escala o ponto passa a ser mentira por
     * omissão — há espaço para a forma real.
     *
     * O critério de extração fica AQUI, no conteúdo, e não embutido num script,
     * porque em arquipélago ele é uma decisão editorial e não um detalhe técnico:
     * Tarawa é um anel de ilhotas e as Malvinas são duas ilhas grandes mais
     * setecentas pequenas, então "o polígono da ilha" não existe — existe o
     * conjunto que se decidiu chamar de Tarawa. Declarado aqui, o critério é
     * versionado, revisável e aparece no diff.
     *
     * Ausente, a ilha continua só ponto. É o estado válido: não obriga a resolver
     * as dezessete de uma vez.
     */
    geometria: FonteDaGeometria.optional(),
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
