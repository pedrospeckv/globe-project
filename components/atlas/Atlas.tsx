"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { GlobeCanvas } from "./GlobeCanvas";
import { GeoOverlay } from "./GeoOverlay";
import { TimeScrubber } from "./TimeScrubber";
import { separarPaises, type PaisFeature } from "@/lib/geo/mundo";
import { ISO_NUMERICO, type Alpha3 } from "@/lib/geo/iso";
import { rotaAte, type RotaFeature } from "@/lib/geo/rota";
import {
  anoFracionarioDe,
  dataDeAnoFracionario,
  intervaloDaViagem,
  intervaloDoAcervo,
  periodoVigente,
} from "@/lib/conteudo/tempo";
import { estaDividido, type Pais } from "@/lib/conteudo/pais";
import type { Viagem } from "@/lib/conteudo/viagem";
import { eventosEm, type Evento } from "@/lib/conteudo/evento";

const LARGURA = 900;
const ALTURA = 560;

interface Props {
  mundo: PaisFeature[];
  paises: Pais[];
  viagens: Viagem[];
  eventos: Evento[];
}

/**
 * Único dono do estado. Tudo abaixo recebe props e não guarda estado próprio,
 * o que torna impossível globo, barra de tempo e rotas dessincronizarem.
 */
export function Atlas({ mundo, paises, viagens, eventos }: Props) {
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
  const acesos = useMemo(
    () =>
      paises
        .filter((p) => periodoVigente(p, tempo) !== null)
        .map((p) => p.iso)
        .filter((iso): iso is Alpha3 => iso in ISO_NUMERICO),
    [paises, tempo]
  );

  const { curados, fundo } = useMemo(
    () => separarPaises(mundo, acesos),
    [mundo, acesos]
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
   * Eventos próximos ao instante atual. A janela é proporcional à escala da
   * barra: ampla quando ela cobre séculos, estreita quando foca uma viagem.
   */
  const eventosVisiveis = useMemo(() => {
    const janela = Math.max((dominio[1] - dominio[0]) / 40, 0.5);
    return eventosEm(eventos, tempo, janela);
  }, [eventos, tempo, dominio]);

  const marcas = useMemo(() => {
    const v = viagens.find((x) => x.id === viagemFoco);
    if (v) {
      return v.paradas.map((p) => ({
        pos: anoFracionarioDe(p.data),
        rotulo: `${p.local} · ${p.data}`,
      }));
    }
    return paises.flatMap((p) =>
      p.periodos.map((per) => ({
        pos: anoFracionarioDe(per.inicio),
        rotulo: `${p.nome} · ${per.rotulo}`,
      }))
    );
  }, [viagens, viagemFoco, paises]);

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

      {eventosVisiveis.length > 0 && (
        <ul className="flex max-w-3xl flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-rose-300/90">
          {eventosVisiveis.map((ev) => (
            <li key={ev.id}>
              <span className="font-mono text-rose-400/70">{ev.data}</span> {ev.titulo}
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
    </div>
  );
}
