'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import {
  brl,
  brlCurto,
  iniciais,
  telefone as fmtTelefone,
  type Imovel,
  type Perfil,
  type ProprietarioComCarteira,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Recado } from '@/componentes/Recado';
import { IconeBusca, IconeEquipe, IconeMais } from '@/componentes/Icones';
import { GavetaProprietario } from './GavetaProprietario';

type Recorte = '' | 'com-imoveis' | 'sem-imoveis' | 'publicando';

/**
 * Cadastro de proprietários.
 *
 * A tela responde uma pergunta que a lista de imóveis não responde: de
 * quem é a carteira. Numa imobiliária de alto padrão isso importa mais
 * do que parece — quem entregou três imóveis é quem entrega o quarto, e
 * é a pessoa para quem se liga antes de anunciar uma captação nova.
 *
 * Por isso a contagem de imóveis fica na linha, e não escondida na
 * ficha: ela é o dado que ordena a atenção da equipe. Um proprietário
 * com quatro imóveis parados vale um telefonema; um com nenhum vale uma
 * limpeza no cadastro.
 */
export function Proprietarios({
  usuario,
  proprietarios,
  imoveis,
  equipe,
  abertoInicial,
}: {
  usuario: Perfil;
  proprietarios: ProprietarioComCarteira[];
  imoveis: Imovel[];
  equipe: Perfil[];
  abertoInicial: string | null;
}) {
  const router = useRouter();

  const [busca, setBusca] = useState('');
  const [recorte, setRecorte] = useState<Recorte>('');
  const [abertoId, setAbertoId] = useState<string | null>(abertoInicial);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');

    return proprietarios.filter((p) => {
      if (recorte === 'com-imoveis' && p.total_imoveis === 0) return false;
      if (recorte === 'sem-imoveis' && p.total_imoveis > 0) return false;
      if (recorte === 'publicando' && p.imoveis_publicados === 0) return false;

      if (!termo) return true;

      return (
        p.nome.toLowerCase().includes(termo) ||
        (p.email ?? '').toLowerCase().includes(termo) ||
        (p.cpf_cnpj ?? '').toLowerCase().includes(termo) ||
        (digitos.length >= 3 && (p.telefone ?? '').includes(digitos))
      );
    });
  }, [proprietarios, busca, recorte]);

  const aberto = useMemo(
    () => (abertoId ? (proprietarios.find((p) => p.id === abertoId) ?? null) : null),
    [proprietarios, abertoId],
  );

  const imoveisDoAberto = useMemo(
    () => (aberto ? imoveis.filter((i) => i.proprietario_id === aberto.id) : []),
    [imoveis, aberto],
  );

  const avisar = useCallback((texto: string, erro = false) => setRecado({ texto, erro }), []);

  function fechar() {
    setAbertoId(null);
    setCriandoNovo(false);
  }

  function aoConcluir(mensagem: string, erro = false) {
    if (!erro) fechar();
    avisar(mensagem, erro);
    router.refresh();
  }

  const valorTotal = filtrados.reduce((soma, p) => soma + p.valor_carteira, 0);
  const semImovel = proprietarios.filter((p) => p.total_imoveis === 0).length;
  const semVinculo = imoveis.filter((i) => !i.proprietario_id).length;

  return (
    <>
      <CabecalhoPagina titulo="Proprietários">
        <button className="btn somente-desktop" onClick={() => setCriandoNovo(true)}>
          <IconeMais />
          Novo proprietário
        </button>
      </CabecalhoPagina>

      <div className="corpo">
        <div className="painel-resumo">
          <ResumoRapido rotulo="Cadastrados" valor={String(proprietarios.length)} />
          <ResumoRapido rotulo="Valor em carteira" valor={brlCurto(valorTotal)} />
          <ResumoRapido rotulo="Sem imóvel" valor={String(semImovel)} />
          <ResumoRapido
            rotulo="Imóveis sem dono"
            valor={String(semVinculo)}
            alerta={semVinculo > 0}
          />
        </div>

        {semVinculo > 0 && (
          <div className="aviso aviso-atencao" style={{ marginBottom: 16 }}>
            <span>
              <strong>
                {semVinculo} {semVinculo === 1 ? 'imóvel' : 'imóveis'}
              </strong>{' '}
              {semVinculo === 1 ? 'ainda não tem' : 'ainda não têm'} proprietário vinculado — quase
              sempre são os que vieram por importação, porque o XML do portal não carrega dado de
              captação.{' '}
              <a href="/imoveis?sem-proprietario=1">Ver e regularizar na carteira</a>.
            </span>
          </div>
        )}

        <div className="filtros-barra">
          <div className="busca-rapida">
            <IconeBusca />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, documento, telefone ou e-mail"
              aria-label="Buscar proprietário"
            />
          </div>

          <div className="campo campo-filtro">
            <select
              value={recorte}
              onChange={(e) => setRecorte(e.target.value as Recorte)}
              aria-label="Filtrar carteira"
            >
              <option value="">Todos os proprietários</option>
              <option value="com-imoveis">Com imóvel na carteira</option>
              <option value="publicando">Com imóvel no ar</option>
              <option value="sem-imoveis">Sem nenhum imóvel</option>
            </select>
          </div>

          {(busca || recorte) && (
            <button
              className="btn btn-fantasma btn-pequeno"
              onClick={() => {
                setBusca('');
                setRecorte('');
              }}
            >
              Limpar filtros
            </button>
          )}

          <span className="texto-mudo empurra somente-desktop">
            {filtrados.length} {filtrados.length === 1 ? 'proprietário' : 'proprietários'} ·{' '}
            {brl(valorTotal)} em carteira
          </span>
        </div>

        {filtrados.length === 0 ? (
          <div className="vazio">
            <IconeEquipe />
            <h3>Nenhum proprietário nesta seleção</h3>
            <p>
              O proprietário entra no sistema no momento em que um imóvel é cadastrado, porque todo
              imóvel precisa de alguém que responda por ele. Você também pode cadastrar antes, para
              já ter o contato em mãos quando a captação fechar.
            </p>
            <button className="btn btn-claro" onClick={() => setCriandoNovo(true)}>
              <IconeMais />
              Cadastrar proprietário
            </button>
          </div>
        ) : (
          <div className="cartao">
            <div className="tabela-envelope">
              <table className="tabela tabela-responsiva">
                <thead>
                  <tr>
                    <th>Proprietário</th>
                    <th>Contato</th>
                    <th className="numerico">Imóveis</th>
                    <th className="numerico">Em carteira</th>
                    <th>Vitrine</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setAbertoId(p.id)}
                      className="linha-clicavel"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setAbertoId(p.id);
                        }
                      }}
                    >
                      <td data-rotulo="Proprietário" className="celula-principal">
                        <div className="linha-flex" style={{ gap: 10, flexWrap: 'nowrap' }}>
                          <span className="avatar">{iniciais(p.nome)}</span>
                          <span style={{ minWidth: 0 }}>
                            {p.nome}
                            {p.cpf_cnpj && <span className="celula-apoio">{p.cpf_cnpj}</span>}
                          </span>
                        </div>
                      </td>

                      <td data-rotulo="Contato">
                        {p.telefone ? fmtTelefone(p.telefone) : (p.email ?? '--')}
                        {p.telefone && p.email && <span className="celula-apoio">{p.email}</span>}
                      </td>

                      <td data-rotulo="Imóveis" className="numerico">
                        {p.total_imoveis}
                      </td>

                      <td data-rotulo="Em carteira" className="numerico">
                        {p.valor_carteira > 0 ? brl(p.valor_carteira) : '--'}
                      </td>

                      <td data-rotulo="Vitrine">
                        {p.imoveis_publicados > 0 ? (
                          <span className="etiqueta etiqueta-verde">
                            {p.imoveis_publicados} no ar
                          </span>
                        ) : (
                          <span className="texto-mudo">Nenhum no ar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="cartao-rodape">
              <span className="texto-mudo">
                O valor em carteira soma apenas o que está disponível ou reservado. Imóvel vendido
                já saiu da conta.
              </span>
            </div>
          </div>
        )}
      </div>

      <button
        className="acao-flutuante"
        onClick={() => setCriandoNovo(true)}
        aria-label="Novo proprietário"
      >
        <IconeMais />
      </button>

      {(aberto || criandoNovo) && (
        <GavetaProprietario
          usuario={usuario}
          proprietario={aberto}
          imoveis={imoveisDoAberto}
          equipe={equipe}
          aoFechar={fechar}
          aoConcluir={aoConcluir}
        />
      )}

      {recado && (
        <Recado texto={recado.texto} erro={recado.erro} aoFechar={() => setRecado(null)} />
      )}
    </>
  );
}

function ResumoRapido({
  rotulo,
  valor,
  alerta,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className={`resumo-item${alerta ? ' resumo-item-alerta' : ''}`}>
      <span className="indicador-rotulo">{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}
