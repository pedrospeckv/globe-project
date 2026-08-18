import type { MultiPolygon } from "geojson";
import desenhos from "./ilhas-geometria.json";

/**
 * O desenho das ilhas, para quando o mapa aproxima o bastante.
 *
 * ## Por que existe
 *
 * A ilha é registrada como PONTO, e num mapa-múndi isso é o correto: Fernando de
 * Noronha tem 18 km² e, num mapa de 1.472 px, ocupa 0,009 px² — polígono fiel é
 * invisível e polígono visível é falso. Foi a decisão de 2026-08-17, e ela estava
 * certa para o mapa que existia então.
 *
 * O zoom mudou a premissa. Com 8× de ampliação há espaço para a forma real, e aí
 * o ponto passa a ser omissão: o Pedro notou que as ilhas apareciam como "bola
 * azul" e não como ilha. A regra passa a ser a mesma da cor e do rótulo — a
 * entidade recebe forma quando há forma para ver, e marcador quando não há.
 *
 * ## Gerado, não escrito
 *
 * `scripts/gerar-geometria-ilhas.ts` extrai de `world-atlas`, que o projeto já
 * empacota. O CRITÉRIO de extração mora no conteúdo, em `Ilha.geometria`, porque
 * em arquipélago ele é decisão editorial: Tarawa é um anel de ilhotas e as
 * Malvinas são duas ilhas grandes mais setecentas pequenas, então "o polígono da
 * ilha" não existe — existe o conjunto que se decidiu chamar de Tarawa.
 *
 * As áreas resultantes conferem com as reais, e é essa conferência que pegou um
 * critério errado: Guadalcanal com raio de 100 km media 9.634 km² contra 5.302,
 * porque as ilhas vizinhas ficam mais perto do ponto que a ponta da própria ilha.
 */

export interface DesenhoDeIlha {
  /**
   * Área em graus², invariante à vista.
   *
   * Gravada em vez de medida por quadro: a equirretangular é linear em longitude
   * e latitude, então a área em pixels é `graus² × (π/180)² × escala²` — e varrer
   * geometria a cada quadro de arrasto é o que deixava o mapa lento.
   */
  areaPlana: number;
  geometria: MultiPolygon;
}

const DESENHOS = desenhos as unknown as Record<string, DesenhoDeIlha>;

/** O desenho de uma ilha, ou `undefined` se ela só tem ponto. */
export function desenhoDaIlha(id: string): DesenhoDeIlha | undefined {
  return DESENHOS[id];
}

/** Graus para radianos, que é a unidade em que a projeção mede. */
const RAD = Math.PI / 180;

/**
 * Área que a ilha ocupa na tela, em pixels². Exata para o mapa plano.
 */
export function areaDaIlhaNaTela(d: DesenhoDeIlha, escala: number): number {
  return d.areaPlana * RAD * RAD * escala * escala;
}

/**
 * Área a partir da qual vale desenhar a forma em vez do marcador.
 *
 * 6 px² é um borrão de 2,5 px de lado — abaixo disso a forma não informa nada que
 * o marcador não informe melhor, e some sem que o leitor saiba que havia algo ali.
 *
 * Medido no mapa de 1.472 px, o zoom em que cada ilha ganha forma:
 *
 * | ilha                       | zoom |
 * |----------------------------|------|
 * | Malvinas, Guadalcanal      | 1×   |
 * | Cabo Verde, Açores         | 1,2× |
 * | Okinawa                    | 1,9× |
 * | Madeira                    | 2,3× |
 * | Guam                       | 2,9× |
 * | Saipan, Santa Helena       | 6×   |
 * | Tristão da Cunha           | 7,1× |
 * | Chuuk, Tarawa, Iwo Jima    | 10–13× |
 * | Peleliu, Fernando de Noronha | 15–16× |
 * | Midway, Kwajalein          | 34× e 56× |
 *
 * Foi esta medição que fez o teto de zoom subir de 8× para 24×: com 8, sete ilhas
 * — inclusive Fernando de Noronha, a primeira que o Pedro pediu — nunca chegavam a
 * ter forma, e o recurso serviria a dez das dezessete.
 *
 * Midway e Kwajalein continuam marcador em qualquer zoom, e o motivo não é o
 * limite da tela: é o da BASE. São atóis de anel fino, e o 10m mapeia só 4 e 2 km²
 * deles — desenhar isso como "a ilha" seria pior que o marcador, que ao menos não
 * afirma forma.
 */
export const AREA_MINIMA_PARA_FORMA = 6;

/** Vale desenhar a forma desta ilha nesta escala? */
export function temFormaVisivel(
  d: DesenhoDeIlha | undefined,
  escala: number
): boolean {
  return d !== undefined && areaDaIlhaNaTela(d, escala) >= AREA_MINIMA_PARA_FORMA;
}
