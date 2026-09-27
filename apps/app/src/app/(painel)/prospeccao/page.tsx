import type { Metadata } from 'next';

import { Prospeccao } from '@/componentes/prospeccao/Prospeccao';
import { exigirPermissao } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Prospecção' };
export const dynamic = 'force-dynamic';

/**
 * Prospecção ativa, atrás da permissão de leads.
 *
 * A tela não carrega nada no servidor: a busca só acontece quando
 * alguém digita um segmento e clica. É deliberado — cada consulta ao
 * Google Places é cobrada, e uma página que buscasse sozinha ao abrir
 * gastaria dinheiro toda vez que alguém passasse por ela sem querer.
 */
export default async function PaginaProspeccao() {
  const usuario = await exigirPermissao('leads');

  return <Prospeccao usuario={usuario} />;
}
