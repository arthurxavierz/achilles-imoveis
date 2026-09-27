import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { buscarImovelPorSlug, buscarSemelhantes, listarSlugsPublicados, urlCapa } from '@imob/db';
import type { ImovelPublico } from '@imob/core';
import {
  area as fmtArea,
  brl,
  custoMensal,
  ehRural,
  enderecoPublico,
  numero,
  precoVigente,
  slugify,
} from '@imob/core';

import { AcoesImovel } from '@/componentes/AcoesImovel';
import { BarraMovel } from '@/componentes/BarraMovel';
import { CartaoImovel } from '@/componentes/CartaoImovel';
import { FormularioInteresse } from '@/componentes/FormularioInteresse';
import { GaleriaImovel } from '@/componentes/GaleriaImovel';
import { Revelar } from '@/componentes/Revelar';
import { SimuladorFinanciamento } from '@/componentes/SimuladorFinanciamento';
import {
  IconeArea,
  IconeBanheiro,
  IconeFolha,
  IconeLocal,
  IconePredio,
  IconeQuarto,
  IconeSeta,
  IconeSuite,
  IconeVaga,
  IconeWhatsApp,
} from '@/componentes/Icones';
import { imovelPorSlug, semBanco, semelhantesVitrine, slugsPublicados } from '@/lib/demonstracao';
import { SITE, linkWhatsApp } from '@/lib/site';
import { jsonLdImovel, jsonLdMigalhas } from '@/lib/seo';
import { supabase } from '@/lib/supabase';

export const revalidate = 300;
/** Imovel publicado depois do build e gerado na primeira visita. */
export const dynamicParams = true;

