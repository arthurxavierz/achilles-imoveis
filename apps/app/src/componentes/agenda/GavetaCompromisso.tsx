'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';

import {
  diaLocal,
  horaLocal,
  podeGerirCompromisso,
  separarInstante,
  TIPOS_COMPROMISSO,
  type CompromissoDetalhado,
  type Perfil,
} from '@imob/core';

import {
  excluirCompromisso,
  mudarStatusCompromisso,
  salvarCompromisso,
  type EstadoAcao,
} from '@/app/(painel)/agenda/acoes';
import {
  IconeAlerta,
  IconeCadeado,
  IconeCheck,
  IconeFechar,
  IconeInfo,
  IconeLixeira,
} from '@/componentes/Icones';

const ESTADO_INICIAL: EstadoAcao = { ok: false };

/**
 * Formulario de compromisso, dentro de uma gaveta.
 *
 * A gaveta existe para nao tirar a pessoa da agenda: marcar uma visita
 * enquanto se olha a semana e o gesto natural, e navegar para outra
 * pagina quebraria esse fio.
 *
 * Quem pode marcar para quem:
 *   gestao   -> escolhe o responsavel e pode fixar o compromisso
 *   corretor -> marca sempre para si, e nao ve o campo de responsavel
 *
 * A trava de verdade e o RLS da migration 0006. Aqui apenas nao
 * mostramos o que iria falhar.
 */
