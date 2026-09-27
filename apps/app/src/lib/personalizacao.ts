import { cookies } from 'next/headers';

import { COOKIE_MARCA, coresDaMarca, iniciais, lerPersonalizacao, modoDemo } from '@imob/demo';

/**
 * Personalização do modo apresentação no painel. Mesmo cookie do site:
 * em localhost ele vale para as duas portas.
 */
export async function personalizacao() {
  if (!modoDemo()) return { demo: false, nome: null, cor: null, iniciais: null, css: null };

  const dados = lerPersonalizacao((await cookies()).get(COOKIE_MARCA)?.value);
  const cores = dados?.cor ? coresDaMarca(dados.cor) : null;

  return {
    demo: true,
    nome: dados?.nome || null,
    cor: dados?.cor || null,
    iniciais: dados?.nome ? iniciais(dados.nome) : null,
    css: cores
      ? `:root{--ouro-500:${cores.base};--ouro-400:${cores.claro};--ouro-600:${cores.escuro};--ouro-700:${cores.escuro};--ouro-rgb:${cores.rgb}}`
      : null,
  };
}
