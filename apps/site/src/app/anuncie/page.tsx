import type { Metadata } from 'next';

import { FormularioInteresse } from '@/componentes/FormularioInteresse';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Anuncie seu imóvel',
  description:
    'Avaliação gratuita, fotografia profissional, anúncio nos principais portais e relatório mensal de desempenho. Anuncie seu imóvel com a Achilles em Uberlândia.',
  alternates: { canonical: '/anuncie' },
};

const ETAPAS = [
  {
    numero: '01',
    titulo: 'Avaliação gratuita',
    texto:
      'Visitamos o imóvel e cruzamos o preço com transações reais da região nos últimos 12 meses. Você recebe uma faixa de valor com justificativa, não um chute.',
  },
  {
    numero: '02',
    titulo: 'Preparação do anúncio',
    texto:
      'Fotografia profissional, planta e descrição escrita para vender. Um imóvel bem fotografado recebe várias vezes mais contatos que o mesmo imóvel mal apresentado.',
  },
  {
    numero: '03',
    titulo: 'Exposição qualificada',
    texto:
      'Seu imóvel entra no nosso site, nos principais portais e na base de clientes que já procuram exatamente esse perfil.',
  },
  {
    numero: '04',
    titulo: 'Relatório mensal',
    texto:
      'Todo mês você recebe quantas pessoas viram, quantas visitaram e o que disseram. Sem relatório, o proprietário fica no escuro. Aqui não fica.',
  },
];

export default function PaginaAnuncie() {
  return (
    <div className="container pagina">
      <span className="rotulo">Para proprietários</span>
      <h1 className="titulo-2">
        Seu imóvel merece <em>a vitrine certa</em>.
      </h1>
      <p className="texto-apoio">
        Trabalhamos com um número limitado de imóveis por consultor. Isso significa atenção real ao
        seu, e não mais um anúncio perdido numa lista de mil.
      </p>

      <div className="duas-colunas" style={{ marginTop: 64 }}>
        <div>
          {ETAPAS.map((e) => (
            <section key={e.numero} style={{ marginBottom: 44 }}>
              <span className="rotulo">{e.numero}</span>
              <h2
                style={{
                  fontFamily: 'var(--fonte-titulo)',
                  fontSize: 26,
                  fontWeight: 400,
                  marginTop: 12,
                }}
              >
                {e.titulo}
              </h2>
              <p style={{ color: 'var(--grafite)', marginTop: 12, lineHeight: 1.75, maxWidth: '58ch' }}>
                {e.texto}
              </p>
            </section>
          ))}
        </div>

        <div className="painel-contato" style={{ position: 'sticky', top: 100 }}>
          <span className="rotulo">Avaliação sem compromisso</span>
          <p style={{ color: 'var(--grafite)', fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
            Conte onde fica o imóvel e o que você espera dele. Um consultor da {SITE.nomeCurto}{' '}
            retorna com a análise de valor.
          </p>
          <FormularioInteresse />
        </div>
      </div>
    </div>
  );
}
