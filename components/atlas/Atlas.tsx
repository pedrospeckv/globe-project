"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { geoPath } from "d3-geo";
import { GlobeCanvas } from "./GlobeCanvas";
import { GeoOverlay, type IlhaMarcada } from "./GeoOverlay";
import { RotulosCanvas } from "./RotulosCanvas";
import { TimeScrubber } from "./TimeScrubber";
import { prepararMundo, separarPaises, type PaisFeature } from "@/lib/geo/mundo";
import {
  DISPUTAS,
  disputasSemRecorteVigentes,
  idsDeDisputasVigentes,
  type DisputaSemRecorte,
} from "@/lib/geo/disputas";
import { ISO_NUMERICO, PAISES_DO_ATLAS, type Alpha3 } from "@/lib/geo/iso";
import {
  atribuicaoDaFatia,
  carregarFatia,
  defasagemDaFatia,
  faixaDeDefasagem,
  fatiaPara,
  proximaFatia,
  precisaoBaixa,
  rotuloDaFatia,
  type Fatia,
} from "@/lib/geo/fatias";
import { corDaFeicao } from "@/lib/geo/cores";
import { criarProjecao } from "@/lib/geo/projecao";
import { criarSeletor } from "@/lib/geo/seletor";
import { rotaAte, type RotaFeature } from "@/lib/geo/rota";
import {
  anoFracionarioDe,
  dataDeAnoFracionario,
  intervaloDaViagem,
  intervaloDoAcervo,
  periodoVigente,
  rotuloDeAnoHistorico,
  rotuloDeData,
} from "@/lib/conteudo/tempo";
import { estaDividido, type Pais } from "@/lib/conteudo/pais";
import { Prosa } from "@/components/conteudo/Prosa";
import type { Fonte } from "@/lib/conteudo/fonte";
import type { Viagem } from "@/lib/conteudo/viagem";
import { eventosEm, type Evento } from "@/lib/conteudo/evento";
import {
  ROTULO_VINCULO,
  conhecidaEm,
  soberaniaEm,
  type Ilha,
} from "@/lib/conteudo/ilha";

/** Tamanho do globo. Fixo: globo maior não mostra mais mundo, só ocupa mais tela. */
const LARGURA_GLOBO = 900;
const ALTURA_GLOBO = 560;

/**
 * Teto da largura do mapa.
 *
 * O mapa cresce até onde a página deixa, porque tamanho é o que decide quantos
 * nomes cabem escritos nele: medido na fatia de 2018, 900 px nomeiam 25 dos 176
 * países e 1600 px nomeiam 58. Acima de 1600 o ganho continua, mas a tela deixa
 * de caber em monitor comum e o mapa passa a exigir rolagem para ser visto
 * inteiro — o oposto do que este modo serve para fazer.
 */
const LARGURA_MAPA_MAX = 1600;

/** Altura do canvas do mapa em relação à largura: o mapa é 2:1 e sobra folga. */
const PROPORCAO_MAPA = 0.53;

/** Espaço que a barra de tempo, os controles e a legenda ocupam abaixo do mapa. */
const RESERVA_VERTICAL = 300;

/**
 * O tamanho do mapa, limitado pelos dois eixos.
 *
 * A largura disponível é o que a página oferece; a altura da janela também
 * manda, senão num monitor largo e baixo o mapa fica mais alto que a tela e a
 * barra de tempo sai de vista. Sai função pura para poder ser medida em teste.
 */
export function tamanhoDoMapa(
  disponivel: number,
  alturaJanela: number
): { largura: number; altura: number } {
  const cabeNaAltura = (alturaJanela - RESERVA_VERTICAL) / PROPORCAO_MAPA;
  const largura = Math.round(
    Math.max(LARGURA_GLOBO, Math.min(disponivel, LARGURA_MAPA_MAX, cabeNaAltura))
  );
  return { largura, altura: Math.round(largura * PROPORCAO_MAPA) };
}

/*
 * Constante, e não `[0, 0]` no lugar de uso: literal novo a cada render fazia o
 * `useMemo` do seletor errar e reconstruir o canvas de seleção — que repinta as
 * 1.946 feições de 1492 — em todo render do modo globo. É o mesmo cuidado que
 * levou `sob` a ser índice em vez de feição.
 */
const SEM_DESLOCAMENTO: [number, number] = [0, 0];

/**
 * Ampliação: 1 é o mundo inteiro, 24 é uma ilha.
 *
 * O teto era 8 e subiu por medição. Ilha ganha forma própria quando ocupa 6 px² na
 * tela (ver `AREA_MINIMA_PARA_FORMA`), e com 8× sete das dezessete nunca chegavam
 * lá — Fernando de Noronha precisa de 16×. Com 24 sobram só Midway e Kwajalein, e
 * essas duas são limite da base e não da tela.
 *
 * O preço é honesto: nessa escala a fronteira histórica aparece angulosa, porque a
 * base é simplificada em cerca de 4 km. Angulosa é o que ela é.
 */
const ZOOM_MIN = 1;
const ZOOM_MAX = 24;

/** Metade da extensão desenhada, em pixels. Vem medida da própria projeção. */
export interface Extensao {
  meiaLargura: number;
  meiaAltura: number;
}

