import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  brl,
  brlCurto,
  corOrigem,
  desempenhoPorBairro,
  desempenhoPorOrigem,
  desempenhoPorPessoa,
  ehGestor,
  evolucaoMensal,
  funilAcumulado,
  iniciais,
  numero,
  resumirOperacao,
  rotuloEtapa,
  rotuloMes,
  rotuloOrigem,
  ultimosMeses,
  desempenhoPorTipo,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Barras, Colunas, Degraus, Faixa, Meta } from '@/componentes/indicadores/Graficos';
import { IconeAlvo, IconeVazio } from '@/componentes/Icones';
import { carregarBaseIndicadores, PERIODOS, resolverPeriodo } from '@/lib/indicadores';
import { exigirUsuario } from '@/lib/sessao';

export const metadata: Metadata = { title: 'Indicadores' };
export const dynamic = 'force-dynamic';

/**
 * Painel de indicadores.
 *
 * Renderizado no servidor por inteiro: nao ha um unico byte de
 * JavaScript de grafico indo para o navegador. A troca de periodo passa
 * pela URL, o que tem dois efeitos praticos, alem do peso: o link de um
 * recorte especifico pode ser mandado no grupo da equipe, e o botao
 * voltar do navegador funciona como se espera.
 *
 * A tela e de gestao. Um consultor com permissao de financeiro ve as
 * proprias comissoes no menu Financeiro; o consolidado da casa, com
 * ranking e margem, e leitura de quem conduz a operacao.
 */
