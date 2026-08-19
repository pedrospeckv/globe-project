"use client";

import { useEffect, useRef } from "react";
import { Prosa } from "@/components/conteudo/Prosa";
import type { Alvos } from "@/lib/conteudo/ligacoes";
import type { Bloco } from "@/lib/conteudo/bloco";
import { paralaxeDe } from "@/lib/ui/paralaxe";

/**
 * Um bloco do episódio: data, título, prosa e a foto de época com paralaxe.
 *
 * O template da Segunda Guerra que serviu de referência **não** tem paralaxe —
 * o que ele faz é `scale(1.05)` no hover, que só acontece com o mouse parado
 * em cima. A sensação de a imagem se aproximar e se afastar conforme se rola a
 * página é outra coisa, e é ela que este componente implementa: a foto se
 * desloca dentro do recorte em ritmo diferente do texto, e a moldura cresce um
 * pouco quando o bloco passa pelo centro da tela.
 *
 * Três decisões que evitam os defeitos clássicos do efeito:
 *
 * - **Transform, nunca `background-position` nem `top`.** Só `transform` e
 *   `opacity` são compostos na GPU; qualquer outra propriedade reflui a página
 *   a cada quadro de rolagem.
 * - **Um `requestAnimationFrame` por quadro**, com trava. O evento de scroll
 *   dispara muito mais que 60 vezes por segundo, e sem a trava o trabalho é
 *   refeito à toa entre dois quadros.
 * - **`prefers-reduced-motion` desliga tudo.** Paralaxe é um dos gatilhos
 *   documentados de enjoo em movimento; quem pediu menos animação ao sistema
 *   recebe a página parada, com a foto centralizada.
 *
 * O primeiro render não escreve `style` nenhum, então o HTML do servidor e o
 * do cliente são iguais e a hidratação não reclama — a armadilha que já custou
 * depuração neste projeto.
 */
export function BlocoNarrado({
  bloco,
  alvos,
  rotulo,
}: {
  bloco: Bloco;
  alvos: Alvos;
  rotulo: string;
}) {
  const moldura = useRef<HTMLDivElement>(null);
  const foto = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const alvo = moldura.current;
    const img = foto.current;
    if (!alvo || !img) return;

    /*
     * `?.` porque `matchMedia` não existe em todo ambiente que roda este
     * componente — o jsdom dos testes é um deles. Ausente, a leitura correta
     * é "não há preferência declarada", e não derrubar a página inteira num
     * erro de efeito.
     */
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let pedido = 0;

    const posicionar = () => {
      pedido = 0;
      const r = alvo.getBoundingClientRect();
      const alturaTela = window.innerHeight || 1;

      // Fora da tela não há o que calcular — e ler `getBoundingClientRect` de
      // dez blocos por quadro é justamente o que faz este efeito custar caro.
      if (r.bottom < 0 || r.top > alturaTela) return;

      const { deslize, escala } = paralaxeDe({
        topo: r.top,
        altura: r.height,
        alturaDaTela: alturaTela,
        folga: img.offsetHeight - r.height,
      });

      img.style.transform = `translate3d(0, ${deslize.toFixed(2)}px, 0)`;
      alvo.style.transform = `scale(${escala.toFixed(4)})`;
    };

    const aoRolar = () => {
      if (pedido) return;
      pedido = requestAnimationFrame(posicionar);
    };

    posicionar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    window.addEventListener("resize", aoRolar, { passive: true });
    return () => {
      if (pedido) cancelAnimationFrame(pedido);
      window.removeEventListener("scroll", aoRolar);
      window.removeEventListener("resize", aoRolar);
    };
  }, []);

  return (
    <li className="group relative">
      <div className="absolute left-[-3px] top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-4 ring-amber-500/20 transition-transform duration-300 group-hover:scale-150 md:left-[117px]" />

      <div className="grid grid-cols-1 gap-4 pl-6 md:grid-cols-[120px_1fr] md:gap-10 md:pl-0">
        <div className="md:pr-10 md:text-right">
          <div className="font-mono text-base font-bold tracking-tight text-amber-500 md:text-lg">
            {rotulo}
          </div>
        </div>

        <div className="space-y-5">
          <h3 className="font-serif text-2xl leading-tight tracking-tight text-zinc-50 transition-colors duration-300 group-hover:text-amber-500/90 md:text-3xl">
            {bloco.titulo}
          </h3>

          <div className="max-w-2xl text-zinc-400">
            <Prosa texto={bloco.textoMdx} alvos={alvos} />
          </div>

          {bloco.imagem && (
            <figure className="space-y-2">
              <div
                ref={moldura}
                /*
                 * `will-change` avisa o compositor antes do primeiro quadro.
                 * Sem ele o navegador promove a camada só depois que o
                 * movimento começa, e o primeiro deslize sai serrilhado.
                 */
                className="relative aspect-[16/10] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 shadow-2xl shadow-black/40 transition-colors duration-500 will-change-transform group-hover:border-amber-500/30"
              >
                <img
                  ref={foto}
                  src={bloco.imagem.url}
                  alt={bloco.imagem.alt}
                  loading="lazy"
                  /*
                   * 128% de altura, ancorada no topo: é a folga que o deslize
                   * consome. Com 100% a paralaxe mostraria o fundo da moldura
                   * nas pontas do curso.
                   */
                  className="absolute inset-x-0 top-0 h-[128%] w-full object-cover will-change-transform"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/50 via-transparent to-transparent" />
              </div>

              <figcaption className="space-y-1">
                {bloco.imagem.legenda && (
                  <p className="text-xs leading-relaxed text-zinc-400">
                    {bloco.imagem.legenda}
                  </p>
                )}
                <p className="font-mono text-[10px] tracking-wide text-zinc-600">
                  {bloco.imagem.origem ? (
                    <a
                      href={bloco.imagem.origem}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-amber-500/70"
                    >
                      {bloco.imagem.credito}
                    </a>
                  ) : (
                    bloco.imagem.credito
                  )}
                  {" · "}
                  {bloco.imagem.licenca}
                </p>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </li>
  );
}
