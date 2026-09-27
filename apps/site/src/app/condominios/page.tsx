import type { Metadata } from 'next';
import Link from 'next/link';

import { CartaoCondominio } from '@/componentes/CartaoCondominio';
import { Revelar } from '@/componentes/Revelar';
import { IconeBusca, IconeSeta } from '@/componentes/Icones';
import { carregarCondominios } from '@/lib/dados';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Condomínios de alto padrão em Uberlândia',
  description:
    'Conheça os condomínios e empreendimentos de alto padrão da carteira Achilles. ' +
    'Estrutura, lazer, unidades disponíveis e faixa de valor de cada endereço.',
  alternates: { canonical: '/condominios' },
};

export default async function PaginaCondominios({
  searchParams,
}: {
  searchParams: Promise<{ cidade?: string }>;
}) {
  const { cidade } = await searchParams;
  const condominios = await carregarCondominios({ cidade, limite: 120 });

  const luxo = condominios.filter((c) => c.luxo);
  const demais = condominios.filter((c) => !c.luxo);

  const cidades = [...new Set(condominios.map((c) => c.cidade))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );

  return (
    <div className="container pagina">
      <nav className="migalhas" aria-label="Você está em">
        <Link href="/">Início</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Condomínios</span>
      </nav>

      <div className="cabecalho-secao" style={{ marginTop: 18 }}>
        <div>
          <span className="rotulo">Onde a cidade quer morar</span>
          <h1 className="titulo-2" style={{ marginTop: 16 }}>
            Condomínios e empreendimentos
          </h1>
          <p className="texto-apoio" style={{ marginTop: 18 }}>
            Conhecemos a planta, o lazer, a taxa de condomínio e o histórico de negociação de cada
            um destes endereços. Escolha o condomínio e veja as unidades disponíveis nele.
          </p>
        </div>
      </div>

      {cidades.length > 1 && (
        <div className="fichas-filtro" style={{ marginBottom: 34 }}>
          <Link className="ficha-filtro" href="/condominios">
            Todas as cidades
          </Link>
          {cidades.map((c) => (
            <Link
              key={c}
              className="ficha-filtro"
              href={`/condominios?cidade=${encodeURIComponent(c)}`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {condominios.length === 0 ? (
        <div className="estado-vazio">
          <IconeBusca />
          <h2 className="titulo-3">Nenhum condomínio nesta seleção</h2>
          <p>
            Ainda não há empreendimento cadastrado para este recorte. Veja a carteira completa de
            imóveis ou fale com um consultor.
          </p>
          <Link className="btn btn-contorno" href="/imoveis" style={{ marginTop: 26 }}>
            Ver todos os imóveis
            <IconeSeta />
          </Link>
        </div>
      ) : (
        <>
          {luxo.length > 0 && (
            <section style={{ marginBottom: 64 }}>
              <h2 className="titulo-3" style={{ marginBottom: 24 }}>
                Alto padrão
              </h2>
              <div className="grade grade-4">
                {luxo.map((c, i) => (
                  <Revelar key={c.id} atraso={Math.min(i, 5) * 70}>
                    <CartaoCondominio condominio={c} prioridade={i < 4} />
                  </Revelar>
                ))}
              </div>
            </section>
          )}

          {demais.length > 0 && (
            <section>
              <h2 className="titulo-3" style={{ marginBottom: 24 }}>
                Outros empreendimentos
              </h2>
              <div className="grade grade-4">
                {demais.map((c, i) => (
                  <Revelar key={c.id} atraso={Math.min(i, 5) * 70}>
                    <CartaoCondominio condominio={c} />
                  </Revelar>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