export function GavetaCompromisso({
  usuario,
  equipe,
  compromisso,
  diaSugerido,
  horaSugerida,
  podeMarcarParaOutros,
  aoFechar,
  aoConcluir,
}: {
  usuario: Perfil;
  equipe: Perfil[];
  compromisso: CompromissoDetalhado | null;
  diaSugerido: string | null;
  horaSugerida: string | null;
  podeMarcarParaOutros: boolean;
  aoFechar: () => void;
  aoConcluir: (mensagem: string, erro?: boolean) => void;
}) {
  const [estado, enviar, enviando] = useActionState(salvarCompromisso, ESTADO_INICIAL);
  const [pendente, iniciar] = useTransition();

  const editando = Boolean(compromisso);
  const podeGerir = compromisso ? podeGerirCompromisso(usuario, compromisso) : true;

  const valores = useMemo(() => {
    if (compromisso) {
      const inicio = separarInstante(compromisso.inicio);
      return {
        data: inicio.data,
        horaInicio: inicio.hora,
        horaFim: horaLocal(compromisso.fim),
      };
    }

    // Clicar numa faixa da grade ja diz o horario. Nesse caso a hora
    // vem pronta, com uma hora de duracao.
    if (horaSugerida) {
      const [h, m] = horaSugerida.split(':').map(Number);
      const fim = `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return {
        data: diaSugerido ?? diaLocal(new Date()),
        horaInicio: horaSugerida,
        horaFim: fim,
      };
    }

    // Novo compromisso: proximo horario cheio, com uma hora de duracao.
    // Ninguem marca visita para 14h37.
    const agora = new Date();
    agora.setMinutes(agora.getMinutes() > 30 ? 60 : 30, 0, 0);
    const depois = new Date(agora.getTime() + 3600000);

    return {
      data: diaSugerido ?? diaLocal(agora),
      horaInicio: horaLocal(agora),
      horaFim: horaLocal(depois),
    };
  }, [compromisso, diaSugerido, horaSugerida]);

  const [diaInteiro, setDiaInteiro] = useState(compromisso?.dia_inteiro ?? false);
  const [travado, setTravado] = useState(compromisso?.travado ?? false);
  const [responsavel, setResponsavel] = useState(compromisso?.responsavel_id ?? usuario.id);

  useEffect(() => {
    if (estado.ok && estado.mensagem) aoConcluir(estado.mensagem);
  }, [estado, aoConcluir]);

  // Escape fecha a gaveta, como qualquer janela sobreposta.
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

  const paraOutraPessoa = responsavel !== usuario.id;
  const nomeResponsavel = equipe.find((p) => p.id === responsavel)?.nome ?? '';

  return (
    <>
      <div className="fundo-escuro" onClick={aoFechar} aria-hidden="true" />

      <div className="gaveta" role="dialog" aria-modal="true" aria-label="Compromisso">
        <header className="gaveta-topo">
          <div>
            <h2>{editando ? 'Editar compromisso' : 'Novo compromisso'}</h2>
            <p>
              {editando
                ? `Criado por ${compromisso?.criado_por_nome ?? 'sistema'}`
                : 'A equipe inteira enxerga o que for marcado aqui.'}
            </p>
          </div>
          <button className="btn-icone" onClick={aoFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>

        <form action={enviar} style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={compromisso?.id ?? ''} />

          <div className="gaveta-corpo">
            <div className="formulario">
              <div className="campo">
                <label htmlFor="titulo">
                  Título<span className="obrigatorio">*</span>
                </label>
                <input
                  id="titulo"
                  name="titulo"
                  defaultValue={compromisso?.titulo ?? ''}
                  placeholder="Visita ao apartamento do Karaíba"
                  maxLength={160}
                  required
                  autoFocus
                />
              </div>

              <div className="campo">
                <label htmlFor="tipo">Tipo</label>
                <select id="tipo" name="tipo" defaultValue={compromisso?.tipo ?? 'visita'}>
                  {TIPOS_COMPROMISSO.map((t) => (
                    <option key={t.chave} value={t.chave}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              {podeMarcarParaOutros && (
                <div className="campo">
                  <label htmlFor="responsavel_id">Responsável</label>
                  <select
                    id="responsavel_id"
                    name="responsavel_id"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                  >
                    <option value={usuario.id}>{usuario.nome} (você)</option>
                    {equipe
                      .filter((p) => p.id !== usuario.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                  </select>
                  <span className="ajuda">
                    O compromisso aparece na agenda de quem for escolhido aqui.
                  </span>
                </div>
              )}

              <label className="interruptor">
                <input
                  type="checkbox"
                  name="dia_inteiro"
                  checked={diaInteiro}
                  onChange={(e) => setDiaInteiro(e.target.checked)}
                />
                <span className="interruptor-trilho" />
                <span className="interruptor-texto">
                  <strong>Dia inteiro</strong>
                  <span>Ocupa o expediente, das 8h às 18h.</span>
                </span>
              </label>

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="data">
                    Data<span className="obrigatorio">*</span>
                  </label>
                  <input id="data" name="data" type="date" defaultValue={valores.data} required />
                </div>

                {!diaInteiro && (
                  <>
                    <div className="campo">
                      <label htmlFor="hora_inicio">
                        Início<span className="obrigatorio">*</span>
                      </label>
                      <input
                        id="hora_inicio"
                        name="hora_inicio"
                        type="time"
                        defaultValue={valores.horaInicio}
                        required
                      />
                    </div>

                    <div className="campo">
                      <label htmlFor="hora_fim">
                        Término<span className="obrigatorio">*</span>
                      </label>
                      <input
                        id="hora_fim"
                        name="hora_fim"
                        type="time"
                        defaultValue={valores.horaFim}
                        required
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="campo">
                <label htmlFor="local">Local</label>
                <input
                  id="local"
                  name="local"
                  defaultValue={compromisso?.local ?? ''}
                  placeholder="Endereço do imóvel, escritório ou reunião online"
                  maxLength={200}
                />
              </div>

              <div className="campo">
                <label htmlFor="observacao">Observação</label>
                <textarea
                  id="observacao"
                  name="observacao"
                  defaultValue={compromisso?.observacao ?? ''}
                  placeholder="O que precisa ser levado, combinado ou conferido. Quem for atender vai ler isto antes."
                  maxLength={2000}
                />
                <span className="ajuda">
                  Este texto aparece junto do compromisso para quem é responsável.
                </span>
              </div>

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="status">Situação</label>
                  <select id="status" name="status" defaultValue={compromisso?.status ?? 'agendado'}>
                    <option value="agendado">Agendado</option>
                    <option value="confirmado">Confirmado com o cliente</option>
                    <option value="concluido">Concluído</option>
                    <option value="remarcado">Remarcado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="lembrete_minutos">Lembrar antes</label>
                  <select
                    id="lembrete_minutos"
                    name="lembrete_minutos"
                    defaultValue={String(compromisso?.lembrete_minutos ?? 60)}
                  >
                    <option value="0">Sem lembrete</option>
                    <option value="15">15 minutos</option>
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="180">3 horas</option>
                    <option value="1440">1 dia</option>
                  </select>
                  <span className="ajuda">
                    O aviso por WhatsApp e e-mail entra numa próxima etapa. A preferência já fica
                    registrada.
                  </span>
                </div>
              </div>

              {podeMarcarParaOutros && (
                <label className="interruptor">
                  <input
                    type="checkbox"
                    name="travado"
                    checked={travado}
                    onChange={(e) => setTravado(e.target.checked)}
                  />
                  <span className="interruptor-trilho" />
                  <span className="interruptor-texto">
                    <strong>Fixar na agenda</strong>
                    <span>
                      Só a gestão pode alterar ou excluir. Use em plantão e reunião obrigatória.
                    </span>
                  </span>
                </label>
              )}

              {paraOutraPessoa && (
                <div className="aviso aviso-info">
                  <IconeInfo />
                  <span>
                    Este compromisso vai para a agenda de <strong>{nomeResponsavel}</strong>, com seu
                    nome registrado como quem marcou.
                    {travado && ' Como está fixado, essa pessoa não poderá alterá-lo.'}
                  </span>
                </div>
              )}

              {compromisso?.travado && !podeMarcarParaOutros && (
                <div className="aviso aviso-atencao">
                  <IconeCadeado />
                  <span>Este compromisso foi fixado pela gestão e não pode ser alterado por você.</span>
                </div>
              )}

              {estado.erro && (
                <div className="aviso aviso-erro">
                  <IconeAlerta />
                  <span>{estado.erro}</span>
                </div>
              )}
            </div>
          </div>

          <footer className="gaveta-rodape">
            {editando && podeGerir && (
              <button
                type="button"
                className="btn btn-perigo"
                disabled={pendente}
                onClick={() => {
                  const certeza = window.confirm(
                    `Excluir "${compromisso?.titulo}"?

Se o compromisso apenas mudou de data, prefira editar: assim o histórico da agenda continua completo.`,
                  );
                  if (!certeza) return;
                  iniciar(async () => {
                    const r = await excluirCompromisso(compromisso!.id);
                    aoConcluir(
                      r.ok ? 'Compromisso excluído.' : (r.erro ?? 'Falha ao excluir.'),
                      !r.ok,
                    );
                  });
                }}
              >
                <IconeLixeira />
                Excluir
              </button>
            )}

            {editando &&
              podeGerir &&
              compromisso?.status !== 'concluido' &&
              compromisso?.status !== 'cancelado' && (
                <button
                  type="button"
                  className="btn btn-claro empurra"
                  disabled={pendente}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await mudarStatusCompromisso(compromisso!.id, 'concluido');
                      aoConcluir(
                        r.ok ? 'Compromisso concluído.' : (r.erro ?? 'Falha ao atualizar.'),
                        !r.ok,
                      );
                    })
                  }
                >
                  <IconeCheck />
                  Concluir
                </button>
              )}

            <button
              type="button"
              className={editando && podeGerir ? 'btn btn-claro' : 'btn btn-claro empurra'}
              onClick={aoFechar}
            >
              Cancelar
            </button>

            {podeGerir && (
              <button className="btn" type="submit" disabled={enviando}>
                {enviando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Marcar na agenda'}
              </button>
            )}
          </footer>
        </form>
      </div>
    </>
  );
}
