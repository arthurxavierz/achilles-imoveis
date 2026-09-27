import { cookies } from 'next/headers';

import { COOKIE_MARCA, coresDaMarca, iniciais, lerPersonalizacao } from '@imob/demo';

import { semBanco } from './demonstracao';

/**
 * Personalização do modo apresentação, lida no servidor.
 *
 * Só consulta o cookie quando o site roda sem banco. Em produção a
 * função devolve null sem tocar em cookies(), o que também preserva a
 * geração estática das páginas.
 */
export async function personalizacao() {
  if (!semBanco()) return { demo: false, nome: null, cor: null, iniciais: null, css: null };

  const dados = lerPersonalizacao((await cookies()).get(COOKIE_MARCA)?.value);
  const cores = dados?.cor ? coresDaMarca(dados.cor) : null;

  return {
    demo: true,
    nome: dados?.nome || null,
    cor: dados?.cor || null,
    iniciais: dados?.nome ? iniciais(dados.nome) : null,
    css: cores
      ? `:root{--ouro:${cores.base};--ouro-claro:${cores.claro};--ouro-escuro:${cores.escuro};--ouro-rgb:${cores.rgb};--ouro-fundo:rgba(${cores.rgb},.12);--ouro-borda:rgba(${cores.rgb},.32)}`
      : null,
  };
}
