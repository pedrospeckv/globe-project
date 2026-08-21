import type { Acervo } from "./integridade";

/**
 * Duas medidas de registro da prosa, e a razão de existirem é uma correção.
 *
 * Em 2026-08-21 o autor olhou os 157 dossiês escritos em lote e disse que
 * tinham ficado "genéricos". A diferença contra os nove escritos à mão é
 * contável, e não é questão de gosto — são dois tiques específicos:
 *
 * **Futuro-do-pretérito** ("seria deposto", "manteria", "culminaria") narra o
 * futuro a partir do passado. Uma vez, encadeia; em toda frase, transforma
 * história em sinopse — o texto para de contar o que aconteceu e passa a
 * anunciar o que vai acontecer, sempre de fora e sempre em suspenso.
 *
 * **Adjetivo avaliativo** ("profundamente", "considerável", "drasticamente")
 * ocupa o lugar do detalhe concreto. "Repressão considerável" não diz nada que
 * "dinamitar as cavernas onde a população se abrigava" não diga melhor — e a
 * segunda pode ser conferida numa fonte.
 *
 * ## Por que a detecção é uma lista de exclusão, e não um padrão
 *
 * A primeira versão usava `\b[a-z]{3,}(a|e|i)ria m?\b` e errava nas DUAS
 * direções, o que só apareceu quando os testes foram escritos:
 *
 * - **Não contava "seria"**, a forma mais comum do tique, porque exigia raiz de
 *   três letras e "seria" tem uma.
 * - **Contava adjetivo em -ária**: "crise humanitária", "reforma agrária",
 *   "regime autoritário", "guerra revolucionária" entravam como verbo. Só
 *   `agraria` aparece 42 vezes no acervo.
 *
 * Não existe padrão que separe os dois casos, porque a colisão é real: sem
 * acento, o verbo "seria" e o adjetivo "séria" são a mesma sequência de letras.
 * Então a decisão foi a mesma da tabela de grafias em `lib/geo/nomes.ts` —
 * enumerar, a partir do próprio acervo, com razão declarada. As 584 formas
 * distintas que o padrão amplo encontra foram lidas uma por uma; o que não é
 * futuro-do-pretérito está em `NAO_E_CONDICIONAL`.
 *
 * A consequência é conhecida e aceita: país novo pode trazer uma colisão nova,
 * e ela vai contar por engano até alguém acrescentá-la à lista. Numa média por
 * mil palavras, uma ocorrência não move o número — e o erro é sempre de
 * SUPERestimar a dívida, que é o lado seguro para uma medida cuja função é
 * puxar trabalho para a fila.
 *
 * ## Como os tetos foram escolhidos
 *
 * Pelos nove dossiês que o autor aprovou: o teto é o pior deles, arredondado
 * para cima. Não é um ideal — é "tão bom quanto o que já foi aceito". Se um
 * teste de teto quebrar por causa de um desses nove, o teto está errado, não o
 * país.
 *
 * ## O que isto NÃO é
 *
 * Não trava o build. A maior parte do acervo está acima do teto agora, e
 * reprovar só impediria qualquer publicação. É dívida contada em voz alta, como
 * a de fonte e a de imagem — medida para encolher, não para sumir de vista.
 *
 * E não é um corretor de estilo. Número dentro do teto não faz texto bom; só
 * remove os dois tiques que o lote produziu em massa. Prosa ruim sem nenhum
 * "-ria" continua ruim.
 */

/** O padrão amplo: pega todo futuro-do-pretérito e também as colisões. */
const CANDIDATO_CONDICIONAL = /\b[a-z]*(?:aria|eria|iria)m?\b/g;

/**
 * Formas que o padrão amplo pega e que NÃO são futuro-do-pretérito.
 *
 * Lidas uma por uma nas 584 formas distintas do acervo. Os grupos:
 *
 * 1. **Adjetivo e substantivo em -ária/-ário** — o grupo mais numeroso e o que
 *    mais poluía a conta, porque é vocabulário central deste atlas: agrária,
 *    humanitária, autoritária, revolucionária, parlamentária, fundiária.
 * 2. **Nome próprio** — Bulgária, Síria, Nigéria, Libéria, Assíria, Estíria,
 *    Sibéria, Ibéria, Maria, Cantuária, Beria.
 * 3. **Outro tempo verbal com a mesma terminação** — e este era o erro mais
 *    sutil: `queria`/`queriam` e `transferia` são PRETÉRITO IMPERFEITO
 *    ("queria" é *wanted*, não *would want*), e `varia`/`variam` é presente. O
 *    condicional dos mesmos verbos seria `quereria`, `transferiria`,
 *    `variaria` — e esses contam.
 * 4. **Ambíguo, excluído de propósito** — `operaria`, `alimentaria`,
 *    `funcionaria`, `originaria`, `contraria`, `arbitraria` e `sumaria` podem
 *    ser verbo ou adjetivo, e no acervo aparecem sobretudo como adjetivo.
 *    Excluir subestima a dívida em alguns casos, o que é preferível a acusar
 *    tique onde há substantivo.
 */
