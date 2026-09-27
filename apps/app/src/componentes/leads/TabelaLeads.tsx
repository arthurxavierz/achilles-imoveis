'use client';

import { useMemo, useState } from 'react';

import {
  brl,
  corOrigem,
  data as fmtData,
  diasSemContato,
  iniciais,
  rotuloEtapa,
  rotuloOrigem,
  telefone as fmtTelefone,
  telefoneWhatsApp,
  tempoRelativo,
  CORES_ETAPA,
  type Interacao,
  type Lead,
  type Perfil,
} from '@imob/core';

import {
  IconeAlerta,
  IconeDireita,
  IconeTelefone,
  IconeUsuario,
  IconeWhatsApp,
} from '@/componentes/Icones';

type Coluna = 'nome' | 'criado_em' | 'valor' | 'contato' | 'score';

/**
 * Carteira de leads em lista.
 *
 * Existe porque o quadro do funil responde bem "como vai a negociacao" e
 * responde mal "qual era o e-mail daquele cliente". Aqui cabe o dado de
 * contato, a origem, quem atende e ha quanto tempo ninguem fala com a
 * pessoa, tudo na mesma linha e ordenavel.
 *
 * No celular a tabela vira uma pilha de cartoes pela regra do
 * data-rotulo, definida em globals.css. Nenhuma coluna e escondida no
 * caminho: quem esta na rua precisa do telefone tanto quanto quem esta
 * na mesa.
 */
