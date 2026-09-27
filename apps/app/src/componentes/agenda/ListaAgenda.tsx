'use client';

import { useTransition } from 'react';

import {
  corTipo,
  diaLocal,
  faixaHoraria,
  horaLocal,
  podeGerirCompromisso,
  rotuloDiaRelativo,
  rotuloTipo,
  STATUS_COMPROMISSO,
  type CompromissoDetalhado,
  type Perfil,
} from '@imob/core';

import {
  IconeCadeado,
  IconeCheck,
  IconeFechar,
  IconeLapis,
  IconeLixeira,
  IconeLocal,
  IconeRelogio,
  IconeTelefone,
  IconeUsuario,
  IconeVazio,
} from '@/componentes/Icones';
import { excluirCompromisso, mudarStatusCompromisso } from '@/app/(painel)/agenda/acoes';

/**
 * Agenda em lista, agrupada por dia.
 *
 * E a visao que a equipe usa no celular. A grade mensal responde "como
 * esta o mes"; esta responde "o que eu faco agora", que e a pergunta de
 * quem esta na rua entre uma visita e outra.
 */
export function ListaAgenda({
  porDia,
  usuario,
  aoEditar,
  aoAtualizar,
}: {
  porDia: Map<string, CompromissoDetalhado[]>;
  usuario: Perfil;
  aoEditar: (c: CompromissoDetalhado) => void;
  aoAtualizar: (mensagem: string, erro?: boolean) => void;
}) {
  const [pendente, iniciar] = useTransition();

  const dias = [...porDia.keys()].sort();
  const hoje = diaLocal(new Date());

  // Dias passados ficam depois dos futuros: o que vem pela frente e o
  // que interessa ao abrir a tela.
  const futuros = dias.filter((d) => d >= hoje);
  const passados = dias.filter((d) => d < hoje).reverse();
  const ordenados = [...futuros, ...passados];

  if (ordenados.length === 0) {
    return (
      <div className="vazio">
        <IconeVazio />
        <h3>Nenhum compromisso neste período</h3>
        <p>
          Marque visitas, plantões e reuniões para que a equipe inteira enxergue a mesma agenda e
          ninguém marque duas coisas no mesmo horário.
        </p>
      </div>
    );
  }

  function mudarPara(c: CompromissoDetalhado, status: string, aviso: string) {
    iniciar(async () => {
      const r = await mudarStatusCompromisso(c.id, status);
      aoAtualizar(r.ok ? aviso : (r.erro ?? 'Falha ao atualizar.'), !r.ok);
    });
  }

  function excluir(c: CompromissoDetalhado) {
    const certeza = window.confirm(
      `Excluir "${c.titulo}"?\n\nEsta ação não pode ser desfeita. Se o compromisso apenas mudou de data, prefira editar.`,
    );
    if (!certeza) return;

    iniciar(async () => {
      const r = await excluirCompromisso(c.id);
      aoAtualizar(r.ok ? 'Compromisso excluído.' : (r.erro ?? 'Falha ao excluir.'), !r.ok);
    });
  }

  return (
    <div>
      {ordenados.map((dia) => (
        <section key={dia} className="agenda-dia">
          <div className="agenda-dia-titulo">
            <h3>{rotuloDiaRelativo(dia)}</h3>
            <span className="texto-mudo">
              {porDia.get(dia)!.length}{' '}
              {porDia.get(dia)!.length === 1 ? 'compromisso' : 'compromissos'}
            </span>
          </div>

          {porDia.get(dia)!.map((c) => {
            const editavel = podeGerirCompromisso(usuario, c);
            const situacao = STATUS_COMPROMISSO[c.status];
            const aberto = c.status !== 'concluido' && c.status !== 'cancelado';
            const meu = c.responsavel_id === usuario.id;
            const marcadoPorOutro = c.criado_por && c.criado_por !== c.responsavel_id;

            return (
              <article
                key={c.id}
                className={[
                  'compromisso',
                  `compromisso-${corTipo(c.tipo)}`,
                  aberto && dia < hoje && 'compromisso-atrasado',
                  !aberto && 'compromisso-fechado',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="compromisso-hora">
                  {c.dia_inteiro ? 'Dia' : horaLocal(c.inicio)}
                  <small>{c.dia_inteiro ? 'inteiro' : `até ${horaLocal(c.fim)}`}</small>
                </div>

                <div className="compromisso-corpo" style={{ minWidth: 0 }}>
                  <div className="linha-flex" style={{ gap: 8 }}>
                    <span className="compromisso-titulo">{c.titulo}</span>
                    <span className={`etiqueta etiqueta-${situacao.cor}`}>{situacao.rotulo}</span>
                    {c.travado && (
                      <span className="travado">
                        <IconeCadeado />
                        Fixado pela gestão
                      </span>
                    )}
                  </div>

                  <div className="compromisso-meta">
                    <span>
                      <IconeRelogio />
                      {rotuloTipo(c.tipo)} · {faixaHoraria(c)}
                    </span>

                    <span>
                      <IconeUsuario />
                      {meu ? 'Você' : c.responsavel_nome}
                      {marcadoPorOutro && c.criado_por_nome && ` · marcado por ${c.criado_por_nome}`}
                    </span>

                    {c.local && (
                      <span>
                        <IconeLocal />
                        {c.local}
                      </span>
                    )}
                  </div>

                  {(c.imovel_titulo || c.lead_nome) && (
                    <div className="compromisso-meta">
                      {c.imovel_titulo && <span>Imóvel: {c.imovel_titulo}</span>}
                      {c.lead_nome && <span>Cliente: {c.lead_nome}</span>}
                    </div>
                  )}

                  {c.observacao && <p className="compromisso-observacao">{c.observacao}</p>}
                </div>

                <div className="compromisso-acoes">
                  {editavel && aberto && c.status === 'agendado' && (
                    <button
                      className="btn-icone"
                      onClick={() => mudarPara(c, 'confirmado', 'Confirmado com o cliente.')}
                      disabled={pendente}
                      title="Confirmar com o cliente"
                      aria-label={`Confirmar ${c.titulo}`}
                    >
                      <IconeTelefone />
                    </button>
                  )}

                  {editavel && aberto && (
                    <button
                      className="btn-icone btn-icone-verde"
                      onClick={() => mudarPara(c, 'concluido', 'Compromisso concluído.')}
                      disabled={pendente}
                      title="Marcar como concluído"
                      aria-label={`Concluir ${c.titulo}`}
                    >
                      <IconeCheck />
                    </button>
                  )}

                  {editavel && aberto && (
                    <button
                      className="btn-icone"
                      onClick={() => mudarPara(c, 'cancelado', 'Compromisso cancelado.')}
                      disabled={pendente}
                      title="Cancelar"
                      aria-label={`Cancelar ${c.titulo}`}
                    >
                      <IconeFechar />
                    </button>
                  )}

                  {editavel ? (
                    <>
                      <button
                        className="btn-icone"
                        onClick={() => aoEditar(c)}
                        title="Editar"
                        aria-label={`Editar ${c.titulo}`}
                      >
                        <IconeLapis />
                      </button>
                      <button
                        className="btn-icone btn-icone-rubro"
                        onClick={() => excluir(c)}
                        disabled={pendente}
                        title="Excluir"
                        aria-label={`Excluir ${c.titulo}`}
                      >
                        <IconeLixeira />
                      </button>
                    </>
                  ) : (
                    <span className="texto-mudo" style={{ fontSize: '0.74rem' }}>
                      Somente leitura
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      ))}
    </div>
  );
}
