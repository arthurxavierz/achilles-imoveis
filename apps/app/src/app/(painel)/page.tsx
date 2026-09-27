import Link from 'next/link';

import {
  brl,
  brlCurto,
  diaLocal,
  faixaHoraria,
  corTipo,
  levantarPendencias,
  rotuloOrigem,
  rotuloTipo,
  taxaConversao,
  tempoRelativo,
  type Compromisso,
  type CompromissoDetalhado,
  type Imovel,
  type Interacao,
  type Lead,
  type Pendencia,
  type Perfil,
  type ResumoFinanceiroPeriodo,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import {
  IconeAgenda,
  IconeAlerta,
  IconeAlvo,
  IconeCheck,
  IconeDinheiro,
  IconeDireita,
  IconeFinanceiro,
  IconeFunil,
  IconeImovel,
  IconeLocal,
  IconeMais,
  IconeVazio,
} from '@/componentes/Icones';
import { resumoFinanceiro } from '@imob/demo';

import {
  baseIndicadoresDemo,
  compromissosDemo,
  contarImoveisDemo,
  leadsDemo,
  parcelasVencidasDemo,
} from '@/lib/dados-demo';
import { modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase-servidor';
import { lerTudo } from '@/lib/consultas';
import type { ImovelResumo } from '@imob/core';

export const dynamic = 'force-dynamic';

export default async function PaginaInicial() {
  const usuario = await exigirUsuario();
  const supabase = await supabaseServidor();

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
  const podeFinanceiro = usuario.papel === 'admin' || Boolean(usuario.permissoes?.financeiro);

  const inicioMes = new Date();
  const competencia = `${inicioMes.getFullYear()}-${String(inicioMes.getMonth() + 1).padStart(2, '0')}`;
  const ultimoDia = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0).getDate();

  const [agendaHoje, leads, imoveis, resumo, pendencias] = modoDemo()
    ? [
        agendaHojeDemo(usuario, gestor),
        leadsDemo(usuario),
        contarImoveisDemo(),
        podeFinanceiro
          ? resumoFinanceiro(`${competencia}-01`, `${competencia}-${ultimoDia}`)
          : null,
        levantarPendencias(
          baseIndicadoresDemo(),
          usuario,
          podeFinanceiro ? parcelasVencidasDemo() : 0,
        ),
      ]
    : await Promise.all([
        carregarAgendaHoje(supabase, usuario, gestor),
        carregarLeads(supabase),
        contarImoveis(supabase),
        podeFinanceiro ? carregarResumo(supabase) : Promise.resolve(null),
        carregarPendencias(supabase, usuario, podeFinanceiro),
      ]);

  const meusLeads = gestor ? leads : leads.filter((l) => l.corretor_id === usuario.id);
  const novos = meusLeads.filter((l) => l.etapa === 'novo' && !l.arquivado);
  const quentes = meusLeads.filter((l) => l.temperatura === 'quente' && !l.arquivado);

  const primeiroNome = usuario.nome.split(' ')[0];
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <>
      <CabecalhoPagina titulo={`${saudacao}, ${primeiroNome}`}>
        <Link className="btn somente-desktop" href="/agenda">
          <IconeMais />
          Marcar compromisso
        </Link>
      </CabecalhoPagina>

      <div className="corpo">
        {/* ---------- INDICADORES ---------- */}
        <div className="grade-cartoes grade-4" style={{ marginBottom: 24 }}>
          <Indicador
            rotulo="Na agenda hoje"
            valor={String(agendaHoje.length)}
            nota={
              agendaHoje.length === 0
                ? 'Dia livre'
                : `Próximo às ${agendaHoje[0].inicio.slice(11, 16)}`
            }
            icone={<IconeAgenda />}
          />

          <Indicador
            rotulo="Leads novos"
            valor={String(novos.length)}
            nota={`${quentes.length} ${quentes.length === 1 ? 'lead quente' : 'leads quentes'} na carteira`}
            icone={<IconeFunil />}
            cor={novos.length > 0 ? 'ouro' : undefined}
          />

          <Indicador
            rotulo="Imóveis publicados"
            valor={String(imoveis.publicados)}
            nota={`${imoveis.total} na carteira, ${imoveis.reservados} reservados`}
            icone={<IconeImovel />}
          />

          {podeFinanceiro && resumo ? (
            <Indicador
              rotulo="VGV do mês"
              valor={brlCurto(resumo.vgv)}
              nota={`${resumo.negocios} ${resumo.negocios === 1 ? 'negócio fechado' : 'negócios fechados'}`}
              icone={<IconeFinanceiro />}
              cor="verde"
            />
          ) : (
            <Indicador
              rotulo="Conversão do funil"
              valor={`${taxaConversao(meusLeads)}%`}
              nota="Fechados sobre o total ativo"
              icone={<IconeAlvo />}
            />
          )}
        </div>

        {/* ---------- PENDÊNCIAS ----------
            Vem antes de qualquer gráfico de propósito: o painel existe
            para dizer o que fazer agora, e só depois como foi o mês. */}
        <section className="cartao" style={{ marginBottom: 22 }}>
          <div className="cartao-cabecalho">
            <h2>O que precisa de você</h2>
            {gestor && (
              <Link className="btn btn-fantasma btn-pequeno" href="/indicadores">
                Ver indicadores
                <IconeDireita />
              </Link>
            )}
          </div>

          {pendencias.length === 0 ? (
            <div className="cartao-corpo">
              <div className="aviso aviso-ok">
                <IconeCheck />
                <span>
                  Nada pendente. Leads atendidos, agenda em dia e nenhum imóvel disponível fora da
                  vitrine.
                </span>
              </div>
            </div>
          ) : (
            <div className="cartao-corpo lista-pendencias">
              {pendencias.map((p) => (
                <Link key={p.chave} href={p.destino} className={`pendencia pendencia-${p.gravidade}`}>
                  <span className="pendencia-numero">{p.quantidade}</span>
                  <span className="pendencia-texto">
                    <strong>{p.titulo}</strong>
                    <span>{p.detalhe}</span>
                  </span>
                  <IconeDireita />
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grade-cartoes grade-2">
          {/* ---------- AGENDA DO DIA ---------- */}
          <section className="cartao">
            <div className="cartao-cabecalho">
              <h2>Sua agenda de hoje</h2>
              <Link className="btn btn-fantasma btn-pequeno" href="/agenda?visao=dia">
                Ver agenda
                <IconeDireita />
              </Link>
            </div>

            {agendaHoje.length === 0 ? (
              <div className="vazio" style={{ padding: '36px 24px' }}>
                <IconeAgenda />
                <h3>Nada marcado para hoje</h3>
                <p>
                  Aproveite para retomar contato com quem visitou nas últimas semanas e não
                  respondeu.
                </p>
                <Link className="btn" href="/agenda">
                  <IconeMais />
                  Marcar compromisso
                </Link>
              </div>
            ) : (
              <div className="cartao-corpo" style={{ display: 'grid', gap: 8 }}>
                {agendaHoje.map((c) => (
                  <div key={c.id} className={`compromisso compromisso-${corTipo(c.tipo)}`}>
                    <div className="compromisso-hora">
                      {c.dia_inteiro ? 'Dia' : c.inicio.slice(11, 16)}
                      <small>{rotuloTipo(c.tipo)}</small>
                    </div>
                    <div className="compromisso-corpo" style={{ minWidth: 0 }}>
                      <p className="compromisso-titulo">{c.titulo}</p>
                      <div className="compromisso-meta">
                        <span>{faixaHoraria(c)}</span>
                        {c.local && (
                          <span>
                            <IconeLocal />
                            {c.local}
                          </span>
                        )}
                        {c.responsavel_id !== usuario.id && <span>{c.responsavel_nome}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ---------- FILA DE ATENDIMENTO ---------- */}
          <section className="cartao">
            <div className="cartao-cabecalho">
              <h2>Fila de atendimento</h2>
              <Link className="btn btn-fantasma btn-pequeno" href="/leads">
                Ver funil
                <IconeDireita />
              </Link>
            </div>

            {novos.length === 0 ? (
              <div className="vazio" style={{ padding: '36px 24px' }}>
                <IconeVazio />
                <h3>Nenhum lead esperando</h3>
                <p>Todos os contatos recebidos já foram atendidos. Bom trabalho.</p>
              </div>
            ) : (
              <div className="cartao-corpo" style={{ display: 'grid', gap: 9 }}>
                {/* Ordenados por score: quem tem telefone, veio de um
                    imóvel específico e chegou agora aparece primeiro. */}
                {[...novos]
                  .sort((a, b) => b.score - a.score)
                  .slice(0, 6)
                  .map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/leads?visao=lista&lead=${lead.id}`}
                      className="lead"
                    >
                      <div className="lead-topo">
                        <span className="lead-nome">{lead.nome}</span>
                        <span className={`termometro termometro-${lead.temperatura}`} />
                      </div>
                      {lead.imovel_titulo && <p className="lead-imovel">{lead.imovel_titulo}</p>}
                      <div className="lead-rodape">
                        <span className="lead-valor">
                          {lead.valor > 0 ? brl(lead.valor) : 'Valor a definir'}
                        </span>
                        <span className="texto-mudo" style={{ fontSize: '0.75rem' }}>
                          {rotuloOrigem(lead.origem)} · {tempoRelativo(lead.criado_em)}
                        </span>
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </section>
        </div>

        {/* ---------- RESULTADO DO MES ---------- */}
        {podeFinanceiro && resumo && (
          <section className="cartao" style={{ marginTop: 22 }}>
            <div className="cartao-cabecalho">
              <h2>Resultado do mês</h2>
              <Link className="btn btn-fantasma btn-pequeno" href="/financeiro">
                Abrir financeiro
                <IconeDireita />
              </Link>
            </div>

            <div className="cartao-corpo">
              <div className="grade-cartoes grade-4">
                <ResumoItem rotulo="VGV" valor={brl(resumo.vgv)} />
                <ResumoItem rotulo="Comissão gerada" valor={brl(resumo.comissao_bruta)} />
                <ResumoItem rotulo="Margem da casa" valor={brl(resumo.margem)} destaque />
                <ResumoItem rotulo="A receber" valor={brl(resumo.a_receber)} />
              </div>

              {resumo.em_negociacao > 0 && (
                <div className="aviso aviso-info" style={{ marginTop: 18 }}>
                  <IconeDinheiro />
                  <span>
                    <strong>{brl(resumo.em_negociacao)}</strong> em negócios abertos aguardando
                    aprovação, contrato ou liberação de recurso.
                  </span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
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

function ResumoItem({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <span className="indicador-rotulo" style={{ fontSize: '0.66rem' }}>
        {rotulo}
      </span>
      <p
        style={{
          fontSize: '1.28rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 5,
          color: destaque ? 'var(--verde)' : 'var(--marinho-900)',
        }}
      >
        {valor}
      </p>
    </div>
  );
}

type ClienteSupabase = Awaited<ReturnType<typeof supabaseServidor>>;

async function carregarAgendaHoje(
  supabase: ClienteSupabase,
  usuario: Perfil,
  gestor: boolean,
): Promise<CompromissoDetalhado[]> {
  const hoje = diaLocal(new Date());

  // A janela vai de um dia antes a um depois porque a comparacao com o
  // dia local acontece aqui, e nao no banco: um compromisso das 22h de
  // hoje esta em UTC no dia seguinte.
  const de = new Date();
  de.setDate(de.getDate() - 1);
  const ate = new Date();
  ate.setDate(ate.getDate() + 2);

  let consulta = supabase
    .from('compromissos')
    .select(`*, responsavel:perfis!compromissos_responsavel_id_fkey (nome)`)
    .gte('inicio', de.toISOString())
    .lte('inicio', ate.toISOString())
    .neq('status', 'cancelado')
    .order('inicio');

  // Gestor ve o dia da equipe inteira; corretor ve o proprio dia.
  if (!gestor) consulta = consulta.eq('responsavel_id', usuario.id);

  const { data, error } = await consulta;

  if (error) {
    console.error('[painel] falha na agenda:', error);
    return [];
  }

  return (data ?? [])
    .map((linha) => {
      const bruto = linha as Record<string, unknown>;
      return {
        ...(bruto as unknown as CompromissoDetalhado),
        responsavel_nome: (bruto.responsavel as { nome?: string })?.nome ?? '',
        criado_por_nome: null,
        imovel_titulo: null,
        lead_nome: null,
      };
    })
    .filter((c) => diaLocal(c.inicio) === hoje);
}

async function carregarLeads(supabase: ClienteSupabase): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('arquivado', false)
    .order('criado_em', { ascending: false })
    .limit(300);

  if (error) {
    console.error('[painel] falha nos leads:', error);
    return [];
  }

  return (data ?? []) as Lead[];
}

async function contarImoveis(supabase: ClienteSupabase) {
  const [total, publicados, reservados] = await Promise.all([
    supabase.from('imoveis').select('id', { count: 'exact', head: true }),
    supabase.from('imoveis').select('id', { count: 'exact', head: true }).eq('publicado', true),
    supabase.from('imoveis').select('id', { count: 'exact', head: true }).eq('status', 'reservado'),
  ]);

  return {
    total: total.count ?? 0,
    publicados: publicados.count ?? 0,
    reservados: reservados.count ?? 0,
  };
}

async function carregarResumo(supabase: ClienteSupabase): Promise<ResumoFinanceiroPeriodo | null> {
  const { data, error } = await supabase.rpc('resumo_financeiro');

  if (error) {
    console.error('[painel] falha no resumo:', error);
    return null;
  }

  const linha = Array.isArray(data) ? data[0] : data;
  return (linha ?? null) as ResumoFinanceiroPeriodo | null;
}

/**
 * Pendencias no banco real.
 *
 * Carrega so o que levantarPendencias() usa, e nao a base inteira dos
 * indicadores: esta e a tela mais aberta do sistema, e ela nao pode
 * pagar o preco de um relatorio consolidado a cada visita.
 */
async function carregarPendencias(
  supabase: ClienteSupabase,
  usuario: Perfil,
  podeFinanceiro: boolean,
): Promise<Pendencia[]> {
  const hoje = new Date().toISOString().slice(0, 10);

  const [leads, interacoes, compromissos, imoveis, parcelas] = await Promise.all([
    lerTudo<Lead>((de, ate) =>
      supabase.from('leads').select('*').eq('arquivado', false).range(de, ate),
    ),
    lerTudo<Interacao>((de, ate) =>
      supabase
        .from('lead_interacoes')
        .select('lead_id, criado_em, tipo, id, conteudo, autor_id, autor_nome')
        .order('criado_em', { ascending: false })
        .range(de, ate),
    ),
    supabase
      .from('compromissos')
      .select('*')
      .in('status', ['agendado', 'confirmado'])
      .lt('inicio', `${hoje}T00:00:00Z`)
      .limit(500),
    // So o que a pendencia conta: situacao, responsavel e publicado.
    lerTudo<ImovelResumo>((de, ate) =>
      supabase
        .from('imoveis')
        .select('id, status, publicado, corretor_id, proprietario_id')
        .eq('publicado', false)
        .range(de, ate),
    ),
    podeFinanceiro
      ? supabase
          .from('venda_parcelas')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente')
          .lt('vencimento', hoje)
      : Promise.resolve({ count: 0 }),
  ]);

  return levantarPendencias(
    {
      perfis: [],
      vendas: [],
      imoveis,
      leads,
      interacoes,
      compromissos: (compromissos.data ?? []) as Compromisso[],
    },
    usuario,
    parcelas.count ?? 0,
  );
}

/** Compromissos de hoje na demonstração, com o mesmo recorte da consulta real. */
function agendaHojeDemo(usuario: Perfil, gestor: boolean): CompromissoDetalhado[] {
  const de = new Date();
  de.setDate(de.getDate() - 1);
  const ate = new Date();
  ate.setDate(ate.getDate() + 2);

  const hoje = diaLocal(new Date());

  return compromissosDemo(de, ate)
    .filter((c) => c.status !== 'cancelado')
    .filter((c) => gestor || c.responsavel_id === usuario.id)
    .filter((c) => diaLocal(c.inicio) === hoje);
}
