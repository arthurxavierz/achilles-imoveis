import type { MetadataRoute } from 'next';

import { SITE, ehDominioOficial } from '@/lib/site';

/**
 * Regras para robô de busca.
 *
 * A indexação só é liberada no domínio oficial. Qualquer outro endereço
 * — o `*.netlify.app` do deploy, um subdomínio provisório de
 * homologação, um preview de branch — sai bloqueado.
 *
 * O motivo é caro de descobrir depois: se o Google indexa a versão de
 * homologação, ela vira conteúdo duplicado competindo com o site real
 * pelos mesmos termos. Tirar do índice depois leva semanas, e no meio
 * do caminho os dois endereços dividem a mesma autoridade. Bloquear
 * desde o primeiro deploy custa uma linha.
 */
export default function robots(): MetadataRoute.Robots {
  if (!ehDominioOficial()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // A rota de formulario nao tem conteudo para indexar e nao deve
        // receber visita de robô.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