const NAO_E_CONDICIONAL = new Set([
  // 1. adjetivo / substantivo em -ária
  "adversaria", "agraria", "artilharia", "autoritaria", "bancaria",
  "bilionaria", "binaria", "bipartidaria", "cavalaria", "centenaria",
  "comunitaria", "engenharia", "expedicionaria", "extraordinaria",
  "faccionaria", "ferroviaria", "fiduciaria", "fundiaria", "hereditaria",
  "humanitaria", "identitaria", "imobiliaria", "infantaria",
  "intercomunitaria", "involuntaria", "latifundiaria", "lendaria",
  "semilendaria", "literaria", "majoritaria", "malaria", "minoritaria",
  "missionaria", "monetaria", "multipartidaria", "necessaria",
  "orcamentaria", "ordinaria", "partidaria", "pecuaria", "pirataria",
  "portuaria", "precaria", "previdenciaria", "primaria", "proprietaria",
  "refinaria", "revolucionaria", "sanitaria", "sectaria", "secretaria",
  "secundaria", "securitaria", "sedentaria", "sharia", "solidaria",
  "temporaria", "tributaria", "trinitaria", "unitaria", "universitaria",
  "voluntaria", "estatuaria", "esteparia", "galeria", "parceria",
  "periferia", "materia", "miseria",
  // 2. nome próprio
  "bulgaria", "siria", "assiria", "estiria", "nigeria", "liberia", "iberia",
  "siberia", "maria", "mariam", "santamaria", "cantuaria", "beria",
  // 3. outro tempo verbal
  "queria", "queriam", "transferia", "varia", "variam",
  // 4. ambíguo, excluído de propósito
  "operaria", "alimentaria", "funcionaria", "originaria", "contraria",
  "arbitraria", "sumaria",
]);

/**
 * Os avaliativos que o lote produziu em massa, medidos no próprio acervo.
 *
 * Lista curta e fechada de propósito: é um detector do tique observado, não um
 * julgamento sobre advérbios. "Profundamente" numa página inteira é escrita;
 * em todo parágrafo é preenchimento.
 */
const AVALIATIVO =
  /\b(?:profundament|considerav|largament|crescentement|drasticament|decisivament|significativament|duradour|uma das (?:piores|maiores|mais))/g;

/**
 * Tetos de aceite, em ocorrências por mil palavras.
 *
 * Medidos nos nove dossiês aprovados pelo autor, que ficam em média 2,1 e 0,2.
 * O pior de cada métrica entre eles é a China, com 3,66 de futuro-do-pretérito,
 * e a Rússia, com 0,60 de avaliativo — os tetos são esses valores arredondados
 * para cima. Para comparação, os 156 do lote ficam em 14,6 e 1,8, e o piloto do
 * Zimbábue, reescrito com fato concreto e sem caçar palavra, em 1,1 e 0,0.
 */
export const TETO_FUTURO_DO_PRETERITO = 5;
export const TETO_AVALIATIVO = 1;

/** Abaixo disto a média por mil palavras é ruído — um país de 3 períodos curtos. */
const PALAVRAS_MINIMAS = 300;

export interface MedidaDeEstilo {
  palavras: number;
  /** Ocorrências por mil palavras. */
  futuroDoPreterito: number;
  avaliativo: number;
}

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function medirEstilo(texto: string): MedidaDeEstilo {
  const plano = semAcento(texto);
  const palavras = plano.split(/\s+/).filter(Boolean).length;
  if (palavras === 0) {
    return { palavras: 0, futuroDoPreterito: 0, avaliativo: 0 };
  }
  const condicionais = (plano.match(CANDIDATO_CONDICIONAL) ?? []).filter(
    (f) => !NAO_E_CONDICIONAL.has(f)
  );
  const porMil = (n: number) => (1000 * n) / palavras;
  return {
    palavras,
    futuroDoPreterito: porMil(condicionais.length),
    avaliativo: porMil((plano.match(AVALIATIVO) ?? []).length),
  };
}

export interface EstiloDoPais extends MedidaDeEstilo {
  nome: string;
  iso: string;
  /** Passou nos dois tetos? */
  dentro: boolean;
}

/**
 * Mede cada país e ordena do pior para o melhor.
 *
 * A ordem é a fila de reescrita: o pior primeiro é onde a mesma hora de
 * trabalho muda mais a leitura.
 */
export function coberturaDeEstilo(acervo: Acervo): {
  medidos: EstiloDoPais[];
  fora: EstiloDoPais[];
  curtos: number;
} {
  const medidos: EstiloDoPais[] = [];
  let curtos = 0;

  for (const pais of acervo.paises) {
    const texto = pais.periodos
      .map((p) => p.textoMdx ?? "")
      .filter(Boolean)
      .join(" ");
    const m = medirEstilo(texto);
    if (m.palavras < PALAVRAS_MINIMAS) {
      curtos++;
      continue;
    }
    medidos.push({
      ...m,
      nome: pais.nome,
      iso: pais.iso,
      dentro:
        m.futuroDoPreterito <= TETO_FUTURO_DO_PRETERITO &&
        m.avaliativo <= TETO_AVALIATIVO,
    });
  }

  medidos.sort((a, b) => b.futuroDoPreterito - a.futuroDoPreterito);
  return { medidos, fora: medidos.filter((m) => !m.dentro), curtos };
}