/**
 * Limita o deslocamento para o desenho nunca sair de baixo do canvas.
 *
 * Em zoom 1 o mapa é mais estreito que o canvas, então o limite é zero e não se
 * arrasta nada — o que é correto: com o mundo inteiro à vista não há para onde ir.
 *
 * A extensão é MEDIDA e não calculada aqui. A primeira versão deduzia a meia
 * largura como `π × escala`, que só vale para a equirretangular pronta: no meio
 * da animação de desenrolar o desenho ainda é quase um globo, cuja meia largura
 * é `escala`, e o limite saía três vezes maior que o desenho — dava para arrastar
 * o globo até quase fora da tela. Um teste pegou isso.
 */
export function limitarDeslocamento(
  d: [number, number],
  largura: number,
  altura: number,
  { meiaLargura, meiaAltura }: Extensao
): [number, number] {
  const maxX = Math.max(0, meiaLargura - largura / 2);
  const maxY = Math.max(0, meiaAltura - altura / 2);
  return [
    Math.max(-maxX, Math.min(maxX, d[0])),
    Math.max(-maxY, Math.min(maxY, d[1])),
  ];
}

/**
 * Globo e mapa são MODOS, e não um gesto de ida e volta.
 *
 * O botão "Desenrolar" já existia e a projeção já sabia achatar (`alpha` de 0 a
 * 1). O que faltava era o achatado ser um lugar onde se fica: para estudar, o
 * mapa é mais eficaz que o globo — vê-se o mundo todo de uma vez, sem lado
 * oculto e sem ter de girar para achar o que se procura. O globo continua sendo
 * o modo bonito de olhar.
 */
type Modo = "globo" | "mapa";

/** Vista inicial do globo: Atlântico Sul de frente, um pouco de cima. */
const ROTACAO_GLOBO: [number, number] = [-40, -10];

/**
 * Vista do mapa: Greenwich no meio e inclinação ZERO.
 *
 * A inclinação é o que precisa ser travado. Na equirretangular, `phi` diferente
 * de zero não gira nada — enviesa o mundo inteiro, e um mapa enviesado é pior
 * para estudar do que um globo. O `lambda` fica em 0 porque o mapa-múndi que se
 * reconhece de escola é centrado no meridiano de Greenwich.
 */
const ROTACAO_MAPA: [number, number] = [0, 0];

/**
 * As rotas de viagem estão estacionadas, não removidas.
 *
 * Decisão de 2026-08-17: com a camada de fronteira histórica no fundo, somar
 * traçados de viagem por cima polui o mapa — e a poluição piora conforme
 * mais períodos ganharem geometria própria. O schema, `rota.ts`, os dados e
 * os testes continuam de pé; só a camada e os botões saem da tela.
 *
 * Ligar de volta é trocar este valor. Se ficar desligado por muito tempo, a
 * conversa passa a ser sobre remover o subsistema, não sobre o flag.
 */
export const VIAGENS_NO_MAPA = false;

interface Props {
  mundo: PaisFeature[];
  paises: Pais[];
  viagens: Viagem[];
  eventos: Evento[];
  ilhas?: Ilha[];
  fontes?: Fonte[];
}

/**
 * Único dono do estado. Tudo abaixo recebe props e não guarda estado próprio,
 * o que torna impossível globo, barra de tempo e rotas dessincronizarem.
 */
