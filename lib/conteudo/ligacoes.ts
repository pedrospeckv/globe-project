import type { Acervo } from "./integridade";

export type TipoAlvo =
  | "pais"
  | "periodo"
  | "figura"
  | "evento"
  | "episodio"
  | "nacao"
  | "eleicao"
  | "viagem"
  | "nota";

export interface Alvo {
  id: string;
  rotulo: string;
  href: string;
  tipo: TipoAlvo;
}

/**
 * Índice como objeto simples, e não Map, porque ele atravessa a fronteira
 * servidor-cliente como prop do Atlas — e Map não sobrevive à serialização.
 */
export type Alvos = Record<string, Alvo>;

/**
 * `[[alvo]]` ou `[[alvo|texto de exibição]]`.
 *
 * A sintaxe é a do Obsidian de propósito: as notas que ele já escreve lá
 * vão precisar do mesmo mecanismo, e aprender duas gramáticas de ligação
 * para o mesmo texto seria custo sem contrapartida.
 */
const RE_LIGACAO = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Alvos citados num texto, na ordem em que aparecem, sem repetição. */
export function ligacoesEm(texto: string | undefined): string[] {
  if (!texto) return [];
  const achados = [...texto.matchAll(RE_LIGACAO)].map((m) => m[1].trim());
  return [...new Set(achados)];
}

/**
 * Tudo que pode ser apontado, com o endereço de cada um.
 *
 * Só entra o que tem página própria. Fonte não entra: ela é exibida junto de
 * quem a cita e não tem endereço, então uma ligação para fonte é erro — e é
 * melhor que seja erro barulhento do que link morto.
 */
export function indexarAlvos(acervo: Acervo): Alvos {
  const alvos: Alvos = {};

  for (const pais of acervo.paises) {
    alvos[pais.iso] = {
      id: pais.iso,
      rotulo: pais.nome,
      href: `/pais/${pais.iso}`,
      tipo: "pais",
    };
    for (const periodo of pais.periodos) {
      alvos[periodo.id] = {
        id: periodo.id,
        rotulo: periodo.rotulo,
        href: `/pais/${pais.iso}/${periodo.id}`,
        tipo: "periodo",
      };
    }
  }

  for (const figura of acervo.figuras) {
    alvos[figura.id] = {
      id: figura.id,
      rotulo: figura.nome,
      href: `/figura/${figura.id}`,
      tipo: "figura",
    };
  }

  // Evento e viagem ainda não têm página própria; apontam para o contexto
  // onde aparecem. O alvo existe, o endereço é o melhor disponível hoje.
  for (const evento of acervo.eventos) {
    alvos[evento.id] = {
      id: evento.id,
      rotulo: evento.titulo,
      href: `/pais/${evento.paises[0]}`,
      tipo: "evento",
    };
  }

  // O episódio tem página própria, então aponta para ela — ao contrário do
  // evento e da viagem, que só têm o contexto onde aparecem.
  for (const episodio of acervo.episodios) {
    alvos[episodio.id] = {
      id: episodio.id,
      rotulo: episodio.titulo,
      href: `/episodio/${episodio.id}`,
      tipo: "episodio",
    };
  }

  // A nação tem página própria, e é ela que `[[escocia]]` deve alcançar: de lá
  // se chega ao episódio, e não o contrário. Foi por isso que os episódios das
  // duas ganharam id descritivo — num Record plano, ids iguais se sobrescrevem
  // em silêncio, e quem perdesse a disputa viraria link para a página errada.
  for (const nacao of acervo.nacoes) {
    alvos[nacao.id] = {
      id: nacao.id,
      rotulo: nacao.nome,
      href: `/nacao/${nacao.id}`,
      tipo: "nacao",
    };
  }

  // A eleição também tem página própria.
  for (const eleicao of acervo.eleicoes) {
    alvos[eleicao.id] = {
      id: eleicao.id,
      rotulo: eleicao.titulo,
      href: `/eleicao/${eleicao.id}`,
      tipo: "eleicao",
    };
  }

  for (const viagem of acervo.viagens) {
    alvos[viagem.id] = {
      id: viagem.id,
      rotulo: viagem.titulo,
      href: "/",
      tipo: "viagem",
    };
  }

  /*
   * A nota também é alvo, e entra por id E por título.
   *
   * As notas vieram do Obsidian citando umas às outras na sintaxe do cofre, que
   * usa o nome do arquivo: `[[Alexandre, o Grande]]`, `[[Judaísmo]]`. São
   * dezessete referências reais entre notas que existem no acervo — apagá-las
   * perderia navegação que o autor escreveu de propósito. Indexar pelos dois
   * nomes faz o link do cofre funcionar na web sem reescrever o texto.
   *
   * O título só entra se não colidir: alvo do atlas tem precedência, porque o
   * espaço de nomes do atlas é o principal e uma nota não pode roubar `[[FRA]]`.
   */
  for (const nota of acervo.notas) {
    const alvo: Alvo = {
      id: nota.id,
      rotulo: nota.titulo,
      href: `/nota/${nota.id}`,
      tipo: "nota",
    };
    if (!(nota.id in alvos)) alvos[nota.id] = alvo;
    if (!(nota.titulo in alvos)) alvos[nota.titulo] = alvo;
  }

  return alvos;
}

