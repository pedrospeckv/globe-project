"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CabecalhoDeSecao } from "@/components/design/CabecalhoDeSecao";
import { CampoDeBusca } from "@/components/design/CampoDeBusca";
import { filtrar } from "@/lib/ui/busca";

/**
 * Só o que a grade precisa saber de uma figura.
 *
 * Não é `Figura` do acervo de propósito: aquele tipo carrega as alegações
 * inteiras, com enunciado, nota e lista de fontes, e mandá-lo para o cliente
 * empurraria alguns quilobytes de texto por país só para contar quantas são.
 * Aqui vai o que a tela mostra.
 */
export interface FiguraNaGrade {
  id: string;
  nome: string;
  /** Cargo mais recente, quando há — é o que distingue homônimos na busca. */
  cargo?: string;
  alegacoes: number;
}

/**
 * A ala de Figuras da central do país, com busca.
 *
 * A busca é do cliente, e não do servidor, porque o atlas é estático: não há
 * onde rodar consulta. A lista inteira do país já vem no HTML — filtrar no
 * navegador é instantâneo e funciona sem rede, o que num site de leitura vale
 * mais que qualquer índice.
 *
 * O componente é o primeiro consumidor do sistema de design (`components/design`)
 * e existe também como modelo: toda ala buscável de país novo — figuras hoje,
 * períodos e episódios quando crescerem — deve montar-se destas mesmas três
 * peças, em vez de reescrever cabeçalho e campo.
 */
export function GradeDeFiguras({ figuras }: { figuras: FiguraNaGrade[] }) {
  const [consulta, definirConsulta] = useState("");

  const visiveis = useMemo(
    // O cargo entra no que a busca varre: "presidente" acha quem governou sem
    // que seja preciso lembrar o nome.
    () => filtrar(figuras, consulta, (f) => `${f.nome} ${f.cargo ?? ""}`),
    [figuras, consulta]
  );

  const buscando = consulta.trim().length > 0;
  const substantivo = figuras.length === 1 ? "PESSOA" : "PESSOAS";

  return (
    <section id="figuras" className="scroll-mt-8">
      <CabecalhoDeSecao
        titulo="Figuras"
        contador={
          buscando
            ? `${visiveis.length} DE ${figuras.length} ${substantivo}`
            : `${figuras.length} ${substantivo}`
        }
        acao={
          <CampoDeBusca
            valor={consulta}
            aoMudar={definirConsulta}
            rotulo="Buscar figura por nome ou cargo"
            placeholder="Buscar figura…"
          />
        }
      />

      {visiveis.length === 0 ? (
        /*
         * O vazio da busca é diferente do vazio da seção: aqui há figuras, só
         * nenhuma com esse nome. Dizer isso, e repetir o termo digitado, é o
         * que separa "não achei" de "não tem".
         */
        <p
          role="status"
          className="rounded-lg border border-dashed border-zinc-800 p-6 text-sm leading-relaxed text-zinc-500"
        >
          Nenhuma figura com <span className="text-zinc-300">{consulta}</span> no
          nome ou no cargo. O país tem {figuras.length}{" "}
          {figuras.length === 1 ? "registrada" : "registradas"}.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visiveis.map((f) => (
            <li key={f.id}>
              <Link
                href={`/figura/${f.id}`}
                className="group flex h-full items-baseline justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-amber-500/30"
              >
                <span className="min-w-0">
                  <span className="block font-serif text-lg text-zinc-50 group-hover:text-amber-500/90">
                    {f.nome}
                  </span>
                  {f.cargo && (
                    <span className="mt-0.5 block font-mono text-[10px] tracking-wide text-zinc-600">
                      {f.cargo}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-600">
                  {f.alegacoes > 0
                    ? `${f.alegacoes} ALEGAÇÃO(ÕES)`
                    : "SEM ALEGAÇÕES"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
