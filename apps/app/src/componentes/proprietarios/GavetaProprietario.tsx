'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState, useTransition } from 'react';

import {
  brl,
  data as fmtData,
  iniciais,
  STATUS_IMOVEL,
  telefone as fmtTelefone,
  telefoneWhatsApp,
  type Imovel,
  type Perfil,
  type ProprietarioComCarteira,
} from '@imob/core';

import {
  excluirProprietario,
  salvarProprietario,
  type EstadoAcao,
} from '@/app/(painel)/proprietarios/acoes';
import {
  IconeAlerta,
  IconeEmail,
  IconeFechar,
  IconeLapis,
  IconeLixeira,
  IconeTelefone,
  IconeWhatsApp,
} from '@/componentes/Icones';

const ESTADO_INICIAL: EstadoAcao = { ok: false };

type Aba = 'carteira' | 'dados';

/**
 * Ficha do proprietário.
 *
 * Duas abas, e a que abre primeiro é a carteira. Quem abre esta gaveta
 * quase sempre está com a pessoa no telefone e quer saber quais imóveis
 * dela estão na mão da Achilles, não reler o CPF. A edição fica atrás de
 * um clique deliberado, do mesmo jeito que na ficha do lead: dado de
 * cadastro não deve ser alterável por acidente enquanto se lê.
 *
 * Cada imóvel da lista é um link para a carteira já filtrada nele. É o
 * caminho de volta que fecha o ciclo — da pessoa para os imóveis dela,
 * e de lá para a ficha de cada um.
 */
