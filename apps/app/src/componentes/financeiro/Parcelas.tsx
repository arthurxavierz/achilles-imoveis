'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';

import {
  brl,
  data as fmtData,
  type Perfil,
  type VendaDetalhada,
  type VendaParcela,
} from '@imob/core';

import {
  baixarParcela,
  excluirParcela,
  salvarParcela,
  type EstadoAcao,
} from '@/app/(painel)/financeiro/acoes';
import { IconeCheck, IconeLapis, IconeLixeira, IconeMais, IconeVazio } from '@/componentes/Icones';

const ESTADO_INICIAL: EstadoAcao = { ok: false };

/** Parcela sendo editada, ou 'nova' para uma que ainda nao existe. */
type EmEdicao = VendaParcela | 'nova' | null;

/**
 * Recebiveis: o que a imobiliaria tem a receber e quando.
 *
 * Comissao raramente entra de uma vez. O padrao e sinal na assinatura e
 * saldo na liberacao do financiamento, que pode levar 60 dias. Sem
 * controlar parcela a parcela, o caixa nunca sabe o que ja caiu de fato,
 * e o mes fecha com um numero que nao existe na conta.
 */
export function Parcelas({
  parcelas,
  vendas,
  equipe,
  usuario,
  aoAtualizar,
}: {
  parcelas: VendaParcela[];
  vendas: VendaDetalhada[];
  equipe: Perfil[];
  usuario: Perfil;
  aoAtualizar: (mensagem: string, erro?: boolean) => void;
}) {
  const [pendente, iniciar] = useTransition();
  const [emEdicao, setEmEdicao] = useState<EmEdicao>(null);
  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const porVenda = useMemo(() => new Map(vendas.map((v) => [v.id, v])), [vendas]);
  const porPessoa = useMemo(() => new Map(equipe.map((p) => [p.id, p.nome])), [equipe]);

  const hoje = new Date().toISOString().slice(0, 10);

  const acoesDaLinha = {
    aoEditar: (p: VendaParcela) => setEmEdicao(p),
    aoExcluir: gestor
      ? (p: VendaParcela) => {
          const certeza = window.confirm(
            `Excluir a parcela "${p.descricao}" em definitivo?\n\n` +
              'Ela sai da previsão de caixa e da comissão de quem recebe.\n\n' +
              'Para tirar da previsão sem perder o registro, cancele e marque como cancelada.',
          );
          if (!certeza) return;

          iniciar(async () => {
            const r = await excluirParcela(p.id);
            aoAtualizar(r.ok ? (r.mensagem ?? 'Excluída.') : (r.erro ?? 'Falha.'), !r.ok);
          });
        }
      : undefined,
  };

  const { vencidas, aVencer, pagas, totalPendente, totalVencido } = useMemo(() => {
    const vencidas: VendaParcela[] = [];
    const aVencer: VendaParcela[] = [];
    const pagas: VendaParcela[] = [];

    for (const p of parcelas) {
      if (p.status === 'pago') pagas.push(p);
      else if (p.status === 'cancelado') continue;
      else if (p.vencimento < hoje) vencidas.push(p);
      else aVencer.push(p);
    }

    return {
      vencidas,
      aVencer,
      pagas,
      totalPendente: [...vencidas, ...aVencer].reduce((s, p) => s + Number(p.valor), 0),
      totalVencido: vencidas.reduce((s, p) => s + Number(p.valor), 0),
    };
  }, [parcelas, hoje]);

  function alternar(parcela: VendaParcela) {
    iniciar(async () => {
      const r = await baixarParcela(parcela.id, parcela.status !== 'pago');
      aoAtualizar(r.ok ? (r.mensagem ?? 'Atualizado.') : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  if (parcelas.length === 0) {
    return (
      <div className="vazio">
        <IconeVazio />
        <h3>Nenhuma parcela lançada</h3>
        <p>
          Ao registrar um negócio, o sistema sugere as parcelas da comissão conforme a forma de
          pagamento. Elas aparecem aqui para receber baixa quando o dinheiro entrar.
        </p>
        {vendas.length > 0 && (
          <button className="btn" onClick={() => setEmEdicao('nova')} style={{ marginTop: 20 }}>
            <IconeMais />
            Lançar parcela
          </button>
        )}
        {emEdicao && (
          <EditorParcela
            parcela={emEdicao === 'nova' ? null : emEdicao}
            vendas={vendas}
            equipe={equipe}
            aoFechar={() => setEmEdicao(null)}
            aoConcluir={(m, erro) => {
              setEmEdicao(null);
              aoAtualizar(m, erro);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grade-cartoes">
      {/* Lançar parcela à mão fecha o processo: o sistema sugere as
          parcelas uma vez, no primeiro salvamento do negócio, e depois
          não mexe mais. Sem isto, comissão renegociada obrigava a apagar
          o negócio e refazer. */}
      <div className="linha-flex" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-claro btn-pequeno" onClick={() => setEmEdicao('nova')}>
          <IconeMais />
          Lançar parcela
        </button>
      </div>

      {emEdicao && (
        <EditorParcela
          parcela={emEdicao === 'nova' ? null : emEdicao}
          vendas={vendas}
          equipe={equipe}
          aoFechar={() => setEmEdicao(null)}
          aoConcluir={(m, erro) => {
            setEmEdicao(null);
            aoAtualizar(m, erro);
          }}
        />
      )}

      {vencidas.length > 0 && (
        <Bloco
          titulo="Vencidas"
          descricao={`${brl(totalVencido)} com o prazo já passado`}
          cor="rubro"
          parcelas={vencidas}
          porVenda={porVenda}
          porPessoa={porPessoa}
          pendente={pendente}
          aoAlternar={alternar}
          {...acoesDaLinha}
        />
      )}

      <Bloco
        titulo="A vencer"
        descricao={`${brl(totalPendente)} previstos no total`}
        parcelas={aVencer}
        porVenda={porVenda}
        porPessoa={porPessoa}
        pendente={pendente}
        aoAlternar={alternar}
        {...acoesDaLinha}
      />

      {pagas.length > 0 && (
        <Bloco
          titulo="Recebidas"
          descricao={`${brl(pagas.reduce((s, p) => s + Number(p.valor), 0))} já em caixa`}
          cor="verde"
          parcelas={pagas}
          porVenda={porVenda}
          porPessoa={porPessoa}
          pendente={pendente}
          aoAlternar={alternar}
          {...acoesDaLinha}
        />
      )}
    </div>
  );
}

function Bloco({
  titulo,
  descricao,
  cor,
  parcelas,
  porVenda,
  porPessoa,
  pendente,
  aoAlternar,
  aoEditar,
  aoExcluir,
}: {
  titulo: string;
  descricao: string;
  cor?: 'rubro' | 'verde';
  parcelas: VendaParcela[];
  porVenda: Map<string, VendaDetalhada>;
  porPessoa: Map<string, string>;
  pendente: boolean;
  aoAlternar: (p: VendaParcela) => void;
  aoEditar: (p: VendaParcela) => void;
  /** Ausente para quem nao e gestao: parcela so a gestao apaga. */
  aoExcluir?: (p: VendaParcela) => void;
}) {
  if (parcelas.length === 0) {
    return (
      <div className="cartao">
        <div className="cartao-cabecalho">
          <h3>{titulo}</h3>
        </div>
        <div className="cartao-corpo">
          <p className="texto-mudo">Nada nesta situação.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cartao">
      <div className="cartao-cabecalho">
        <div>
          <h3>{titulo}</h3>
          <p className="texto-mudo">{descricao}</p>
        </div>
        <span className={`etiqueta${cor ? ` etiqueta-${cor}` : ''}`}>{parcelas.length}</span>
      </div>

      <div className="tabela-envelope">
        <table className="tabela tabela-responsiva">
          <thead>
            <tr>
              <th>Parcela</th>
              <th>Negócio</th>
              <th>Destino</th>
              <th className="numerico">Valor</th>
              <th className="numerico">Vencimento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {parcelas.map((p) => {
              const venda = porVenda.get(p.venda_id);
              const paga = p.status === 'pago';

              return (
                <tr key={p.id}>
                  <td data-rotulo="Parcela" className="celula-principal">
                    {p.descricao}
                  </td>
                  <td data-rotulo="Negócio">
                    {venda ? (
                      <>
                        {venda.codigo}
                        <span className="celula-apoio">{venda.imovel_titulo}</span>
                      </>
                    ) : (
                      <span className="texto-mudo">Negócio removido</span>
                    )}
                  </td>
                  <td data-rotulo="Destino">
                    {p.destino === 'casa'
                      ? 'Imobiliária'
                      : (p.beneficiario_id && porPessoa.get(p.beneficiario_id)) || p.destino}
                  </td>
                  <td data-rotulo="Valor" className="numerico">
                    {brl(p.valor)}
                  </td>
                  <td data-rotulo="Vencimento" className="numerico">
                    {fmtData(p.vencimento)}
                    {paga && p.pago_em && (
                      <span className="celula-apoio">pago em {fmtData(p.pago_em)}</span>
                    )}
                  </td>
                  <td data-rotulo="" className="celula-acoes">
                    <button
                      className={paga ? 'btn btn-fantasma btn-pequeno' : 'btn btn-pequeno'}
                      onClick={() => aoAlternar(p)}
                      disabled={pendente}
                    >
                      {paga ? (
                        'Desfazer baixa'
                      ) : (
                        <>
                          <IconeCheck />
                          Dar baixa
                        </>
                      )}
                    </button>

                    <button
                      className="btn-icone"
                      onClick={() => aoEditar(p)}
                      disabled={pendente}
                      title="Editar a parcela"
                      aria-label={`Editar ${p.descricao}`}
                    >
                      <IconeLapis />
                    </button>

                    {aoExcluir && (
                      <button
                        className="btn-icone"
                        onClick={() => aoExcluir(p)}
                        disabled={pendente}
                        title="Excluir a parcela"
                        aria-label={`Excluir ${p.descricao}`}
                      >
                        <IconeLixeira />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Formulário curto de parcela, em linha na própria aba.
 *
 * Não virou gaveta de propósito: a gaveta do negócio já é longa, e quem
 * está conferindo recebíveis quer corrigir um valor sem sair da lista
 * que estava lendo.
 *
 * Só descrição, valor e vencimento são exigidos. Beneficiário e
 * observação ficam em branco sem problema, e o negócio só é escolhido
 * quando a parcela ainda não existe: mudar a parcela de negócio depois
 * bagunçaria a comissão dos dois lados.
 */
function EditorParcela({
  parcela,
  vendas,
  equipe,
  aoFechar,
  aoConcluir,
}: {
  parcela: VendaParcela | null;
  vendas: VendaDetalhada[];
  equipe: Perfil[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string, erro?: boolean) => void;
}) {
  const [estado, enviar, enviando] = useActionState(salvarParcela, ESTADO_INICIAL);
  const [status, setStatus] = useState(parcela?.status ?? 'pendente');

  useEffect(() => {
    if (estado.ok) aoConcluir(estado.mensagem ?? 'Salvo.');
  }, [estado, aoConcluir]);

  return (
    <form action={enviar} className="cartao editor-parcela">
      <div className="cartao-cabecalho">
        <h3>{parcela ? 'Editar parcela' : 'Lançar parcela'}</h3>
      </div>

      <div className="cartao-corpo formulario">
        <input type="hidden" name="id" value={parcela?.id ?? ''} />

        {!parcela && (
          <div className="campo">
            <label htmlFor="p-venda">Negócio</label>
            <select id="p-venda" name="venda_id" required defaultValue="">
              <option value="" disabled>
                Escolha o negócio
              </option>
              {vendas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.codigo} · {v.imovel_titulo.slice(0, 60)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="campo">
          <label htmlFor="p-descricao">Descrição</label>
          <input
            id="p-descricao"
            name="descricao"
            defaultValue={parcela?.descricao ?? ''}
            placeholder="Sinal na assinatura"
            required
          />
        </div>

        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="p-valor">Valor</label>
            <input
              id="p-valor"
              name="valor"
              inputMode="decimal"
              defaultValue={parcela ? String(parcela.valor) : ''}
              placeholder="12000"
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="p-vencimento">Vencimento</label>
            <input
              id="p-vencimento"
              name="vencimento"
              type="date"
              defaultValue={parcela?.vencimento ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
        </div>

        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="p-destino">Quem recebe</label>
            <select id="p-destino" name="destino" defaultValue={parcela?.destino ?? 'casa'}>
              <option value="casa">Imobiliária</option>
              <option value="consultor">Consultor</option>
              <option value="captador">Captador</option>
              <option value="terceiro">Terceiro</option>
            </select>
          </div>

          <div className="campo">
            <label htmlFor="p-beneficiario">Pessoa (opcional)</label>
            <select
              id="p-beneficiario"
              name="beneficiario_id"
              defaultValue={parcela?.beneficiario_id ?? ''}
            >
              <option value="">Ninguém em especial</option>
              {equipe.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="linha-campos">
          <div className="campo">
            <label htmlFor="p-status">Situação</label>
            <select
              id="p-status"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as VendaParcela['status'])}
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Paga</option>
              <option value="cancelado">Cancelada</option>
            </select>
            <span className="ajuda">
              Cancelada sai da previsão de caixa sem apagar o registro. É o caminho para desfazer
              sem perder o histórico.
            </span>
          </div>

          {/* O banco recusa parcela paga sem data, e com razão: é o que
              separa "o cliente disse que pagou" de "entrou na conta". */}
          {status === 'pago' && (
            <div className="campo">
              <label htmlFor="p-pago-em">Pago em</label>
              <input
                id="p-pago-em"
                name="pago_em"
                type="date"
                defaultValue={parcela?.pago_em ?? new Date().toISOString().slice(0, 10)}
              />
            </div>
          )}
        </div>

        <div className="campo">
          <label htmlFor="p-observacoes">Observações (opcional)</label>
          <input
            id="p-observacoes"
            name="observacoes"
            defaultValue={parcela?.observacoes ?? ''}
            placeholder="Combinado com o proprietário na assinatura"
          />
        </div>

        {estado.erro && (
          <p className="aviso aviso-erro" role="alert">
            {estado.erro}
          </p>
        )}
      </div>

      <div className="cartao-rodape linha-flex" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-claro btn-pequeno" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="btn btn-pequeno" type="submit" disabled={enviando}>
          {enviando ? 'Salvando...' : parcela ? 'Salvar alterações' : 'Lançar parcela'}
        </button>
      </div>
    </form>
  );
}