export async function generateStaticParams() {
  if (semBanco()) return slugsPublicados().map((i) => ({ slug: i.slug }));

  try {
    const slugs = await listarSlugsPublicados(supabase());
    // Só os 200 mais recentes entram no build. Com quase mil imóveis, o
    // resto é gerado na primeira visita e fica em cache, o que evita um
    // build de vinte minutos a cada publicação.
    return slugs.slice(0, 200).map((s) => ({ slug: s.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const imovel = await carregar(slug);

  if (!imovel) {
    return { title: 'Imóvel não encontrado', robots: { index: false, follow: true } };
  }

  const { valor } = precoVigente(imovel);
  const titulo =
    imovel.meta_titulo ?? `${imovel.titulo}, ${imovel.bairro ?? imovel.cidade}, ${brl(valor)}`;

  const descricao =
    imovel.meta_descricao ??
    `${imovel.tipo} com ${imovel.quartos} quartos e ${fmtArea(imovel.area_util)} em ${
      imovel.bairro ?? imovel.cidade
    }, ${imovel.cidade}. ${brl(valor)}. Código ${imovel.codigo}.`;

  const foto = urlCapa(imovel.fotos);

  return {
    title: titulo,
    description: descricao.slice(0, 160),
    alternates: { canonical: `/imovel/${imovel.slug}` },
    openGraph: {
      type: 'website',
      title: titulo,
      description: descricao.slice(0, 200),
      url: `${SITE.url}/imovel/${imovel.slug}`,
      ...(foto ? { images: [{ url: foto, width: 1200, height: 630, alt: imovel.titulo }] } : {}),
    },
    // Imovel vendido sai do indice, mas os links continuam sendo
    // seguidos. Nao adianta ranquear o que nao esta mais a venda.
    robots:
      imovel.status === 'disponivel' || imovel.status === 'reservado'
        ? { index: true, follow: true }
        : { index: false, follow: true },
  };
}

export default async function PaginaImovel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const imovel = await carregar(slug);
  if (!imovel) notFound();

  const semelhantes = await carregarSemelhantes(imovel);
  const { valor, sufixo } = precoVigente(imovel);
  const mensal = custoMensal(imovel);
  const rural = ehRural(imovel.tipo);
  const hectares = Number(imovel.hectares ?? 0);

  const mensagemWhats = linkWhatsApp(
    `Olá! Tenho interesse no imóvel ${imovel.referencia_externa ?? imovel.codigo}, ${imovel.titulo}. ${SITE.url}/imovel/${imovel.slug}`,
  );

  return (
    <div className="com-barra-movel">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdImovel(imovel)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            jsonLdMigalhas([
              { nome: 'Início', href: '/' },
              { nome: 'Imóveis', href: '/imoveis' },
              { nome: imovel.titulo, href: `/imovel/${imovel.slug}` },
            ]),
          ),
        }}
      />

      <div className="container imovel-topo">
        <nav className="migalhas" aria-label="Você está aqui">
          <Link href="/">Início</Link>
          <span aria-hidden="true">/</span>
          <Link href="/imoveis">Imóveis</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/imoveis?cidade=${encodeURIComponent(imovel.cidade)}`}>{imovel.cidade}</Link>
          {imovel.bairro && (
            <>
              <span aria-hidden="true">/</span>
              <Link href={`/imoveis?bairro=${encodeURIComponent(imovel.bairro)}`}>
                {imovel.bairro}
              </Link>
            </>
          )}
          <span aria-hidden="true">/</span>
          <span aria-current="page">{imovel.referencia_externa ?? imovel.codigo}</span>
        </nav>

        <div className="imovel-cabecalho">
          <div>
            <span className="rotulo">
              {imovel.tipo} · {imovel.finalidade === 'locacao' ? 'Locação' : 'Venda'}
            </span>
            <h1 className="imovel-titulo">{imovel.titulo}</h1>
            <p className="imovel-local">
              <IconeLocal />
              {enderecoPublico(imovel)}
            </p>
          </div>

          <AcoesImovel imovelId={imovel.id} titulo={imovel.titulo} codigo={imovel.codigo} />
        </div>

        <Revelar>
          <GaleriaImovel imovel={imovel} />
        </Revelar>

        <div className="imovel-corpo">
          <div>
            <Revelar>
              <section className="imovel-bloco">
                <div className="ficha-tecnica">
                  {imovel.quartos > 0 && (
                    <ItemFicha icone={<IconeQuarto />} valor={imovel.quartos} rotulo="Quartos" />
                  )}
                  {imovel.suites > 0 && (
                    <ItemFicha icone={<IconeSuite />} valor={imovel.suites} rotulo="Suítes" />
                  )}
                  {imovel.banheiros > 0 && (
                    <ItemFicha
                      icone={<IconeBanheiro />}
                      valor={imovel.banheiros}
                      rotulo="Banheiros"
                    />
                  )}
                  {imovel.vagas > 0 && (
                    <ItemFicha icone={<IconeVaga />} valor={imovel.vagas} rotulo="Vagas" />
                  )}

                  {rural && hectares > 0 ? (
                    <ItemFicha
                      icone={<IconeFolha />}
                      valor={numero(hectares)}
                      rotulo="Hectares"
                    />
                  ) : (
                    imovel.area_util > 0 && (
                      <ItemFicha
                        icone={<IconeArea />}
                        valor={numero(imovel.area_util)}
                        rotulo="m² úteis"
                      />
                    )
                  )}
                </div>
              </section>
            </Revelar>

            {imovel.condominio_nome && (
              <Revelar>
                <section className="imovel-bloco">
                  <h2>Sobre o condomínio</h2>
                  <div className="aviso">
                    <IconePredio />
                    <span>
                      Este imóvel fica no <strong>{imovel.condominio_nome}</strong>. Conheça a
                      estrutura do empreendimento e as outras unidades disponíveis nele.
                    </span>
                  </div>
                  {/* O botão da página do condomínio só aparece quando
                      existe condomínio cadastrado para apontar.

                      A carteira veio de importação e trouxe o nome do
                      empreendimento em texto, sem criar o registro:
                      condominio_id está vazio nos 964. Enquanto esteve
                      fixo, "Ver o condomínio" montava um slug a partir do
                      nome e levava a uma página que não existe. Sem
                      registro sobra uma ação só, a que funciona, e o
                      botão volta sozinho quando a gestão cadastrar o
                      empreendimento. */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                    {imovel.condominio_id && (
                      <Link
                        className="btn btn-contorno btn-pequeno"
                        href={`/condominio/${slugify(`${imovel.condominio_nome}-${imovel.cidade}`)}`}
                      >
                        Ver o condomínio
                        <IconeSeta />
                      </Link>
                    )}
                    <Link
                      className="btn btn-contorno btn-pequeno"
                      href={`/imoveis?condominio=${encodeURIComponent(imovel.condominio_nome)}`}
                    >
                      {imovel.condominio_id ? 'Outras unidades' : 'Ver outras unidades'}
                      {!imovel.condominio_id && <IconeSeta />}
                    </Link>
                  </div>
                </section>
              </Revelar>
            )}

            {imovel.descricao && (
              <Revelar>
                <section className="imovel-bloco">
                  <h2>Sobre o imóvel</h2>
                  <p className="imovel-descricao">{imovel.descricao}</p>
                </section>
              </Revelar>
            )}

            {imovel.caracteristicas.length > 0 && (
              <Revelar>
                <section className="imovel-bloco">
                  <h2>O que este imóvel oferece</h2>
                  <ul className="lista-marcada">
                    {imovel.caracteristicas.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </section>
              </Revelar>
            )}

            <Revelar>
              <section className="imovel-bloco">
                <h2>Custos e condições</h2>

                <div className="custo-mensal">
                  <span>{imovel.finalidade === 'locacao' ? 'Aluguel' : 'Valor de venda'}</span>
                  <strong>{valor > 0 ? brl(valor) : 'Sob consulta'}</strong>
                </div>

                {imovel.valor_condominio != null && imovel.valor_condominio > 0 && (
                  <div className="custo-mensal">
                    <span>Condomínio, por mês</span>
                    <strong>{brl(imovel.valor_condominio)}</strong>
                  </div>
                )}

                {imovel.valor_iptu != null && imovel.valor_iptu > 0 && (
                  <div className="custo-mensal">
                    <span>IPTU, por ano</span>
                    <strong>{brl(imovel.valor_iptu)}</strong>
                  </div>
                )}

                {mensal > 0 && (
                  <div className="custo-mensal">
                    <span>Custo mensal estimado</span>
                    <strong className="custo-total">{brl(mensal)}</strong>
                  </div>
                )}

                <div className="custo-mensal">
                  <span>Financiamento</span>
                  <strong>{imovel.aceita_financiamento ? 'Aceita' : 'Não aceita'}</strong>
                </div>

                <div className="custo-mensal">
                  <span>Permuta</span>
                  <strong>{imovel.aceita_permuta ? 'Aceita' : 'Não aceita'}</strong>
                </div>

                {imovel.ano_construcao && (
                  <div className="custo-mensal">
                    <span>Ano de construção</span>
                    <strong>{imovel.ano_construcao}</strong>
                  </div>
                )}

                {imovel.area_total > 0 && (
                  <div className="custo-mensal">
                    <span>Área total</span>
                    <strong>{fmtArea(imovel.area_total)}</strong>
                  </div>
                )}

                <p className="texto-mudo" style={{ marginTop: 18, lineHeight: 1.6 }}>
                  Condomínio e IPTU são informados pelo proprietário e podem sofrer reajuste. O
                  custo mensal estimado soma o condomínio ao IPTU rateado em doze meses. Confirme os
                  valores vigentes com seu consultor antes de apresentar proposta.
                </p>
              </section>
            </Revelar>

            {imovel.aceita_financiamento && valor > 0 && (
              <Revelar>
                <section className="imovel-bloco">
                  <h2>Simulação de financiamento</h2>
                  <SimuladorFinanciamento valorImovel={valor} />
                </section>
              </Revelar>
            )}
          </div>

          {/* ---------- PAINEL LATERAL ---------- */}
          <aside className="painel-interesse">
            <div className="painel-preco">
              <span className="rotulo-preco">
                {imovel.finalidade === 'locacao' ? 'Aluguel mensal' : 'Valor de venda'}
              </span>
              <span className="valor">
                {valor > 0 ? (
                  <>
                    {brl(valor)}
                    {sufixo && <small>{sufixo}</small>}
                  </>
                ) : (
                  <small>Sob consulta</small>
                )}
              </span>
            </div>

            <div className="painel-corpo">
              <a
                className="btn btn-zap btn-bloco"
                href={mensagemWhats}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconeWhatsApp />
                Tenho interesse
              </a>

              <FormularioInteresse
                comAbas
                imovelId={imovel.id}
                imovelTitulo={imovel.titulo}
                imovelCodigo={imovel.referencia_externa ?? imovel.codigo}
                valor={valor}
              />
            </div>

            <div className="painel-consultor">
              <span className="consultor-avatar" aria-hidden="true">
                <i />
              </span>
              <span>
                <strong>Equipe {SITE.nomeCurto}</strong>
                <span>{SITE.creci}</span>
              </span>
            </div>
          </aside>
        </div>
      </div>

      {semelhantes.length > 0 && (
        <section className="secao secao-carvao" style={{ marginTop: 64 }}>
          <div className="container">
            <Revelar>
              <div className="cabecalho-secao">
                <div>
                  <span className="rotulo">Continue procurando</span>
                  <h2 className="titulo-2">Imóveis semelhantes</h2>
                </div>
                <Link className="link-seta" href="/imoveis">
                  Ver toda a carteira
                  <IconeSeta />
                </Link>
              </div>
            </Revelar>

            <div className="grade grade-4">
              {semelhantes.map((s, i) => (
                <Revelar key={s.id} atraso={i * 80}>
                  <CartaoImovel imovel={s} />
                </Revelar>
              ))}
            </div>
          </div>
        </section>
      )}

      <BarraMovel valor={valor} sufixo={sufixo} titulo={imovel.titulo} linkWhats={mensagemWhats} />
    </div>
  );
}

function ItemFicha({
  icone,
  valor,
  rotulo,
}: {
  icone: React.ReactNode;
  valor: number | string;
  rotulo: string;
}) {
  return (
    <div className="ficha-item">
      {icone}
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  );
}

async function carregar(slug: string): Promise<ImovelPublico | null> {
  if (semBanco()) return imovelPorSlug(slug);

  try {
    return await buscarImovelPorSlug(supabase(), slug);
  } catch (erro) {
    console.error('[imovel] falha ao carregar', slug, erro);
    return null;
  }
}

async function carregarSemelhantes(imovel: ImovelPublico): Promise<ImovelPublico[]> {
  if (semBanco()) return semelhantesVitrine(imovel, 4);

  try {
    return await buscarSemelhantes(supabase(), imovel, 4);
  } catch {
    return [];
  }
}
