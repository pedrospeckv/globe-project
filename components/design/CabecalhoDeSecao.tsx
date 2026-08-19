import type { ReactNode } from "react";

/**
 * O cabeçalho de seção do atlas: serifa grande, contador em mono amber, régua
 * embaixo.
 *
 * Estava copiado em dez lugares — central do país, dossiê de período, episódio
 * — com as mesmas classes escritas de novo a cada vez, e já tinha divergido em
 * dois deles. Aqui vira um objeto só, que é o que faz "país novo entra e sai
 * parecido com os outros" ser consequência do código em vez de disciplina.
 *
 * `acao` é o canto direito, alinhado à base do título: onde entra o campo de
 * busca das Figuras. Fica no cabeçalho, e não acima da lista, porque é ali que
 * quem procura olha primeiro — e porque assim toda seção buscável do atlas
 * ganha o campo no mesmo lugar.
 */
export function CabecalhoDeSecao({
  titulo,
  contador,
  acao,
  className,
}: {
  titulo: string;
  /** A linha em mono sob o título: "3 PESSOAS", "8 MOMENTOS · 8 IMAGENS". */
  contador?: ReactNode;
  /** Controle do canto direito — busca, filtro, link. */
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4 ${className ?? ""}`}
    >
      <div>
        <h2 className="font-serif text-3xl tracking-tight text-zinc-50 md:text-4xl">
          {titulo}
        </h2>
        {contador && (
          <p className="mt-1 font-mono text-xs tracking-widest text-amber-500/80">
            {contador}
          </p>
        )}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
