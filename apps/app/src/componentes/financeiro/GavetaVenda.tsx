'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';

import {
  brl,
  calcularVenda,
  EFEITOS_NO_IMOVEL,
  FORMAS_PAGAMENTO,
  type ImovelDaVenda,
  type Perfil,
  type VendaDetalhada,
} from '@imob/core';

import { excluirVenda, salvarVenda, type EstadoAcao } from '@/app/(painel)/financeiro/acoes';
import { IconeAlerta, IconeFechar, IconeInfo, IconeLixeira } from '@/componentes/Icones';

const ESTADO_INICIAL: EstadoAcao = { ok: false };

/**
 * Formulario do negocio.
 *
 * A conta da comissao aparece enquanto a pessoa digita, no painel de
 * resultado. Isso muda o comportamento: em vez de salvar e conferir
 * depois, o consultor ve na hora quanto cada parte recebe e corrige o
 * percentual ali mesmo.
 *
 * O calculo mostrado aqui usa a mesma sequencia de arredondamento das
 * colunas geradas do banco (migration 0007), entao o numero da tela e o
 * numero que sera gravado.
 */
export function GavetaVenda({
  venda,
  imoveis,
  equipe,
  usuario,
  aoFechar,
  aoConcluir,
}: {
  venda: VendaDetalhada | null;
  imoveis: ImovelDaVenda[];
  equipe: Perfil[];
  usuario: Perfil;
  aoFechar: () => void;
  aoConcluir: (mensagem: string) => void;
}) {
  const [estado, enviar, enviando] = useActionState(salvarVenda, ESTADO_INICIAL);
  const [pendente, iniciar] = useTransition();
  const editando = Boolean(venda);
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  /**
   * O imóvel escolhido da carteira.
   *
   * Fica em estado, e não solto no formulário, porque duas coisas
   * dependem dele: o título gravado no negócio, que é preenchido
   * sozinho ao escolher, e o bloco de efeito, que não faz sentido
   * aparecer quando não há imóvel para afetar.
   */
  const [imovelId, setImovelId] = useState(venda?.imovel_id ?? '');
  const [tituloImovel, setTituloImovel] = useState(venda?.imovel_titulo ?? '');

  const imovelEscolhido = imoveis.find((i) => i.id === imovelId) ?? null;

  const [valorTabela, setValorTabela] = useState(formatar(venda?.valor_tabela));
  const [valorVenda, setValorVenda] = useState(formatar(venda?.valor_venda));
  const [pctComissao, setPctComissao] = useState(String(venda?.percentual_comissao ?? 6));
  const [pctCasa, setPctCasa] = useState(String(venda?.percentual_casa ?? 50));
  const [pctCaptador, setPctCaptador] = useState(String(venda?.percentual_captador ?? 0));
  const [custos, setCustos] = useState(formatar(venda?.custos));
  const [status, setStatus] = useState(venda?.status ?? 'proposta');

  const conta = useMemo(
    () =>
      calcularVenda({
        valorTabela: desformatar(valorTabela),
        valorVenda: desformatar(valorVenda),
        percentualComissao: Number(pctComissao) || 0,
        percentualCasa: Number(pctCasa) || 0,
        percentualCaptador: Number(pctCaptador) || 0,
        custos: desformatar(custos),
      }),
    [valorTabela, valorVenda, pctComissao, pctCasa, pctCaptador, custos],
  );

  const somaExcede = Number(pctCasa) + Number(pctCaptador) > 100;

  useEffect(() => {
    if (estado.ok && estado.mensagem) aoConcluir(estado.mensagem);
  }, [estado, aoConcluir]);

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

  return (
    <>
      <div className="fundo-escuro" onClick={aoFechar} aria-hidden="true" />

      <div className="gaveta gaveta-larga" role="dialog" aria-modal="true" aria-label="Negócio">
        <header className="gaveta-topo">
          <div>
            <h2>{editando ? `Negócio ${venda?.codigo}` : 'Registrar negócio'}</h2>
            <p>
              {editando
                ? 'Alterações recalculam a comissão automaticamente.'
                : 'Registre já na proposta. O acompanhamento vale mais que o registro no fim.'}
            </p>
          </div>
          <button className="btn-icone" onClick={aoFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>

        <form action={enviar} style={{ display: 'contents' }}>
          <input type="hidden" name="id" value={venda?.id ?? ''} />
          <input type="hidden" name="imovel_id" value={imovelId} />
          <input type="hidden" name="lead_id" value={venda?.lead_id ?? ''} />

          <div className="gaveta-corpo">
            <div className="formulario">
              {/* ---------- IMOVEL E PARTES ---------- */}
              <Secao titulo="O negócio" />

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="tipo">Tipo</label>
                  <select id="tipo" name="tipo" defaultValue={venda?.tipo ?? 'venda'}>
                    <option value="venda">Venda</option>
                    <option value="locacao">Locação</option>
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="data_proposta">Data da proposta</label>
                  <input
                    id="data_proposta"
                    name="data_proposta"
                    type="date"
                    defaultValue={venda?.data_proposta ?? new Date().toISOString().slice(0, 10)}
                  />
                </div>
              </div>

              {/* O imóvel da carteira, e não um texto solto.
                  ------------------------------------------------------
                  Este campo era só um texto digitado, e por isso
                  imovel_id ficava vazio em quase todo negócio. O efeito
                  disso não aparecia aqui: aparecia na carteira, onde o
                  gatilho do banco que tira o imóvel do ar ao concluir
                  nunca tinha um id para agir. Escolhendo da lista, o
                  negócio passa a abater no estoque de verdade. */}
              <div className="campo">
                <label htmlFor="imovel_escolhido">Imóvel da carteira</label>
                <select
                  id="imovel_escolhido"
                  value={imovelId}
                  onChange={(e) => {
                    setImovelId(e.target.value);
                    const escolhido = imoveis.find((i) => i.id === e.target.value);
                    if (escolhido) setTituloImovel(escolhido.titulo);
                  }}
                >
                  <option value="">Sem vínculo com a carteira</option>
                  {imoveis.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.codigo} · {i.titulo.slice(0, 70)}
                      {i.bairro ? ` · ${i.bairro}` : ''}
                    </option>
                  ))}
                </select>
                <span className="ajuda">
                  Opcional. Vinculado, o negócio abate no estoque e a conclusão tira o imóvel da
                  vitrine sozinha. Sem vínculo, entra como negócio de fora da carteira.
                </span>
              </div>

              <div className="campo">
                <label htmlFor="imovel_titulo">
                  Como aparece no negócio<span className="obrigatorio">*</span>
                </label>
                <input
                  id="imovel_titulo"
                  name="imovel_titulo"
                  value={tituloImovel}
                  onChange={(e) => setTituloImovel(e.target.value)}
                  placeholder="Cobertura Duplex Morada da Colina"
                  required
                  autoFocus={!editando}
                />
                <span className="ajuda">
                  Preenchido sozinho ao escolher da carteira, e editável. O título fica gravado no
                  negócio: se o imóvel for renomeado ou excluído depois, o histórico financeiro
                  continua legível.
                </span>
              </div>

              {/* Só faz sentido com imóvel vinculado: sem id não há o que
                  afetar, e um seletor inerte só confunde. */}
              {imovelId && (
                <div className="campo">
                  <label htmlFor="efeito_imovel">O que fazer com o imóvel</label>
                  <select id="efeito_imovel" name="efeito_imovel" defaultValue="manter">
                    {Object.entries(EFEITOS_NO_IMOVEL)
                      .filter(([chave]) => chave !== 'excluir' || gestor)
                      .map(([chave, info]) => (
                        <option key={chave} value={chave}>
                          {info.rotulo}
                        </option>
                      ))}
                  </select>
                  <span className="ajuda">
                    {imovelEscolhido && !imovelEscolhido.publicado && 'Este imóvel já está fora do ar. '}
                    Aplicado ao salvar. Vale lembrar: concluir o negócio já marca o imóvel como
                    vendido ou locado e tira da vitrine, mesmo com “manter”.
                  </span>
                </div>
              )}

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="comprador_nome">
                    Comprador<span className="obrigatorio">*</span>
                  </label>
                  <input
                    id="comprador_nome"
                    name="comprador_nome"
                    defaultValue={venda?.comprador_nome ?? ''}
                    required
                  />
                </div>

                <div className="campo">
                  <label htmlFor="comprador_telefone">Telefone</label>
                  <input
                    id="comprador_telefone"
                    name="comprador_telefone"
                    defaultValue={venda?.comprador_telefone ?? ''}
                    placeholder="(34) 90000-0000"
                  />
                </div>

                <div className="campo">
                  <label htmlFor="proprietario_nome">Proprietário</label>
                  <input
                    id="proprietario_nome"
                    name="proprietario_nome"
                    defaultValue={venda?.proprietario_nome ?? ''}
                  />
                </div>
              </div>

              {/* ---------- VALORES ---------- */}
              <Secao titulo="Valores" />

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="valor_tabela">Valor de tabela</label>
                  <div className="campo-prefixado">
                    <span>R$</span>
                    <input
                      id="valor_tabela"
                      name="valor_tabela"
                      inputMode="numeric"
                      value={valorTabela}
                      onChange={(e) => setValorTabela(mascarar(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                  <span className="ajuda">O que estava anunciado.</span>
                </div>

                <div className="campo">
                  <label htmlFor="valor_venda">
                    Valor fechado<span className="obrigatorio">*</span>
                  </label>
                  <div className="campo-prefixado">
                    <span>R$</span>
                    <input
                      id="valor_venda"
                      name="valor_venda"
                      inputMode="numeric"
                      value={valorVenda}
                      onChange={(e) => setValorVenda(mascarar(e.target.value))}
                      placeholder="0"
                      required
                    />
                  </div>
                  {conta.desconto > 0 && (
                    <span className="ajuda">
                      Desconto de {brl(conta.desconto)} ({conta.descontoPercentual.toFixed(1).replace('.', ',')}%)
                    </span>
                  )}
                </div>
              </div>

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="forma_pagamento">Forma de pagamento</label>
                  <select
                    id="forma_pagamento"
                    name="forma_pagamento"
                    defaultValue={venda?.forma_pagamento ?? 'financiado'}
                  >
                    {FORMAS_PAGAMENTO.map((f) => (
                      <option key={f.chave} value={f.chave}>
                        {f.rotulo}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="entrada">Entrada</label>
                  <div className="campo-prefixado">
                    <span>R$</span>
                    <input
                      id="entrada"
                      name="entrada"
                      inputMode="numeric"
                      defaultValue={formatar(venda?.entrada)}
                      onChange={(e) => (e.target.value = mascarar(e.target.value))}
                    />
                  </div>
                </div>

                <div className="campo">
                  <label htmlFor="banco">Banco</label>
                  <input id="banco" name="banco" defaultValue={venda?.banco ?? ''} />
                </div>
              </div>

              {/* ---------- COMISSAO ---------- */}
              <Secao titulo="Comissão e divisão" />

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="percentual_comissao">Comissão total</label>
                  <div className="campo-prefixado campo-sufixado">
                    <span>%</span>
                    <input
                      id="percentual_comissao"
                      name="percentual_comissao"
                      inputMode="decimal"
                      value={pctComissao}
                      onChange={(e) => setPctComissao(e.target.value)}
                    />
                  </div>
                  <span className="ajuda">O que o proprietário paga.</span>
                </div>

                <div className={`campo${somaExcede ? ' campo-erro' : ''}`}>
                  <label htmlFor="percentual_casa">Parte da casa</label>
                  <div className="campo-prefixado campo-sufixado">
                    <span>%</span>
                    <input
                      id="percentual_casa"
                      name="percentual_casa"
                      inputMode="decimal"
                      value={pctCasa}
                      onChange={(e) => setPctCasa(e.target.value)}
                    />
                  </div>
                  <span className="ajuda">Sobre a comissão total.</span>
                </div>

                <div className={`campo${somaExcede ? ' campo-erro' : ''}`}>
                  <label htmlFor="percentual_captador">Prêmio de captação</label>
                  <div className="campo-prefixado campo-sufixado">
                    <span>%</span>
                    <input
                      id="percentual_captador"
                      name="percentual_captador"
                      inputMode="decimal"
                      value={pctCaptador}
                      onChange={(e) => setPctCaptador(e.target.value)}
                    />
                  </div>
                  <span className="ajuda">Zero quando quem captou também vendeu.</span>
                </div>

                <div className="campo">
                  <label htmlFor="custos">Custos do negócio</label>
                  <div className="campo-prefixado">
                    <span>R$</span>
                    <input
                      id="custos"
                      name="custos"
                      inputMode="numeric"
                      value={custos}
                      onChange={(e) => setCustos(mascarar(e.target.value))}
                    />
                  </div>
                  <span className="ajuda">Fotografia, anúncio, cartório, deslocamento.</span>
                </div>
              </div>

              {somaExcede && (
                <div className="aviso aviso-erro">
                  <IconeAlerta />
                  <span>
                    A casa e a captação somam mais de 100% da comissão. Sobrando nada para o
                    consultor, o negócio ficaria com comissão negativa.
                  </span>
                </div>
              )}

              {/* Resultado ao vivo */}
              <div className="cartao" style={{ background: 'var(--nevoa)' }}>
                <div className="cartao-corpo">
                  <p className="indicador-rotulo" style={{ marginBottom: 14 }}>
                    Como fica a divisão
                  </p>

                  <div className="grade-cartoes grade-4" style={{ gap: 12 }}>
                    <ResultadoItem rotulo="Comissão bruta" valor={brl(conta.comissaoBruta)} />
                    <ResultadoItem rotulo="Casa" valor={brl(conta.comissaoCasa)} />
                    <ResultadoItem
                      rotulo="Consultor"
                      valor={brl(conta.comissaoConsultor)}
                      destaque
                    />
                    <ResultadoItem
                      rotulo="Margem final"
                      valor={brl(conta.margem)}
                      negativo={conta.margem < 0}
                    />
                  </div>

                  {conta.comissaoCaptador > 0 && (
                    <p className="texto-mudo" style={{ marginTop: 12 }}>
                      Prêmio de captação: {brl(conta.comissaoCaptador)}
                    </p>
                  )}

                  {conta.margem < 0 && (
                    <div className="aviso aviso-atencao" style={{ marginTop: 14 }}>
                      <IconeAlerta />
                      <span>
                        Os custos passaram da parte que fica com a casa. Este negócio dá prejuízo
                        para a imobiliária como está.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* ---------- PESSOAS ---------- */}
              <Secao titulo="Quem participou" />

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="consultor_id">Consultor que fechou</label>
                  <select
                    id="consultor_id"
                    name="consultor_id"
                    defaultValue={venda?.consultor_id ?? usuario.id}
                  >
                    <option value="">Não informado</option>
                    {equipe.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.id === usuario.id ? ' (você)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="captador_id">Quem captou o imóvel</label>
                  <select
                    id="captador_id"
                    name="captador_id"
                    defaultValue={venda?.captador_id ?? ''}
                  >
                    <option value="">Não informado</option>
                    {equipe.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ---------- ANDAMENTO ---------- */}
              <Secao titulo="Andamento" />

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="status">Situação</label>
                  <select
                    id="status"
                    name="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                  >
                    <option value="proposta">Proposta apresentada</option>
                    <option value="aprovada">Aprovada pelo proprietário</option>
                    <option value="contrato">Contrato assinado</option>
                    <option value="concluida">Concluída</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div className="campo">
                  <label htmlFor="data_assinatura">Data da assinatura</label>
                  <input
                    id="data_assinatura"
                    name="data_assinatura"
                    type="date"
                    defaultValue={venda?.data_assinatura ?? ''}
                  />
                </div>

                <div className="campo">
                  <label htmlFor="data_conclusao">Data da conclusão</label>
                  <input
                    id="data_conclusao"
                    name="data_conclusao"
                    type="date"
                    defaultValue={venda?.data_conclusao ?? ''}
                  />
                </div>
              </div>

              {status === 'cancelada' && (
                <div className="campo">
                  <label htmlFor="motivo_cancelamento">
                    Motivo do cancelamento<span className="obrigatorio">*</span>
                  </label>
                  <input
                    id="motivo_cancelamento"
                    name="motivo_cancelamento"
                    defaultValue={venda?.motivo_cancelamento ?? ''}
                    placeholder="Crédito negado, desistência, imóvel vendido por terceiro"
                    required
                  />
                  <span className="ajuda">
                    O relatório de perdas só ensina alguma coisa se o motivo estiver registrado.
                  </span>
                </div>
              )}

              {status === 'concluida' && (
                <div className="aviso aviso-info">
                  <IconeInfo />
                  <span>
                    Ao concluir, o imóvel sai da vitrine do site, o lead vinculado passa para
                    fechado e a comissão é lançada no caixa. Depois disso, só a gestão pode alterar
                    este negócio.
                  </span>
                </div>
              )}

              <div className="campo">
                <label htmlFor="observacoes">Observações</label>
                <textarea
                  id="observacoes"
                  name="observacoes"
                  defaultValue={venda?.observacoes ?? ''}
                  placeholder="Condições combinadas, pendências de documentação, prazos."
                />
              </div>

              {estado.erro && (
                <div className="aviso aviso-erro">
                  <IconeAlerta />
                  <span>{estado.erro}</span>
                </div>
              )}
            </div>
          </div>

          <footer className="gaveta-rodape">
            {/* Excluir some com o lançamento, não com o imóvel: quem
                apaga um registro errado do financeiro não está dizendo
                que o imóvel deixou de existir. */}
            {editando && gestor && (
              <button
                type="button"
                className="btn btn-perigo"
                disabled={pendente || enviando}
                onClick={() => {
                  const certeza = window.confirm(
                    `Excluir o negócio ${venda?.codigo ?? ''} em definitivo?\n\n` +
                      'As parcelas de comissão vão junto e não há como desfazer.\n\n' +
                      'O imóvel vinculado continua na carteira.',
                  );
                  if (!certeza) return;

                  iniciar(async () => {
                    const r = await excluirVenda(venda!.id);
                    aoConcluir(r.ok ? (r.mensagem ?? 'Excluído.') : (r.erro ?? 'Falha.'));
                  });
                }}
              >
                <IconeLixeira />
                Excluir
              </button>
            )}

            <button type="button" className="btn btn-claro empurra" onClick={aoFechar}>
              Cancelar
            </button>
            <button className="btn" type="submit" disabled={enviando || somaExcede}>
              {enviando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Registrar negócio'}
            </button>
          </footer>
        </form>
      </div>
    </>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <p
      className="indicador-rotulo"
      style={{
        paddingTop: 8,
        paddingBottom: 4,
        borderBottom: '1px solid var(--linha)',
        marginBottom: 2,
      }}
    >
      {titulo}
    </p>
  );
}

function ResultadoItem({
  rotulo,
  valor,
  destaque,
  negativo,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
  negativo?: boolean;
}) {
  return (
    <div>
      <span className="indicador-rotulo" style={{ fontSize: '0.66rem' }}>
        {rotulo}
      </span>
      <p
        style={{
          fontSize: '1.12rem',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          marginTop: 4,
          color: negativo
            ? 'var(--rubro)'
            : destaque
              ? 'var(--ouro-600)'
              : 'var(--marinho-900)',
        }}
      >
        {valor}
      </p>
    </div>
  );
}

/** 1250000 -> "1.250.000" */
function formatar(valor: number | null | undefined): string {
  const n = Number(valor ?? 0);
  return n > 0 ? n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '';
}

function mascarar(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 12);
  return digitos ? Number(digitos).toLocaleString('pt-BR') : '';
}

function desformatar(texto: string): number {
  const digitos = texto.replace(/\D/g, '');
  return digitos ? Number(digitos) : 0;
}
