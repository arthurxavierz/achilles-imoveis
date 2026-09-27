'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import {
  agruparPorDia,
  diaLocal,
  gradeDaSemana,
  NOMES_MES,
  rotuloDia,
  rotuloDiaRelativo,
  TIPOS_COMPROMISSO,
  type CompromissoDetalhado,
  type Perfil,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import {
  IconeAgenda,
  IconeDireita,
  IconeEsquerda,
  IconeGrade,
  IconeLista,
  IconeMais,
  IconeRelogio,
} from '@/componentes/Icones';
import { GradeMes } from './GradeMes';
import { GradeSemana } from './GradeSemana';
import { ListaAgenda } from './ListaAgenda';
import { GavetaCompromisso } from './GavetaCompromisso';
import { Recado } from '@/componentes/Recado';

type Visao = 'mes' | 'semana' | 'dia' | 'lista';

const VISOES: { chave: Visao; rotulo: string; Icone: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement }[] = [
  { chave: 'mes', rotulo: 'Mês', Icone: IconeGrade },
  { chave: 'semana', rotulo: 'Semana', Icone: IconeAgenda },
  { chave: 'dia', rotulo: 'Dia', Icone: IconeRelogio },
  { chave: 'lista', rotulo: 'Lista', Icone: IconeLista },
];

/**
 * Agenda da equipe.
 *
 * Quatro leituras do mesmo periodo, porque a pergunta muda ao longo do
 * dia: o mes responde "como esta a semana que vem", a semana responde
 * "onde cabe mais uma visita", o dia responde "o que vem agora" e a
 * lista responde "o que preciso dar baixa".
 *
 * Quem manda no periodo exibido e a URL, e nao o estado do React. Assim
 * um gestor consegue mandar por WhatsApp o link da agenda de dezembro de
 * um corretor especifico, e o botao voltar do navegador funciona.
 */
