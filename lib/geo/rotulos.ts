import { geoArea, geoCentroid, geoContains, type GeoProjection } from "d3-geo";
import type { Polygon, Position } from "geojson";
import type { FatiaFeature } from "./fatias";

/**
 * Nomes escritos sobre o mapa, e o tamanho de cada entidade na tela.
 *
 * ## Por que só no mapa plano
 *
 * No globo não dá: metade do mundo está do outro lado, e a cada grau de giro os
 * nomes teriam de ser recolocados. O mapa é fixo por decisão (ver `Atlas.tsx`).
 *
 * ## O limite, medido antes de escrever
 *
 * Rótulo dentro do território não nomeia um mundo inteiro, e isso é propriedade
 * de mapa-múndi, não defeito desta implementação. Medido na fatia de 2018, com
 * 176 entidades:
 *
 * | largura do mapa | nomes colocados |
 * |-----------------|-----------------|
 * | 900 px          | 25 (14%)        |
 * | 1200 px         | 41 (23%)        |
 * | 1600 px         | 58 (33%)        |
 * | 2600 px         | 86 (49%)        |
 *
 * Ou seja: nem dobrando o mapa se passa da metade. O ganho real está na faixa do
 * meio — a 1600 px entram França, Alemanha, Egito, Nigéria, Quênia e Polônia, que
 * são os nomes por onde alguém se orienta ao estudar.
 *
 * **Correção:** eu havia escrito aqui que o zoom 3× colocava 121 nomes. Estava
 * errado — aquela contagem incluía rótulos posicionados FORA do enquadramento, que
 * nunca apareciam na tela. Com o recorte pela tela, os números honestos num mapa de
 * 1472 px são: 53 no mundo inteiro, 60 sobre a Europa a 3×, 45 a 6× e 7 sobre o
 * Japão a 8×.
 *
 * O que o zoom faz não é mostrar MAIS nomes: é trocar QUAIS. Sobre a Europa a 6×
 * entram Alemanha, Polônia, Itália e Espanha, que no mundo inteiro nunca caberiam,
 * e saem os gigantes que estão fora do recorte. É o comportamento que se quer de um
 * mapa de estudo — atlas de papel resolve isso com prancha regional.
 *
 * O critério é ELE CABER, e não a área do país: nome curto em país estreito entra
 * (Chile não, Peru sim), e escrever por cima da fronteira do vizinho seria
 * afirmar território errado.
 *
 * ## O que é medido uma vez e o que é medido por quadro
 *
 * Esta é a parte que decide se arrastar o mapa é fluido. A primeira versão fazia
 * TUDO por quadro — âncora, caixa e área de cada entidade — e cada uma dessas
 * contas varre a geometria inteira, com até 1.307 entidades em 1492. Arrastar
 * ficava pesado, e com razão.
 *
 * A separação que resolve: âncora, caixa e área não dependem da vista. A
 * equirretangular é um mapa LINEAR de longitude e latitude, então basta guardar
 * a caixa em graus e a área em graus² uma vez por fatia, e por quadro fazer
 * aritmética — `× escala`. O resultado é exato, não aproximado.
 */

export interface Rotulo {
  nome: string;
  /** Centro do texto, em pixels do canvas. */
  x: number;
  y: number;
}

/**
 * O que se sabe de uma entidade sem olhar a vista.
 *
 * Calculado uma vez por fatia e reaproveitado em todo quadro. É por isso que
 * arrastar e aproximar não recalculam geometria.
 */
export interface ResumoDeEntidade {
  /** Ponto interior onde o nome vai, em lon/lat. A melhor opção. */
  ancora: [number, number] | null;
  /** Caixa envolvente em graus: oeste, sul, leste, norte. */
  caixa: [number, number, number, number];
  /** Área em graus², invariante à vista. */
  areaPlana: number;
  /** O maior polígono, guardado para gerar alternativas quando precisar. */
  pol: Polygon;
  /**
   * Outros pontos interiores, para quando a âncora principal sai da tela.
   *
   * Calculado SOB DEMANDA e guardado aqui. Em zoom alto a âncora fica fora do
   * enquadramento com frequência — aproximar em Kyushu tirava o nome do Japão da
   * tela, e o país aparecia sem nome justamente quando se estava olhando ele.
   *
   * Preguiçoso porque a varredura custa 529 testes de contenção por entidade, e
   * são 1.307 entidades em 1492: fazer para todas na carga da fatia custaria
   * perto de um segundo para servir a um caso que só acontece ampliado. Assim,
   * paga-se por entidade e uma vez só.
   */
  alternativas?: [number, number][];
}