export default async function PaginaIndicadores({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const usuario = await exigirUsuario();

  if (!ehGestor(usuario)) redirect('/?erro=sem-permissao');

  const base = await carregarBaseIndicadores();
  const { periodo, rotulo } = resolverPeriodo(params.periodo);

  const resumo = resumirOperacao(base, periodo);
  const bairros = desempenhoPorBairro(base, periodo).filter((b) => b.leads > 0 || b.vendas > 0);
  const origens = desempenhoPorOrigem(base, periodo);
  const pessoas = desempenhoPorPessoa(base, periodo);
  const funil = funilAcumulado(base, periodo);
  const tipos = desempenhoPorTipo(base, periodo).filter((t) => t.leads > 0 || t.vendas > 0);
  const meses = evolucaoMensal(base, ultimosMeses(6));

  const competenciaAtual = meses[meses.length - 1]?.competencia;

  const campeaoVgv = pessoas.find((p) => p.vgv > 0);
  const campeaoAtendimento = [...pessoas].sort((a, b) => b.interacoes - a.interacoes)[0];
  const bairroTopo = bairros[0];
  const origemTopo = [...origens].sort((a, b) => b.conversao - a.conversao || b.leads - a.leads)[0];

  const semDados = resumo.negocios === 0 && resumo.leadsRecebidos === 0;

  return (
    <>
      <CabecalhoPagina titulo="Indicadores" />

      <div className="corpo">
        <nav className="abas-periodo" aria-label="Período dos indicadores">
          {PERIODOS.map((p) => (
            <Link
              key={p.chave}
              href={`/indicadores?periodo=${p.chave}`}
              aria-current={
                (params.periodo ?? 'mes') === p.chave || (!params.periodo && p.chave === 'mes')
                  ? 'page'
                  : undefined
              }
              title={p.descricao}
            >
              {p.rotulo}
            </Link>
          ))}
          <span className="texto-mudo empurra somente-desktop">
            {rotulo} · {periodo.inicio.split('-').reverse().join('/')} a{' '}
            {periodo.fim.split('-').reverse().join('/')}
          </span>
        </nav>

        {semDados ? (
          <div className="vazio">
            <IconeVazio />
            <h3>Nada registrado neste período</h3>
            <p>
              Os indicadores se alimentam do que a equipe registra no dia a dia: leads recebidos,
              contatos anotados, visitas concluídas e negócios fechados. Escolha outro período ou
              comece a registrar.
            </p>
          </div>
        ) : (
          <>
            {/* ---------- LINHA DE FRENTE ---------- */}
            <div className="grade-cartoes grade-4" style={{ marginBottom: 22 }}>
              <Numero
                rotulo="VGV do período"
                valor={brlCurto(resumo.vgv)}
                nota={`${resumo.negocios} ${resumo.negocios === 1 ? 'negócio fechado' : 'negócios fechados'}`}
                cor="verde"
              />
              <Numero
                rotulo="Ticket médio"
                valor={brlCurto(resumo.ticketMedio)}
                nota="Valor médio por negócio fechado"
              />
              <Numero
                rotulo="Conversão de leads"
                valor={`${resumo.conversao.toFixed(1)}%`}
                nota={`${resumo.leadsConvertidos} de ${resumo.leadsRecebidos} leads recebidos`}
                cor={resumo.conversao >= 10 ? 'ouro' : undefined}
              />
              <Numero
                rotulo="Ciclo de venda"
                valor={resumo.cicloMedioDias > 0 ? `${resumo.cicloMedioDias} dias` : '--'}
                nota="Do primeiro contato até a conclusão"
              />
            </div>

            <div className="grade-cartoes grade-4" style={{ marginBottom: 26 }}>
              <Numero
                rotulo="Comissão gerada"
                valor={brlCurto(resumo.comissaoBruta)}
                nota="Bruta, antes da divisão"
              />
              <Numero
                rotulo="Margem da casa"
                valor={brlCurto(resumo.margem)}
                nota="Depois de comissões e custos"
              />
              <Numero
                rotulo="Atendimentos"
                valor={numero(resumo.atendimentos)}
                nota="Contatos registrados pela equipe"
              />
              <Numero
                rotulo="Visitas realizadas"
                valor={numero(resumo.visitasRealizadas)}
                nota="Compromissos de visita concluídos"
              />
            </div>

            {/* ---------- LEITURAS DIRETAS ---------- */}
            <div className="grade-cartoes grade-4 destaques-leitura">
              {bairroTopo && (
                <Leitura
                  titulo="Bairro mais promissor"
                  valor={bairroTopo.bairro}
                  apoio={`${bairroTopo.leads} leads, ${bairroTopo.vendas} ${bairroTopo.vendas === 1 ? 'venda' : 'vendas'}, ${brlCurto(bairroTopo.vgv)} em VGV`}
                />
              )}
              {campeaoVgv && (
                <Leitura
                  titulo="Maior desempenho"
                  valor={campeaoVgv.nome}
                  apoio={`${brlCurto(campeaoVgv.vgv)} em ${campeaoVgv.negocios} ${campeaoVgv.negocios === 1 ? 'negócio' : 'negócios'}, ${campeaoVgv.atingimento}% da meta`}
                />
              )}
              {campeaoAtendimento && campeaoAtendimento.interacoes > 0 && (
                <Leitura
                  titulo="Mais atendimentos"
                  valor={campeaoAtendimento.nome}
                  apoio={`${campeaoAtendimento.interacoes} contatos registrados em ${campeaoAtendimento.leadsAtendidos} leads`}
                />
              )}
              {origemTopo && (
                <Leitura
                  titulo="Canal que mais converte"
                  valor={rotuloOrigem(origemTopo.origem)}
                  apoio={`${origemTopo.conversao.toFixed(0)}% de conversão em ${origemTopo.leads} ${origemTopo.leads === 1 ? 'lead' : 'leads'}`}
                />
              )}
            </div>

            {/* ---------- EVOLUÇÃO ---------- */}
            <section className="cartao" style={{ marginTop: 26 }}>
              <div className="cartao-cabecalho">
                <h2>Evolução dos últimos seis meses</h2>
                <span className="texto-mudo">VGV concluído por mês</span>
              </div>
              <div className="cartao-corpo">
                <Colunas
                  itens={meses.map((m) => ({
                    rotulo: rotuloMes(m.competencia).split(' de ')[0].slice(0, 3),
                    valor: m.vgv,
                    apoio: `${m.negocios} neg. · ${m.leads} leads`,
                    atual: m.competencia === competenciaAtual,
                  }))}
                />
              </div>
            </section>

            <div className="grade-cartoes grade-2" style={{ marginTop: 22 }}>
              {/* ---------- FUNIL ---------- */}
              <section className="cartao">
                <div className="cartao-cabecalho">
                  <h2>Funil do período</h2>
                  <span className="texto-mudo">Quantos chegaram a cada etapa</span>
                </div>
                <div className="cartao-corpo">
                  <Degraus
                    etapas={funil.map((e) => ({
                      rotulo: rotuloEtapa(e.etapa),
                      quantidade: e.leads,
                      passagem: e.passagem,
                      valor: e.valor,
                    }))}
                  />
                </div>
              </section>

              {/* ---------- ORIGEM ---------- */}
              <section className="cartao">
                <div className="cartao-cabecalho">
                  <h2>De onde vêm os leads</h2>
                  <span className="texto-mudo">{resumo.leadsRecebidos} no período</span>
                </div>
                <div className="cartao-corpo">
                  <Faixa
                    fatias={origens.map((o) => ({
                      rotulo: rotuloOrigem(o.origem),
                      parte: o.participacao,
                      cor: corOrigem(o.origem),
                    }))}
                  />

                  <div className="tabela-envelope" style={{ marginTop: 18 }}>
                    <table className="tabela tabela-responsiva tabela-compacta">
                      <thead>
                        <tr>
                          <th>Canal</th>
                          <th className="numerico">Leads</th>
                          <th className="numerico">Fechados</th>
                          <th className="numerico">Conversão</th>
                          <th className="numerico">Score médio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {origens.map((o) => (
                          <tr key={o.origem}>
                            <td data-rotulo="Canal">{rotuloOrigem(o.origem)}</td>
                            <td data-rotulo="Leads" className="numerico">
                              {o.leads}
                            </td>
                            <td data-rotulo="Fechados" className="numerico">
                              {o.fechados}
                            </td>
                            <td data-rotulo="Conversão" className="numerico">
                              {o.conversao.toFixed(0)}%
                            </td>
                            <td data-rotulo="Score médio" className="numerico">
                              {o.scoreMedio}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            {/* ---------- BAIRROS ---------- */}
            <section className="cartao" style={{ marginTop: 22 }}>
              <div className="cartao-cabecalho">
                <h2>Bairros por potencial</h2>
                <span className="texto-mudo">
                  O índice pesa procura, conversão e valor gerado
                </span>
              </div>

              <div className="cartao-corpo">
                {bairros.length === 0 ? (
                  <p className="texto-mudo">
                    Ainda não há leads nem vendas ligados a um imóvel neste período.
                  </p>
                ) : (
                  <>
                    <Barras
                      itens={bairros.slice(0, 8).map((b, i) => ({
                        rotulo: b.bairro,
                        valor: b.indice,
                        apoio: `${b.leads} leads`,
                        destaque: i === 0,
                      }))}
                      formato="numero"
                    />

                    <div className="tabela-envelope" style={{ marginTop: 20 }}>
                      <table className="tabela tabela-responsiva tabela-compacta">
                        <thead>
                          <tr>
                            <th>Bairro</th>
                            <th className="numerico">Imóveis</th>
                            <th className="numerico">Leads</th>
                            <th className="numerico">Visitas</th>
                            <th className="numerico">Vendas</th>
                            <th className="numerico">VGV</th>
                            <th className="numerico">Ticket médio</th>
                            <th className="numerico">Preço do m²</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bairros.map((b) => (
                            <tr key={b.bairro}>
                              <td data-rotulo="Bairro">
                                <span className="celula-principal">{b.bairro}</span>
                                {b.leadsPorVenda > 0 && (
                                  <span className="celula-apoio">
                                    {b.leadsPorVenda} leads por venda
                                  </span>
                                )}
                              </td>
                              <td data-rotulo="Imóveis" className="numerico">
                                {b.imoveis}
                              </td>
                              <td data-rotulo="Leads" className="numerico">
                                {b.leads}
                              </td>
                              <td data-rotulo="Visitas" className="numerico">
                                {b.visitas}
                              </td>
                              <td data-rotulo="Vendas" className="numerico">
                                {b.vendas}
                              </td>
                              <td data-rotulo="VGV" className="numerico">
                                {b.vgv > 0 ? brlCurto(b.vgv) : '--'}
                              </td>
                              <td data-rotulo="Ticket médio" className="numerico">
                                {b.ticketMedio > 0 ? brlCurto(b.ticketMedio) : '--'}
                              </td>
                              <td data-rotulo="Preço do m²" className="numerico">
                                {b.precoMetro > 0 ? brl(b.precoMetro) : '--'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ---------- EQUIPE ---------- */}
            <section className="cartao" style={{ marginTop: 22 }}>
              <div className="cartao-cabecalho">
                <h2>Desempenho da equipe</h2>
                <span className="texto-mudo">Resultado, esforço e eficiência lado a lado</span>
              </div>

              <div className="tabela-envelope">
                <table className="tabela tabela-responsiva tabela-desempenho">
                  <thead>
                    <tr>
                      <th>Consultor</th>
                      <th className="numerico">VGV</th>
                      <th className="numerico">Negócios</th>
                      <th className="numerico">Comissão</th>
                      <th>Meta</th>
                      <th className="numerico">Leads</th>
                      <th className="numerico">Atendimentos</th>
                      <th className="numerico">Visitas</th>
                      <th className="numerico">Conversão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoas.map((p, indice) => (
                      <tr key={p.id}>
                        <td data-rotulo="Consultor">
                          <div className="celula-pessoa">
                            <span className="avatar avatar-p">{iniciais(p.nome)}</span>
                            <div className="pilha">
                              <span className="celula-principal">
                                {p.nome}
                                {indice === 0 && p.vgv > 0 && (
                                  <span className="marcador-lider">
                                    <IconeAlvo style={{ width: 12, height: 12 }} />
                                    líder
                                  </span>
                                )}
                              </span>
                              <span className="celula-apoio">
                                {p.imoveisAtivos} imóveis na vitrine
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-rotulo="VGV" className="numerico">
                          {p.vgv > 0 ? brlCurto(p.vgv) : '--'}
                        </td>
                        <td data-rotulo="Negócios" className="numerico">
                          {p.negocios}
                        </td>
                        <td data-rotulo="Comissão" className="numerico">
                          {p.comissao > 0 ? brlCurto(p.comissao) : '--'}
                        </td>
                        <td data-rotulo="Meta">
                          {p.metaMensal > 0 ? (
                            <Meta atingimento={p.atingimento} />
                          ) : (
                            <span className="texto-mudo">sem meta</span>
                          )}
                        </td>
                        <td data-rotulo="Leads" className="numerico">
                          {p.leadsAtendidos}
                        </td>
                        <td data-rotulo="Atendimentos" className="numerico">
                          {p.interacoes}
                          {p.toqueMedio > 0 && <small> ({p.toqueMedio}/lead)</small>}
                        </td>
                        <td data-rotulo="Visitas" className="numerico">
                          {p.visitasFeitas}
                        </td>
                        <td data-rotulo="Conversão" className="numerico">
                          {p.conversao}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="cartao-rodape">
                <span className="texto-mudo">
                  Atendimento conta cada contato registrado na ficha do lead. É o indicador que
                  mostra quem trabalha a carteira mesmo em mês sem fechamento.
                </span>
              </footer>
            </section>

            {/* ---------- TIPOS DE IMÓVEL ---------- */}
            {tipos.length > 0 && (
              <section className="cartao" style={{ marginTop: 22 }}>
                <div className="cartao-cabecalho">
                  <h2>Tipos de imóvel</h2>
                  <span className="texto-mudo">Onde está a procura e o giro</span>
                </div>

                <div className="tabela-envelope">
                  <table className="tabela tabela-responsiva tabela-compacta">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th className="numerico">Na carteira</th>
                        <th className="numerico">Leads</th>
                        <th className="numerico">Vendas</th>
                        <th className="numerico">VGV</th>
                        <th className="numerico">Ticket médio</th>
                        <th className="numerico">Dias até vender</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tipos.map((t) => (
                        <tr key={t.tipo}>
                          <td data-rotulo="Tipo">{t.tipo}</td>
                          <td data-rotulo="Na carteira" className="numerico">
                            {t.imoveis}
                          </td>
                          <td data-rotulo="Leads" className="numerico">
                            {t.leads}
                          </td>
                          <td data-rotulo="Vendas" className="numerico">
                            {t.vendas}
                          </td>
                          <td data-rotulo="VGV" className="numerico">
                            {t.vgv > 0 ? brlCurto(t.vgv) : '--'}
                          </td>
                          <td data-rotulo="Ticket médio" className="numerico">
                            {t.ticketMedio > 0 ? brlCurto(t.ticketMedio) : '--'}
                          </td>
                          <td data-rotulo="Dias até vender" className="numerico">
                            {t.diasAteVender > 0 ? t.diasAteVender : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Numero({
  rotulo,
  valor,
  nota,
  cor,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  cor?: 'ouro' | 'verde' | 'ambar' | 'rubro';
}) {
  return (
    <div className={`indicador${cor ? ` indicador-${cor}` : ''}`}>
      <span className="indicador-rotulo">{rotulo}</span>
      <p className="indicador-valor">{valor}</p>
      <p className="indicador-nota">{nota}</p>
    </div>
  );
}

function Leitura({ titulo, valor, apoio }: { titulo: string; valor: string; apoio: string }) {
  return (
    <div className="leitura">
      <span className="indicador-rotulo">{titulo}</span>
      <strong>{valor}</strong>
      <span className="leitura-apoio">{apoio}</span>
    </div>
  );
}