/**
 * Troca `[[alvo]]` por markdown de link, para o react-markdown renderizar.
 *
 * Alvo desconhecido fica como texto simples em vez de virar link quebrado.
 * Isso não é tolerância: a integridade quebra o build antes, e este caminho
 * só existe para o texto não sumir da tela se alguém renderizar um trecho
 * fora do acervo validado.
 */
export function resolverLigacoes(
  texto: string | undefined,
  alvos: Alvos
): string | undefined {
  if (!texto) return texto;
  return texto.replace(RE_LIGACAO, (_todo, alvoBruto: string, rotulo?: string) => {
    const alvo = alvos[alvoBruto.trim()];
    const exibido = rotulo?.trim() || alvo?.rotulo || alvoBruto.trim();
    return alvo ? `[${exibido}](${alvo.href})` : exibido;
  });
}

/** Todo texto do acervo que pode conter ligação, com sua procedência. */
function textosDoAcervo(acervo: Acervo): { onde: string; texto?: string }[] {
  const saida: { onde: string; texto?: string }[] = [];

  for (const nacao of acervo.nacoes) {
    saida.push({ onde: `nação "${nacao.id}"`, texto: nacao.abertura });
    saida.push({
      onde: `reconhecimento de "${nacao.id}"`,
      texto: nacao.reconhecimento.textoMdx,
    });
    if (nacao.legislatura?.nota) {
      saida.push({
        onde: `legislatura de "${nacao.id}"`,
        texto: nacao.legislatura.nota,
      });
    }
  }

  for (const pais of acervo.paises) {
    for (const periodo of pais.periodos) {
      saida.push({ onde: `período "${periodo.id}"`, texto: periodo.textoMdx });
      for (const ent of periodo.entidades) {
        saida.push({
          onde: `entidade "${ent.nome}" em "${periodo.id}"`,
          texto: ent.textoMdx,
        });
      }
    }
  }
  for (const figura of acervo.figuras) {
    saida.push({ onde: `figura "${figura.id}"`, texto: figura.textoMdx });
    for (const bloco of figura.trajetoria) {
      saida.push({
        onde: `bloco "${bloco.id}" de "${figura.id}"`,
        texto: bloco.textoMdx,
      });
    }
  }
  for (const evento of acervo.eventos) {
    saida.push({ onde: `evento "${evento.id}"`, texto: evento.textoMdx });
  }
  for (const episodio of acervo.episodios) {
    saida.push({ onde: `episódio "${episodio.id}"`, texto: episodio.abertura });
    saida.push({ onde: `fecho de "${episodio.id}"`, texto: episodio.fecho });
    for (const bloco of episodio.blocos) {
      saida.push({
        onde: `bloco "${bloco.id}" de "${episodio.id}"`,
        texto: bloco.textoMdx,
      });
    }
  }
  for (const eleicao of acervo.eleicoes) {
    saida.push({ onde: `eleição "${eleicao.id}"`, texto: eleicao.abertura });
    saida.push({ onde: `fecho de "${eleicao.id}"`, texto: eleicao.fecho });
    for (const chapa of eleicao.chapas) {
      saida.push({
        onde: `chapa "${chapa.id}" em "${eleicao.id}"`,
        texto: chapa.nota,
      });
    }
  }
  for (const viagem of acervo.viagens) {
    saida.push({ onde: `viagem "${viagem.id}"`, texto: viagem.textoMdx });
    for (const parada of viagem.paradas) {
      saida.push({
        onde: `parada "${parada.local}" em "${viagem.id}"`,
        texto: parada.textoMdx,
      });
    }
  }

  /*
   * A prosa da nota também. Faltava, e o buraco era exatamente do tipo que
   * este mecanismo existe para fechar: as notas vieram do Obsidian cheias de
   * `[[Primeira cruzada]]` e `[[Primeira Guerra Mundial]]`, escritos na
   * sintaxe do cofre e apontando para outras NOTAS — que não são alvos do
   * atlas. Nada acusava, e a página publicava o colchete cru na tela.
   *
   * A nota participa do mesmo espaço de nomes que o resto: se cita `[[FRA]]`,
   * o link tem de existir, e se cita uma nota, tem de virar link comum.
   */
  for (const nota of acervo.notas) {
    saida.push({ onde: `nota "${nota.id}"`, texto: nota.corpo });
  }

  return saida;
}

