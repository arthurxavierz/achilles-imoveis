'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';

import {
  brl,
  corInteracao,
  data as fmtData,
  dataHora,
  diasSemContato,
  ETAPAS,
  iniciais,
  MOTIVOS_PERDA,
  ORIGENS_LEAD,
  rotuloInteracao,
  rotuloOrigem,
  telefone as fmtTelefone,
  telefoneWhatsApp,
  tempoRelativo,
  TIPOS_INTERACAO_MANUAIS,
  type Interacao,
  type Lead,
  type Perfil,
} from '@imob/core';

import {
  arquivarLead,
  excluirInteracao,
  excluirLead,
  reabrirLead,
  registrarInteracao,
  salvarLead,
  transferirLead,
  type EstadoAcao,
} from '@/app/(painel)/leads/acoes';
import {
  IconeAlerta,
  IconeCheck,
  IconeFechar,
  IconeLapis,
  IconeLixeira,
  IconeTelefone,
  IconeWhatsApp,
} from '@/componentes/Icones';

const ESTADO_INICIAL: EstadoAcao = { ok: false };

type Aba = 'historico' | 'dados';

/**
 * Ficha do lead.
 *
 * Reune numa gaveta o que antes exigia tres telas: o contato, o
 * historico do atendimento e a edicao. A gaveta importa aqui mais do que
 * em outros lugares porque quem esta atendendo costuma estar ao telefone
 * com a pessoa: sair da lista para uma pagina e voltar perde o lugar na
 * fila de trabalho.
 *
 * As acoes destrutivas ficam separadas no fim, e arquivar exige motivo.
 * O motivo nao e burocracia: e o unico dado que responde por que a
 * operacao perde negocio, e sem ele o relatorio de perdas nao existe.
 */
