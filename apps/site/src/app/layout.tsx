import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';

import { BarraProgresso } from '@/componentes/BarraProgresso';
import { Cabecalho } from '@/componentes/Cabecalho';
import { Rodape } from '@/componentes/Rodape';
import { BotaoWhatsApp } from '@/componentes/BotaoWhatsApp';
import { AvisoCookies } from '@/componentes/AvisoCookies';
import { ehDominioOficial, SITE } from '@/lib/site';
import { jsonLdImobiliaria } from '@/lib/seo';
import { personalizacao } from '@/lib/personalizacao';
import { PersonalizarMarca, ProvedorMarca } from '@/componentes/MarcaDemo';

import './globals.css';

/**
 * Uma familia so: Outfit, do peso 200 ao 700.
 *
 * A escolha vem do proprio simbolo da marca. O "B" da Achilles e
 * geometrico — circulos e retas, sem modulacao — e o logotipo por
 * extenso e uma sans geometrica. Uma serifada nos titulos brigava com
 * isso: a pagina dizia "editorial classico" no cabecalho e "moderno
 * geometrico" na assinatura, e nenhuma das duas vencia.
 *
 * O que estava aqui antes, Fraunces com Inter, tem outro problema: sao
 * o par que toda pagina gerada por IA usa. Quem ve muitas dessas
 * paginas reconhece na primeira olhada, e foi exatamente esse o
 * incomodo relatado.
 *
 * Sem serifada, a hierarquia passa a vir de peso, corpo e entreletra,
 * que e como marca de luxo moderna resolve: o titulo e leve e grande
 * com tracking negativo, o rotulo e pequeno e espacado. O contraste
 * entre esses dois extremos da a mesma tensao que a serifada dava, sem
 * a contradicao com o simbolo.
 */
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600', '700'],
  variable: '--f-marca',
  display: 'swap',
});

/**
 * metadataBase e o que faz as imagens de compartilhamento (Open Graph)
 * virarem URL absoluta. Sem ela, o WhatsApp e o Instagram nao conseguem
 * montar a previa do link do imovel.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.nome} | Imóveis de alto padrão em Uberlândia`,
    template: `%s | ${SITE.nomeCurto}`,
  },
  description: SITE.descricao,
  keywords: [
    'imóveis Uberlândia',
    'apartamento alto padrão Uberlândia',
    'casa em condomínio Uberlândia',
    'cobertura Uberlândia',
    'imobiliária Uberlândia',
    'lançamentos Uberlândia',
  ],
  authors: [{ name: SITE.nome }],
  creator: SITE.nome,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: SITE.url,
    siteName: SITE.nome,
    title: `${SITE.nome} | Imóveis de alto padrão em Uberlândia`,
    description: SITE.descricao,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.nome,
    description: SITE.descricao,
  },
  // Fora do domínio oficial o site inteiro sai como noindex. Ver o
  // comentário em robots.ts: staging indexado vira concorrente do
  // site real pelos mesmos termos.
  robots: ehDominioOficial()
    ? {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
      }
    : { index: false, follow: false, nocache: true },
  icons: { icon: '/assets/marca/favicon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#070707',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { css, ...marca } = await personalizacao();

  return (
    <html lang="pt-BR" className={outfit.variable}>
      <body data-demo={marca.demo || undefined}>
        {css &&<style dangerouslySetInnerHTML={{ __html: css }} />}
        <ProvedorMarca valor={marca}>
        {/* Identifica a imobiliaria para o Google. E o que habilita o
            painel de negocio local na busca e no Maps. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdImobiliaria()) }}
        />

        {/* Fica antes de tudo no DOM mas cobre tudo pelo z-index, e
            nao intercepta toque. Ver .grao no globals.css. */}
        <div className="grao" aria-hidden="true" />

        <BarraProgresso />
        <Cabecalho />
        <main>{children}</main>
        <Rodape />
        <BotaoWhatsApp />

        {/* Selo da marca no canto oposto ao WhatsApp. Leva ao topo, que
            e o gesto que a pessoa procura depois de rolar uma listagem
            longa, e mantem a assinatura presente sem ocupar conteudo. */}
        <a className="selo-flutuante" href="#" aria-label="Voltar ao topo">
          <i aria-hidden="true" />
        </a>

        <AvisoCookies />
        <PersonalizarMarca />
        </ProvedorMarca>
      </body>
    </html>
  );
}
