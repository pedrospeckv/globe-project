"use client";

import { useId, useRef } from "react";
import { IconeLimpar, IconeLupa } from "./Icones";

/**
 * O campo de busca do atlas: lupa à esquerda, texto no meio, botão de limpar
 * que só aparece quando há o que limpar.
 *
 * É controlado — quem o usa guarda a consulta e decide o que ela filtra. Um
 * campo que guardasse o próprio estado obrigaria a lista a adivinhá-lo, e o
 * contador do cabeçalho ("1 DE 3") não teria como acompanhar.
 *
 * Decisões que não são estéticas:
 *
 * - **`type="search"` com `autoComplete="off"`.** O tipo dá ao campo a
 *   semântica certa para leitor de tela e o teclado de busca no celular; o
 *   autocomplete desligado evita o navegador oferecer endereços e cartões
 *   salvos num campo que só procura nome de figura.
 * - **Rótulo de verdade, escondido.** `aria-label` sozinho não é lido por
 *   toda combinação de navegador e leitor; um `<label>` ligado por `id` é.
 *   Ele fica em `sr-only` porque a lupa já diz o que é para quem enxerga.
 * - **Escape limpa e mantém o foco.** É o gesto que quem digita espera, e
 *   sem ele a única saída é apagar caractere por caractere.
 * - **Nada de `autoFocus`.** A seção fica no meio da página; roubar o foco
 *   ao carregar jogaria a rolagem de quem chegou para ler o texto do topo.
 */
export function CampoDeBusca({
  valor,
  aoMudar,
  rotulo,
  placeholder,
  className,
}: {
  valor: string;
  aoMudar: (valor: string) => void;
  /** O que o campo procura, para quem usa leitor de tela. */
  rotulo: string;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);

  return (
    <div className={`relative ${className ?? ""}`}>
      <label htmlFor={id} className="sr-only">
        {rotulo}
      </label>

      <IconeLupa className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />

      <input
        ref={campo}
        id={id}
        type="search"
        autoComplete="off"
        spellCheck={false}
        value={valor}
        placeholder={placeholder}
        onChange={(e) => aoMudar(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            aoMudar("");
          }
        }}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-9 pr-9 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 hover:border-zinc-700 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 sm:w-64
          [&::-webkit-search-cancel-button]:appearance-none"
      />

      {valor && (
        <button
          type="button"
          onClick={() => {
            aoMudar("");
            campo.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 transition-colors hover:text-amber-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500/40"
        >
          <IconeLimpar className="h-3.5 w-3.5" />
          <span className="sr-only">Limpar busca</span>
        </button>
      )}
    </div>
  );
}
