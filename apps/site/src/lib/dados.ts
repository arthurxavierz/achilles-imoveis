import {
  buscarImoveis,
  listarCondominios,
  listarFacetas,
  type Facetas,
  type ResultadoBusca,
} from '@imob/db';
import type { CondominioComResumo, FiltroBusca } from '@imob/core';

import {
  buscarDemo,
  condominiosVitrine,
  facetasVitrine,
  semBanco,
} from './demonstracao';
import { supabase } from './supabase';

/**
 * Carregadores da vitrine.
 *
 * Cada um sabe fazer tres coisas: buscar no banco, buscar na
 * demonstracao e desistir em silencio. A desistencia importa mais do que
 * parece: nenhuma pagina do site pode cair porque uma consulta lateral
 * falhou. Sem o dado, o bloco correspondente some e o resto continua no
 * ar, que e o comportamento certo para uma vitrine.
 */

export const FACETAS_VAZIAS: Facetas = {
  bairros: [],
  cidades: [],
  tipos: [],
  condominios: [],
  faixaValor: [0, 0],
};

export const BUSCA_VAZIA: ResultadoBusca = {
  imoveis: [],
  total: 0,
  pagina: 1,
  porPagina: 12,
  totalPaginas: 1,
};

export async function carregarFacetas(): Promise<Facetas> {
  if (semBanco()) return facetasVitrine();

  try {
    return await listarFacetas(supabase());
  } catch (erro) {
    console.error('[vitrine] falha nas facetas:', erro);
    return FACETAS_VAZIAS;
  }
}

export async function carregarBusca(filtro: FiltroBusca): Promise<ResultadoBusca> {
  if (semBanco()) return buscarDemo(filtro);

  try {
    return await buscarImoveis(supabase(), filtro);
  } catch (erro) {
    console.error('[vitrine] falha na busca:', erro);
    return { ...BUSCA_VAZIA, porPagina: filtro.porPagina ?? 12 };
  }
}

export async function carregarCondominios(
  opcoes: { destaque?: boolean; luxo?: boolean; cidade?: string; limite?: number } = {},
): Promise<CondominioComResumo[]> {
  if (semBanco()) return condominiosVitrine(opcoes);

  try {
    return await listarCondominios(supabase(), opcoes);
  } catch (erro) {
    console.error('[vitrine] falha nos condomínios:', erro);
    return [];
  }
}