export function GavetaLead({
  usuario,
  equipe,
  lead,
  historico,
  aoFechar,
  aoConcluir,
  aoAtualizar,
}: {
  usuario: Perfil;
  equipe: Perfil[];
  lead: Lead | null;
  historico: Interacao[];
  aoFechar: () => void;
  /** Encerrou o trabalho neste lead: a gaveta fecha. */
  aoConcluir: (mensagem: string, erro?: boolean) => void;
  /** Mudou algo sem sair da ficha: avisa e recarrega, sem fechar. */
  aoAtualizar: (mensagem: string, erro?: boolean) => void;
}) {
  const [estado, enviar, enviando] = useActionState(salvarLead, ESTADO_INICIAL);
  const [estadoNota, enviarNota, enviandoNota] = useActionState(
    registrarInteracao,
    ESTADO_INICIAL,
  );
  const [pendente, iniciar] = useTransition();

  const novo = !lead;
  const [aba, setAba] = useState<Aba>(novo ? 'dados' : 'historico');
  const [editando, setEditando] = useState(novo);
  const [motivoAberto, setMotivoAberto] = useState(false);
  const [motivo, setMotivo] = useState<string>(MOTIVOS_PERDA[0]);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  useEffect(() => {
    if (estado.ok && estado.mensagem) aoConcluir(estado.mensagem);
  }, [estado, aoConcluir]);

  useEffect(() => {
    if (estadoNota.ok && estadoNota.mensagem) setAba('historico');
  }, [estadoNota]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') aoFechar();
    }
    document.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [aoFechar]);

  /**
   * Acoes que encerram o trabalho no lead. A gaveta fecha depois, porque
   * arquivar ou excluir tira o registro da tela de tras.
   */
  function comFechamento(promessa: Promise<EstadoAcao>, sucesso: string) {
    iniciar(async () => {
      const r = await promessa;
      aoConcluir(r.ok ? (r.mensagem ?? sucesso) : (r.erro ?? 'Falha na operação.'), !r.ok);
    });
  }

  /**
   * Acoes que acontecem dentro da ficha. Apagar uma anotacao nao pode
   * jogar a pessoa de volta para a lista: ela ainda esta lendo o
   * historico.
   */
  function semSair(promessa: Promise<EstadoAcao>, sucesso: string) {
    iniciar(async () => {
      const r = await promessa;
      aoAtualizar(r.ok ? (r.mensagem ?? sucesso) : (r.erro ?? 'Falha na operação.'), !r.ok);
    });
  }

  const dono = lead?.corretor_id ? equipe.find((p) => p.id === lead.corretor_id) : null;
  const dias = lead ? diasSemContato(lead, historico[0]?.criado_em) : 0;
  const parado = Boolean(lead) && !['fechado', 'perdido'].includes(lead!.etapa) && dias > 7;

  return (
    <>
      <div className="fundo-escuro" onClick={aoFechar} aria-hidden="true" />

      <div className="gaveta gaveta-larga" role="dialog" aria-modal="true" aria-label="Lead">
        <header className="gaveta-topo">
          <div className="linha-flex" style={{ gap: 12, minWidth: 0 }}>
            {lead && <span className="avatar avatar-g">{iniciais(lead.nome)}</span>}
            <div style={{ minWidth: 0 }}>
              <h2>{lead ? lead.nome : 'Novo lead'}</h2>
              <p>
                {lead
                  ? `${rotuloOrigem(lead.origem)} · entrou ${tempoRelativo(lead.criado_em)}`
                  : 'Cadastro manual de quem chegou por telefone, indicação ou na loja.'}
              </p>
            </div>
          </div>
          <button className="btn-icone" onClick={aoFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>

        {lead && (
          <div className="gaveta-atalhos">
            {lead.telefone && (
              <>
                <a
                  className="btn btn-claro btn-pequeno btn-zap-cheio"
                  href={`https://wa.me/${telefoneWhatsApp(lead.telefone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconeWhatsApp />
                  WhatsApp
                </a>
                <a className="btn btn-claro btn-pequeno" href={`tel:+55${lead.telefone}`}>
                  <IconeTelefone />
                  {fmtTelefone(lead.telefone)}
                </a>
              </>
            )}
            {lead.email && (
              <a className="btn btn-claro btn-pequeno" href={`mailto:${lead.email}`}>
                {lead.email}
              </a>
            )}
            {!editando && (
              <button
                className="btn btn-claro btn-pequeno empurra"
                onClick={() => {
                  setEditando(true);
                  setAba('dados');
                }}
              >
                <IconeLapis />
                Editar
              </button>
            )}
          </div>
        )}

        {lead && (
          <div className="abas" role="tablist">
            <button
              role="tab"
              aria-selected={aba === 'historico'}
              onClick={() => setAba('historico')}
            >
              Histórico
              <span className="aba-contador">{historico.length}</span>
            </button>
            <button role="tab" aria-selected={aba === 'dados'} onClick={() => setAba('dados')}>
              {editando ? 'Editar dados' : 'Dados do lead'}
            </button>
          </div>
        )}

        {aba === 'historico' && lead ? (
          <>
            <div className="gaveta-corpo">
              {parado && (
                <div className="aviso aviso-atencao" style={{ marginBottom: 16 }}>
                  <IconeAlerta />
                  <span>
                    Este atendimento está há <strong>{dias} dias</strong> sem nenhum contato
                    registrado. Um retorno agora costuma valer mais que um lead novo.
                  </span>
                </div>
              )}

              <div className="ficha-resumo">
                <FichaItem rotulo="Etapa" valor={ETAPAS.find((e) => e.chave === lead.etapa)?.nome ?? 'Perdido'} />
                <FichaItem
                  rotulo="Interesse"
                  valor={lead.valor > 0 ? brl(lead.valor) : 'A definir'}
                />
                <FichaItem rotulo="Responsável" valor={dono?.nome ?? 'Sem responsável'} />
                <FichaItem rotulo="Score" valor={`${lead.score} de 100`} />
                {lead.proximo_contato && (
                  <FichaItem rotulo="Retorno combinado" valor={fmtData(lead.proximo_contato)} />
                )}
                {lead.imovel_titulo && <FichaItem rotulo="Imóvel" valor={lead.imovel_titulo} />}
              </div>

              {lead.mensagem && (
                <div className="ficha-mensagem">
                  <span className="indicador-rotulo">O que o cliente escreveu</span>
                  <p>{lead.mensagem}</p>
                </div>
              )}

              <form action={enviarNota} className="formulario-nota">
                <input type="hidden" name="lead_id" value={lead.id} />

                <div className="campo">
                  <label htmlFor="conteudo">Registrar contato</label>
                  <textarea
                    id="conteudo"
                    name="conteudo"
                    placeholder="O que foi conversado, o que ficou combinado e para quando."
                    maxLength={2000}
                    rows={3}
                    required
                  />
                </div>

                <div className="linha-flex" style={{ gap: 10 }}>
                  <div className="campo" style={{ flex: 1 }}>
                    <select name="tipo" defaultValue="nota" aria-label="Tipo de registro">
                      {TIPOS_INTERACAO_MANUAIS.map((t) => (
                        <option key={t.chave} value={t.chave}>
                          {t.rotulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button className="btn" type="submit" disabled={enviandoNota}>
                    {enviandoNota ? 'Registrando...' : 'Registrar'}
                  </button>
                </div>

                {estadoNota.erro && (
                  <div className="aviso aviso-erro">
                    <IconeAlerta />
                    <span>{estadoNota.erro}</span>
                  </div>
                )}
              </form>

              {historico.length === 0 ? (
                <p className="texto-mudo" style={{ textAlign: 'center', padding: '24px 8px' }}>
                  Nenhum contato registrado ainda. O primeiro registro entra aqui.
                </p>
              ) : (
                <ol className="historico">
                  {historico.map((i) => (
                    <li key={i.id} className={`marco marco-${corInteracao(i.tipo)}`}>
                      <div className="marco-cabecalho">
                        <span className="marco-tipo">{rotuloInteracao(i.tipo)}</span>
                        <span className="texto-mudo">{dataHora(i.criado_em)}</span>
                        {(i.autor_id === usuario.id || gestor) && i.tipo !== 'sistema' && (
                          <button
                            className="btn-icone btn-icone-pequeno empurra"
                            onClick={() => semSair(excluirInteracao(i.id), 'Anotação removida.')}
                            disabled={pendente}
                            aria-label="Excluir anotação"
                            title="Excluir anotação"
                          >
                            <IconeLixeira />
                          </button>
                        )}
                      </div>
                      <p>{i.conteudo}</p>
                      <span className="marco-autor">{i.autor_nome ?? 'Sistema'}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <footer className="gaveta-rodape gaveta-rodape-perigo">
              {lead.arquivado ? (
                <button
                  className="btn btn-claro"
                  onClick={() => comFechamento(reabrirLead(lead.id), 'Atendimento reaberto.')}
                  disabled={pendente}
                >
                  Reabrir atendimento
                </button>
              ) : (
                <button
                  className="btn btn-claro"
                  onClick={() => setMotivoAberto(!motivoAberto)}
                  disabled={pendente}
                >
                  Arquivar
                </button>
              )}

              {gestor && (
                <button
                  className="btn btn-perigo"
                  onClick={() => {
                    const certeza = window.confirm(
                      `Excluir ${lead.nome} em definitivo?\n\nO histórico de atendimento vai junto e não há como desfazer. Para tirar do funil sem perder o registro, use arquivar.`,
                    );
                    if (certeza) comFechamento(excluirLead(lead.id), 'Lead excluído.');
                  }}
                  disabled={pendente}
                >
                  <IconeLixeira />
                  Excluir
                </button>
              )}
            </footer>

            {motivoAberto && !lead.arquivado && (
              <div className="painel-motivo">
                <label htmlFor="motivo">Por que este atendimento não avança?</label>
                <div className="linha-flex" style={{ gap: 10 }}>
                  <div className="campo" style={{ flex: 1 }}>
                    <select
                      id="motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                    >
                      {MOTIVOS_PERDA.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="btn"
                    onClick={() => comFechamento(arquivarLead(lead.id, motivo), 'Arquivado.')}
                    disabled={pendente}
                  >
                    <IconeCheck />
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <form action={enviar} style={{ display: 'contents' }}>
            <input type="hidden" name="id" value={lead?.id ?? ''} />

            <div className="gaveta-corpo">
              {!editando && lead ? (
                <div className="ficha-resumo ficha-resumo-largo">
                  <FichaItem rotulo="Telefone" valor={fmtTelefone(lead.telefone) || 'Não informado'} />
                  <FichaItem rotulo="E-mail" valor={lead.email ?? 'Não informado'} />
                  <FichaItem rotulo="Origem" valor={rotuloOrigem(lead.origem)} />
                  <FichaItem rotulo="Página de entrada" valor={lead.pagina_origem ?? '--'} />
                  <FichaItem
                    rotulo="Campanha"
                    valor={lead.utm_campaign ? `${lead.utm_source} / ${lead.utm_campaign}` : '--'}
                  />
                  <FichaItem
                    rotulo="Consentimento LGPD"
                    valor={
                      lead.consentimento_lgpd
                        ? `Aceito em ${fmtData(lead.consentimento_em)}`
                        : 'Não registrado'
                    }
                  />
                </div>
              ) : (
                <div className="formulario">
                  <div className="campo">
                    <label htmlFor="nome">
                      Nome<span className="obrigatorio">*</span>
                    </label>
                    <input
                      id="nome"
                      name="nome"
                      defaultValue={lead?.nome ?? ''}
                      maxLength={120}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="linha-campos">
                    <div className="campo">
                      <label htmlFor="telefone">Telefone</label>
                      <input
                        id="telefone"
                        name="telefone"
                        defaultValue={lead?.telefone ?? ''}
                        inputMode="tel"
                        placeholder="(34) 90000-0000"
                      />
                    </div>

                    <div className="campo">
                      <label htmlFor="email">E-mail</label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        defaultValue={lead?.email ?? ''}
                        placeholder="cliente@email.com"
                      />
                    </div>
                  </div>

                  <div className="linha-campos">
                    <div className="campo">
                      <label htmlFor="origem">Origem</label>
                      <select id="origem" name="origem" defaultValue={lead?.origem ?? 'manual'}>
                        {ORIGENS_LEAD.map((o) => (
                          <option key={o.chave} value={o.chave}>
                            {o.rotulo}
                          </option>
                        ))}
                      </select>
                      <span className="ajuda">
                        Site e portal são preenchidos sozinhos. Escolha aqui quando o contato vier
                        por telefone, indicação ou atendimento na loja.
                      </span>
                    </div>

                    <div className="campo">
                      <label htmlFor="etapa">Etapa</label>
                      <select id="etapa" name="etapa" defaultValue={lead?.etapa ?? 'novo'}>
                        {ETAPAS.map((e) => (
                          <option key={e.chave} value={e.chave}>
                            {e.nome}
                          </option>
                        ))}
                        <option value="perdido">Perdido</option>
                      </select>
                    </div>
                  </div>

                  <div className="linha-campos">
                    <div className="campo">
                      <label htmlFor="valor">Valor de interesse</label>
                      <div className="campo-prefixado">
                        <span>R$</span>
                        <input
                          id="valor"
                          name="valor"
                          inputMode="numeric"
                          defaultValue={lead?.valor ? String(lead.valor) : ''}
                          placeholder="850000"
                        />
                      </div>
                    </div>

                    <div className="campo">
                      <label htmlFor="proximo_contato">Retorno combinado</label>
                      <input
                        id="proximo_contato"
                        name="proximo_contato"
                        type="date"
                        defaultValue={lead?.proximo_contato ?? ''}
                      />
                      <span className="ajuda">
                        A data aparece nas pendências da visão geral quando chegar.
                      </span>
                    </div>
                  </div>

                  <div className="campo">
                    <label htmlFor="imovel_titulo">Imóvel de interesse</label>
                    <input
                      id="imovel_titulo"
                      name="imovel_titulo"
                      defaultValue={lead?.imovel_titulo ?? ''}
                      placeholder="Cobertura Duplex Morada da Colina"
                      maxLength={160}
                    />
                  </div>

                  {gestor && (
                    <div className="campo">
                      <label htmlFor="corretor_id">Responsável pelo atendimento</label>
                      <select
                        id="corretor_id"
                        name="corretor_id"
                        defaultValue={lead?.corretor_id ?? ''}
                      >
                        <option value="">Deixar na fila, sem responsável</option>
                        {equipe
                          .filter((p) => p.ativo)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                              {p.id === usuario.id ? ' (você)' : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div className="campo">
                    <label htmlFor="mensagem">Observação inicial</label>
                    <textarea
                      id="mensagem"
                      name="mensagem"
                      defaultValue={lead?.mensagem ?? ''}
                      placeholder="O que a pessoa procura, orçamento, prazo e qualquer combinado."
                      maxLength={2000}
                    />
                  </div>

                  {estado.erro && (
                    <div className="aviso aviso-erro">
                      <IconeAlerta />
                      <span>{estado.erro}</span>
                    </div>
                  )}
                </div>
              )}

              {lead && !editando && gestor && (
                <div className="bloco-transferencia">
                  <span className="indicador-rotulo">Transferir atendimento</span>
                  <p className="texto-mudo">
                    A troca fica registrada no histórico, com quem passou e para quem.
                  </p>
                  <div className="linha-flex" style={{ gap: 10, marginTop: 10 }}>
                    <div className="campo" style={{ flex: 1 }}>
                      <select
                        defaultValue={lead.corretor_id ?? ''}
                        aria-label="Novo responsável"
                        onChange={(e) =>
                          semSair(transferirLead(lead.id, e.target.value), 'Transferido.')
                        }
                        disabled={pendente}
                      >
                        <option value="">Sem responsável, volta para a fila</option>
                        {equipe
                          .filter((p) => p.ativo)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nome}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(editando || novo) && (
              <footer className="gaveta-rodape">
                <button
                  type="button"
                  className="btn btn-claro"
                  onClick={() => (novo ? aoFechar() : setEditando(false))}
                >
                  Cancelar
                </button>
                <button className="btn" type="submit" disabled={enviando}>
                  {enviando ? 'Salvando...' : novo ? 'Cadastrar lead' : 'Salvar alterações'}
                </button>
              </footer>
            )}
          </form>
        )}
      </div>
    </>
  );
}

function FichaItem({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="ficha-item">
      <span className="indicador-rotulo">{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}