/**
 * Ligação para alvo inexistente é erro de build, como fonte inexistente.
 *
 * É o que separa este mecanismo de um link comum: `[texto](/pais/XYZ)` pode
 * apodrecer em silêncio, `[[xyz]]` não passa na validação.
 */
export function verificarLigacoes(acervo: Acervo): string[] {
  const alvos = indexarAlvos(acervo);
  const erros: string[] = [];

  /*
   * Período, figura, evento e viagem dividem um espaço de nomes só, porque
   * `[[lula]]` não diz de que tipo é o alvo. Duas coisas com o mesmo id
   * fariam uma sobrescrever a outra no índice, e o texto apontaria para o
   * lugar errado sem nenhum sinal.
   */
  const origens = new Map<string, string[]>();
  const anotar = (id: string, onde: string) =>
    origens.set(id, [...(origens.get(id) ?? []), onde]);

  for (const pais of acervo.paises) {
    anotar(pais.iso, `país ${pais.iso}`);
    for (const p of pais.periodos) anotar(p.id, `período de ${pais.iso}`);
  }
  for (const f of acervo.figuras) anotar(f.id, "figura");
  for (const e of acervo.eventos) anotar(e.id, "evento");
  for (const e of acervo.episodios) anotar(e.id, "episódio");
  for (const e of acervo.eleicoes) anotar(e.id, "eleição");
  for (const v of acervo.viagens) anotar(v.id, "viagem");

  for (const [id, onde] of origens) {
    if (onde.length > 1) {
      erros.push(`id "${id}" usado por mais de um alvo: ${onde.join(", ")}`);
    }
  }

  /*
   * Fonte não é alvo, mas não pode dividir id com um.
   *
   * Aconteceu: "magna-carta" era evento, e o documento entrou com o mesmo id.
   * `[[magna-carta]]` resolveria para o evento e a lista de fontes citaria o
   * documento — duas coisas diferentes atendendo pelo mesmo nome, sem que
   * nada acusasse. Quem lê o JSON não tem como saber de qual se trata.
   */
  for (const fonte of acervo.fontes) {
    if (fonte.id in alvos) {
      erros.push(
        `fonte "${fonte.id}" tem o mesmo id de um alvo do atlas — renomeie uma das duas`
      );
    }
  }

  for (const { onde, texto } of textosDoAcervo(acervo)) {
    for (const alvo of ligacoesEm(texto)) {
      if (!(alvo in alvos)) {
        erros.push(`${onde} aponta para alvo inexistente: [[${alvo}]]`);
      }
    }

    /*
     * Colchete que sobra depois de resolver é ligação malformada — `[[x]`
     * com um colchete só, por exemplo. Ela não casa o padrão, então não
     * seria acusada como alvo inexistente, e chegaria à tela como texto
     * cru. O erro é de sintaxe, e precisa aparecer aqui.
     */
    const restante = resolverLigacoes(texto, alvos);
    if (restante?.includes("[[")) {
      const trecho = restante.slice(restante.indexOf("[["), restante.indexOf("[[") + 40);
      erros.push(`${onde} tem ligação malformada: ${trecho}`);
    }
  }

  return erros;
}
