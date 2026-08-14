"use client";

import { useMemo } from "react";
import { geoPath } from "d3-geo";
import { criarProjecao, pontoVisivel } from "@/lib/geo/projecao";
import type { PaisCurado } from "@/lib/geo/mundo";
import type { RotaFeature } from "@/lib/geo/rota";
import type { Alpha3 } from "@/lib/geo/iso";
import type { TerritorioDisputado } from "@/lib/geo/disputas";
import type { Evento } from "@/lib/conteudo/evento";
import { rotuloDeData } from "@/lib/conteudo/tempo";

interface Props {
  curados: PaisCurado[];
  rotas: RotaFeature[];
  /** Eventos próximos ao instante atual. */
  eventos?: Evento[];
  largura: number;
  altura: number;
  alpha: number;
  rotacao: [number, number];
  selecionado: Alpha3 | null;
  onSelecionar: (a: Alpha3) => void;
  /** Países cujo território abrigava mais de um Estado nesta data. */
  divididos?: readonly Alpha3[];
  /** Territórios de soberania disputada, marcados por polígono e não por país. */
  disputados?: readonly TerritorioDisputado[];
}

/**
 * Camada interativa. Poucos elementos, então SVG compensa: clique e hover
 * saem de graça pelo DOM, e as rotas viram <path> reais — que é o que o
 * DrawSVG do GSAP precisa para desenhá-las progressivamente no plano 3.
 *
 * Usa a MESMA projeção do canvas, então as camadas não podem dessincronizar.
 */
export function GeoOverlay({
  curados,
  rotas,
  eventos = [],
  largura,
  altura,
  alpha,
  rotacao,
  selecionado,
  onSelecionar,
  divididos = [],
  disputados = [],
}: Props) {
  const projecao = useMemo(
    () => criarProjecao({ largura, altura, alpha, rotacao }),
    [largura, altura, alpha, rotacao]
  );
  const path = useMemo(() => geoPath(projecao), [projecao]);

  const dividido = useMemo(() => new Set<string>(divididos), [divididos]);

  return (
    <svg width={largura} height={altura} className="pointer-events-none absolute inset-0">
      <defs>
        {/*
          Hachura para território que abrigava mais de um Estado. Ela admite a
          limitação em vez de escondê-la: o atlas não tem a geometria da
          fronteira interna e não vai inventar uma.
        */}
        <pattern
          id="hachura-dividido"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="7" height="7" fill="#0ea5e9" fillOpacity="0.28" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#7dd3fc" strokeWidth="2.2" />
        </pattern>

        {/*
          Disputa de soberania usa hachura própria, em âmbar. Compartilhar a
          hachura azul com o território dividido faria o mapa dizer que são a
          mesma coisa, e não são: uma é país partido em dois Estados, a outra
          é um pedaço cuja soberania está em contestação aberta.
        */}
        <pattern
          id="hachura-disputado"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <rect width="7" height="7" fill="#f59e0b" fillOpacity="0.18" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#fbbf24" strokeWidth="2" />
        </pattern>
      </defs>

      {/*
        Cada camada se identifica pelo nome. Antes elas eram alcançadas pela
        posição, e inserir uma no meio quebrava tudo que dependia da ordem.
      */}
      <g data-camada="paises">
        {curados.map(({ alpha3, feature }) => {
          const d = path(feature);
          if (!d) return null;
          const ativo = selecionado === alpha3;
          const partido = dividido.has(alpha3);
          return (
            <path
              key={alpha3}
              d={d}
              fill={partido ? "url(#hachura-dividido)" : ativo ? "#38bdf8" : "#0ea5e9"}
              fillOpacity={partido ? 1 : ativo ? 0.9 : 0.55}
              stroke="#7dd3fc"
              strokeWidth={ativo ? 1.5 : 0.75}
              strokeDasharray={partido ? "4 2" : undefined}
              className="pointer-events-auto cursor-pointer transition-[fill-opacity] duration-200"
              onClick={() => onSelecionar(alpha3)}
            >
              <title>
                {partido ? `${alpha3} — território dividido` : alpha3}
              </title>
            </path>
          );
        })}
      </g>

      {/*
        Território disputado. Fica entre os países e as rotas: por cima do
        país a que a base o atribui, e clicável pelo mesmo país — a disputa
        é sobre a soberania, não sobre a existência do dossiê.
      */}
      <g data-camada="disputados">
        {disputados.map(({ alpha3, feature, disputa }) => {
          const d = path(feature);
          if (!d) return null;
          return (
            <path
              key={disputa.id}
              d={d}
              fill="url(#hachura-disputado)"
              stroke="#fbbf24"
              strokeWidth={1}
              strokeDasharray="3 2"
              className="pointer-events-auto cursor-pointer"
              onClick={() => onSelecionar(alpha3)}
            >
              <title>{`${disputa.nome} — soberania disputada`}</title>
            </path>
          );
        })}
      </g>

      <g data-camada="rotas">
        {rotas.map((rota) => {
          const d = path(rota);
          if (!d) return null;
          return (
            <path
              key={rota.properties.viagemId}
              d={d}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="5 4"
            >
              <title>{rota.properties.titulo}</title>
            </path>
          );
        })}
      </g>

      {/*
        Marcadores de evento. Projetados pela MESMA projeção das outras
        camadas — mas um ponto avulso não passa pelo corte que o `geoPath`
        aplica, então o lado oculto precisa ser perguntado antes: sem isso o
        marcador de um evento na China aparece sobre a América do Sul.
      */}
      <g data-camada="eventos">
        {eventos.map((ev) => {
          if (!pontoVisivel(ev.ponto, { alpha, rotacao })) return null;
          const p = projecao(ev.ponto);
          if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
          /*
             Arredondar não é cosmético: sem isso o servidor escrevia
             `388.6494362206221` e o navegador `388.649436220622`, e o React
             acusava divergência de hidratação. Trigonometria em ponto
             flutuante pode diferir no último dígito entre o V8 do Node e o do
             navegador. O `d` dos países não sofre disso porque o geoPath do
             d3 já arredonda em 3 casas por conta própria — aqui a string é
             montada à mão, então o arredondamento também precisa ser.
          */
          const x = p[0].toFixed(3);
          const y = p[1].toFixed(3);
          return (
            <g key={ev.id} transform={`translate(${x},${y})`}>
              <circle r={7} fill="#f43f5e" fillOpacity={0.18} />
              <circle r={3} fill="#f43f5e" stroke="#fecdd3" strokeWidth={0.8}>
                <title>{`${ev.titulo} · ${rotuloDeData(ev.data)}`}</title>
              </circle>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
