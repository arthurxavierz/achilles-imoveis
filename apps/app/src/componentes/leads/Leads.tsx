'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, useTransition } from 'react';

import {
  brl,
  brlCurto,
  ETAPAS,
  ORIGENS_LEAD,
  taxaConversao,
  ultimaInteracaoPorLead,
  type EtapaLead,
  type Interacao,
  type Lead,
  type Perfil,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Recado } from '@/componentes/Recado';
import {
  IconeBusca,
  IconeFunil,
  IconeGrade,
  IconeLista,
  IconeMais,
} from '@/componentes/Icones';
import { assumirLead, moverLead } from '@/app/(painel)/leads/acoes';
import { Funil } from './Funil';
import { GavetaLead } from './GavetaLead';
import { TabelaLeads } from './TabelaLeads';

type Visao = 'funil' | 'lista';

export interface FiltrosLead {
  busca: string;
  etapa: string;
  origem: string;
  consultor: string;
  situacao: string;
}

const FILTROS_VAZIOS: FiltrosLead = {
  busca: '',
  etapa: '',
  origem: '',
  consultor: '',
  situacao: '',
};

/**
 * Central de leads.
 *
 * Duas leituras da mesma carteira, e a escolha entre elas nao e questao
 * de gosto: o funil responde "em que pe esta cada negociacao", e a lista
 * responde "onde esta o telefone daquela pessoa que ligou terca". Quem
 * conduz a equipe vive na primeira; quem atende vive na segunda.
 *
 * Os filtros ficam neste componente, acima das duas visoes, para que
 * trocar de visao nao perca a selecao. Alternar entre quadro e lista com
 * o mesmo recorte na tela e o que torna a troca util.
 */
