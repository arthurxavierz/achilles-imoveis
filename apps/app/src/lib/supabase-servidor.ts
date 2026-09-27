import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Cliente Supabase do lado do servidor.
 *
 * A sessao viaja em cookie, e nao em localStorage, porque as paginas
 * deste app sao renderizadas no servidor: o servidor precisa saber quem
 * e a pessoa antes de montar o HTML. Cookie httpOnly tambem e mais
 * seguro, ja que script injetado na pagina nao consegue ler o token.
 *
 * Cada requisicao cria a propria instancia, de proposito. Reaproveitar
 * um cliente entre requisicoes num servidor misturaria a sessao de um
 * corretor com a de outro, que e a pior falha possivel num sistema com
 * carteira separada por pessoa.
 */
export async function supabaseServidor() {
  const armazem = await cookies();

  /**
   * Sem banco configurado, o painel roda em demonstração e nenhuma
   * consulta chega até aqui: cada página desvia para os dados simulados
   * antes de usar o cliente. Ele ainda é construído porque as páginas o
   * criam no topo da função, antes de decidir o caminho. Estes valores
   * de fachada só existem para a construção não estourar; qualquer
   * requisição feita com eles falharia, e é isso que queremos, já que
   * seria sinal de um desvio esquecido.
   */
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://demonstracao.invalido';
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'demonstracao';

  return createServerClient(
    url,
    chave,
    {
      cookies: {
        getAll() {
          return armazem.getAll();
        },
        setAll(paraGravar: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of paraGravar) {
              armazem.set(name, value, options);
            }
          } catch {
            // Server Component nao pode gravar cookie. Quem renova a
            // sessao e o middleware, entao ignorar aqui e o
            // comportamento correto, nao um remendo.
          }
        },
      },
    },
  );
}