/**
 * O maior polígono de uma feição, isolado.
 *
 * O rótulo vai na maior parte, não no conjunto: o centroide dos Estados Unidos
 * com o Alasca somado cai no Canadá, e o de um país com ilha distante cai no mar.
 * Uma parte só, a maior, é sempre um lugar que existe.
 */
export function maiorPoligono(f: FatiaFeature): Polygon | null {
  const g = f.geometry;
  if (!g) return null;
  if (g.type === "Polygon") return g as Polygon;
  if (g.type !== "MultiPolygon") return null;

  let melhor: Polygon | null = null;
  let area = -1;
  for (const aneis of g.coordinates as Position[][][]) {
    const p: Polygon = { type: "Polygon", coordinates: aneis };
    const a = geoArea(p);
    if (a > area) {
      area = a;
      melhor = p;
    }
  }
  return melhor;
}

/** Quantas divisões a grade de recurso usa em cada eixo. */
const GRADE = 24;

function caixaDe(pol: Polygon): [number, number, number, number] {
  let oeste = 180;
  let sul = 90;
  let leste = -180;
  let norte = -90;
  for (const anel of pol.coordinates) {
    for (const [x, y] of anel as Position[]) {
      if (x < oeste) oeste = x;
      if (x > leste) leste = x;
      if (y < sul) sul = y;
      if (y > norte) norte = y;
    }
  }
  return [oeste, sul, leste, norte];
}

/** Área do anel em graus², pela fórmula do sapateiro. Invariante à vista. */
function areaPlanaDoAnel(anel: Position[]): number {
  let s = 0;
  for (let i = 0; i < anel.length - 1; i++) {
    s += anel[i][0] * anel[i + 1][1] - anel[i + 1][0] * anel[i][1];
  }
  return Math.abs(s / 2);
}

/**
 * Área de uma feição em graus², somando as partes e descontando os buracos.
 *
 * Em graus² e não em esterradianos porque é isto que a equirretangular usa: o
 * mapa é linear em longitude e latitude, então `graus² × (π/180)² × escala²` dá
 * a área exata em pixels, sem a distorção por latitude que a área esférica
 * introduziria — e foi essa distorção que me fez, antes, medir por quadro.
 */
function areaPlanaDaFeicao(f: FatiaFeature): number {
  const g = f.geometry;
  if (!g) return 0;
  const poligonos: Position[][][] =
    g.type === "Polygon"
      ? [g.coordinates as Position[][]]
      : g.type === "MultiPolygon"
        ? (g.coordinates as Position[][][])
        : [];

  let total = 0;
  for (const aneis of poligonos) {
    for (let i = 0; i < aneis.length; i++) {
      const a = areaPlanaDoAnel(aneis[i]);
      total += i === 0 ? a : -a;
    }
  }
  return Math.max(0, total);
}

/**
 * Um ponto DENTRO do polígono, para o texto não flutuar no mar.
 *
 * O centroide serve na grande maioria, e falha justamente nas formas em que
 * falharia à mão: em 2018 são Croácia, Haiti, Israel e Vietnã — países em
 * crescente ou em fita, cujo centro geométrico cai fora do próprio território.
 * Em 1492, com muitas entidades de forma irregular, são 290.
 *
 * O recurso é uma varredura em grade pela caixa envolvente, escolhendo o ponto
 * interior mais afastado das bordas. É um "polo de inacessibilidade" pobre, e é
 * a conta mais caro deste arquivo — por isso roda uma vez por fatia e não por
 * quadro. Devolver `null` é resposta legítima: melhor um país sem nome que um
 * nome no lugar errado.
 */
export function ancoraDe(pol: Polygon): [number, number] | null {
  const centro = geoCentroid(pol);
  if (geoContains(pol, centro)) return centro;

  const [oeste, sul, leste, norte] = caixaDe(pol);
  let melhor: [number, number] | null = null;
  let folgaMaxima = -1;
  for (let i = 1; i < GRADE; i++) {
    for (let j = 1; j < GRADE; j++) {
      const p: [number, number] = [
        oeste + ((leste - oeste) * i) / GRADE,
        sul + ((norte - sul) * j) / GRADE,
      ];
      if (!geoContains(pol, p)) continue;
      const folga = Math.min(p[0] - oeste, leste - p[0], p[1] - sul, norte - p[1]);
      if (folga > folgaMaxima) {
        folgaMaxima = folga;
        melhor = p;
      }
    }
  }
  return melhor;
}

/** Quantas âncoras alternativas guardar por entidade. */
const ALTERNATIVAS = 24;

