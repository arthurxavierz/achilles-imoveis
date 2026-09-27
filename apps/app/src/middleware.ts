import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Renovacao da sessao a cada navegacao.
 *
 * O token do Supabase expira em uma hora. Sem este middleware, o corretor
 * que deixa o sistema aberto a manha inteira e derrubado no meio do
 * trabalho. Aqui o token e renovado em silencio e o cookie novo segue na
 * resposta.
 *
 * O middleware tambem barra o acesso antes da pagina existir: quem nao
 * esta logado nem chega a carregar o painel, o que evita o piscar de uma
 * tela vazia antes do redirecionamento.
 */
export async function middleware(req: NextRequest) {
  // Em demonstração não há autenticação: a tela de entrada não teria
  // contra o que validar. O painel abre direto.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    if (req.nextUrl.pathname.startsWith('/entrar')) {
      const destino = req.nextUrl.clone();
      destino.pathname = '/';
      destino.search = '';
      return NextResponse.redirect(destino);
    }
    return NextResponse.next({ request: req });
  }

  let resposta = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(paraGravar: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of paraGravar) {
            req.cookies.set(name, value);
          }
          resposta = NextResponse.next({ request: req });
          for (const { name, value, options } of paraGravar) {
            resposta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const caminho = req.nextUrl.pathname;
  const paginaPublica = caminho.startsWith('/entrar') || caminho.startsWith('/recuperar');

  if (!user && !paginaPublica) {
    const destino = req.nextUrl.clone();
    destino.pathname = '/entrar';
    // Guarda onde a pessoa queria chegar. Depois de entrar, ela volta
    // para la em vez de cair sempre no painel inicial.
    if (caminho !== '/') destino.searchParams.set('proximo', caminho);
    return NextResponse.redirect(destino);
  }

  if (user && paginaPublica) {
    const destino = req.nextUrl.clone();
    destino.pathname = '/';
    destino.search = '';
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  matcher: [
    /*
     * Tudo, menos o que nao depende de sessao:
     * arquivos internos do Next, favicon e imagens.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
