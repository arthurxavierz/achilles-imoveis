import type { Metadata } from 'next';
import Link from 'next/link';

import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Sobre a Achilles',
  description: `${SITE.nome}: curadoria de imóveis de alto padrão em Uberlândia, com atendimento consultivo e transparência em cada etapa.`,
  alternates: { canonical: '/sobre' },
};

export default function PaginaSobre() {
  return (
    <div className="container pagina">
      <span className="rotulo">Quem somos</span>
      <h1 className="titulo-2">
        Imóveis que elevam seu <em>patrimônio</em>.
      </h1>

      <div className="prosa" style={{ marginTop: 48 }}>
        <p>
          A {SITE.nome} nasceu em Uberlândia com uma convicção simples: comprar um imóvel de alto
          padrão é uma das maiores decisões financeiras de uma vida, e merece mais do que um
          catálogo e um vendedor apressado.
        </p>

        <h2>Como trabalhamos</h2>
        <p>
          Cada imóvel da nossa carteira passa por visita presencial, checagem de documentação e
          análise de preço frente ao histórico da região. O que não passa nesse filtro não entra na
          vitrine, mesmo que o proprietário insista.
        </p>
        <p>
          Nossos consultores trabalham com um número limitado de imóveis. Não é modéstia: é o que
          permite que quem atende você conheça o condomínio, a planta, a incidência de sol e o
          histórico de negociação daquele endereço específico.
        </p>

        <h2>Transparência no número</h2>
        <p>
          Valor de condomínio, IPTU e custo mensal aparecem na ficha do imóvel, antes de você
          perguntar. Preferimos perder uma visita a perder a confiança de um cliente na reta final.
        </p>

        <h2>Tecnologia a serviço do atendimento</h2>
        <p>
          Nosso sistema de gestão acompanha cada contato, cada visita e cada proposta. Na prática,
          isso significa que você não repete sua história a cada ligação, e que o proprietário
          recebe todo mês um relatório real do desempenho do imóvel.
        </p>

        <h3>Registro profissional</h3>
        <p>{SITE.creci}</p>

        <p style={{ marginTop: 40 }}>
          <Link className="btn btn-ouro" href="/imoveis">
            Conhecer a carteira
          </Link>
        </p>
      </div>
    </div>
  );
}