/**
 * Pontos interiores espalhados pelo território, para o rótulo achar lugar visível.
 *
 * A ordem importa e não é a de folga: é **amostragem do ponto mais distante**.
 * Ordenar só por folga concentraria as 24 opções na parte mais larga do país — no
 * Japão, todas em Honshu —, e aproximar em Kyushu continuaria sem nome. Começando
 * pela de maior folga e escolhendo em seguida sempre a mais longe das já
 * escolhidas, as opções cobrem a forma inteira.
 *
 * Quem desenha varre nesta ordem e usa a primeira que cai na tela: perto do centro
 * quando o país todo está visível, e numa ponta quando só a ponta está.
 */
export function ancorasDe(pol: Polygon): [number, number][] {
  const [oeste, sul, leste, norte] = caixaDe(pol);
  const dentro: { p: [number, number]; folga: number }[] = [];
  for (let i = 1; i < GRADE; i++) {
    for (let j = 1; j < GRADE; j++) {
      const p: [number, number] = [
        oeste + ((leste - oeste) * i) / GRADE,
        sul + ((norte - sul) * j) / GRADE,
      ];
      if (!geoContains(pol, p)) continue;
      dentro.push({
        p,
        folga: Math.min(p[0] - oeste, leste - p[0], p[1] - sul, norte - p[1]),
      });
    }
  }
  if (dentro.length === 0) return [];

  dentro.sort((a, b) => b.folga - a.folga);
  const escolhidas: [number, number][] = [dentro[0].p];
  const restantes = dentro.slice(1);
  while (escolhidas.length < ALTERNATIVAS && restantes.length > 0) {
    let melhor = 0;
    let maiorDistancia = -1;
    for (let k = 0; k < restantes.length; k++) {
      let perto = Infinity;
      for (const e of escolhidas) {
        const dx = restantes[k].p[0] - e[0];
        const dy = restantes[k].p[1] - e[1];
        const d = dx * dx + dy * dy;
        if (d < perto) perto = d;
      }
      if (perto > maiorDistancia) {
        maiorDistancia = perto;
        melhor = k;
      }
    }
    escolhidas.push(restantes[melhor].p);
    restantes.splice(melhor, 1);
  }
  return escolhidas;
}

/*
 * Cache por identidade da lista de feições. A fatia é criada uma vez no
 * carregador e guardada em memória, então a mesma lista volta em todo quadro — e
 * é isso que o `WeakMap` aproveita, sem impedir a coleta quando a fatia sai de
 * cena.
 */
const resumos = new WeakMap<
  readonly FatiaFeature[],
  Map<string, ResumoDeEntidade>
>();

/**
 * O resumo geométrico de cada entidade nomeada da fatia, calculado uma vez.
 *
 * Uma entidade, um resumo: a Itália aparece em 5 feições e se nomeia uma vez, na
 * maior delas. A área, porém, SOMA todas as partes — quem decide se cabe cor é a
 * extensão total, não a da maior ilha.
 */
export function resumirFatia(
  feicoes: readonly FatiaFeature[]
): Map<string, ResumoDeEntidade> {
  const emCache = resumos.get(feicoes);
  if (emCache) return emCache;

  const maiores = new Map<string, { pol: Polygon; area: number }>();
  const areas = new Map<string, number>();
  for (const f of feicoes) {
    const nome = f.properties?.n;
    if (!nome) continue;
    areas.set(nome, (areas.get(nome) ?? 0) + areaPlanaDaFeicao(f));
    const pol = maiorPoligono(f);
    if (!pol) continue;
    const area = geoArea(pol);
    const atual = maiores.get(nome);
    if (!atual || area > atual.area) maiores.set(nome, { pol, area });
  }

  const resumo = new Map<string, ResumoDeEntidade>();
  for (const [nome, { pol }] of maiores) {
    resumo.set(nome, {
      ancora: ancoraDe(pol),
      caixa: caixaDe(pol),
      areaPlana: areas.get(nome) ?? 0,
      pol,
    });
  }
  resumos.set(feicoes, resumo);
  return resumo;
}

/** Graus para radianos, que é a unidade em que a projeção mede. */
const RAD = Math.PI / 180;

/**
 * A área que a entidade ocupa na tela, em pixels².
 *
 * Exata para o mapa plano, e por aritmética: a equirretangular multiplica
 * longitude e latitude pela escala, então a área multiplica pelo quadrado dela.
 */
export function areaNaTela(r: ResumoDeEntidade, escala: number): number {
  return r.areaPlana * RAD * RAD * escala * escala;
}

