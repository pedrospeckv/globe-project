/**
 * Os ícones das alas da central do país.
 *
 * Escritos à mão em SVG porque o projeto não tem `lucide-react` e a central
 * usa um punhado. Puxar uma biblioteca de mil ícones para gastar cinco,
 * num projeto cujas dependências cabem em nove linhas, custa mais do que
 * resolve. Traço de 1.5 e `currentColor` para herdarem a cor de quem os usa,
 * que é como os originais se comportam.
 */

const comum = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

export function IconePeriodos({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconeFiguras({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function IconeLivros({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

/** A moldura com a foto dentro — o episódio é o recorte ilustrado. */
export function IconeEpisodios({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

/**
 * A urna com a cédula marcada.
 *
 * Cédula com um visto, e não com um "X": a cruz lê como recusa ou como erro em
 * quase toda interface, e esta ala aponta para uma lista de pedidos de
 * registro em que nenhum foi indeferido.
 */
export function IconeEleicoes({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <rect x="3" y="10" width="18" height="10" rx="1.5" />
      <path d="M8 10V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v5" />
      <path d="M9.75 7l1.5 1.5 3-3" />
    </svg>
  );
}

/**
 * O mastro com a bandeira, e a linha do chão continuando dos dois lados.
 *
 * A bandeira sozinha diria "Estado", e é justamente isso que a nação não é
 * aqui. O chão que atravessa o mastro sem se interromper é o desenho do que a
 * ala contém: identidade que não corta o território de ninguém.
 */
export function IconeNacoes({ className }: { className?: string }) {
  return (
    <svg {...comum} className={className}>
      <path d="M7 21V4" />
      <path d="M7 4h9l-2 3.5L16 11H7" />
      <path d="M3 21h18" />
    </svg>
  );
}
