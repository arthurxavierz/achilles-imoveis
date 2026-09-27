'use client';

import { useState, useTransition } from 'react';

import {
  brl,
  data as fmtData,
  ETAPAS_VENDA,
  STATUS_VENDA,
  type Perfil,
  type VendaDetalhada,
  type VendaParcela,
} from '@imob/core';

import { mudarStatusVenda } from '@/app/(painel)/financeiro/acoes';
import { IconeCheck, IconeLapis } from '@/componentes/Icones';

/**
 * Cartao de um negocio.
 *
 * Mostra o que o dono da imobiliaria pergunta primeiro, nesta ordem:
 * quanto foi, quanto de comissao gerou, quanto sobrou para a casa. A
 * repartição desenhada logo abaixo torna a divisao entendivel sem que
 * ninguem precise fazer conta de cabeca.
 */
export function CartaoVenda({
  venda,
  parcelas,
  usuario,
  aoEditar,
  aoAtualizar,
}: {
  venda: VendaDetalhada;
  parcelas: VendaParcela[];
  usuario: Perfil;
  aoEditar: () => void;
  aoAtualizar: (mensagem: string, erro?: boolean) => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [motivo, setMotivo] = useState('');

  const situacao = STATUS_VENDA[venda.status];
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  // Negocio concluido vira historico contabil: so a gestao mexe.
  const editavel =
    gestor || (venda.consultor_id === usuario.id && ['proposta', 'aprovada'].includes(venda.status));

  const recebido = parcelas
    .filter((p) => p.status === 'pago')
    .reduce((soma, p) => soma + Number(p.valor), 0);

  const indiceAtual = ETAPAS_VENDA.indexOf(venda.status as (typeof ETAPAS_VENDA)[number]);
  const cancelada = venda.status === 'cancelada';

  // Percentuais da barra de repartição. Base é a comissão bruta.
  const bruta = Number(venda.comissao_bruta) || 1;
  const fatia = (valor: number) => `${Math.max(0, (Number(valor) / bruta) * 100)}%`;

  function avancar(novoStatus: string) {
    iniciar(async () => {
      const r = await mudarStatusVenda(venda.id, novoStatus);
      aoAtualizar(r.ok ? (r.mensagem ?? 'Atualizado.') : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  function cancelar() {
    if (!motivo.trim()) return;
    iniciar(async () => {
      const r = await mudarStatusVenda(venda.id, 'cancelada', motivo);
      setConfirmandoCancelamento(false);
      setMotivo('');
      aoAtualizar(r.ok ? 'Negócio cancelado.' : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  const proxima = indiceAtual >= 0 && indiceAtual < ETAPAS_VENDA.length - 1
    ? ETAPAS_VENDA[indiceAtual + 1]
    : null;

  return (
    <article className="venda">
      <div className="venda-topo">
        <div style={{ minWidth: 0 }}>
          <span className="venda-codigo">{venda.codigo}</span>
          <h3 className="venda-imovel">{venda.imovel_titulo}</h3>
          <p className="venda-comprador">
            {venda.comprador_nome}
            {venda.consultor_nome && ` · ${venda.consultor_nome}`}
            {venda.tipo === 'locacao' && ' · Locação'}
          </p>
        </div>

        <div className="pilha" style={{ alignItems: 'flex-end', flexShrink: 0 }}>
          <span className={`etiqueta etiqueta-${situacao.cor}`}>{situacao.rotulo}</span>
          {editavel && (
            <button
              className="btn-icone"
              onClick={aoEditar}
              aria-label={`Editar negócio ${venda.codigo}`}
              title="Editar"
            >
              <IconeLapis />
            </button>
          )}
        </div>
      </div>

      <div className="venda-valores">
        <div className="venda-valor">
          <span>Valor fechado</span>
          <strong>{brl(venda.valor_venda)}</strong>
        </div>

        {venda.desconto > 0 && (
          <div className="venda-valor negativo">
            <span>Desconto</span>
            <strong>{brl(venda.desconto)}</strong>
          </div>
        )}

        <div className="venda-valor">
          <span>Comissão ({Number(venda.percentual_comissao).toFixed(1).replace('.', ',')}%)</span>
          <strong>{brl(venda.comissao_bruta)}</strong>
        </div>

        <div className="venda-valor destaque">
          <span>Margem da casa</span>
          <strong>{brl(venda.margem)}</strong>
        </div>
      </div>

      <div style={{ padding: '16px 18px' }}>
        {/* Repartição da comissão */}
        <div className="reparticao" aria-hidden="true">
          <span className="fatia-casa" style={{ width: fatia(venda.comissao_casa) }} />
          <span className="fatia-consultor" style={{ width: fatia(venda.comissao_consultor) }} />
          {Number(venda.comissao_captador) > 0 && (
            <span className="fatia-captador" style={{ width: fatia(venda.comissao_captador) }} />
          )}
        </div>

        <div className="legenda-reparticao">
          <span>
            <i style={{ background: 'var(--marinho-700)' }} />
            Casa {brl(venda.comissao_casa)}
          </span>
          <span>
            <i style={{ background: 'var(--ouro-500)' }} />
            {venda.consultor_nome ?? 'Consultor'} {brl(venda.comissao_consultor)}
          </span>
          {Number(venda.comissao_captador) > 0 && (
            <span>
              <i style={{ background: 'var(--marinho-300)' }} />
              Captação {brl(venda.comissao_captador)}
            </span>
          )}
          {Number(venda.custos) > 0 && (
            <span>
              <i style={{ background: 'var(--rubro)' }} />
              Custos {brl(venda.custos)}
            </span>
          )}
        </div>

        {parcelas.length > 0 && (
          <p className="texto-mudo" style={{ marginTop: 12 }}>
            {brl(recebido)} recebidos de {brl(venda.comissao_bruta)} em {parcelas.length}{' '}
            {parcelas.length === 1 ? 'parcela' : 'parcelas'}
          </p>
        )}
      </div>

      {/* Trilha de andamento */}
      {!cancelada ? (
        <div className="trilha">
          {ETAPAS_VENDA.map((etapa, i) => {
            const estado =
              i < indiceAtual ? 'concluido' : i === indiceAtual ? 'atual' : 'pendente';

            return (
              <div key={etapa} style={{ display: 'contents' }}>
                <div className="trilha-passo" data-estado={estado}>
                  <span className="trilha-bola">
                    <IconeCheck />
                  </span>
                  <span className="trilha-rotulo">{STATUS_VENDA[etapa].rotulo}</span>
                </div>
                {i < ETAPAS_VENDA.length - 1 && <span className="trilha-linha" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cartao-rodape">
          <p className="texto-mudo">
            Cancelado: {venda.motivo_cancelamento ?? 'sem motivo registrado'}
          </p>
        </div>
      )}

      {editavel && !cancelada && (
        <div className="cartao-rodape">
          {confirmandoCancelamento ? (
            <div className="formulario">
              <div className="campo">
                <label htmlFor={`motivo-${venda.id}`}>Motivo do cancelamento</label>
                <input
                  id={`motivo-${venda.id}`}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Crédito negado, desistência do comprador, imóvel vendido por terceiro"
                  autoFocus
                />
              </div>
              <div className="linha-flex">
                <button
                  className="btn btn-perigo btn-pequeno"
                  onClick={cancelar}
                  disabled={pendente || !motivo.trim()}
                >
                  Confirmar cancelamento
                </button>
                <button
                  className="btn btn-claro btn-pequeno"
                  onClick={() => setConfirmandoCancelamento(false)}
                >
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <div className="linha-flex">
              {proxima && (
                <button
                  className="btn btn-pequeno"
                  onClick={() => avancar(proxima)}
                  disabled={pendente}
                >
                  <IconeCheck />
                  Avançar para {STATUS_VENDA[proxima].rotulo.toLowerCase()}
                </button>
              )}
              <button
                className="btn btn-fantasma btn-pequeno"
                onClick={() => setConfirmandoCancelamento(true)}
                disabled={pendente}
              >
                Cancelar negócio
              </button>
              <span className="texto-mudo empurra">
                Proposta em {fmtData(venda.data_proposta)}
              </span>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