interface Caixa {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const seCruzam = (a: Caixa, b: Caixa) =>
  a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/** Folga entre dois rótulos, em pixels, para não se encostarem. */
const RESPIRO = 2;

export interface OpcoesRotulos {
  feicoes: readonly FatiaFeature[];
  projecao: GeoProjection;
  /**
   * Tamanho do canvas, para recusar nome que cairia fora dele.
   *
   * Sem isto, em zoom alto a maioria dos nomes era colocada fora do
   * enquadramento: não apareciam, e ainda ocupavam espaço na detecção de
   * sobreposição, podendo barrar um nome visível perto da borda.
   */
  largura: number;
  altura: number;
  /**
   * Largura do texto em pixels.
   *
   * Injetada porque só quem tem o contexto do canvas sabe medir de verdade, e
   * porque assim o teste roda sem canvas — no jsdom `measureText` não existe.
   */
  medir: (texto: string) => number;
  /** Altura da linha, em pixels. */
  fonte: number;
}

/**
 * Escolhe e posiciona os nomes que cabem.
 *
 * A ordem é por área decrescente e é o que decide os empates: quando dois nomes
 * disputam o mesmo espaço, fica o do país maior. Sem uma ordem fixa, a mesma
 * fatia produziria mapas diferentes a cada carga.
 *
 * Por quadro, só há aritmética e uma chamada de projeção por candidato. Tudo que
 * varre geometria mora em `resumirFatia`, que roda uma vez por fatia.
 */
export function colocarRotulos({
  feicoes,
  projecao,
  largura: larguraDaTela,
  altura: alturaDaTela,
  medir,
  fonte,
}: OpcoesRotulos): Rotulo[] {
  const resumo = resumirFatia(feicoes);
  const escala = projecao.scale();

  /** A caixa do texto cabe, ao menos em parte, dentro do canvas? */
  const naTela = (c: Caixa) =>
    c.x1 > 0 && c.x0 < larguraDaTela && c.y1 > 0 && c.y0 < alturaDaTela;

  const candidatos: (Rotulo & { area: number; caixa: Caixa })[] = [];
  for (const [nome, r] of resumo) {
    if (!r.ancora) continue;
    const [oeste, sul, leste, norte] = r.caixa;
    const larguraCaixa = (leste - oeste) * RAD * escala;
    const alturaCaixa = (norte - sul) * RAD * escala;
    const largura = medir(nome);
    if (largura > larguraCaixa || fonte > alturaCaixa) continue;

    const caixaDoTexto = (xy: [number, number]): Caixa => ({
      x0: xy[0] - largura / 2 - RESPIRO,
      y0: xy[1] - fonte / 2 - RESPIRO,
      x1: xy[0] + largura / 2 + RESPIRO,
      y1: xy[1] + fonte / 2 + RESPIRO,
    });

    const projetar = (p: [number, number]): Caixa | null => {
      const xy = projecao(p);
      if (!xy || !Number.isFinite(xy[0]) || !Number.isFinite(xy[1])) return null;
      return caixaDoTexto(xy as [number, number]);
    };

    /*
     * A âncora principal quando ela está na tela; se não, uma das alternativas.
     *
     * É o conserto de "aproximei em Kyushu e o Japão perdeu o nome": a âncora
     * fica no centro do território, e em zoom alto o centro sai do enquadramento
     * com frequência. As alternativas são pontos interiores espalhados, então o
     * nome migra para a parte que está visível — e continua sobre a terra que
     * nomeia, que é a promessa que não se pode quebrar. Deslocar o nome para
     * dentro da tela por força bruta o colocaria no mar do vizinho.
     */
    let caixa = projetar(r.ancora);
    if (!caixa || !naTela(caixa)) {
      if (!r.alternativas) r.alternativas = ancorasDe(r.pol);
      caixa = null;
      for (const alt of r.alternativas) {
        const c = projetar(alt);
        if (c && naTela(c)) {
          caixa = c;
          break;
        }
      }
    }
    if (!caixa) continue;

    candidatos.push({
      nome,
      x: (caixa.x0 + caixa.x1) / 2,
      y: (caixa.y0 + caixa.y1) / 2,
      area: r.areaPlana,
      caixa,
    });
  }

  candidatos.sort((a, b) => b.area - a.area || a.nome.localeCompare(b.nome));

  const postos: Caixa[] = [];
  const rotulos: Rotulo[] = [];
  for (const c of candidatos) {
    if (postos.some((p) => seCruzam(c.caixa, p))) continue;
    postos.push(c.caixa);
    rotulos.push({ nome: c.nome, x: c.x, y: c.y });
  }
  return rotulos;
}
