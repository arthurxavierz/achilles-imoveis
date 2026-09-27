'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  brl,
  brlCurto,
  data as fmtData,
  rotuloMes,
  STATUS_VENDA,
  type DesempenhoConsultor,
  type ImovelDaVenda,
  type Perfil,
  type ResumoFinanceiroPeriodo,
  type VendaDetalhada,
  type VendaParcela,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Recado } from '@/componentes/Recado';
import {
  IconeAlvo,
  IconeDinheiro,
  IconeDireita,
  IconeEsquerda,
  IconeFinanceiro,
  IconeMais,
  IconeRelogio,
  IconeVazio,
} from '@/componentes/Icones';
import { CartaoVenda } from './CartaoVenda';
import { GavetaVenda } from './GavetaVenda';
import { Parcelas } from './Parcelas';

type Aba = 'negocios' | 'recebiveis' | 'equipe';

export function Financeiro({
  usuario,
  resumo,
  vendas,
  parcelas,
  desempenho,
  equipe,
  competencia,
  statusFiltro,
  imoveis,
  de,
  ate,
  periodoLivre,
}: {
  usuario: Perfil;
  resumo: ResumoFinanceiroPeriodo;
  vendas: VendaDetalhada[];
  parcelas: VendaParcela[];
  desempenho: DesempenhoConsultor[];
  equipe: Perfil[];
  competencia: string;
  statusFiltro: string;
  imoveis: ImovelDaVenda[];
  de: string;
  ate: string;
  /** Verdadeiro quando a pessoa digitou datas em vez de usar o mês. */
  periodoLivre: boolean;
}) {
  const router = useRouter();

  const [aba, setAba] = useState<Aba>('negocios');
  const [emEdicao, setEmEdicao] = useState<VendaDetalhada | null>(null);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);

  const parcelasPorVenda = useMemo(() => {
    const mapa = new Map<string, VendaParcela[]>();
    for (const p of parcelas) {
      const lista = mapa.get(p.venda_id) ?? [];
      lista.push(p);
      mapa.set(p.venda_id, lista);
    }
    return mapa;
  }, [parcelas]);

  const atrasadas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return parcelas.filter((p) => p.status === 'pendente' && p.vencimento < hoje);
  }, [parcelas]);

  function navegar(mudancas: Record<string, string | null>) {
    const params = new URLSearchParams();
    params.set('competencia', competencia);
    if (statusFiltro) params.set('status', statusFiltro);

    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) params.delete(chave);
      else params.set(chave, valor);
    }

    router.push(`/financeiro?${params.toString()}`);
  }

  function mudarMes(passo: number) {
    const [ano, mes] = competencia.split('-').map(Number);
    const d = new Date(ano, mes - 1 + passo, 1);
    navegar({ competencia: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  }

  function avisar(mensagem: string, erro = false) {
    setRecado({ texto: mensagem, erro });
    router.refresh();
  }

  return (
    <>
      <CabecalhoPagina titulo="Financeiro">
        <button
          className="btn somente-desktop"
          onClick={() => {
            setEmEdicao(null);
            setGavetaAberta(true);
          }}
        >
          <IconeMais />
          Registrar negócio
        </button>
      </CabecalhoPagina>

      <div className="corpo">
        {/* ---------- PERIODO ---------- */}
        <div className="agenda-topo">
          <div className="navegador-mes">
            <button onClick={() => mudarMes(-1)} aria-label="Mês anterior">
              <IconeEsquerda />
            </button>
            <span className="rotulo-periodo">{rotuloMes(competencia)}</span>
            <button onClick={() => mudarMes(1)} aria-label="Próximo mês">
              <IconeDireita />
            </button>
          </div>

          <div className="seletor-visao">
            <button aria-pressed={aba === 'negocios'} onClick={() => setAba('negocios')}>
              Negócios
            </button>
            <button aria-pressed={aba === 'recebiveis'} onClick={() => setAba('recebiveis')}>
              A receber
            </button>
            <button aria-pressed={aba === 'equipe'} onClick={() => setAba('equipe')}>
              Equipe
            </button>
          </div>
        </div>

        {/* ---------- INDICADORES ---------- */}
        <div className="grade-cartoes grade-4" style={{ marginBottom: 22 }}>
          <Indicador
            rotulo="VGV do mês"
            valor={brlCurto(resumo.vgv)}
            nota={`${resumo.negocios} ${resumo.negocios === 1 ? 'negócio fechado' : 'negócios fechados'}`}
            icone={<IconeFinanceiro />}
          />
          <Indicador
            rotulo="Comissão gerada"
            valor={brl(resumo.comissao_bruta)}
            nota={`${brl(resumo.comissao_equipe)} para a equipe`}
            icone={<IconeDinheiro />}
            cor="ouro"
          />
          <Indicador
            rotulo="Margem da casa"
            valor={brl(resumo.margem)}
            nota={`${brl(resumo.custos)} em custos no período`}
            icone={<IconeAlvo />}
            cor={resumo.margem >= 0 ? 'verde' : 'rubro'}
          />
          <Indicador
            rotulo="A receber"
            valor={brl(resumo.a_receber)}
            nota={
              atrasadas.length > 0
                ? `${atrasadas.length} ${atrasadas.length === 1 ? 'parcela vencida' : 'parcelas vencidas'}`
                : 'Nenhuma parcela vencida'
            }
            icone={<IconeRelogio />}
            cor={atrasadas.length > 0 ? 'ambar' : undefined}
          />
        </div>

        {resumo.em_negociacao > 0 && (
          <div className="aviso aviso-info" style={{ marginBottom: 22 }}>
            <IconeFinanceiro />
            <span>
              Há <strong>{brl(resumo.em_negociacao)}</strong> em negócios abertos, somando propostas,
              aprovações e contratos em andamento. Ticket médio do mês:{' '}
              <strong>{brl(resumo.ticket_medio)}</strong>
              {resumo.desconto_medio_pct > 0 && (
                <>
                  {' '}
                  · desconto médio de{' '}
                  <strong>{resumo.desconto_medio_pct.toFixed(1).replace('.', ',')}%</strong>
                </>
              )}
              .
            </span>
          </div>
        )}

        {/* ---------- ABAS ---------- */}
        {aba === 'negocios' && (
          <>
            <div className="filtros-barra">
              <div className="campo" style={{ minWidth: 190 }}>
                <select
                  value={statusFiltro}
                  onChange={(e) => navegar({ status: e.target.value || null })}
                  aria-label="Filtrar por situação"
                >
                  <option value="">Todas as situações</option>
                  {Object.entries(STATUS_VENDA).map(([chave, info]) => (
                    <option key={chave} value={chave}>
                      {info.rotulo}
                    </option>
                  ))}
                </select>
              </div>
              {/* Datas soltas mandam mais que o mês do cabeçalho. É o
                  que permite olhar um trimestre ou o ano inteiro sem
                  andar de mês em mês. */}
              <div className="campo campo-periodo">
                <label htmlFor="periodo-de">De</label>
                <input
                  id="periodo-de"
                  type="date"
                  value={de}
                  onChange={(e) => navegar({ de: e.target.value || null })}
                />
              </div>

              <div className="campo campo-periodo">
                <label htmlFor="periodo-ate">Até</label>
                <input
                  id="periodo-ate"
                  type="date"
                  value={ate}
                  onChange={(e) => navegar({ ate: e.target.value || null })}
                />
              </div>

              {periodoLivre && (
                <button
                  className="btn btn-fantasma btn-pequeno"
                  onClick={() => navegar({ de: null, ate: null })}
                >
                  Voltar ao mês
                </button>
              )}

              <span className="texto-mudo">
                {vendas.length} {vendas.length === 1 ? 'negócio' : 'negócios'}
              </span>
            </div>

            {vendas.length === 0 ? (
              <div className="vazio">
                <IconeVazio />
                <h3>Nenhum negócio registrado</h3>
                <p>
                  Registre a proposta assim que ela for apresentada, ainda antes do aceite. É o que
                  permite acompanhar quanto está em jogo e qual comissão está por vir.
                </p>
                <button
                  className="btn"
                  onClick={() => {
                    setEmEdicao(null);
                    setGavetaAberta(true);
                  }}
                >
                  <IconeMais />
                  Registrar negócio
                </button>
              </div>
            ) : (
              <div className="grade-cartoes grade-2">
                {vendas.map((venda) => (
                  <CartaoVenda
                    key={venda.id}
                    venda={venda}
                    parcelas={parcelasPorVenda.get(venda.id) ?? []}
                    usuario={usuario}
                    aoEditar={() => {
                      setEmEdicao(venda);
                      setGavetaAberta(true);
                    }}
                    aoAtualizar={avisar}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {aba === 'recebiveis' && (
          <Parcelas
            parcelas={parcelas}
            vendas={vendas}
            equipe={equipe}
            usuario={usuario}
            aoAtualizar={avisar}
          />
        )}

        {aba === 'equipe' && <QuadroEquipe desempenho={desempenho} competencia={competencia} />}
      </div>

      <button
        className="acao-flutuante"
        onClick={() => {
          setEmEdicao(null);
          setGavetaAberta(true);
        }}
        aria-label="Registrar negócio"
      >
        <IconeMais />
      </button>

      {gavetaAberta && (
        <GavetaVenda
          venda={emEdicao}
          imoveis={imoveis}
          equipe={equipe}
          usuario={usuario}
          aoFechar={() => {
            setGavetaAberta(false);
            setEmEdicao(null);
          }}
          aoConcluir={(mensagem) => {
            setGavetaAberta(false);
            setEmEdicao(null);
            avisar(mensagem);
          }}
        />
      )}

      {recado && (
        <Recado texto={recado.texto} erro={recado.erro} aoFechar={() => setRecado(null)} />
      )}
    </>
  );
}

function Indicador({
  rotulo,
  valor,
  nota,
  icone,
  cor,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  icone: React.ReactNode;
  cor?: 'ouro' | 'verde' | 'ambar' | 'rubro';
}) {
  return (
    <div className={`indicador${cor ? ` indicador-${cor}` : ''}`}>
      <div className="indicador-topo">
        <span className="indicador-rotulo">{rotulo}</span>
        <span className="indicador-icone">{icone}</span>
      </div>
      <p className="indicador-valor">{valor}</p>
      <p className="indicador-nota">{nota}</p>
    </div>
  );
}

/**
 * Desempenho por consultor.
 *
 * Mostra atingimento de meta, e nao apenas VGV bruto. Um consultor que
 * fez 400 mil com meta de 300 mil esta indo melhor que outro que fez 600
 * mil com meta de um milhao, e o ranking precisa deixar isso visivel.
 */
function QuadroEquipe({
  desempenho,
  competencia,
}: {
  desempenho: DesempenhoConsultor[];
  competencia: string;
}) {
  if (desempenho.length === 0) {
    return (
      <div className="vazio">
        <IconeVazio />
        <h3>Sem dados de equipe neste período</h3>
      </div>
    );
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <h2>Desempenho em {rotuloMes(competencia)}</h2>
        <span className="texto-mudo">Meta considerada: a cadastrada em cada perfil</span>
      </div>

      <div className="tabela-envelope">
        <table className="tabela tabela-responsiva">
          <thead>
            <tr>
              <th>Consultor</th>
              <th className="numerico">Negócios</th>
              <th className="numerico">VGV</th>
              <th className="numerico">Comissão</th>
              <th style={{ minWidth: 190 }}>Meta</th>
            </tr>
          </thead>
          <tbody>
            {desempenho.map((c) => {
              const atingiu = c.atingimento >= 100;
              const perto = c.atingimento >= 70;

              return (
                <tr key={c.consultor_id}>
                  <td data-rotulo="Consultor" className="celula-principal">
                    {c.consultor_nome}
                  </td>
                  <td data-rotulo="Negócios" className="numerico">
                    {c.negocios}
                  </td>
                  <td data-rotulo="VGV" className="numerico">
                    {brl(c.vgv)}
                  </td>
                  <td data-rotulo="Comissão" className="numerico">
                    {brl(c.comissao)}
                  </td>
                  <td data-rotulo="Meta">
                    <div className="meta">
                      <div className="linha-flex entre" style={{ fontSize: '0.78rem' }}>
                        <span className="texto-mudo">
                          {c.meta_mensal > 0 ? brlCurto(c.meta_mensal) : 'sem meta'}
                        </span>
                        <strong
                          style={{
                            color: atingiu
                              ? 'var(--verde)'
                              : perto
                                ? 'var(--ambar)'
                                : 'var(--cinza)',
                          }}
                        >
                          {c.atingimento.toFixed(0)}%
                        </strong>
                      </div>
                      <div className="meta-barra">
                        <div
                          className={`meta-preenchimento${atingiu ? ' batida' : perto ? ' atrasada' : ''}`}
                          style={{ width: `${Math.min(100, c.atingimento)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cartao-rodape">
        <span className="texto-mudo">
          Período apurado pela data de conclusão do negócio. Atualizado em {fmtData(new Date().toISOString())}.
        </span>
      </div>
    </div>
  );
}
