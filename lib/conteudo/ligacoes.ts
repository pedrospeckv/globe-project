import type { Acervo } from "./integridade";

export type TipoAlvo = "pais" | "periodo" | "figura" | "evento" | "viagem";

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

  for (const viagem of acervo.viagens) {
    alvos[viagem.id] = {
      id: viagem.id,
      rotulo: viagem.titulo,
      href: "/",
      tipo: "viagem",
    };
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
  }
  for (const evento of acervo.eventos) {
    saida.push({ onde: `evento "${evento.id}"`, texto: evento.textoMdx });
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
  for (const v of acervo.viagens) anotar(v.id, "viagem");

  for (const [id, onde] of origens) {
    if (onde.length > 1) {
      erros.push(`id "${id}" usado por mais de um alvo: ${onde.join(", ")}`);
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
