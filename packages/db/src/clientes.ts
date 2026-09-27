/**
 * Fabricas de cliente Supabase.
 *
 * Existem duas chaves e a diferenca entre elas e a linha que separa um
 * sistema seguro de um vazamento:
 *
 *   anon         -> pode ir para o navegador. So faz o que o RLS permite.
 *   service_role -> chave mestra, ignora RLS. NUNCA sai do servidor.
 *
 * Por isso criarClienteAdmin() derruba o processo se for chamada em
 * qualquer lugar onde exista window. E melhor quebrar o build do que
 * publicar a chave mestra num bundle de JavaScript.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Cliente = SupabaseClient;

function exigir(valor: string | undefined, nome: string): string {
  if (!valor) {
    throw new Error(
      `Variavel de ambiente ausente: ${nome}. ` +
        'Preencha o .env local ou as variaveis do site no Netlify.',
    );
  }
  return valor;
}

/**
 * Cliente publico, com a chave anon. Usado pelo site (leitura da vitrine)
 * e pelo app no navegador. Sem sessao: serve para dados publicos.
 */
export function criarClientePublico(url?: string, anonKey?: string): Cliente {
  return createClient(
    exigir(url ?? process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'),
    exigir(anonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-achilles-origem': 'site' } },
    },
  );
}

/**
 * Cliente administrativo, com a service_role. Ignora RLS por completo.
 * Use apenas dentro de Netlify Functions e rotas de servidor, e apenas
 * quando a operacao realmente precisar passar por cima das policies
 * (gravar lead vindo do formulario publico, webhook do WhatsApp).
 */
export function criarClienteAdmin(url?: string, serviceKey?: string): Cliente {
  if (typeof window !== 'undefined') {
    throw new Error(
      'criarClienteAdmin() foi chamada no navegador. A chave service_role ' +
        'nunca pode chegar ao cliente. Mova esta chamada para uma funcao de servidor.',
    );
  }

  return createClient(
    exigir(process.env.SUPABASE_URL ?? url ?? process.env.NEXT_PUBLIC_SUPABASE_URL, 'SUPABASE_URL'),
    exigir(serviceKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-achilles-origem': 'servidor' } },
    },
  );
}
