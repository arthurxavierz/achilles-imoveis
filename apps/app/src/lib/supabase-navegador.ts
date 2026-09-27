'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente do navegador, para as telas que gravam sem recarregar a
 * pagina: arrastar um lead no funil, marcar um compromisso, dar baixa
 * numa parcela.
 *
 * Usa a chave anon e carrega a sessao do mesmo cookie que o servidor
 * escreveu. Toda regra de quem ve o que continua sendo do RLS: este
 * cliente nao tem poder nenhum alem do que o banco concede ao usuario
 * logado.
 *
 * Uma instancia por aba, guardada em modulo. Criar um cliente por
 * componente abriria varias conexoes de tempo real para o mesmo usuario.
 */
let instancia: SupabaseClient | null = null;

export function supabaseNavegador(): SupabaseClient {
  if (!instancia) {
    instancia = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return instancia;
}
