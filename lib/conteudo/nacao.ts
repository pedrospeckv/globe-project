import { z } from "zod";
import { DataHistorica, Id } from "./primitivos";

/** Mesma forma usada em `pais.ts` e `ilha.ts`: referência por id ao acervo. */
const FontesDoTexto = z.array(Id).default([]);

/**
 * Nação reconhecida em lei pelo próprio Estado que a contém, sem código ISO
 * 3166-1 nem feição própria na base cartográfica.
 *
 * ## Por que não é `Pais`
 *
 * Não é por soberania. A Groenlândia já está em `conteudo/paises/` com três
 * períodos, e não é Estado soberano — é país constituinte do Reino da
 * Dinamarca. Entrou porque tem ISO 3166-1 (GRL) e desenho próprio no
 * world-atlas (304).
 *
 * O portão do atlas, portanto, nunca foi político: foi cartográfico. E é
 * exatamente nele que Escócia e Gales reprovam. Os códigos deles são 3166-**2**,
 * de subdivisão, e o world-atlas tem uma feição só para o Reino Unido, a 826.
 * Um arquivo em `conteudo/paises/` reprovaria no validador por `isoNumerico`
 * inexistente — não por juízo sobre a nação, mas por falta de polígono.
 *
 * Esta é a entrada para quem passa no teste da nação e falha no do desenho.
 *
 * ## Por que não basta o episódio
 *
 * `conteudo/episodios/escocia.json` e `pais-de-gales.json` contam a história, e
 * continuam contando — esta entrada não duplica prosa, aponta para ela. O que o
 * episódio não faz é EXISTIR como entidade: não entra na cobertura, não aparece
 * no globo, não tem identidade fora da narrativa em que foi escrito. Uma nação
 * que existe hoje, com parlamento em funcionamento, é entidade e não recorte.
 *
 * ## Por que `reconhecimento` é obrigatório
 *
 * Porque é ele o critério, e critério que mora em comentário não segura nada.
 *
 * A pergunta que este campo responde não é "esta nação é real" — é "quem afirma
 * que ela é, e onde está escrito". Escócia e Gales entram porque a lei
 * britânica os chama de países e lhes dá legislaturas. A Catalunha fica de fora
 * porque o Tribunal Constitucional espanhol anulou o efeito jurídico da palavra
 * "nação" no Estatuto de 2006, na STC 31/2010: a Espanha RECUSOU expressamente o
 * que o Reino Unido concedeu. O Tibete fica de fora porque a China o administra
 * como uma das cinco regiões autônomas e não reconhece nação nenhuma ali.
 *
 * Exigir o instrumento no schema é o que faz essas três exclusões serem
 * verificáveis em vez de opinião minha. Quem discordar tem onde apontar: ou o
 * instrumento existe e eu errei ao omitir, ou não existe e a entrada não cabe.
 *
 * O que este campo explicitamente NÃO mede é intensidade de identidade
 * nacional. Pela identidade, o Tibete entraria antes de Gales. O atlas não tem
 * régua para isso e não vai fingir que tem.
 */

/**
 * O alcance do poder legislativo, que é onde Escócia e Gales divergem de fato.
 *
 * Não é detalhe institucional. O Scotland Act 1998 deu ao Parlamento escocês
 * competência sobre tudo que a lei não reservasse a Westminster — modelo de
 * poderes reservados. O Government of Wales Act do mesmo ano deu à Assembleia
 * galesa apenas as competências listadas, sem legislação primária, e a
 * equiparação levou quase vinte anos, chegando por etapas até a lei de 2017.
 *
 * Duas nações, a mesma data, o mesmo governo, e graus de autogoverno que só se
 * encontraram duas décadas depois. Um campo booleano de "tem parlamento"
 * apagaria isso.
 */
export const Competencia = z.enum(["primaria", "delegada", "nenhuma"]);

export type Competencia = z.infer<typeof Competencia>;

/** Como cada competência é dita na tela, em minúscula, para compor frase. */
export const ROTULO_COMPETENCIA: Record<Competencia, string> = {
  primaria: "com competência legislativa primária",
  delegada: "com poderes apenas delegados",
  nenhuma: "sem competência legislativa própria",
};