export function Leads({
  usuario,
  leads,
  equipe,
  interacoes,
  parametros,
}: {
  usuario: Perfil;
  leads: Lead[];
  equipe: Perfil[];
  interacoes: Interacao[];
  parametros: { visao?: string; consultor?: string; situacao?: string; lead?: string };
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const [visao, setVisao] = useState<Visao>(parametros.visao === 'lista' ? 'lista' : 'funil');
  const [filtros, setFiltros] = useState<FiltrosLead>({
    ...FILTROS_VAZIOS,
    consultor: parametros.consultor ?? '',
    situacao: parametros.situacao ?? '',
  });
  const [abertoId, setAbertoId] = useState<string | null>(parametros.lead ?? null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const porPessoa = useMemo(() => new Map(equipe.map((p) => [p.id, p.nome])), [equipe]);

  const ultimaPorLead = useMemo(() => ultimaInteracaoPorLead(interacoes), [interacoes]);

  const contagemPorLead = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const i of interacoes) {
      if (i.tipo === 'sistema') continue;
      mapa.set(i.lead_id, (mapa.get(i.lead_id) ?? 0) + 1);
    }
    return mapa;
  }, [interacoes]);

  const hoje = new Date().toISOString().slice(0, 10);

  const filtrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    const somenteDigitos = termo.replace(/\D/g, '');

    return leads.filter((l) => {
      // Arquivados só aparecem quando explicitamente pedidos: eles são a
      // memória da operação, não a fila de trabalho de ninguém.
      if (filtros.situacao === 'arquivados') {
        if (!l.arquivado) return false;
      } else if (l.arquivado) {
        return false;
      }

      if (filtros.etapa && l.etapa !== filtros.etapa) return false;
      if (filtros.origem && l.origem !== filtros.origem) return false;

      if (filtros.consultor === 'meus' && l.corretor_id !== usuario.id) return false;
      if (filtros.consultor === 'sem-dono' && l.corretor_id !== null) return false;
      if (filtros.consultor && !['meus', 'sem-dono'].includes(filtros.consultor)) {
        if (l.corretor_id !== filtros.consultor) return false;
      }

      if (filtros.situacao === 'parados') {
        if (['fechado', 'perdido'].includes(l.etapa)) return false;
        const referencia = ultimaPorLead.get(l.id)?.criado_em ?? l.criado_em;
        const dias = (Date.now() - new Date(referencia).getTime()) / 86_400_000;
        if (dias <= 7) return false;
      }

      if (filtros.situacao === 'retorno') {
        if (!l.proximo_contato || l.proximo_contato > hoje) return false;
      }

      if (filtros.situacao === 'quentes' && l.temperatura !== 'quente') return false;

      if (!termo) return true;

      return (
        l.nome.toLowerCase().includes(termo) ||
        (l.email ?? '').toLowerCase().includes(termo) ||
        (somenteDigitos.length >= 3 && (l.telefone ?? '').includes(somenteDigitos)) ||
        (l.imovel_titulo ?? '').toLowerCase().includes(termo)
      );
    });
  }, [leads, filtros, usuario.id, ultimaPorLead, hoje]);

  const aberto = useMemo(
    () => (abertoId ? (leads.find((l) => l.id === abertoId) ?? null) : null),
    [leads, abertoId],
  );

  const historicoAberto = useMemo(
    () =>
      aberto
        ? interacoes
            .filter((i) => i.lead_id === aberto.id)
            .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
        : [],
    [interacoes, aberto],
  );

  const avisar = useCallback((texto: string, erro = false) => {
    setRecado({ texto, erro });
  }, []);

  function mover(id: string, etapa: EtapaLead) {
    iniciar(async () => {
      const r = await moverLead(id, etapa);
      if (!r.ok) avisar(r.erro ?? 'Falha ao mover.', true);
      router.refresh();
    });
  }

  function assumir(id: string) {
    iniciar(async () => {
      const r = await assumirLead(id);
      avisar(r.ok ? 'Lead atribuído a você.' : (r.erro ?? 'Falha.'), !r.ok);
      router.refresh();
    });
  }

  function fecharGaveta() {
    setAbertoId(null);
    setCriandoNovo(false);
  }

  function aoSalvar(mensagem: string, erro = false) {
    if (!erro) fecharGaveta();
    avisar(mensagem, erro);
    router.refresh();
  }

  const ativos = filtrados.filter((l) => !['fechado', 'perdido'].includes(l.etapa));
  const valorEmJogo = ativos.reduce((soma, l) => soma + Number(l.valor), 0);
  const semDono = filtrados.filter((l) => l.corretor_id === null).length;

  const algumFiltro =
    filtros.busca || filtros.etapa || filtros.origem || filtros.consultor || filtros.situacao;

  return (
    <>
      <CabecalhoPagina titulo="Leads">
        <div className="seletor-visao somente-desktop">
          <button aria-pressed={visao === 'funil'} onClick={() => setVisao('funil')}>
            <IconeGrade />
            Funil
          </button>
          <button aria-pressed={visao === 'lista'} onClick={() => setVisao('lista')}>
            <IconeLista />
            Lista
          </button>
        </div>

        <button className="btn somente-desktop" onClick={() => setCriandoNovo(true)}>
          <IconeMais />
          Novo lead
        </button>
      </CabecalhoPagina>

      <div className="corpo">
        <div className="painel-resumo">
          <ResumoRapido rotulo="Em atendimento" valor={String(ativos.length)} />
          <ResumoRapido rotulo="Valor em jogo" valor={brlCurto(valorEmJogo)} />
          <ResumoRapido rotulo="Conversão" valor={`${taxaConversao(filtrados)}%`} />
          <ResumoRapido
            rotulo="Sem responsável"
            valor={String(semDono)}
            alerta={semDono > 0}
          />
        </div>

        <div className="filtros-barra">
          <div className="busca-rapida">
            <IconeBusca />
            <input
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              placeholder="Nome, telefone, e-mail ou imóvel"
              aria-label="Buscar lead"
            />
          </div>

          <div className="campo campo-filtro">
            <select
              value={filtros.etapa}
              onChange={(e) => setFiltros({ ...filtros, etapa: e.target.value })}
              aria-label="Filtrar por etapa"
            >
              <option value="">Todas as etapas</option>
              {ETAPAS.map((e) => (
                <option key={e.chave} value={e.chave}>
                  {e.nome}
                </option>
              ))}
              <option value="perdido">Perdido</option>
            </select>
          </div>

          <div className="campo campo-filtro">
            <select
              value={filtros.origem}
              onChange={(e) => setFiltros({ ...filtros, origem: e.target.value })}
              aria-label="Filtrar por origem"
            >
              <option value="">Todas as origens</option>
              {ORIGENS_LEAD.map((o) => (
                <option key={o.chave} value={o.chave}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="campo campo-filtro">
            <select
              value={filtros.consultor}
              onChange={(e) => setFiltros({ ...filtros, consultor: e.target.value })}
              aria-label="Filtrar por consultor"
            >
              <option value="">Todos os consultores</option>
              <option value="meus">Meus leads</option>
              <option value="sem-dono">Sem responsável</option>
              {gestor &&
                equipe
                  .filter((p) => p.ativo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
            </select>
          </div>

          <div className="campo campo-filtro">
            <select
              value={filtros.situacao}
              onChange={(e) => setFiltros({ ...filtros, situacao: e.target.value })}
              aria-label="Filtrar por situação"
            >
              <option value="">Situação: todas</option>
              <option value="quentes">Somente quentes</option>
              <option value="parados">Parados há mais de 7 dias</option>
              <option value="retorno">Retorno combinado vencido</option>
              <option value="arquivados">Arquivados</option>
            </select>
          </div>

          {algumFiltro && (
            <button
              className="btn btn-fantasma btn-pequeno"
              onClick={() => setFiltros(FILTROS_VAZIOS)}
            >
              Limpar filtros
            </button>
          )}

          <span className="texto-mudo empurra somente-desktop">
            {filtrados.length} {filtrados.length === 1 ? 'lead' : 'leads'} · {brl(valorEmJogo)} em
            aberto
          </span>
        </div>

        <div className="seletor-visao somente-celular" style={{ marginBottom: 14 }}>
          <button aria-pressed={visao === 'funil'} onClick={() => setVisao('funil')}>
            <IconeGrade />
            Funil
          </button>
          <button aria-pressed={visao === 'lista'} onClick={() => setVisao('lista')}>
            <IconeLista />
            Lista
          </button>
        </div>

        {filtrados.length === 0 ? (
          <div className="vazio">
            <IconeFunil />
            <h3>Nenhum lead nesta seleção</h3>
            <p>
              Os contatos que chegam pelo formulário do site e pelo WhatsApp entram aqui
              automaticamente, na etapa Novo. Você também pode cadastrar um atendimento presencial
              pelo botão de novo lead.
            </p>
            {algumFiltro && (
              <button className="btn btn-claro" onClick={() => setFiltros(FILTROS_VAZIOS)}>
                Limpar filtros
              </button>
            )}
          </div>
        ) : visao === 'funil' ? (
          <Funil
            usuario={usuario}
            leads={filtrados}
            porPessoa={porPessoa}
            pendente={pendente}
            aoMover={mover}
            aoAssumir={assumir}
            aoAbrir={(lead) => setAbertoId(lead.id)}
          />
        ) : (
          <TabelaLeads
            usuario={usuario}
            leads={filtrados}
            porPessoa={porPessoa}
            ultimaPorLead={ultimaPorLead}
            contagemPorLead={contagemPorLead}
            pendente={pendente}
            aoAssumir={assumir}
            aoAbrir={(lead) => setAbertoId(lead.id)}
          />
        )}
      </div>

      <button
        className="acao-flutuante"
        onClick={() => setCriandoNovo(true)}
        aria-label="Novo lead"
      >
        <IconeMais />
      </button>

      {(aberto || criandoNovo) && (
        <GavetaLead
          usuario={usuario}
          equipe={equipe}
          lead={aberto}
          historico={historicoAberto}
          aoFechar={fecharGaveta}
          aoConcluir={aoSalvar}
          aoAtualizar={(mensagem, erro) => {
            avisar(mensagem, erro);
            router.refresh();
          }}
        />
      )}

      {recado && (
        <Recado texto={recado.texto} erro={recado.erro} aoFechar={() => setRecado(null)} />
      )}
    </>
  );
}

function ResumoRapido({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className={`resumo-item${alerta ? ' resumo-item-alerta' : ''}`}>
      <span className="indicador-rotulo">{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}