export function Atlas({
  mundo,
  paises,
  viagens,
  eventos,
  ilhas = [],
  fontes = [],
}: Props) {
  const [alpha, setAlpha] = useState(0);
  const [modo, setModo] = useState<Modo>("globo");
  const [rotacao, setRotacao] = useState<[number, number]>(ROTACAO_GLOBO);
  /**
   * A rotação que vai para a tela, e não a que o arrasto guardou.
   *
   * É derivada do modo, e não animada, de propósito: assim o mapa está sempre
   * aprumado no instante em que se entra nele, mesmo que a animação do achatado
   * ainda esteja correndo — e o giro que o globo tinha fica guardado em
   * `rotacao`, esperando a volta. Amarrar isto ao tween deixaria o mapa
   * enviesado durante mais de um segundo a cada troca, e enviesado é exatamente
   * o defeito que o modo mapa existe para não ter.
   */
  const rotacaoEfetiva = modo === "mapa" ? ROTACAO_MAPA : rotacao;

  /**
   * Quanto espaço a página oferece.
   *
   * Medido, e não fixo, porque o mapa cresce até onde couber — e é o tamanho que
   * determina quantos nomes de país cabem escritos nele. O `ResizeObserver` já
   * dispara uma vez ao começar a observar, então não é preciso medir à mão na
   * montagem (o que também evitaria acusar a regra de setState em efeito).
   */
  const raiz = useRef<HTMLDivElement>(null);
  const [espaco, setEspaco] = useState({
    largura: LARGURA_GLOBO,
    alturaJanela: 900,
  });

  useEffect(() => {
    const el = raiz.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () =>
      setEspaco({ largura: el.clientWidth, alturaJanela: window.innerHeight });
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, []);

  const { largura: LARGURA, altura: ALTURA } = useMemo(
    () =>
      modo === "mapa"
        ? tamanhoDoMapa(espaco.largura, espaco.alturaJanela)
        : { largura: LARGURA_GLOBO, altura: ALTURA_GLOBO },
    [modo, espaco]
  );

  /*
   * Zoom e deslocamento valem só no mapa. No globo, aproximar não revela nada
   * que girar não revele, e arrastar já tem outro significado — girar.
   */
  const [zoom, setZoom] = useState(1);
  const [deslocamento, setDeslocamento] = useState<[number, number]>([0, 0]);
  const zoomEfetivo = modo === "mapa" ? zoom : 1;
  const deslocamentoEfetivo = modo === "mapa" ? deslocamento : SEM_DESLOCAMENTO;

  /**
   * Quanto do canvas o desenho ocupa AGORA, medido na projeção.
   *
   * Serve para limitar o arrasto, e precisa ser medido porque a extensão muda com
   * o achatamento de forma que não se deduz da escala — a esfera ocupa `escala`
   * de meia largura, o mapa plano ocupa `π × escala`, e no meio da animação fica
   * entre os dois sem ser linear.
   */
  const extensao = useMemo<Extensao>(() => {
    const p = criarProjecao({
      largura: LARGURA,
      altura: ALTURA,
      alpha,
      rotacao: rotacaoEfetiva,
      zoom: zoomEfetivo,
    });
    const [[x0, y0], [x1, y1]] = geoPath(p).bounds({ type: "Sphere" });
    return { meiaLargura: (x1 - x0) / 2, meiaAltura: (y1 - y0) / 2 };
  }, [LARGURA, ALTURA, alpha, rotacaoEfetiva, zoomEfetivo]);

  const [selecionado, setSelecionado] = useState<Alpha3 | null>(null);
  const [viagemFoco, setViagemFoco] = useState<string | null>(null);

  const dominioAcervo = useMemo(() => intervaloDoAcervo(paises), [paises]);

  /**
   * Domínio em dois níveis. Numa barra de 843 até hoje, os 46 dias do Cabral
   * ocupam menos de um pixel — selecionar a viagem estreita a barra para o
   * intervalo dela e torna a rota navegável.
   */
  const dominio = useMemo<[number, number]>(() => {
    const v = viagens.find((x) => x.id === viagemFoco);
    return v ? intervaloDaViagem(v) : dominioAcervo;
  }, [viagemFoco, viagens, dominioAcervo]);

  const [tempo, setTempo] = useState(dominioAcervo[1]);

  // Ao trocar de domínio, recolocar o tempo dentro dele.
  useEffect(() => {
    setTempo((t) => Math.min(Math.max(t, dominio[0]), dominio[1]));
  }, [dominio]);

  const dataAtual = useMemo(() => dataDeAnoFracionario(tempo), [tempo]);

  /**
   * A linha mais importante do plano: aceso depende do TEMPO, não de uma
   * lista fixa. Em 843 o Brasil apaga; em 1500 acende. O globo deixa de ser
   * "mapa com países marcados" e vira o retrato do mundo naquele instante.
   */
  /*
   * A CHAVE muda a cada ano; a LISTA só muda quando um país nasce ou morre.
   * Congelar a identidade da lista é o que impede o canvas de redesenhar o
   * mundo inteiro a cada ano que a barra atravessa — o array novo invalidava
   * tudo abaixo mesmo com conteúdo idêntico.
   */
  const acesosChave = paises
    .filter((p) => periodoVigente(p, tempo) !== null)
    .map((p) => p.iso)
    .filter((iso): iso is Alpha3 => iso in ISO_NUMERICO)
    .join(",");

  const acesos = useMemo(
    () => (acesosChave ? (acesosChave.split(",") as Alpha3[]) : []),
    [acesosChave]
  );

  /** Mesma ideia: em toda a linha do tempo isto muda uma vez, em 2014. */
  const disputasChave = useMemo(() => idsDeDisputasVigentes(tempo).join(","), [tempo]);
  const disputasAtivas = useMemo(
    () => (disputasChave ? disputasChave.split(",") : []),
    [disputasChave]
  );

  /*
   * Disputas sem polígono na base. Vão direto para a camada de marcadores,
   * sem passar por separarPaises — não há geometria a recortar. Passam pela
   * mesma dança de chave em string porque o array novo a cada tique
   * invalidaria o memo do overlay sem nada ter mudado.
   */
  const marcadasChave = useMemo(
    () => disputasSemRecorteVigentes(tempo).map((d) => d.id).join(","),
    [tempo]
  );
  const disputasMarcadas = useMemo(() => {
    const ids = new Set(marcadasChave ? marcadasChave.split(",") : []);
    return DISPUTAS.filter(
      (d): d is DisputaSemRecorte => d.recorte === "nenhum" && ids.has(d.id)
    );
  }, [marcadasChave]);

  /*
   * Decomposição cara, feita uma vez. Ela já esteve junto do cálculo por
   * instante e custava 200ms a cada mexida na barra — a interface inteira
   * emperrava. O recorte de ultramar não depende do tempo; não tem por que
   * refazê-lo quando o tempo muda.
   */
  const preparado = useMemo(
    () => prepararMundo(mundo, PAISES_DO_ATLAS),
    [mundo]
  );

  const { curados, fundo, disputados } = useMemo(
    () => separarPaises(preparado, acesos, disputasAtivas),
    [preparado, acesos, disputasAtivas]
  );

  /** Países cujo território abrigava mais de um Estado nesta data. */
  const divididos = useMemo(
    () =>
      paises
        .filter((p) => {
          const periodo = periodoVigente(p, tempo);
          return periodo !== null && estaDividido(periodo);
        })
        .map((p) => p.iso)
        .filter((iso): iso is Alpha3 => iso in ISO_NUMERICO),
    [paises, tempo]
  );

  const rotas = useMemo(
    () =>
      VIAGENS_NO_MAPA
        ? viagens
            .map((v) => rotaAte(v, dataAtual))
            .filter((r): r is RotaFeature => r !== null)
        : [],
    [viagens, dataAtual]
  );

  /**
   * A fatia de fronteiras da data atual.
   *
   * Buscada no cliente, uma por vez, e trocada só quando o ano cruza para
   * outra fatia — arrastar a barra dentro do mesmo intervalo não gera
   * requisição. `fatiaPara` já é a fatia ANTERIOR ou igual à data, então o
   * mapa nunca adianta um arranjo territorial.
   */
  const fatiaAtual = useMemo(() => fatiaPara(tempo), [tempo]);
  const [fatia, setFatia] = useState<Fatia | undefined>(undefined);

  useEffect(() => {
    let vigente = true;
    carregarFatia(fatiaAtual)
      .then((f) => {
        // Descarta resposta de uma fatia que já não é a pedida: arrastar a
        // barra rápido dispara várias buscas e elas não voltam em ordem.
        if (vigente) setFatia(f);
      })
      .catch(() => {
        // Fatia que não carrega não pode apagar o globo. Sem ela, o
        // `GlobeCanvas` cai para os países de hoje.
        if (vigente) setFatia(undefined);
      });
    return () => {
      vigente = false;
    };
  }, [fatiaAtual]);

  /*
   * A defasagem sai da biblioteca e não de um cálculo local. Ela já estava
   * duplicada aqui como `Math.max(0, Math.round(...))`, e duas cópias da mesma
   * regra é como uma delas começa a divergir.
   */
  const credito = atribuicaoDaFatia(fatiaAtual);

  const defasagem = defasagemDaFatia(tempo);
  const faixa = faixaDeDefasagem(defasagem);
  const seguinte = useMemo(() => proximaFatia(tempo), [tempo]);

  /**
   * Ilhas que já eram conhecidas nesta data, com a soberania resolvida.
   *
   * `conhecidaEm` é o filtro que importa: antes de 1504 Fernando de Noronha
   * não aparece, porque marcá-la no mapa de 1400 afirmaria que alguém sabia
   * dela. Ilha conhecida e sem dono aparece — é o caso de Tristão da Cunha
   * por três séculos —, e o marcador sai tracejado para dizer isso.
   */
  const ilhasMarcadas = useMemo<IlhaMarcada[]>(
    () =>
      ilhas
        .filter((i) => conhecidaEm(i, tempo))
        .map((i) => {
          const s = soberaniaEm(i, tempo);
          return {
            id: i.id,
            nome: i.nome,
            ponto: i.ponto,
            poder: s?.poder ?? null,
            /* Soberania é o caso comum e não vira etiqueta. */
            vinculo:
              s && s.vinculo !== "soberania" ? ROTULO_VINCULO[s.vinculo] : null,
            disputada: i.disputada,
          };
        }),
    [ilhas, tempo]
  );

  /**
   * Quem estava sob o ponteiro, na camada de fundo.
   *
   * Guardado como índice e não como feição: o estado é comparável por valor,
   * então mover o mouse dentro do mesmo país não gera render novo. Com a
   * feição inteira no estado, cada pixel percorrido invalidava a árvore.
   */
  const [sob, setSob] = useState<number | null>(null);

  const seletor = useMemo(
    () =>
      fatia
        ? criarSeletor({
            fatia: fatia.feicoes,
            largura: LARGURA,
            altura: ALTURA,
            alpha,
            rotacao: rotacaoEfetiva,
            zoom: zoomEfetivo,
            deslocamento: deslocamentoEfetivo,
          })
        : null,
    [fatia, alpha, rotacaoEfetiva, zoomEfetivo, deslocamentoEfetivo, LARGURA, ALTURA]
  );

  const feicaoSob = sob !== null && fatia ? (fatia.feicoes[sob] ?? null) : null;

  /**
   * Eventos próximos ao instante atual.
   *
   * A janela NÃO acompanha o tamanho do domínio. Ela já acompanhou, e o
   * resultado foi que, com a barra cobrindo 3.600 anos, meio século entrava
   * como "agora": parar em 1890 listava Pearl Harbor e as bombas de
   * Hiroshima e Nagasaki como se fossem daquele momento. Meia década para
   * cada lado é o que ainda se lê como contemporâneo.
   *
   * Numa viagem o domínio tem meses, e aí a proporção volta a fazer sentido.
   */
  const eventosVisiveis = useMemo(() => {
    const amplitude = dominio[1] - dominio[0];
    const janela = amplitude > 50 ? 5 : Math.max(amplitude / 8, 0.05);
    return eventosEm(eventos, tempo, janela);
  }, [eventos, tempo, dominio]);

  /**
   * Marcas da barra. Os eventos entram porque a janela é estreita: com 3.600
   * anos numa barra de 900px, cada pixel vale quatro anos e meia década é
   * menos de dois pixels. Sem um alvo visível, o evento existiria sem ser
   * alcançável pelo arrasto.
   */
  const marcas = useMemo(() => {
    const v = viagens.find((x) => x.id === viagemFoco);
    const base = v
      ? v.paradas.map((p) => ({
          pos: anoFracionarioDe(p.data),
          rotulo: `${p.local} · ${rotuloDeData(p.data)}`,
          tipo: "periodo" as const,
        }))
      : paises.flatMap((p) =>
          p.periodos.map((per) => ({
            pos: anoFracionarioDe(per.inicio),
            rotulo: `${p.nome} · ${per.rotulo}`,
            tipo: "periodo" as const,
          }))
        );

    const deEventos = eventos.map((ev) => ({
      pos: anoFracionarioDe(ev.data),
      rotulo: `${ev.titulo} · ${rotuloDeData(ev.data)}`,
      tipo: "evento" as const,
    }));

    // Marca fora do domínio seria posicionada fora da barra.
    return [...base, ...deEventos].filter(
      (m) => m.pos >= dominio[0] && m.pos <= dominio[1]
    );
  }, [viagens, viagemFoco, paises, eventos, dominio]);

  const viagemSelecionada = useMemo(
    () => viagens.find((v) => v.id === viagemFoco) ?? null,
    [viagens, viagemFoco]
  );

  const fontesDaViagem = useMemo(
    () =>
      viagemSelecionada
        ? fontes.filter((f) => viagemSelecionada.fontes.includes(f.id))
        : [],
    [fontes, viagemSelecionada]
  );

  const paisSelecionado = useMemo(
    () => paises.find((p) => p.iso === selecionado) ?? null,
    [paises, selecionado]
  );
  const periodoDoSelecionado = paisSelecionado
    ? periodoVigente(paisSelecionado, tempo)
    : null;

  const arrastando = useRef(false);
  const ultimo = useRef<[number, number]>([0, 0]);

  const tween = useRef({ v: 0 });
  const animacao = useRef<gsap.core.Tween | null>(null);
  useEffect(() => () => void animacao.current?.kill(), []);

  /**
   * Troca de modo: o estado muda na hora, o achatado é que é animado.
   *
   * O desenrolar é a assinatura visual do projeto e fica. Mas o MODO não espera
   * a animação: quem clicou em "Mapa" já está no mapa para todo efeito — arrasto
   * desligado, vista aprumada —, e o `alpha` só leva 1,2 s para chegar lá. Isso
   * também é o que torna a troca verificável sem depender do tween, que roda em
   * `requestAnimationFrame` e fica parado quando a aba não está visível.
   */
  const trocarModo = useCallback(
    (destino: Modo) => {
      if (destino === modo) return;
      /* A animação é disparada AQUI e não dentro do atualizador de estado: o
         React pode chamar o atualizador duas vezes, e efeito colateral lá
         dentro criaria dois tweens. */
      animacao.current?.kill();
      animacao.current = gsap.to(tween.current, {
        v: destino === "mapa" ? 1 : 0,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => setAlpha(tween.current.v),
      });
      setModo(destino);
    },
    [modo]
  );

  /**
   * Aproxima ou afasta, mantendo fixo o ponto sob o cursor.
   *
   * A conta é a de sempre em mapa que amplia: se o ponto `p` tem de continuar
   * onde está, o deslocamento tem de absorver a diferença de escala, daí o fator
   * `(1 - novo/velho)`. Sem isso, aproximar puxaria a vista para o centro e o
   * lugar que se queria ver escaparia da tela — que é o defeito que faz zoom de
   * mapa parecer quebrado.
   *
   * Sem `ponto`, amplia pelo centro: é o caso dos botões, que não têm cursor.
   */
  const aplicarZoom = useCallback(
    (fator: number, ponto?: [number, number]) => {
      const novo = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * fator));
      if (novo === zoom) return;
      const razao = novo / zoom;
      const cx = LARGURA / 2;
      const cy = ALTURA / 2;
      const [px, py] = ponto ?? [cx, cy];
      const alvo: [number, number] = [
        deslocamento[0] + (px - cx - deslocamento[0]) * (1 - razao),
        deslocamento[1] + (py - cy - deslocamento[1]) * (1 - razao),
      ];
      setZoom(novo);
      /*
       * A extensão cresce proporcionalmente ao zoom, então dá para escalar a que
       * já foi medida em vez de construir outra projeção só para medir de novo.
       */
      setDeslocamento(
        limitarDeslocamento(alvo, LARGURA, ALTURA, {
          meiaLargura: (extensao.meiaLargura / zoom) * novo,
          meiaAltura: (extensao.meiaAltura / zoom) * novo,
        })
      );
    },
    [zoom, deslocamento, LARGURA, ALTURA, extensao]
  );

  const reenquadrar = useCallback(() => {
    setZoom(1);
    setDeslocamento([0, 0]);
  }, []);

  /**
   * Tela cheia pedida na RAIZ do Atlas, e não só na área do mapa.
   *
   * Duas razões. A raiz leva a barra de tempo e os controles junto, e mapa em
   * tela cheia sem a linha do tempo seria um mapa mudo. E é a raiz que o
   * `ResizeObserver` observa, então o mapa cresce sozinho, sem nenhuma conta
   * nova: `tamanhoDoMapa` recebe a largura e a altura novas e responde.
   */
  const [telaCheia, setTelaCheia] = useState(false);

  useEffect(() => {
    const aoMudar = () => setTelaCheia(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", aoMudar);
    return () => document.removeEventListener("fullscreenchange", aoMudar);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    const el = raiz.current;
    if (!el) return;
    /*
     * A promessa é rejeitada quando o navegador recusa — falta de gesto do
     * usuário, política de permissão — e engolir o erro é o certo: tela cheia é
     * conforto, e conforto não pode derrubar o mapa.
     */
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen?.().catch(() => {});
  }, []);

  /*
   * A roda entra por ouvinte nativo com `passive: false`, e não por `onWheel`:
   * o React registra `wheel` como passivo na raiz, e em ouvinte passivo o
   * `preventDefault` é ignorado — a página rolaria junto com o zoom.
   */
  const areaDoMapa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = areaDoMapa.current;
    if (!el || modo !== "mapa") return;
    const aoRodar = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      aplicarZoom(e.deltaY < 0 ? 1.25 : 1 / 1.25, [
        e.clientX - r.left,
        e.clientY - r.top,
      ]);
    };
    el.addEventListener("wheel", aoRodar, { passive: false });
    return () => el.removeEventListener("wheel", aoRodar);
  }, [modo, aplicarZoom]);

  /*
   * Arrastar significa coisas diferentes nos dois modos, e é de propósito.
   *
   * No globo, gira. No mapa, NÃO gira — girar a equirretangular levaria a emenda
   * do antimeridiano para o meio de um continente — e passa a deslocar a vista,
   * que é o que serve quando se está ampliado. Em zoom 1 o limite de
   * deslocamento é zero, então o mapa continua imóvel enquanto mostra o mundo
   * inteiro, e só ganha arrasto depois de aproximar.
   */
  const aoPressionar = useCallback((e: React.PointerEvent) => {
    arrastando.current = true;
    ultimo.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const aoMover = useCallback(
    (e: React.PointerEvent) => {
      if (!arrastando.current) return;
      const [px, py] = ultimo.current;
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      ultimo.current = [e.clientX, e.clientY];

      if (modo === "mapa") {
        setDeslocamento((d) =>
          limitarDeslocamento([d[0] + dx, d[1] + dy], LARGURA, ALTURA, extensao)
        );
        return;
      }
      setRotacao(([lambda, phi]) => [
        lambda + dx * 0.35,
        Math.max(-90, Math.min(90, phi - dy * 0.35)),
      ]);
    },
    [modo, LARGURA, ALTURA, extensao]
  );

  const aoSoltar = useCallback(() => {
    arrastando.current = false;
  }, []);

  /*
   * Hover só quando não está arrastando: girar o globo com o botão apertado
   * não é consulta, e manter a etiqueta viva no meio do arrasto a fazia
   * piscar de país em país.
   */
  const aoPassar = useCallback(
    (e: React.PointerEvent) => {
      if (arrastando.current || !seletor || !fatia) {
        setSob(null);
        return;
      }
      const r = e.currentTarget.getBoundingClientRect();
      const f = seletor.em(e.clientX - r.left, e.clientY - r.top);
      setSob(f ? fatia.feicoes.indexOf(f) : null);
    },
    [seletor, fatia]
  );

  return (
    <div
      ref={raiz}
      /*
        Em tela cheia a raiz passa a ser o documento inteiro, e sem fundo próprio
        ela herdaria o preto do navegador em volta de uma página que é
        `bg-slate-950`. O respiro impede a barra de tempo de encostar na borda.
      */
      className={`flex w-full flex-col items-center gap-4 ${
        telaCheia ? "justify-center bg-slate-950 p-6" : ""
      }`}
    >
      <div
        ref={areaDoMapa}
        className={`relative touch-none ${
          modo === "globo" || zoom > 1
            ? "cursor-grab active:cursor-grabbing"
            : "cursor-default"
        }`}
        style={{ width: LARGURA, height: ALTURA }}
        onPointerDown={aoPressionar}
        onPointerMove={(e) => {
          aoMover(e);
          aoPassar(e);
        }}
        onPointerUp={aoSoltar}
        onPointerLeave={() => {
          aoSoltar();
          setSob(null);
        }}
      >
        <GlobeCanvas
          fundo={fundo}
          fatia={fatia}
          largura={LARGURA}
          altura={ALTURA}
          alpha={alpha}
          rotacao={rotacaoEfetiva}
          zoom={zoomEfetivo}
          deslocamento={deslocamentoEfetivo}
        />
        {/*
          Etiqueta do que está sob o ponteiro, fixa num canto e não seguindo o
          cursor. Seguir exigiria guardar a posição em estado a cada pixel, e
          o motivo de `sob` ser índice em vez de feição foi justamente não
          renderizar de novo dentro do mesmo país. Canto fixo mantém isso.

          `s` é o `SUBJECTO` da fonte: a quem aquele território respondia. É a
          resposta para "de quem era isto", e vem do dado, não de inferência
          nossa — quando a fonte não diz, a linha não aparece.
        */}
        {feicaoSob && (
          <div className="pointer-events-none absolute left-3 top-3 max-w-[15rem] rounded border border-slate-700 bg-slate-950/85 px-2 py-1.5">
            {/*
              A amostra da cor liga a etiqueta ao mapa. Com 24 cores para
              centenas de entidades, ela é o que permite achar a olho as outras
              partes da mesma entidade — exclave, colônia, ilha — em vez de
              passar o ponteiro por cada mancha para descobrir de quem é.
            */}
            <p className="flex items-center gap-1.5 font-mono text-xs text-slate-200">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-slate-700"
                style={{ background: corDaFeicao(feicaoSob, fatia?.cores ?? new Map()) }}
              />
              {rotuloDaFatia(feicaoSob) ?? "sem atribuição na fonte"}
            </p>
            {feicaoSob.properties?.s && (
              <p className="mt-0.5 text-[10px] text-amber-300/80">
                sob domínio de {feicaoSob.properties.s}
              </p>
            )}
            <p className="mt-0.5 text-[10px] text-slate-500">
              {rotuloDeAnoHistorico(fatiaAtual.ano)}
              {precisaoBaixa(feicaoSob) && " · fronteira conjectural"}
            </p>
          </div>
        )}

        <GeoOverlay
          curados={curados}
          rotas={rotas}
          eventos={eventosVisiveis}
          largura={LARGURA}
          altura={ALTURA}
          alpha={alpha}
          rotacao={rotacaoEfetiva}
          zoom={zoomEfetivo}
          deslocamento={deslocamentoEfetivo}
          selecionado={selecionado}
          onSelecionar={setSelecionado}
          divididos={divididos}
          disputados={disputados}
          disputasMarcadas={disputasMarcadas}
          ilhas={ilhasMarcadas}
        />

        {/*
          Os nomes vêm DEPOIS do overlay, e é o que os torna legíveis nos países
          que têm dossiê: eles são pintados com ciano a 55% de opacidade, e um
          rótulo desenhado por baixo saía lavado.
        */}
        <RotulosCanvas
          fatia={fatia}
          largura={LARGURA}
          altura={ALTURA}
          alpha={alpha}
          rotacao={rotacaoEfetiva}
          zoom={zoomEfetivo}
          deslocamento={deslocamentoEfetivo}
        />
      </div>

      <TimeScrubber
        largura={LARGURA}
        valor={tempo}
        dominio={dominio}
        onChange={setTempo}
        marcas={marcas}
      />

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {VIAGENS_NO_MAPA &&
          viagens.map((v) => (
          <button
            key={v.id}
            onClick={() => setViagemFoco(viagemFoco === v.id ? null : v.id)}
            className={`rounded border px-2 py-1 transition-colors ${
              viagemFoco === v.id
                ? "border-amber-500 text-amber-400"
                : "border-slate-600 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {v.titulo}
          </button>
        ))}
        {/*
          Dois estados nomeados, e não um botão cujo rótulo depende de onde a
          animação está. "Desenrolar" descrevia o gesto; o leitor precisa saber
          em que modo ESTÁ, e poder escolher — o globo para olhar, o mapa para
          estudar.
        */}
        <div
          role="group"
          aria-label="Modo de visualização"
          className="flex overflow-hidden rounded border border-slate-600"
        >
          {(["globo", "mapa"] as const).map((m) => (
            <button
              key={m}
              onClick={() => trocarModo(m)}
              aria-pressed={modo === m}
              className={`px-2 py-1 transition-colors ${
                modo === m
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              {m === "globo" ? "Globo" : "Mapa"}
            </button>
          ))}
        </div>

        {/*
          Zoom só no mapa. É o que resolve o teto dos rótulos: a 900 px cabem 25
          nomes e a 1600 px cabem 58, e aproximando cabe o resto — quem se
          aproxima da Europa vê aparecer Chéquia e Bélgica, que no mundo inteiro
          nunca teriam espaço.
        */}
        {modo === "mapa" && (
          <div
            role="group"
            aria-label="Ampliação"
            className="flex items-center overflow-hidden rounded border border-slate-600"
          >
            <button
              onClick={() => aplicarZoom(1 / 1.5)}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Afastar"
              className="px-2 py-1 text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              −
            </button>
            <span className="min-w-10 border-x border-slate-700 px-1 py-1 text-center font-mono text-[11px] text-slate-400">
              {zoom.toFixed(1)}×
            </span>
            <button
              onClick={() => aplicarZoom(1.5)}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Aproximar"
              className="px-2 py-1 text-slate-400 transition-colors hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              +
            </button>
            {zoom > ZOOM_MIN && (
              <button
                onClick={reenquadrar}
                className="border-l border-slate-700 px-2 py-1 text-slate-400 transition-colors hover:bg-slate-800"
              >
                Mundo inteiro
              </button>
            )}
          </div>
        )}

        <button
          onClick={alternarTelaCheia}
          aria-pressed={telaCheia}
          className="rounded border border-slate-600 px-2 py-1 text-slate-400 transition-colors hover:bg-slate-800"
        >
          {telaCheia ? "Sair da tela cheia" : "Tela cheia"}
        </button>
      </div>

      {/*
        De que ano é a fronteira que está na tela.

        O §12 mandava avisar que as fronteiras eram as de hoje. Agora elas são
        históricas, e o aviso mudou de conteúdo mas não de razão: a fatia é a
        última ANTERIOR à data, então quase sempre há defasagem, e ela precisa
        estar escrita. Sem isso o mapa afirmaria conhecer 1491 quando está
        mostrando 1400.

        O crédito ao lado não é enfeite: a base é CC-BY-SA e a atribuição é
        condição da licença.
      */}
      <p
        className={`max-w-2xl text-center text-[10px] leading-relaxed ${
          faixa === "remota"
            ? "text-amber-400/90"
            : faixa === "distante"
              ? "text-amber-600/80"
              : "text-slate-600"
        }`}
      >
        {/*
          Quatro tons para quatro faixas. A frase anterior dizia "17 anos atrás
          desta data" no mesmo tom em que diria "900 anos", e com vão mediano de
          70 anos entre fatias isso apresentava o dado como melhor do que é.
        */}
        {faixa === "exata" ? (
          <>
            Fronteiras de{" "}
            <span className="font-mono">{rotuloDeAnoHistorico(fatiaAtual.ano)}</span>
            , a base desta data.
          </>
        ) : faixa === "proxima" ? (
          <>
            Fronteiras de{" "}
            <span className="font-mono">{rotuloDeAnoHistorico(fatiaAtual.ano)}</span>
            , {defasagem} {defasagem === 1 ? "ano" : "anos"} antes desta data.
          </>
        ) : faixa === "distante" ? (
          <>
            Atenção: fronteiras de{" "}
            <span className="font-mono">{rotuloDeAnoHistorico(fatiaAtual.ano)}</span>
            , <strong>{defasagem} anos</strong> antes desta data
            {seguinte && (
              <>
                {" "}
                — a base seguinte é{" "}
                <span className="font-mono">{rotuloDeAnoHistorico(seguinte.ano)}</span>,
                então todo esse intervalo aparece igual
              </>
            )}
            .
          </>
        ) : (
          <>
            Nesta faixa o mapa não é retrato do ano escolhido: a base é de{" "}
            <span className="font-mono">{rotuloDeAnoHistorico(fatiaAtual.ano)}</span>,{" "}
            <strong>{defasagem.toLocaleString("pt-BR")} anos</strong> antes
            {seguinte && (
              <>
                {" "}
                e a seguinte só vem em{" "}
                <span className="font-mono">{rotuloDeAnoHistorico(seguinte.ano)}</span>
              </>
            )}
            {/* Travessão e não ponto: `rotuloDeAnoHistorico` já termina em
                "a.C." nas datas antigas, e o ponto virava "1000 a.C..". */}
            {" — leia como ordem de grandeza, não como fronteira."}
          </>
        )}{" "}
        {/*
          O crédito é POR FATIA, e não um só para o mapa todo. A fatia de 2018 é
          geometria própria, do Natural Earth, e não do upstream — creditá-la a
          ele seria atribuição falsa, o oposto do que a obrigação de crédito
          existe para garantir.
        */}
        <span className="text-slate-600">
          {fatiaAtual.local && "Geometria própria do atlas. "}
          Base cartográfica de {credito.autor} (
          {credito.url ? (
            <a
              href={credito.url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-slate-700 hover:text-slate-400"
            >
              {credito.fonte}
            </a>
          ) : (
            credito.fonte
          )}
          ), {credito.licenca}. Traço tracejado marca fronteira que a fonte
          declara como conjectural.
        </span>
      </p>

      {/*
        Contexto da viagem selecionada. O traço no mapa não comporta ressalva:
        a rota do Colombo desenha um desembarque cuja ilha é disputada, e a
        linha sozinha afirmaria uma certeza que as fontes não têm.
      */}
      {viagemSelecionada && (
        <article className="max-w-2xl rounded-lg border border-amber-900/40 bg-amber-950/10 p-4">
          <h2 className="text-sm font-semibold text-amber-200">
            {viagemSelecionada.titulo}
          </h2>
          <Prosa texto={viagemSelecionada.textoMdx} />

          {fontesDaViagem.length > 0 && (
            <footer className="mt-3 border-t border-amber-900/30 pt-2">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-600">
                {fontesDaViagem.length === 1 ? "Fonte" : "Fontes"}
              </p>
              <ul className="space-y-1">
                {fontesDaViagem.map((f) => (
                  <li key={f.id} className="text-xs text-slate-400">
                    {f.titulo}
                    {f.autor && <span className="text-slate-600"> · {f.autor}</span>}
                    {f.data && (
                      <span className="text-slate-600"> · {rotuloDeData(f.data)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </footer>
          )}
        </article>
      )}

      {eventosVisiveis.length > 0 && (
        <ul className="flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-rose-300/90">
          {eventosVisiveis.map((ev) => (
            <li key={ev.id}>
              <span className="font-mono text-rose-400/70">{rotuloDeData(ev.data)}</span>{" "}
              {ev.titulo}
            </li>
          ))}
        </ul>
      )}

      <div className="flex min-h-6 items-center gap-3 font-mono text-xs text-slate-400">
        <span>
          {paisSelecionado
            ? periodoDoSelecionado
              ? `${paisSelecionado.nome} · ${periodoDoSelecionado.rotulo} · ${periodoDoSelecionado.regime}`
              : `${paisSelecionado.nome} não existia nesta data`
            : "Clique num país aceso"}
        </span>
        {paisSelecionado && (
          <Link
            href={`/pais/${paisSelecionado.iso}`}
            className="shrink-0 text-sky-400 hover:underline"
          >
            abrir dossiê →
          </Link>
        )}
      </div>

      {/*
        A limitação mais importante do mapa, dita onde ela é vista. Esconder
        isso faria o atlas afirmar fronteiras que nunca existiram.

        O texto mudou quando a camada de fundo virou histórica: dizer que TODO
        contorno é o de hoje passou a ser falso, e um aviso falso é pior que
        nenhum. Agora ele separa as duas camadas, porque elas têm status
        diferente — o fundo é datado e aproximado, o país aceso é a silhueta
        de hoje.
      */}
      <p className="max-w-2xl text-center text-[10px] leading-relaxed text-slate-600">
        O contorno dos países <span className="text-slate-500">acesos</span> é o
        de hoje, em todos os períodos — a geometria histórica dos dossiês ainda
        não existe, e é a camada de fundo que muda com a data. Territórios
        ultramarinos ficam de fora do país aceso e aparecem só como terra, para
        o mapa não sugerir domínio séculos antes de ele existir.
      </p>

      {/*
        O cinza tem DOIS significados, e é preciso dizer os dois — senão o mapa
        pareceria afirmar "sem dono" onde a fonte nomeia alguém. Nada fica
        escondido: o hover nomeia em todos os casos.
      */}
      {modo === "mapa" && (
        <p className="max-w-2xl text-center text-[10px] leading-relaxed text-slate-600">
          Território em <span className="text-slate-500">cinza</span> é terra sem cor
          de identidade, por um de três motivos: a fonte não atribui dono; não há
          soberano, como na Antártida, cujas reivindicações o Tratado de 1959
          suspende; ou a entidade é pequena demais para a cor dizer algo nesta
          escala — em 1650 a base divide a Austrália em 375 territórios de povos, e
          colorir cada um afirmaria 375 Estados com fronteira. Aproximar devolve a
          cor a quem ganhou espaço, e o nome aparece ao passar o mouse sempre.
        </p>
      )}
    </div>
  );
}
