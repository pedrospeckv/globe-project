import type { Imagem } from "@/lib/conteudo/imagem";

/**
 * A moldura de imagem do memorial: 16/10, borda que acende em amber no hover,
 * e a foto crescendo devagar por dentro do recorte.
 *
 * O que o template original não tem e aqui é obrigatório: crédito e licença
 * embaixo. Publicar imagem sob CC BY-SA sem atribuir é violar a licença, e
 * `Imagem` recusa os dois campos vazios justamente para que a legenda não
 * dependa de alguém lembrar.
 *
 * `<img>` e não `next/image` porque `next.config.ts` não declara
 * `remotePatterns` para upload.wikimedia.org.
 */
/**
 * `anteriorAFotografia` liga a ressalva de período pré-fotográfico.
 *
 * É prop e não cálculo interno porque a moldura não sabe que período ilustra
 * — ela recebe uma `Imagem` solta, e a mesma moldura serve período de país e
 * bloco de episódio, que datam de formas diferentes. Quem sabe a data é quem
 * chama.
 */
export function FotoHistorica({
  imagem,
  anteriorAFotografia = false,
}: {
  imagem: Imagem;
  anteriorAFotografia?: boolean;
}) {
  return (
    <figure className="group/foto space-y-2">
      <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all duration-500 group-hover/foto:border-amber-500/30 group-hover/foto:shadow-2xl group-hover/foto:shadow-amber-500/10">
        <div className="relative aspect-[16/10]">
          <img
            src={imagem.url}
            alt={imagem.alt}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover/foto:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 to-transparent opacity-0 transition-opacity duration-500 group-hover/foto:opacity-100" />
        </div>
      </div>

      <figcaption className="space-y-1">
        {imagem.legenda && (
          <p className="text-xs leading-relaxed text-zinc-400">{imagem.legenda}</p>
        )}
        <p className="font-mono text-[10px] tracking-wide text-zinc-600">
          {imagem.origem ? (
            <a
              href={imagem.origem}
              target="_blank"
              rel="noreferrer"
              className="hover:text-amber-500/70"
            >
              {imagem.credito}
            </a>
          ) : (
            imagem.credito
          )}
          {" · "}
          {imagem.licenca}
        </p>

        {/*
          A quarta limitação declarada do atlas, e ela aparece só onde é
          verdadeira. As outras três moram no mapa porque falam de fronteira;
          esta mora aqui porque fala da imagem, e o leitor que precisa dela é
          o que está olhando uma foto nítida de um prédio sob um texto sobre
          o século XIV.
        */}
        {anteriorAFotografia && (
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Período anterior à fotografia: a peça é de época, mas a imagem dela
            é de hoje. Onde a peça é um objeto — moeda, manuscrito, escultura —,
            a fotografia é só o meio de olhá-la; onde é um edifício ainda de pé,
            ela mostra o prédio como está agora, com restauros e entorno que o
            período não tinha.
          </p>
        )}
      </figcaption>
    </figure>
  );
}
