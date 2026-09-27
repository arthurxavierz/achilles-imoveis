/** @type {import('next').NextConfig} */

const hostSupabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://exemplo.supabase.co').hostname;
  } catch {
    return 'exemplo.supabase.co';
  }
})();

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@imob/core', '@imob/db', '@imob/demo'],
  poweredByHeader: false,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: hostSupabase, pathname: '/storage/v1/object/public/**' },
    ],
  },

  // Mesmo contorno do site: no Windows a geracao paralela quebra quando
  // o caminho do projeto tem espaco no nome.
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
          // O painel nunca deve ser embutido em iframe de outro site:
          // e a defesa contra alguem sobrepor botoes invisiveis sobre a
          // tela de um corretor logado.
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Sistema interno nao tem por que aparecer em buscador.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
