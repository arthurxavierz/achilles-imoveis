import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buscarCondominioPorSlug } from '@imob/db';
import type { CondominioComResumo } from '@imob/core';
import { brl, brlCurto } from '@imob/core';

import { CartaoImovel } from '@/componentes/CartaoImovel';
import { FormularioInteresse } from '@/componentes/FormularioInteresse';
import { Revelar } from '@/componentes/Revelar';
import {
  IconeCheck,
  IconeEstrela,
  IconeLocal,
  IconeSeta,
  IconeWhatsApp,
} from '@/componentes/Icones';
import { carregarBusca } from '@/lib/dados';
import { condominioPorSlug, semBanco } from '@/lib/demonstracao';
import { SITE, linkWhatsApp } from '@/lib/site';
import { jsonLdMigalhas } from '@/lib/seo';
import { supabase } from '@/lib/supabase';

export const revalidate = 300;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const condominio = await carregar(slug);

  if (!condominio) {
    return { title: 'Condomínio não encontrado', robots: { index: false, follow: true } };
  }

  const titulo =
    condominio.meta_titulo ?? `${condominio.nome}, ${condominio.bairro ?? condominio.cidade}`;

  return {
    title: titulo,
    description:
      condominio.meta_descricao ??
      `${condominio.nome} em ${condominio.cidade}. Estrutura, lazer e unidades disponíveis na carteira da ${SITE.nomeCurto}.`,
    alternates: { canonical: `/condominio/${condominio.slug}` },
  };
}

export default async function PaginaCondominio({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const condominio = await carregar(slug);
  if (!condominio) notFound();

  const unidades = await carregarBusca({
    condominio: condominio.nome,
    porPagina: 24,
    ordem: 'menor_preco',
  });

  const mensagem = linkWhatsApp(
    `Olá! Gostaria de saber mais sobre o ${condominio.nome}, em ${condominio.cidade}.`,
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdMigalhas([
              { nome: 'Início', href: '/' },
              { nome: 'Condomínios', href: '/condominios' },
              { nome: condominio.nome, href: `/condominio/${condominio.slug}` },
            ]),
          ),
        }}
      />

      <div className="container pagina" style={{ paddingBottom: 40 }}>
        <nav className="migalhas" aria-label="Você está aqui">
          <Link href="/">Início</Link>
          <span aria-hidden="true">/</span>
          <Link href="/condominios">Condomínios</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{condominio.nome}</span>
        </nav>

        <div className="imovel-cabecalho" style={{ marginTop: 18 }}>
          <div>
            <span className="rotulo">
              {condominio.luxo ? 'Alto padrão' : 'Empreendimento'}
              {condominio.construtora ? ` · ${condominio.construtora}` : ''}
            </span>
            <h1 className="imovel-titulo">{condominio.nome}</h1>
            <p className="imovel-local">
              <IconeLocal />
              {condominio.bairro ? `${condominio.bairro}, ` : ''}
              {condominio.cidade} - {condominio.uf}
            </p>
          </div>

          <a
            className="btn btn-zap"
            href={mensagem}
            target="_blank"
            rel="noopener noreferrer"
          >
            <IconeWhatsApp />
            Falar sobre este condomínio
          </a>
        </div>

        <div className="imovel-corpo">
          <div>
            <Revelar>
              <section className="imovel-bloco">
                <div className="ficha-tecnica">
                  <div className="ficha-item">
                    <IconeEstrela />
                    <strong>{condominio.total_imoveis}</strong>
                    <span>
                      {condominio.total_imoveis === 1 ? 'unidade' : 'unidades'} na carteira
                    </span>
                  </div>

                  {condominio.menor_valor > 0 && (
                    <div className="ficha-item">
                      <IconeCheck />
                      <strong>{brlCurto(condominio.menor_valor)}</strong>
                      <span>a partir de</span>
                    </div>
                  )}

                  {condominio.maior_valor > 0 && (
                    <div className="ficha-item">
                      <IconeCheck />
                      <strong>{brlCurto(condominio.maior_valor)}</strong>
                      <span>maior valor</span>
                    </div>
                  )}

                  {condominio.ano_entrega && (
                    <div className="ficha-item">
                      <IconeCheck />
                      <strong>{condominio.ano_entrega}</strong>
                      <span>entrega</span>
                    </div>
                  )}
                </div>
              </section>
            </Revelar>

            {condominio.descricao && (
              <Revelar>
                <section className="imovel-bloco">
                  <h2>Sobre o empreendimento</h2>
                  <p className="imovel-descricao">{condominio.descricao}</p>
                </section>
              </Revelar>
            )}

            {condominio.lazer.length > 0 && (
              <Revelar>
                <section className="imovel-bloco">
                  <h2>Estrutura e lazer</h2>
                  <ul className="lista-marcada">
                    {condominio.lazer.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              </Revelar>
            )}
          </div>

          <aside className="painel-interesse">
            <div className="painel-preco">
              <span className="rotulo-preco">Unidades disponíveis</span>
              <span className="valor">
                {condominio.menor_valor > 0 ? (
                  <>
                    {brl(condominio.menor_valor)}
                    <small> a partir de</small>
                  </>
                ) : (
                  <small>Sob consulta</small>
                )}
              </span>
            </div>

            <div className="painel-corpo">
              <a className="btn btn-zap btn-bloco" href={mensagem} target="_blank" rel="noopener noreferrer">
                <IconeWhatsApp />
                Tenho interesse
              </a>

              <FormularioInteresse
                comAbas
                imovelTitulo={condominio.nome}
                imovelCodigo={condominio.slug}
              />
            </div>

            <div className="painel-consultor">
              <span className="consultor-avatar" aria-hidden="true">
                B
              </span>
              <span>
                <strong>Equipe {SITE.nomeCurto}</strong>
                <span>{SITE.creci}</span>
              </span>
            </div>
          </aside>
        </div>
      </div>

      <section className="secao secao-carvao">
        <div className="container">
          <Revelar>
            <div className="cabecalho-secao">
              <div>
                <span className="rotulo">No {condominio.nome}</span>
                <h2 className="titulo-2">
                  {unidades.total > 0
                    ? `${unidades.total} ${unidades.total === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}`
                    : 'Nenhuma unidade na vitrine agora'}
                </h2>
              </div>
              <Link className="link-seta" href="/imoveis">
                Ver toda a carteira
                <IconeSeta />
              </Link>
            </div>
          </Revelar>

          {unidades.imoveis.length === 0 ? (
            <p className="texto-apoio">
              Boa parte das unidades de alto padrão é negociada com discrição e não aparece na
              vitrine. Fale com um consultor: costumamos ter opção neste endereço mesmo quando o
              site não mostra.
            </p>
          ) : (
            <div className="grade grade-4">
              {unidades.imoveis.map((imovel, i) => (
                <Revelar key={imovel.id} atraso={Math.min(i, 5) * 70}>
                  <CartaoImovel imovel={imovel} prioridade={i < 4} />
                </Revelar>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

async function carregar(slug: string): Promise<CondominioComResumo | null> {
  if (semBanco()) return condominioPorSlug(slug);

  try {
    return await buscarCondominioPorSlug(supabase(), slug);
  } catch (erro) {
    console.error('[condomínio] falha ao carregar', slug, erro);
    return null;
  }
}