export const Legislatura = z.object({
  /** O nome corrente, na língua em que a instituição se chama. */
  nome: z.string().min(1),
  /** Quando entrou em funcionamento — não quando a lei foi aprovada. */
  desde: DataHistorica,
  competencia: Competencia,
  /** O que a competência abrange ou deixa de fora, quando precisa de nuance. */
  nota: z.string().optional(),
});

export type Legislatura = z.infer<typeof Legislatura>;

/**
 * O ato pelo qual o Estado soberano reconhece a nação. O critério de entrada.
 *
 * `instrumento` é texto livre e não id de fonte porque nem todo reconhecimento
 * é lei: o do Quebec é uma moção da Câmara dos Comuns de 2006, e o das Ilhas
 * Feroe está numa lei de autogoverno dinamarquesa de 1948. Forçar uma forma só
 * obrigaria a distorcer os casos que não cabem nela.
 *
 * `fontes` é obrigatória, e é ela que impede o campo de virar afirmação solta.
 */
export const Reconhecimento = z.object({
  instrumento: z.string().min(1, "reconhecimento precisa nomear o instrumento"),
  data: DataHistorica,
  /** O que o instrumento diz, e o que ele deliberadamente não diz. */
  textoMdx: z.string().min(1, "reconhecimento precisa ser explicado"),
  fontes: z
    .array(Id)
    .min(1, "reconhecimento precisa de fonte — é ele o critério de entrada"),
});

export type Reconhecimento = z.infer<typeof Reconhecimento>;

export const Nacao = z.object({
  id: Id,
  nome: z.string().min(1),
  /**
   * Os outros nomes, incluindo o da própria língua.
   *
   * "Alba" e "Cymru" não são traduções decorativas: são como as duas nações se
   * chamam onde a língua sobreviveu, e num atlas cujo assunto é justamente a
   * sobrevivência dessas línguas, omiti-los seria escolher um lado calado.
   * Mesma razão de `outrosNomes` em `ilha.ts`.
   */
  outrosNomes: z.array(z.string().min(1)).default([]),
  /** ISO alpha-3 do Estado soberano que a contém. */
  anfitriao: z.string().regex(/^[A-Z]{3}$/, "anfitrião é ISO alpha-3"),
  /**
   * [longitude, latitude] em graus decimais, para o alfinete no globo.
   *
   * ALFINETE, e não polígono, e a razão é a mesma que pôs as ilhas como ponto
   * em agosto de 2026: o atlas não desenha o que não tem fonte para desenhar. O
   * world-atlas não separa Escócia de Inglaterra, e inventar a linha seria pior
   * que omiti-la — uma fronteira falsa num projeto cujo assunto é fronteira.
   *
   * As ilhas ganharam forma quando houve base de onde extraí-la e zoom que a
   * justificasse. Aqui vale o mesmo: o dia em que o projeto empacotar uma base
   * de subdivisões licenciada, isto vira `geometria` e o alfinete sai.
   */
  ponto: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
  /** O critério de entrada, feito campo. Ver o cabeçalho do arquivo. */
  reconhecimento: Reconhecimento,
  /** Ausente é estado válido: nação reconhecida pode não ter casa própria. */
  legislatura: Legislatura.optional(),
  /** O parágrafo de entrada. Curto de propósito — a história está no episódio. */
  abertura: z.string().min(1, "nação precisa de abertura"),
  /**
   * Os episódios que contam a história dela.
   *
   * Obrigatório ao menos um, e não é formalidade. Sem episódio, esta entrada
   * seria uma ficha de identidade sem narrativa — e uma nação registrada só por
   * lei e coordenada é exatamente o tipo de verbete raso que o atlas passou o
   * mês corrigindo. A prosa mora lá; aqui fica o ponteiro.
   */
  episodios: z.array(Id).min(1, "nação precisa de ao menos um episódio"),
  /** Períodos do país anfitrião em que ela aparece, para apontar de volta. */
  periodos: z.array(Id).default([]),
  fontes: FontesDoTexto,
});

export type Nacao = z.infer<typeof Nacao>;

/** Nações contidas num país, em ordem alfabética. */
export function nacoesDoPais(nacoes: Nacao[], iso: string): Nacao[] {
  return nacoes
    .filter((n) => n.anfitriao === iso)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Nações que aparecem num período, para o dossiê dele apontar de volta. */
export function nacoesDoPeriodo(nacoes: Nacao[], periodoId: string): Nacao[] {
  return nacoes
    .filter((n) => n.periodos.includes(periodoId))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
