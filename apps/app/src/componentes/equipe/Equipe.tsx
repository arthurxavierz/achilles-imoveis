'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import {
  AREAS_PERMISSAO,
  brl,
  iniciais,
  rotuloPapel,
  telefone as fmtTelefone,
  type Perfil,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Recado } from '@/componentes/Recado';
import {
  IconeAlerta,
  IconeCheck,
  IconeEquipe,
  IconeLapis,
  IconeLixeira,
  IconeMais,
} from '@/componentes/Icones';
import { alternarAcesso, redefinirSenha, removerPessoa } from '@/app/(painel)/equipe/acoes';
import { GavetaPessoa } from './GavetaPessoa';

export interface Carteira {
  leads: number;
  imoveis: number;
  negocios: number;
}

/**
 * Tela de equipe.
 *
 * Papel e permissao aparecem lado a lado porque respondem perguntas
 * diferentes: o papel diz quanto a pessoa manda, a permissao diz em
 * quais areas ela entra. Um gestor sem a area de financeiro nao ve
 * comissao nenhuma, e essa combinacao e comum em imobiliaria familiar.
 *
 * Quem nao e administrador chega aqui em modo leitura. E proposital: a
 * funcao definir_acesso() do banco recusaria a alteracao de qualquer
 * forma, e mostrar botao que sempre falha e pior do que nao mostrar.
 */
