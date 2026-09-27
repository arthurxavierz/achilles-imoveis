import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// O host do Supabase entra na lista de origens permitidas do next/image.
// Sem isto, o Next recusa otimizar as fotos dos imoveis.
const hostSupabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemplo.supabase.co').hostname;
  } catch {
    return 'exemplo.supabase.co';
  }
})();

/**
 * A foto de abertura da home, descoberta no build.
 *
 * A checagem era feita a cada requisicao com fs.existsSync, e no
 * Cloudflare Workers nao ha disco: o arquivo nunca era achado e a home
 * caia no skyline desenhado em CSS. No build o disco existe, entao a
 * resposta e calculada aqui e embutida no codigo. Uma
 * NEXT_PUBLIC_HERO_IMAGEM definida no ambiente continua tendo prioridade.
 */
const heroImagem = (() => {
  if (process.env.NEXT_PUBLIC_HERO_IMAGEM) return process.env.NEXT_PUBLIC_HERO_IMAGEM;
  const pasta = fileURLToPath(new URL('../../assets/site/', import.meta.url));
  const extensao = ['jpg', 'jpeg', 'webp', 'avif', 'png'].find((e) => fs.existsSync(`${pasta}hero.${e}`));
  return extensao ? `/assets/site/hero.${extensao}` : '';
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_HERO_IMAGEM: heroImagem,
  },

  // Os pacotes do monorepo sao TypeScript puro, sem passo de build proprio.
  // O Next compila junto com o site.
  transpilePackages: ['@imob/core', '@imob/db', '@imob/demo'],

  images: {
    remotePatterns: [{ protocol: 'https', hostname: hostSupabase, pathname: '/storage/v1/object/public/**' }],
    formats: ['image/avif', 'image/webp'],
  },

  // Nao entrega o numero da versao do Next para quem varre servidor.
  poweredByHeader: false,

  /**
   * No Windows, a geracao das paginas estaticas em processos paralelos
   * falha com "spawn UNKNOWN" quando o caminho do projeto tem espaco no
   * nome, que e o caso aqui ("agencia achilles"). Gerar em thread unica
   * resolve. O build fica alguns segundos mais lento e nada muda no
   * resultado. No Netlify, que roda em Linux, a variavel abaixo nao
   * existe e o build volta a usar todos os nucleos.
   */
  experimental: {
    workerThreads: false,
    cpus: process.platform === 'win32' ? 1 : undefined,
  },

  async headers() {
    return [
      {
        source: '/:caminho*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), interest-cohort=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
