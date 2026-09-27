/**
 * URLs das fotos guardadas no Supabase Storage.
 *
 * O bucket "imoveis" e publico, entao a URL e direta e servida pelo CDN,
 * sem token e sem chamada de API. O redimensionamento fica por conta do
 * next/image: assim nao dependemos da transformacao de imagem do
 * Supabase, que e recurso de plano pago.
 */

import type { Foto } from '@imob/core';

function baseStorage(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL nao configurada.');
  return `${url.replace(/\/$/, '')}/storage/v1/object/public`;
}

/** Caminho no bucket -> URL publica servida pelo CDN. */
export function urlFoto(path: string | null | undefined, bucket = 'imoveis'): string | null {
  if (!path) return null;
  // Caminho absoluto do proprio site (acervo da demonstracao em /assets).
  if (path.startsWith('/') || path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${baseStorage()}/${bucket}/${path.replace(/^\/+/, '')}`;
}

/**
 * A foto de capa do imovel. Ordem de preferencia: a marcada como capa,
 * senao a primeira da ordenacao. Retorna null quando o imovel ainda nao
 * tem foto, e a interface cai no cartao gráfico (o "cover").
 */
export function urlCapa(fotos: Foto[] | undefined | null): string | null {
  if (!fotos?.length) return null;
  const capa = fotos.find((f) => f.capa) ?? fotos[0];
  return urlFoto(capa.path);
}

export function urlAvatar(path: string | null | undefined): string | null {
  return urlFoto(path, 'avatares');
}

/**
 * Caminho onde a foto de um imovel e gravada. Prefixar pelo id do imovel
 * mantem o bucket navegavel e faz o delete em cascata ser uma operacao de
 * pasta so.
 */
export function caminhoFoto(imovelId: string, nomeArquivo: string): string {
  const limpo = nomeArquivo
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${imovelId}/${Date.now()}-${limpo}`;
}
