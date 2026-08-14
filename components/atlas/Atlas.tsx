"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { GlobeCanvas } from "./GlobeCanvas";
import { GeoOverlay } from "./GeoOverlay";
import { TimeScrubber } from "./TimeScrubber";
import { prepararMundo, separarPaises, type PaisFeature } from "@/lib/geo/mundo";
import { idsDeDisputasVigentes } from "@/lib/geo/disputas";
import { ISO_NUMERICO, PAISES_DO_ATLAS, type Alpha3 } from "@/lib/geo/iso";
import { rotaAte, type RotaFeature } from "@/lib/geo/rota";
import {
  anoFracionarioDe,
  dataDeAnoFracionario,
  intervaloDaViagem,
  intervaloDoAcervo,
  periodoVigente,
  rotuloDeData,
} from "@/lib/conteudo/tempo";
import { estaDividido, type Pais } from "@/lib/conteudo/pais";
import { Prosa } from "@/components/conteudo/Prosa";
import type { Fonte } from "@/lib/conteudo/fonte";
import type { Viagem } from "@/lib/conteudo/viagem";
import { eventosEm, type Evento } from "@/lib/conteudo/evento";

const LARGURA = 900;
const ALTURA = 560;

interface Props {
  mundo: PaisFeature[];
  paises: Pais[];
  viagens: Viagem[];
  eventos: Evento[];
  fontes?: Fonte[];
}

/**
 * Único dono do estado. Tudo abaixo recebe props e não guarda estado próprio,
 * o que torna impossível globo, barra de tempo e rotas dessincronizarem.
 */
export function Atlas({ mundo, paises, viagens, eventos, fontes = [] }: Props) {
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
      viagens
        .map((v) => rotaAte(v, dataAtual))
        .filter((r): r is RotaFeature => r !== null),
    [viagens, dataAtual]
  );

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

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative touch-none cursor-grab active:cursor-grabbing"
        style={{ width: LARGURA, height: ALTURA }}
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerLeave={aoSoltar}
      >
        <GlobeCanvas
          fundo={fundo}
          largura={LARGURA}
          altura={ALTURA}
          alpha={alpha}
          rotacao={rotacao}
        />
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
        />
      </div>

      <TimeScrubber
        valor={tempo}
        dominio={dominio}
        onChange={setTempo}
        marcas={marcas}
      />

      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        {viagens.map((v) => (
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
      */}
      <p className="max-w-2xl text-center text-[10px] leading-relaxed text-slate-600">
        O contorno de cada país é o de hoje, em todos os períodos — o atlas não
        tem geometria histórica. Territórios ultramarinos ficam de fora do país
        aceso e aparecem só como terra, para o mapa não sugerir domínio séculos
        antes de ele existir.
      </p>
    </div>
  );
}
