import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';

import { PersonalizarMarca, ProvedorMarca } from '@/componentes/MarcaDemo';
import { personalizacao } from '@/lib/personalizacao';

import './globals.css';

/**
 * A mesma Outfit do site publico.
 *
 * O painel e o site sao dois apps, mas uma marca so. Fontes diferentes
 * nos dois fariam o consultor sentir que trocou de empresa ao sair da
 * vitrine para a gestao — e o logotipo, que e desenhado nesta familia,
 * ficaria estranho sobre um texto de outra.
 */
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--f-marca',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Achilles Gestão',
    template: '%s | Achilles Gestão',
  },
  description: 'Sistema de gestão da Achilles Imóveis.',
  // Sistema interno nao entra em buscador em hipotese nenhuma.
  robots: { index: false, follow: false, nocache: true },
  icons: { icon: '/assets/marca/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#0c2340',
  width: 'device-width',
  initialScale: 1,
  // O painel e usado muito no celular. Travar a escala em 1 evita o
  // zoom acidental de dois dedos no meio de um formulario, mas
  // maximumScale fica em 5 para nao impedir quem precisa ampliar.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { css, ...marca } = await personalizacao();

  return (
    <html lang="pt-BR" className={outfit.variable}>
      <body>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <ProvedorMarca valor={marca}>
          {children}
          <PersonalizarMarca />
        </ProvedorMarca>
      </body>
    </html>
  );
}