export function Agenda({
  usuario,
  equipe,
  compromissos,
  ano,
  mes,
  responsavelFiltro,
  visaoInicial,
}: {
  usuario: Perfil;
  equipe: Perfil[];
  compromissos: CompromissoDetalhado[];
  ano: number;
  mes: number;
  responsavelFiltro: string;
  visaoInicial: string;
}) {
  const router = useRouter();

  const hoje = diaLocal(new Date());

  const [visao, setVisao] = useState<Visao>(
    VISOES.some((v) => v.chave === visaoInicial) ? (visaoInicial as Visao) : 'mes',
  );
  const [diaFoco, setDiaFoco] = useState<string>(() => {
    // Ao abrir um mês que não é o atual, a semana e o dia começam no
    // primeiro dia daquele mês, e não em uma data fora da tela.
    const agora = new Date();
    if (agora.getFullYear() === ano && agora.getMonth() + 1 === mes) return hoje;
    return `${ano}-${String(mes).padStart(2, '0')}-01`;
  });

  const [tiposOcultos, setTiposOcultos] = useState<string[]>([]);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);

  const [emEdicao, setEmEdicao] = useState<CompromissoDetalhado | null>(null);
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [diaEscolhido, setDiaEscolhido] = useState<string | null>(null);
  const [horaEscolhida, setHoraEscolhida] = useState<string | null>(null);
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const filtrados = useMemo(
    () =>
      compromissos
        .filter((c) => !responsavelFiltro || c.responsavel_id === responsavelFiltro)
        .filter((c) => !tiposOcultos.includes(c.tipo))
        .filter((c) => mostrarCancelados || c.status !== 'cancelado'),
    [compromissos, responsavelFiltro, tiposOcultos, mostrarCancelados],
  );

  const porDia = useMemo(() => agruparPorDia(filtrados), [filtrados]);

  const doDia = porDia.get(hoje) ?? [];
  const pendentesHoje = doDia.filter((c) => c.status === 'agendado' || c.status === 'confirmado');

  const atrasados = useMemo(
    () =>
      filtrados.filter(
        (c) =>
          (c.status === 'agendado' || c.status === 'confirmado') &&
          diaLocal(c.inicio) < hoje &&
          (gestor || c.responsavel_id === usuario.id),
      ),
    [filtrados, hoje, gestor, usuario.id],
  );

  function navegar(mudancas: Record<string, string | null>) {
    const params = new URLSearchParams();
    params.set('mes', `${ano}-${String(mes).padStart(2, '0')}`);
    if (responsavelFiltro) params.set('responsavel', responsavelFiltro);
    params.set('visao', visao);

    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) params.delete(chave);
      else params.set(chave, valor);
    }

    router.push(`/agenda?${params.toString()}`);
  }

  function irParaMes(data: Date) {
    navegar({ mes: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}` });
  }

  /**
   * O passo do botão muda com a visão: em mês anda um mês, na semana
   * anda sete dias, no dia anda um dia. Quando o novo foco cai em outro
   * mês, a URL acompanha para que os dados do período venham do servidor.
   */
  function andar(passo: number) {
    if (visao === 'mes' || visao === 'lista') {
      irParaMes(new Date(ano, mes - 1 + passo, 1));
      return;
    }

    const dias = visao === 'semana' ? 7 : 1;
    const [a, m, d] = diaFoco.split('-').map(Number);
    const alvo = new Date(a, m - 1, d + passo * dias);
    const novoDia = `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, '0')}-${String(
      alvo.getDate(),
    ).padStart(2, '0')}`;

    setDiaFoco(novoDia);
    if (alvo.getFullYear() !== ano || alvo.getMonth() + 1 !== mes) irParaMes(alvo);
  }

  function irParaHoje() {
    setDiaFoco(hoje);
    const agora = new Date();
    if (agora.getFullYear() !== ano || agora.getMonth() + 1 !== mes) irParaMes(agora);
  }

  function abrirNovo(dia?: string, hora?: string) {
    setEmEdicao(null);
    setDiaEscolhido(dia ?? null);
    setHoraEscolhida(hora ?? null);
    setGavetaAberta(true);
  }

  function abrirEdicao(compromisso: CompromissoDetalhado) {
    setEmEdicao(compromisso);
    setDiaEscolhido(null);
    setHoraEscolhida(null);
    setGavetaAberta(true);
  }

  function aoConcluir(mensagem: string, erro = false) {
    setGavetaAberta(false);
    setEmEdicao(null);
    setRecado({ texto: mensagem, erro });
    router.refresh();
  }

  function alternarTipo(tipo: string) {
    setTiposOcultos((atual) =>
      atual.includes(tipo) ? atual.filter((t) => t !== tipo) : [...atual, tipo],
    );
  }

  const semana = useMemo(() => gradeDaSemana(diaFoco), [diaFoco]);

  const titulo =
    visao === 'dia'
      ? rotuloDiaRelativo(diaFoco)
      : visao === 'semana'
        ? `${rotuloDia(semana[0]).replace(/^\w+-feira, |^\w+, /, '')} a ${rotuloDia(semana[6]).replace(/^\w+-feira, |^\w+, /, '')}`
        : `${NOMES_MES[mes - 1]} ${ano}`;

  return (
    <>
      <CabecalhoPagina titulo="Agenda">
        <button className="btn somente-desktop" onClick={() => abrirNovo()}>
          <IconeMais />
          Novo compromisso
        </button>
      </CabecalhoPagina>

      <div className="corpo">
        {pendentesHoje.length > 0 && (
          <div className="aviso aviso-info" style={{ marginBottom: 12 }}>
            <IconeAgenda />
            <span>
              Você tem <strong>{pendentesHoje.length}</strong>{' '}
              {pendentesHoje.length === 1 ? 'compromisso' : 'compromissos'} hoje. O primeiro é{' '}
              <strong>{pendentesHoje[0].titulo}</strong>.
            </span>
          </div>
        )}

        {atrasados.length > 0 && (
          <div className="aviso aviso-atencao" style={{ marginBottom: 18 }}>
            <IconeRelogio />
            <span>
              <strong>{atrasados.length}</strong>{' '}
              {atrasados.length === 1
                ? 'compromisso passou da data e continua aberto'
                : 'compromissos passaram da data e continuam abertos'}
              . Dar baixa mantém o histórico e os indicadores corretos.
            </span>
            <button
              className="btn btn-claro btn-pequeno empurra"
              onClick={() => setVisao('lista')}
            >
              Ver na lista
            </button>
          </div>
        )}

        <div className="agenda-topo">
          <div className="navegador-mes">
            <button onClick={() => andar(-1)} aria-label="Período anterior">
              <IconeEsquerda />
            </button>
            <span className="rotulo-periodo">{titulo}</span>
            <button onClick={() => andar(1)} aria-label="Próximo período">
              <IconeDireita />
            </button>
          </div>

          <button className="btn btn-claro btn-pequeno" onClick={irParaHoje}>
            Hoje
          </button>

          <div className="seletor-visao">
            {VISOES.map(({ chave, rotulo, Icone }) => (
              <button
                key={chave}
                aria-pressed={visao === chave}
                onClick={() => setVisao(chave)}
                title={`Visão de ${rotulo.toLowerCase()}`}
              >
                <Icone />
                <span className="somente-desktop">{rotulo}</span>
              </button>
            ))}
          </div>

          {/* O filtro de pessoa aparece para todos: ver a agenda do
              colega evita marcar visita em cima de plantão alheio. Quem
              não é gestão apenas não consegue editar o que vê. */}
          <div className="campo empurra" style={{ minWidth: 190 }}>
            <select
              value={responsavelFiltro}
              onChange={(e) => navegar({ responsavel: e.target.value || null })}
              aria-label="Filtrar por responsável"
            >
              <option value="">Agenda de toda a equipe</option>
              <option value={usuario.id}>Somente a minha</option>
              {equipe
                .filter((p) => p.id !== usuario.id && p.ativo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="legenda-agenda">
          {TIPOS_COMPROMISSO.map((t) => (
            <button
              key={t.chave}
              className={`ficha-tipo ficha-${t.cor}${tiposOcultos.includes(t.chave) ? ' apagada' : ''}`}
              onClick={() => alternarTipo(t.chave)}
              aria-pressed={!tiposOcultos.includes(t.chave)}
              title={
                tiposOcultos.includes(t.chave)
                  ? `Mostrar ${t.rotulo.toLowerCase()}`
                  : `Ocultar ${t.rotulo.toLowerCase()}`
              }
            >
              <span className="ficha-cor" />
              {t.rotulo}
            </button>
          ))}

          <button
            className={`ficha-tipo ficha-cinza${mostrarCancelados ? '' : ' apagada'}`}
            onClick={() => setMostrarCancelados(!mostrarCancelados)}
            aria-pressed={mostrarCancelados}
          >
            <span className="ficha-cor" />
            Cancelados
          </button>

          <span className="texto-mudo empurra somente-desktop">
            {filtrados.length} {filtrados.length === 1 ? 'compromisso' : 'compromissos'} no período
          </span>
        </div>

        {visao === 'mes' && (
          <GradeMes
            ano={ano}
            mes={mes}
            porDia={porDia}
            usuario={usuario}
            aoAbrirDia={(dia) => {
              setDiaFoco(dia);
              setVisao('dia');
            }}
            aoCriarEm={(dia) => abrirNovo(dia)}
            aoAbrirCompromisso={abrirEdicao}
          />
        )}

        {visao === 'semana' && (
          <GradeSemana
            dias={semana}
            porDia={porDia}
            usuario={usuario}
            aoAbrirCompromisso={abrirEdicao}
            aoCriarEm={(dia, hora) => abrirNovo(dia, hora)}
          />
        )}

        {visao === 'dia' && (
          <GradeSemana
            dias={[diaFoco]}
            porDia={porDia}
            usuario={usuario}
            aoAbrirCompromisso={abrirEdicao}
            aoCriarEm={(dia, hora) => abrirNovo(dia, hora)}
          />
        )}

        {visao === 'lista' && (
          <ListaAgenda
            porDia={porDia}
            usuario={usuario}
            aoEditar={abrirEdicao}
            aoAtualizar={(mensagem, erro) => {
              setRecado({ texto: mensagem, erro });
              router.refresh();
            }}
          />
        )}
      </div>

      <button className="acao-flutuante" onClick={() => abrirNovo()} aria-label="Novo compromisso">
        <IconeMais />
      </button>

      {gavetaAberta && (
        <GavetaCompromisso
          usuario={usuario}
          equipe={equipe}
          compromisso={emEdicao}
          diaSugerido={diaEscolhido}
          horaSugerida={horaEscolhida}
          podeMarcarParaOutros={gestor}
          aoFechar={() => {
            setGavetaAberta(false);
            setEmEdicao(null);
          }}
          aoConcluir={aoConcluir}
        />
      )}

      {recado && (
        <Recado texto={recado.texto} erro={recado.erro} aoFechar={() => setRecado(null)} />
      )}
    </>
  );
}