export function GavetaProprietario({
  usuario,
  proprietario,
  imoveis,
  equipe,
  aoFechar,
  aoConcluir,
}: {
  usuario: Perfil;
  proprietario: ProprietarioComCarteira | null;
  imoveis: Imovel[];
  equipe: Perfil[];
  aoFechar: () => void;
  aoConcluir: (mensagem: string, erro?: boolean) => void;
}) {
  const [estado, enviar, enviando] = useActionState(salvarProprietario, ESTADO_INICIAL);
  const [pendente, iniciar] = useTransition();

  const novo = !proprietario;
  const [aba, setAba] = useState<Aba>(novo ? 'dados' : 'carteira');
  const [editando, setEditando] = useState(novo);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';
  const porPessoa = new Map(equipe.map((p) => [p.id, p.nome]));

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

  function excluir() {
    if (!proprietario) return;

    const certeza = window.confirm(
      `Excluir ${proprietario.nome} do cadastro?\n\nOs dados de contato e as observações vão junto, e não há como desfazer.`,
    );
    if (!certeza) return;

    iniciar(async () => {
      const r = await excluirProprietario(proprietario.id);
      aoConcluir(r.ok ? (r.mensagem ?? 'Excluído.') : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  return (
    <>
      <div className="fundo-escuro" onClick={aoFechar} aria-hidden="true" />

      <div className="gaveta gaveta-larga" role="dialog" aria-modal="true" aria-label="Proprietário">
        <header className="gaveta-topo">
          <div className="linha-flex" style={{ gap: 12, minWidth: 0 }}>
            {proprietario && <span className="avatar avatar-g">{iniciais(proprietario.nome)}</span>}
            <div style={{ minWidth: 0 }}>
              <h2>{proprietario ? proprietario.nome : 'Novo proprietário'}</h2>
              <p>
                {proprietario
                  ? `${proprietario.total_imoveis} ${
                      proprietario.total_imoveis === 1 ? 'imóvel' : 'imóveis'
                    } na carteira · cadastrado em ${fmtData(proprietario.criado_em)}`
                  : 'Quem entrega o imóvel para a Achilles vender.'}
              </p>
            </div>
          </div>
          <button className="btn-icone" onClick={aoFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>

        {proprietario && (
          <div className="gaveta-atalhos">
            {proprietario.telefone && (
              <>
                <a
                  className="btn btn-claro btn-pequeno btn-zap-cheio"
                  href={`https://wa.me/${telefoneWhatsApp(proprietario.telefone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconeWhatsApp />
                  WhatsApp
                </a>
                <a className="btn btn-claro btn-pequeno" href={`tel:+55${proprietario.telefone}`}>
                  <IconeTelefone />
                  {fmtTelefone(proprietario.telefone)}
                </a>
              </>
            )}
            {proprietario.email && (
              <a className="btn btn-claro btn-pequeno" href={`mailto:${proprietario.email}`}>
                <IconeEmail />
                {proprietario.email}
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

        {proprietario && (
          <div className="abas" role="tablist">
            <button role="tab" aria-selected={aba === 'carteira'} onClick={() => setAba('carteira')}>
              Carteira
              <span className="aba-contador">{imoveis.length}</span>
            </button>
            <button role="tab" aria-selected={aba === 'dados'} onClick={() => setAba('dados')}>
              {editando ? 'Editar dados' : 'Dados cadastrais'}
            </button>
          </div>
        )}

        {aba === 'carteira' && proprietario ? (
          <>
            <div className="gaveta-corpo">
              <div className="ficha-resumo">
                <FichaItem rotulo="Imóveis" valor={String(proprietario.total_imoveis)} />
                <FichaItem rotulo="No ar" valor={String(proprietario.imoveis_publicados)} />
                <FichaItem
                  rotulo="Valor em carteira"
                  valor={proprietario.valor_carteira > 0 ? brl(proprietario.valor_carteira) : '--'}
                />
              </div>

              {imoveis.length === 0 ? (
                <p className="texto-mudo" style={{ textAlign: 'center', padding: '24px 8px' }}>
                  Nenhum imóvel vinculado a esta pessoa. Ela pode ter sido cadastrada antes da
                  captação fechar — ou os imóveis dela já foram vendidos e excluídos.
                </p>
              ) : (
                <ul className="lista-vinculos">
                  {imoveis.map((i) => {
                    const situacao = STATUS_IMOVEL[i.status];

                    return (
                      <li key={i.id}>
                        <Link href={`/imoveis?imovel=${i.id}`} className="vinculo-item">
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <strong>{i.titulo}</strong>
                            <span className="celula-apoio">
                              {i.codigo} · {i.tipo}
                              {i.bairro && ` · ${i.bairro}`} ·{' '}
                              {i.corretor_id
                                ? (porPessoa.get(i.corretor_id) ?? 'Outro consultor')
                                : 'Sem responsável'}
                            </span>
                          </span>

                          <span className="linha-flex" style={{ gap: 8 }}>
                            <span className={`etiqueta etiqueta-${situacao.cor}`}>
                              {situacao.rotulo}
                            </span>
                            <strong className="numerico">
                              {brl(
                                i.finalidade === 'locacao' ? (i.valor_locacao ?? 0) : i.valor,
                              )}
                            </strong>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {proprietario.observacoes && (
                <div className="ficha-mensagem">
                  <span className="indicador-rotulo">Observações da captação</span>
                  <p>{proprietario.observacoes}</p>
                </div>
              )}
            </div>

            {gestor && (
              <footer className="gaveta-rodape gaveta-rodape-perigo">
                <span className="texto-mudo" style={{ flex: 1, fontSize: '0.82rem' }}>
                  {imoveis.length > 0
                    ? 'Só é possível excluir depois de transferir os imóveis para outro proprietário.'
                    : 'Sem imóveis vinculados, o cadastro pode ser removido.'}
                </span>
                <button
                  className="btn btn-perigo"
                  onClick={excluir}
                  disabled={pendente || imoveis.length > 0}
                >
                  <IconeLixeira />
                  Excluir
                </button>
              </footer>
            )}
          </>
        ) : (
          <form action={enviar} style={{ display: 'contents' }}>
            <input type="hidden" name="id" value={proprietario?.id ?? ''} />

            <div className="gaveta-corpo">
              {!editando && proprietario ? (
                <div className="ficha-resumo ficha-resumo-largo">
                  <FichaItem rotulo="Documento" valor={proprietario.cpf_cnpj ?? 'Não informado'} />
                  <FichaItem
                    rotulo="Telefone"
                    valor={fmtTelefone(proprietario.telefone) || 'Não informado'}
                  />
                  <FichaItem rotulo="E-mail" valor={proprietario.email ?? 'Não informado'} />
                  <FichaItem rotulo="Endereço" valor={proprietario.endereco ?? 'Não informado'} />
                  <FichaItem
                    rotulo="Cadastrado em"
                    valor={fmtData(proprietario.criado_em)}
                  />
                  <FichaItem
                    rotulo="Cadastrado por"
                    valor={
                      proprietario.criado_por
                        ? (porPessoa.get(proprietario.criado_por) ?? 'Fora da equipe')
                        : '--'
                    }
                  />
                </div>
              ) : (
                <div className="formulario">
                  <div className="campo">
                    <label htmlFor="nome">
                      Nome completo ou razão social<span className="obrigatorio">*</span>
                    </label>
                    <input
                      id="nome"
                      name="nome"
                      defaultValue={proprietario?.nome ?? ''}
                      maxLength={140}
                      required
                      autoFocus
                      placeholder="Helena Machado, ou Construtora Umuarama Ltda"
                    />
                  </div>

                  <div className="linha-campos">
                    <div className="campo">
                      <label htmlFor="telefone">Telefone</label>
                      <input
                        id="telefone"
                        name="telefone"
                        defaultValue={proprietario?.telefone ?? ''}
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
                        defaultValue={proprietario?.email ?? ''}
                        placeholder="proprietario@email.com"
                      />
                    </div>
                  </div>

                  <span className="ajuda" style={{ marginTop: -6 }}>
                    Ao menos um dos dois é obrigatório. Sem contato, o cadastro não serve para a
                    hora em que aparecer uma proposta.
                  </span>

                  <div className="campo">
                    <label htmlFor="cpf_cnpj">CPF ou CNPJ</label>
                    <input
                      id="cpf_cnpj"
                      name="cpf_cnpj"
                      defaultValue={proprietario?.cpf_cnpj ?? ''}
                      maxLength={24}
                      placeholder="000.000.000-00"
                    />
                    <span className="ajuda">
                      Necessário na escritura. Pode ficar para depois, mas não para o fechamento.
                    </span>
                  </div>

                  <div className="campo">
                    <label htmlFor="endereco">Endereço</label>
                    <input
                      id="endereco"
                      name="endereco"
                      defaultValue={proprietario?.endereco ?? ''}
                      maxLength={220}
                      placeholder="Rua, número, bairro, cidade - UF"
                    />
                    <span className="ajuda">
                      O endereço de quem vende, não o do imóvel à venda.
                    </span>
                  </div>

                  <div className="campo">
                    <label htmlFor="observacoes">Observações da captação</label>
                    <textarea
                      id="observacoes"
                      name="observacoes"
                      defaultValue={proprietario?.observacoes ?? ''}
                      maxLength={2000}
                      rows={4}
                      placeholder="Piso de negociação, quem assina, melhor horário para ligar, pendência de documentação."
                    />
                    <span className="ajuda">
                      Fica só aqui dentro. Nada deste campo chega ao site.
                    </span>
                  </div>

                  {estado.erro && (
                    <div className="aviso aviso-erro">
                      <IconeAlerta />
                      <span>{estado.erro}</span>
                    </div>
                  )}
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
                  {enviando ? 'Salvando...' : novo ? 'Cadastrar proprietário' : 'Salvar alterações'}
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
