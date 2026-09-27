import { criarClientePublico, type Cliente } from '@imob/db';

/**
 * Cliente do site publico.
 *
 * Roda no servidor durante a renderizacao das paginas, com a chave anon.
 * Nao ha sessao de usuario aqui: o visitante nao faz login no site. O
 * unico dado que este cliente alcanca e o que a policy de anon libera,
 * ou seja, imoveis publicados.
 *
 * Uma instancia so por processo, reaproveitada entre requisicoes.
 */
let cache: Cliente | null = null;

export function supabase(): Cliente {
  if (!cache) cache = criarClientePublico();
  return cache;
}
