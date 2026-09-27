'use client';

import { useState } from 'react';

import {
  brl,
  corOrigem,
  rotuloOrigem,
  telefone as fmtTelefone,
  telefoneWhatsApp,
  tempoRelativo,
  ETAPAS,
  type EtapaLead,
  type Lead,
  type Perfil,
} from '@imob/core';

import {
  IconeDireita,
  IconeEsquerda,
  IconeUsuario,
  IconeWhatsApp,
} from '@/componentes/Icones';

/**
 * Funil em colunas.
 *
 * No desktop o cartao e arrastado entre colunas. No celular arrastar
 * dentro de uma area que tambem rola horizontalmente e um desastre de
 * usabilidade, entao cada cartao ganha setas para avancar e voltar de
 * etapa. As duas formas chamam a mesma acao.
 *
 * O componente nao busca nem filtra nada: recebe a lista pronta de quem
 * o contem. Assim trocar entre funil e lista mantem exatamente o mesmo
 * recorte na tela.
 */
export function Funil({
  usuario,
  leads,
  porPessoa,
  pendente,
  aoMover,
  aoAssumir,
  aoAbrir,
}: {
  usuario: Perfil;
  leads: Lead[];
  porPessoa: Map<string, string>;
  pendente: boolean;
  aoMover: (id: string, etapa: EtapaLead) => void;
  aoAssumir: (id: string) => void;
  aoAbrir: (lead: Lead) => void;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [colunaAtiva, setColunaAtiva] = useState<string | null>(null);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const porEtapa = new Map<string, Lead[]>();
  for (const etapa of ETAPAS) porEtapa.set(etapa.chave, []);
  for (const lead of leads) {
    if (lead.etapa === 'perdido') continue;
    porEtapa.get(lead.etapa)?.push(lead);
  }

  return (
    <div className="funil">
      {ETAPAS.map((etapa, indice) => {
        const itens = porEtapa.get(etapa.chave) ?? [];
        const soma = itens.reduce((s, l) => s + Number(l.valor), 0);

        return (
          <section
            key={etapa.chave}
            className={`coluna${colunaAtiva === etapa.chave ? ' recebendo' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setColunaAtiva(etapa.chave);
            }}
            onDragLeave={() => setColunaAtiva(null)}
            onDrop={(e) => {
              e.preventDefault();
              setColunaAtiva(null);
              const id = e.dataTransfer.getData('text/plain');
              if (id) aoMover(id, etapa.chave);
            }}
          >
            <header className="coluna-topo">
              <h3>{etapa.nome}</h3>
              <span className="coluna-contador">{itens.length}</span>
            </header>

            <div className="coluna-corpo">
              {soma > 0 && (
                <p className="coluna-soma">{brl(soma)}</p>
              )}

              {itens.map((lead) => {
                const meu = lead.corretor_id === usuario.id;
                const semDono = lead.corretor_id === null;

                return (
                  <article
                    key={lead.id}
                    className={`lead${arrastando === lead.id ? ' arrastando' : ''}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', lead.id);
                      setArrastando(lead.id);
                    }}
                    onDragEnd={() => setArrastando(null)}
                  >
                    <button
                      className="lead-abrir"
                      onClick={() => aoAbrir(lead)}
                      aria-label={`Abrir atendimento de ${lead.nome}`}
                    />

                    <div className="lead-topo">
                      <span className="lead-nome">{lead.nome}</span>
                      <span
                        className={`termometro termometro-${lead.temperatura}`}
                        title={`Lead ${lead.temperatura}, score ${lead.score}`}
                      />
                    </div>

                    <span className={`selo-origem selo-${corOrigem(lead.origem)}`}>
                      {rotuloOrigem(lead.origem)}
                    </span>

                    {lead.imovel_titulo && <p className="lead-imovel">{lead.imovel_titulo}</p>}

                    <div className="lead-rodape">
                      <span className="lead-valor">
                        {lead.valor > 0 ? brl(lead.valor) : 'A definir'}
                      </span>
                      <span className="texto-mudo" style={{ fontSize: '0.72rem' }}>
                        {tempoRelativo(lead.criado_em)}
                      </span>
                    </div>

                    <div className="lead-acoes">
                      <div className="linha-flex" style={{ gap: 4 }}>
                        {indice > 0 && (
                          <button
                            className="btn-icone btn-icone-pequeno"
                            onClick={() => aoMover(lead.id, ETAPAS[indice - 1].chave)}
                            disabled={pendente}
                            aria-label="Voltar etapa"
                            title={`Voltar para ${ETAPAS[indice - 1].nome}`}
                          >
                            <IconeEsquerda />
                          </button>
                        )}
                        {indice < ETAPAS.length - 1 && (
                          <button
                            className="btn-icone btn-icone-pequeno"
                            onClick={() => aoMover(lead.id, ETAPAS[indice + 1].chave)}
                            disabled={pendente}
                            aria-label="Avançar etapa"
                            title={`Avançar para ${ETAPAS[indice + 1].nome}`}
                          >
                            <IconeDireita />
                          </button>
                        )}
                      </div>

                      <div className="linha-flex" style={{ gap: 4 }}>
                        {lead.telefone && (
                          <a
                            className="btn-icone btn-icone-pequeno btn-zap"
                            href={`https://wa.me/${telefoneWhatsApp(lead.telefone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Chamar ${lead.nome} no WhatsApp`}
                            title={fmtTelefone(lead.telefone)}
                          >
                            <IconeWhatsApp />
                          </a>
                        )}

                        {semDono && (
                          <button
                            className="btn btn-pequeno"
                            onClick={() => aoAssumir(lead.id)}
                            disabled={pendente}
                          >
                            Assumir
                          </button>
                        )}

                        {!semDono && !meu && gestor && (
                          <span className="lead-dono">
                            <IconeUsuario style={{ width: 13, height: 13 }} />
                            {porPessoa.get(lead.corretor_id ?? '')?.split(' ')[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {itens.length === 0 && <p className="coluna-vazia">Arraste um cartão para cá</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
