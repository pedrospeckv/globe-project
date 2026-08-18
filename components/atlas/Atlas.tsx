"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { GlobeCanvas } from "./GlobeCanvas";
import { GeoOverlay, type IlhaMarcada } from "./GeoOverlay";
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

const LARGURA = 900;
const ALTURA = 560;

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
  const [rotacao, setRotacao] = useState<[number, number]>([-40, -10]);
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
    carregarFatia(fatiaAtual.nome)
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
  }, [fatiaAtual.nome]);

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
            rotacao,
          })
        : null,
    [fatia, alpha, rotacao]
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

  const alternarModo = useCallback(() => {
    animacao.current?.kill();
    const destino = tween.current.v < 0.5 ? 1 : 0;
    animacao.current = gsap.to(tween.current, {
      v: destino,
      duration: 1.2,
      ease: "power2.inOut",
      onUpdate: () => setAlpha(tween.current.v),
    });
  }, []);

  const aoPressionar = useCallback((e: React.PointerEvent) => {
    arrastando.current = true;
    ultimo.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const aoMover = useCallback((e: React.PointerEvent) => {
    if (!arrastando.current) return;
    const [px, py] = ultimo.current;
    const dx = e.clientX - px;
    const dy = e.clientY - py;
    ultimo.current = [e.clientX, e.clientY];
    setRotacao(([lambda, phi]) => [
      lambda + dx * 0.35,
      Math.max(-90, Math.min(90, phi - dy * 0.35)),
    ]);
  }, []);

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
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative touch-none cursor-grab active:cursor-grabbing"
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
          rotacao={rotacao}
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
          rotacao={rotacao}
          selecionado={selecionado}
          onSelecionar={setSelecionado}
          divididos={divididos}
          disputados={disputados}
          disputasMarcadas={disputasMarcadas}
          ilhas={ilhasMarcadas}
        />
      </div>

      <TimeScrubber
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
        <button
          onClick={alternarModo}
          className="rounded border border-slate-600 px-2 py-1 text-slate-300 transition-colors hover:bg-slate-800"
        >
          {alpha < 0.5 ? "Desenrolar" : "Enrolar"}
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
    </div>
  );
}