export function TabelaLeads({
  usuario,
  leads,
  porPessoa,
  ultimaPorLead,
  contagemPorLead,
  pendente,
  aoAssumir,
  aoAbrir,
}: {
  usuario: Perfil;
  leads: Lead[];
  porPessoa: Map<string, string>;
  ultimaPorLead: Map<string, Interacao>;
  contagemPorLead: Map<string, number>;
  pendente: boolean;
  aoAssumir: (id: string) => void;
  aoAbrir: (lead: Lead) => void;
}) {
  const [coluna, setColuna] = useState<Coluna>('criado_em');
  const [crescente, setCrescente] = useState(false);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const ordenados = useMemo(() => {
    const valorDe = (l: Lead): string | number => {
      switch (coluna) {
        case 'nome':
          return l.nome.toLocaleLowerCase('pt-BR');
        case 'valor':
          return Number(l.valor);
        case 'score':
          return Number(l.score);
        case 'contato':
          return ultimaPorLead.get(l.id)?.criado_em ?? l.criado_em;
        default:
          return l.criado_em;
      }
    };

    return [...leads].sort((a, b) => {
      const x = valorDe(a);
      const y = valorDe(b);
      const comparacao =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), 'pt-BR');
      return crescente ? comparacao : -comparacao;
    });
  }, [leads, coluna, crescente, ultimaPorLead]);

  function ordenarPor(nova: Coluna) {
    if (nova === coluna) {
      setCrescente(!crescente);
      return;
    }
    setColuna(nova);
    // Texto começa de A para Z; número e data começam do maior, que é o
    // que alguém espera ao clicar em "valor" ou "data".
    setCrescente(nova === 'nome');
  }

  /** Marca a coluna ordenada com um triângulo desenhado em CSS. */
  const seta = (alvo: Coluna) =>
    coluna === alvo ? (
      <i className={`marca-ordem${crescente ? '' : ' descendo'}`} aria-hidden="true" />
    ) : null;

  return (
    <div className="cartao">
      <div className="tabela-envelope">
        <table className="tabela tabela-responsiva tabela-leads">
          <thead>
            <tr>
              <th>
                <button className="ordenar" onClick={() => ordenarPor('nome')}>
                  Cliente{seta('nome')}
                </button>
              </th>
              <th>Contato</th>
              <th>Origem</th>
              <th>Etapa</th>
              <th>Responsável</th>
              <th className="numerico">
                <button className="ordenar" onClick={() => ordenarPor('valor')}>
                  Interesse{seta('valor')}
                </button>
              </th>
              <th>
                <button className="ordenar" onClick={() => ordenarPor('contato')}>
                  Último contato{seta('contato')}
                </button>
              </th>
              <th>
                <button className="ordenar" onClick={() => ordenarPor('criado_em')}>
                  Entrada{seta('criado_em')}
                </button>
              </th>
              <th aria-label="Ações" />
            </tr>
          </thead>

          <tbody>
            {ordenados.map((lead) => {
              const ultima = ultimaPorLead.get(lead.id);
              const dias = diasSemContato(lead, ultima?.criado_em);
              const parado = !['fechado', 'perdido'].includes(lead.etapa) && dias > 7;
              const anotacoes = contagemPorLead.get(lead.id) ?? 0;
              const dono = lead.corretor_id ? porPessoa.get(lead.corretor_id) : null;

              return (
                <tr key={lead.id} className={lead.arquivado ? 'linha-apagada' : undefined}>
                  <td data-rotulo="Cliente">
                    <div className="celula-pessoa">
                      <span className={`avatar avatar-p termometro-borda-${lead.temperatura}`}>
                        {iniciais(lead.nome)}
                      </span>
                      <div className="pilha">
                        <button className="celula-principal ligacao" onClick={() => aoAbrir(lead)}>
                          {lead.nome}
                        </button>
                        <span className="celula-apoio">
                          {lead.imovel_titulo ?? 'Sem imóvel vinculado'}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td data-rotulo="Contato">
                    <div className="pilha celula-contato">
                      {lead.telefone ? (
                        <a href={`tel:+55${lead.telefone}`} className="celula-principal ligacao">
                          {fmtTelefone(lead.telefone)}
                        </a>
                      ) : (
                        <span className="texto-mudo">Sem telefone</span>
                      )}
                      {lead.email ? (
                        <a href={`mailto:${lead.email}`} className="celula-apoio ligacao">
                          {lead.email}
                        </a>
                      ) : (
                        <span className="celula-apoio">Sem e-mail</span>
                      )}
                    </div>
                  </td>

                  <td data-rotulo="Origem">
                    <span className={`selo-origem selo-${corOrigem(lead.origem)}`}>
                      {rotuloOrigem(lead.origem)}
                    </span>
                  </td>

                  <td data-rotulo="Etapa">
                    <span className={`etiqueta etiqueta-${CORES_ETAPA[lead.etapa]}`}>
                      {rotuloEtapa(lead.etapa)}
                    </span>
                    {lead.arquivado && (
                      <span className="celula-apoio">{lead.motivo_perda ?? 'Arquivado'}</span>
                    )}
                  </td>

                  <td data-rotulo="Responsável">
                    {dono ? (
                      <span className="celula-dono">
                        <IconeUsuario style={{ width: 14, height: 14 }} />
                        {dono}
                      </span>
                    ) : (
                      <button
                        className="btn btn-pequeno"
                        onClick={() => aoAssumir(lead.id)}
                        disabled={pendente}
                      >
                        Assumir
                      </button>
                    )}
                  </td>

                  <td data-rotulo="Interesse" className="numerico">
                    {lead.valor > 0 ? brl(lead.valor) : '--'}
                  </td>

                  <td data-rotulo="Último contato">
                    <div className="pilha">
                      <span className={parado ? 'celula-principal alerta' : 'celula-principal'}>
                        {parado && <IconeAlerta style={{ width: 13, height: 13 }} />}
                        {ultima ? tempoRelativo(ultima.criado_em) : 'Nenhum registro'}
                      </span>
                      <span className="celula-apoio">
                        {anotacoes} {anotacoes === 1 ? 'anotação' : 'anotações'}
                      </span>
                    </div>
                  </td>

                  <td data-rotulo="Entrada">
                    <div className="pilha">
                      <span className="celula-principal">{fmtData(lead.criado_em)}</span>
                      {lead.proximo_contato && (
                        <span className="celula-apoio">
                          Retorno em {fmtData(lead.proximo_contato)}
                        </span>
                      )}
                    </div>
                  </td>

                  <td data-rotulo="Ações">
                    <div className="celula-acoes">
                      {lead.telefone && (
                        <>
                          <a
                            className="btn-icone btn-zap"
                            href={`https://wa.me/${telefoneWhatsApp(lead.telefone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Chamar ${lead.nome} no WhatsApp`}
                            title="Abrir conversa no WhatsApp"
                          >
                            <IconeWhatsApp />
                          </a>
                          <a
                            className="btn-icone somente-desktop"
                            href={`tel:+55${lead.telefone}`}
                            aria-label={`Ligar para ${lead.nome}`}
                            title="Ligar"
                          >
                            <IconeTelefone />
                          </a>
                        </>
                      )}

                      <button
                        className="btn btn-claro btn-pequeno"
                        onClick={() => aoAbrir(lead)}
                        aria-label={`Abrir ficha de ${lead.nome}`}
                      >
                        Abrir
                        <IconeDireita />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="cartao-rodape">
        <span className="texto-mudo">
          {ordenados.length} {ordenados.length === 1 ? 'lead listado' : 'leads listados'}
          {!gestor && '. Você vê os seus e os que ainda não têm responsável.'}
        </span>
      </footer>
    </div>
  );
}
