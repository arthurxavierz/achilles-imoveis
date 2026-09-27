import { NextResponse } from 'next/server';

import { buscarImoveisPorIds } from '@imob/db';

import { imoveisPorIds, semBanco } from '@/lib/demonstracao';
import { supabase } from '@/lib/supabase';

/**
 * Busca imoveis por id.
 *
 * Existe para a pagina de salvos: a lista de favoritos vive no navegador
 * do visitante, entao o servidor nao tem como saber, na renderizacao,
 * quais imoveis buscar. A pagina carrega, le o localStorage e pede estes
 * aqui.
 *
 * Usa o cliente publico, com a chave anon. Mesmo que alguem chame a rota
 * com o id de um imovel nao publicado, a view da vitrine simplesmente
 * nao devolve a linha.
 */
export const revalidate = 60;

const LIMITE = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const bruto = searchParams.get('ids') ?? '';

  const ids = bruto
    .split(',')
    .map((s) => s.trim())
    // Somente UUID passa. Barra qualquer texto solto antes de virar
    // consulta ao banco.
    .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))
    .slice(0, LIMITE);

  if (ids.length === 0) {
    return NextResponse.json({ imoveis: [] });
  }

  if (semBanco()) {
    return NextResponse.json({ imoveis: imoveisPorIds(ids) });
  }

  try {
    const imoveis = await buscarImoveisPorIds(supabase(), ids);
    return NextResponse.json({ imoveis });
  } catch (erro) {
    console.error('[api/imoveis] falha ao buscar por ids:', erro);
    return NextResponse.json({ erro: 'Não foi possível carregar os imóveis.' }, { status: 500 });
  }
}