export function Equipe({
  usuario,
  equipe,
  carteiras,
}: {
  usuario: Perfil;
  equipe: Perfil[];
  carteiras: Record<string, Carteira>;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const [emEdicao, setEmEdicao] = useState<Perfil | null>(null);
  const [criando, setCriando] = useState(false);
  const [removendo, setRemovendo] = useState<Perfil | null>(null);
  const [substituto, setSubstituto] = useState('');
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);

  const eAdmin = usuario.papel === 'admin';

  const ativos = useMemo(() => equipe.filter((p) => p.ativo), [equipe]);
  const inativos = useMemo(() => equipe.filter((p) => !p.ativo), [equipe]);

  function avisar(texto: string, erro = false) {
    setRecado({ texto, erro });
    router.refresh();
  }

  function alternar(pessoa: Perfil) {
    const carteira = carteiras[pessoa.id];
    const carrega = carteira && carteira.leads + carteira.imoveis + carteira.negocios > 0;

    if (pessoa.ativo && carrega) {
      const certeza = window.confirm(
        `Desativar o acesso de ${pessoa.nome}?\n\n` +
          `Ainda respondem por esta pessoa: ${carteira.leads} leads, ${carteira.imoveis} imóveis e ${carteira.negocios} negócios em aberto. ` +
          'Eles continuam no nome dela até serem transferidos.',
      );
      if (!certeza) return;
    }

    iniciar(async () => {
      const r = await alternarAcesso(pessoa.id, !pessoa.ativo);
      avisar(r.ok ? (r.mensagem ?? 'Acesso alterado.') : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  /**
   * Redefine a senha de alguem.
   *
   * A senha e sorteada aqui e mostrada uma unica vez, num prompt que a
   * pessoa copia. Nao ha tela para consulta-la depois, e isso e
   * proposital: senha guardada em algum canto do sistema e senha que
   * vaza junto com o resto no dia de um acesso indevido.
   */
  function trocarSenha(pessoa: Perfil) {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    const sugestao = Array.from(bytes, (n) => alfabeto[n % alfabeto.length]).join('');

    const escolhida = window.prompt(
      [
        `Nova senha para ${pessoa.nome}.`,
        '',
        'Anote antes de confirmar: ela não aparece de novo.',
        'Você pode trocar por outra de sua preferência.',
      ].join('\n'),
      sugestao,
    );

    if (escolhida === null) return;
    if (escolhida.trim().length < 8) {
      avisar('A senha precisa de ao menos 8 caracteres.', true);
      return;
    }

    iniciar(async () => {
      const r = await redefinirSenha(pessoa.id, escolhida.trim());
      avisar(r.ok ? (r.mensagem ?? 'Senha redefinida.') : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  function confirmarRemocao() {
    if (!removendo) return;

    iniciar(async () => {
      const r = await removerPessoa(removendo.id, substituto);
      if (r.ok) {
        setRemovendo(null);
        setSubstituto('');
      }
      avisar(r.ok ? (r.mensagem ?? 'Removido.') : (r.erro ?? 'Falha.'), !r.ok);
    });
  }

  return (
    <>
      <CabecalhoPagina titulo="Equipe">
        {eAdmin && (
          <button className="btn somente-desktop" onClick={() => setCriando(true)}>
            <IconeMais />
            Cadastrar integrante
          </button>
        )}
      </CabecalhoPagina>

      <div className="corpo">
        <div className="painel-resumo" style={{ marginBottom: 20 }}>
          <div className="resumo-item">
            <span className="indicador-rotulo">Pessoas ativas</span>
            <strong>{ativos.length}</strong>
          </div>
          <div className="resumo-item">
            <span className="indicador-rotulo">Administradores</span>
            <strong>{ativos.filter((p) => p.papel === 'admin').length}</strong>
          </div>
          <div className="resumo-item">
            <span className="indicador-rotulo">Meta somada</span>
            <strong>{brl(ativos.reduce((s, p) => s + Number(p.meta_mensal), 0))}</strong>
          </div>
          <div className="resumo-item">
            <span className="indicador-rotulo">Acessos desativados</span>
            <strong>{inativos.length}</strong>
          </div>
        </div>

        {!eAdmin && (
          <div className="aviso aviso-info" style={{ marginBottom: 20 }}>
            <IconeAlerta />
            <span>
              Você enxerga a equipe, mas papel, permissão e situação de acesso são alterados apenas
              por um administrador. A trava está no banco, não nesta tela.
            </span>
          </div>
        )}

        {equipe.length === 0 ? (
          <div className="vazio">
            <IconeEquipe />
            <h3>Nenhum perfil cadastrado</h3>
            <p>Cadastre o primeiro integrante para começar a distribuir a carteira.</p>
          </div>
        ) : (
          <div className="cartao">
            <div className="tabela-envelope">
              <table className="tabela tabela-responsiva tabela-equipe">
                <thead>
                  <tr>
                    <th>Pessoa</th>
                    <th>Papel</th>
                    <th>Permissões</th>
                    <th className="numerico">Meta mensal</th>
                    <th>Carteira</th>
                    <th>Acesso</th>
                    <th aria-label="Ações" />
                  </tr>
                </thead>

                <tbody>
                  {equipe.map((p) => {
                    const carteira = carteiras[p.id] ?? { leads: 0, imoveis: 0, negocios: 0 };
                    const euMesmo = p.id === usuario.id;

                    return (
                      <tr key={p.id} className={p.ativo ? undefined : 'linha-apagada'}>
                        <td data-rotulo="Pessoa">
                          <div className="celula-pessoa">
                            <span className="avatar avatar-p">{iniciais(p.nome)}</span>
                            <div className="pilha">
                              <span className="celula-principal">
                                {p.nome}
                                {euMesmo && <span className="marcador-voce">você</span>}
                              </span>
                              <span className="celula-apoio">
                                {p.email ?? 'sem e-mail'}
                                {p.telefone && ` · ${fmtTelefone(p.telefone)}`}
                                {p.creci && ` · ${p.creci}`}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td data-rotulo="Papel">
                          <span
                            className={`etiqueta${
                              p.papel === 'admin'
                                ? ' etiqueta-ouro'
                                : p.papel === 'gestor'
                                  ? ''
                                  : ' etiqueta-cinza'
                            }`}
                          >
                            {rotuloPapel(p.papel)}
                          </span>
                        </td>

                        <td data-rotulo="Permissões">
                          <div className="fichas-permissao">
                            {p.papel === 'admin' ? (
                              <span className="texto-mudo">Acesso total</span>
                            ) : (
                              <>
                                {AREAS_PERMISSAO.filter((a) => p.permissoes?.[a.chave]).map((a) => (
                                  <span
                                    key={a.chave}
                                    className="etiqueta etiqueta-sem-ponto etiqueta-cinza"
                                    title={a.explicacao}
                                  >
                                    {a.rotulo}
                                  </span>
                                ))}
                                {!AREAS_PERMISSAO.some((a) => p.permissoes?.[a.chave]) && (
                                  <span className="texto-mudo">Nenhuma</span>
                                )}
                              </>
                            )}
                          </div>
                        </td>

                        <td data-rotulo="Meta mensal" className="numerico">
                          {p.meta_mensal > 0 ? brl(p.meta_mensal) : '--'}
                        </td>

                        <td data-rotulo="Carteira">
                          <span className="celula-apoio">
                            {carteira.leads} leads · {carteira.imoveis} imóveis
                          </span>
                          {carteira.negocios > 0 && (
                            <span className="celula-apoio">
                              {carteira.negocios} em negociação
                            </span>
                          )}
                        </td>

                        <td data-rotulo="Acesso">
                          <span
                            className={`etiqueta ${p.ativo ? 'etiqueta-verde' : 'etiqueta-rubro'}`}
                          >
                            {p.ativo ? 'Ativo' : 'Desativado'}
                          </span>
                        </td>

                        <td data-rotulo="Ações">
                          <div className="celula-acoes">
                            {eAdmin || euMesmo ? (
                              <button
                                className="btn-icone"
                                onClick={() => setEmEdicao(p)}
                                title="Editar cadastro"
                                aria-label={`Editar ${p.nome}`}
                              >
                                <IconeLapis />
                              </button>
                            ) : null}

                            {eAdmin && !euMesmo && (
                              <>
                                <button
                                  className="btn btn-claro btn-pequeno"
                                  onClick={() => alternar(p)}
                                  disabled={pendente}
                                >
                                  {p.ativo ? 'Desativar' : 'Reativar'}
                                </button>

                                <button
                                  className="btn btn-claro btn-pequeno"
                                  onClick={() => trocarSenha(p)}
                                  disabled={pendente}
                                  title="Definir uma nova senha para esta pessoa"
                                >
                                  Nova senha
                                </button>

                                <button
                                  className="btn-icone btn-icone-rubro"
                                  onClick={() => {
                                    setRemovendo(p);
                                    setSubstituto('');
                                  }}
                                  disabled={pendente}
                                  title="Remover da equipe"
                                  aria-label={`Remover ${p.nome}`}
                                >
                                  <IconeLixeira />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {eAdmin && (
              <footer className="cartao-rodape">
                <span className="texto-mudo">
                  Quem entra pelo cadastro recebe um convite por e-mail e define a própria senha.
                  Ninguém digita senha de terceiro.
                </span>
              </footer>
            )}
          </div>
        )}
      </div>

      {eAdmin && (
        <button
          className="acao-flutuante"
          onClick={() => setCriando(true)}
          aria-label="Cadastrar integrante"
        >
          <IconeMais />
        </button>
      )}

      {(emEdicao || criando) && (
        <GavetaPessoa
          usuario={usuario}
          pessoa={emEdicao}
          equipe={equipe}
          carteira={emEdicao ? carteiras[emEdicao.id] : undefined}
          aoFechar={() => {
            setEmEdicao(null);
            setCriando(false);
          }}
          aoConcluir={(mensagem, erro) => {
            if (!erro) {
              setEmEdicao(null);
              setCriando(false);
            }
            avisar(mensagem, erro);
          }}
        />
      )}

      {removendo && (
        <>
          <div className="fundo-escuro" onClick={() => setRemovendo(null)} aria-hidden="true" />
          <div className="caixa-confirmacao" role="dialog" aria-modal="true">
            <h3>Remover {removendo.nome} da equipe</h3>
            <p>
              O acesso é apagado e não há como desfazer. Se a saída for temporária, prefira
              desativar: o histórico e as comissões continuam ligados à pessoa.
            </p>

            {(() => {
              const c = carteiras[removendo.id] ?? { leads: 0, imoveis: 0, negocios: 0 };
              const total = c.leads + c.imoveis + c.negocios;

              if (total === 0) {
                return (
                  <div className="aviso aviso-ok">
                    <IconeCheck />
                    <span>Não há leads, imóveis nem negócios em aberto no nome desta pessoa.</span>
                  </div>
                );
              }

              return (
                <>
                  <div className="aviso aviso-atencao">
                    <IconeAlerta />
                    <span>
                      Estão no nome desta pessoa: <strong>{c.leads}</strong> leads,{' '}
                      <strong>{c.imoveis}</strong> imóveis e <strong>{c.negocios}</strong> negócios
                      em aberto. Escolha quem assume.
                    </span>
                  </div>

                  <div className="campo">
                    <label htmlFor="substituto">Quem assume a carteira</label>
                    <select
                      id="substituto"
                      value={substituto}
                      onChange={(e) => setSubstituto(e.target.value)}
                    >
                      <option value="">Selecione uma pessoa</option>
                      {equipe
                        .filter((p) => p.ativo && p.id !== removendo.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                    </select>
                    <span className="ajuda">
                      Negócios já concluídos não trocam de dono: a comissão daquele mês pertence a
                      quem vendeu.
                    </span>
                  </div>
                </>
              );
            })()}

            <div className="linha-flex" style={{ gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-claro" onClick={() => setRemovendo(null)}>
                Cancelar
              </button>
              <button className="btn btn-perigo" onClick={confirmarRemocao} disabled={pendente}>
                <IconeLixeira />
                Remover em definitivo
              </button>
            </div>
          </div>
        </>
      )}

      {recado && (
        <Recado texto={recado.texto} erro={recado.erro} aoFechar={() => setRecado(null)} />
      )}
    </>
  );
}
