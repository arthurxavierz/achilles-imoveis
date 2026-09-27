'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  CARACTERISTICAS_COMUNS,
  DEGRAUS,
  FAIXAS_VALOR,
  GRUPOS_TIPO,
  PRETENSOES,
  chaveDaFaixa,
  contarFiltros,
  descreverFiltros,
  type FiltroBusca,
} from '@imob/core';
import type { Facetas } from '@imob/db';

import { IconeFechar, IconeFiltro } from './Icones';
import { Seletor } from './Seletor';

/**
 * Filtros da listagem.
 *
 * A gaveta guarda um rascunho e so escreve na URL quando a pessoa
 * confirma. E deliberado: aplicar a cada clique dispararia uma consulta
 * por caixa marcada, e numa carteira de centenas de imoveis isso vira
 * meia duzia de recarregamentos ate montar a busca que ela queria.
 *
 * As fichas de fora, ao contrario, removem na hora. Ali o gesto e
 * "tire isto", e esperar por um botao de confirmar seria estranho.
 */
export function FiltrosImoveis({
  facetas,
  filtroAtual,
  abrirAoEntrar = false,
}: {
  facetas: Facetas;
  filtroAtual: FiltroBusca;
  /** A busca do hero manda abrir a gaveta ja aberta. */
  abrirAoEntrar?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [aberta, setAberta] = useState(abrirAoEntrar);
  const [rascunho, setRascunho] = useState<FiltroBusca>(filtroAtual);

  // Voltar pelo navegador troca a URL sem remontar o componente. Sem
  // isto, a gaveta reabriria com o filtro antigo.
  useEffect(() => {
    setRascunho(filtroAtual);
  }, [filtroAtual]);

  useEffect(() => {
    document.body.style.overflow = aberta ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [aberta]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberta(false);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, []);

  const total = contarFiltros(filtroAtual);
  const fichas = descreverFiltros(filtroAtual);

  function irPara(novos: Record<string, string | null>) {
    const atuais = new URLSearchParams(params.toString());

    for (const [chave, valor] of Object.entries(novos)) {
      if (valor === null || valor === '') atuais.delete(chave);
      else atuais.set(chave, valor);
    }

    atuais.delete('pagina');
    atuais.delete('filtros');

    router.push(`/imoveis?${atuais.toString()}`);
  }

  function aplicar() {
    const atuais = new URLSearchParams(params.toString());

    const escrever = (chave: string, valor: string | number | undefined | null) => {
      if (valor === undefined || valor === null || valor === '' || valor === 0) {
        atuais.delete(chave);
      } else {
        atuais.set(chave, String(valor));
      }
    };

    escrever('finalidade', rascunho.finalidade);
    escrever('tipo', rascunho.tipo);
    escrever('cidade', rascunho.cidade);
    escrever('bairro', rascunho.bairro);
    escrever('condominio', rascunho.condominio);
    escrever('quartos', rascunho.quartos);
    escrever('suites', rascunho.suites);
    escrever('vagas', rascunho.vagas);
    escrever('banheiros', rascunho.banheiros);
    escrever('valorMin', rascunho.valorMin);
    escrever('valorMax', rascunho.valorMax);
    escrever('areaMin', rascunho.areaMin);
    escrever('areaMax', rascunho.areaMax);
    escrever('destaque', rascunho.somenteDestaque ? '1' : null);

    // Característica é parâmetro repetido, então precisa de append e não
    // de set: um set apagaria as anteriores a cada volta do laço.
    atuais.delete('caracteristica');
    for (const c of rascunho.caracteristicas ?? []) atuais.append('caracteristica', c);

    // Qualquer mudança de filtro volta para a primeira página. Ficar na
    // página 7 de um resultado que agora tem duas é a forma mais rápida
    // de o visitante achar que o site não tem nada.
    atuais.delete('pagina');
    atuais.delete('filtros');

    router.push(`/imoveis?${atuais.toString()}`);
    setAberta(false);
  }

  function limparTudo() {
    setRascunho({ ordem: filtroAtual.ordem });
    router.push('/imoveis');
    setAberta(false);
  }

  function alternarCaracteristica(nome: string) {
    const atuais = rascunho.caracteristicas ?? [];
    setRascunho({
      ...rascunho,
      caracteristicas: atuais.includes(nome)
        ? atuais.filter((c) => c !== nome)
        : [...atuais, nome],
    });
  }

  function removerFicha(ficha: { chave: string; limpa: string[] }) {
    if (ficha.chave.startsWith('caracteristica-')) {
      const nome = ficha.chave.replace('caracteristica-', '');
      const atuais = new URLSearchParams(params.toString());
      const restantes = atuais.getAll('caracteristica').filter((c) => c !== nome);
      atuais.delete('caracteristica');
      for (const c of restantes) atuais.append('caracteristica', c);
      atuais.delete('pagina');
      router.push(`/imoveis?${atuais.toString()}`);
      return;
    }

    const zerados: Record<string, null> = {};
    for (const chave of ficha.limpa) zerados[chave] = null;
    if (ficha.chave === 'destaque') zerados.destaque = null;
    irPara(zerados);
  }

  const degrau = (
    campo: 'quartos' | 'suites' | 'vagas' | 'banheiros',
    rotulo: string,
  ) => (
    <div className="grupo-filtro">
      <span>{rotulo}</span>
      <div className="degraus">
        {DEGRAUS.map((n) => (
          <button
            key={n}
            type="button"
            className="degrau"
            aria-pressed={rascunho[campo] === n}
            onClick={() =>
              setRascunho({ ...rascunho, [campo]: rascunho[campo] === n ? undefined : n })
            }
          >
            {n}
            {n === 4 ? '+' : ''}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <button className="botao-filtros" onClick={() => setAberta(true)} aria-expanded={aberta}>
        <IconeFiltro />
        Filtros
        {total > 0 && <span className="contador-filtros">{total}</span>}
      </button>

      {fichas.length > 0 && (
        <div className="fichas-filtro" style={{ width: '100%' }}>
          {fichas.map((f) => (
            <span key={f.chave} className="ficha-filtro">
              {f.rotulo}
              <button onClick={() => removerFicha(f)} aria-label={`Remover filtro ${f.rotulo}`}>
                <IconeFechar />
              </button>
            </span>
          ))}

          <button className="ficha-filtro" onClick={limparTudo}>
            Limpar tudo
          </button>
        </div>
      )}

      {aberta && (
        <>
          <div className="fundo-escuro" onClick={() => setAberta(false)} aria-hidden="true" />

          <aside className="gaveta-filtros" role="dialog" aria-modal="true" aria-label="Filtros">
            <header className="gaveta-topo">
              <h2>Filtrar imóveis</h2>
              <button
                className="btn-icone"
                onClick={() => setAberta(false)}
                aria-label="Fechar filtros"
              >
                <IconeFechar />
              </button>
            </header>

            <div className="gaveta-corpo">
              <div className="grupo-filtro">
                <span>Pretensão</span>
                <div className="degraus">
                  {PRETENSOES.map((p) => (
                    <button
                      key={p.chave}
                      type="button"
                      className="degrau"
                      aria-pressed={rascunho.finalidade === p.chave}
                      onClick={() =>
                        setRascunho({
                          ...rascunho,
                          finalidade: rascunho.finalidade === p.chave ? undefined : p.chave,
                        })
                      }
                    >
                      {p.rotulo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="campo">
                <label htmlFor="f-tipo">Tipo de imóvel</label>
                <Seletor
                  id="f-tipo"
                  rotulo="Tipo de imóvel"
                  className="campo-seletor"
                  valor={rascunho.tipo ?? ''}
                  aoMudar={(v) => setRascunho({ ...rascunho, tipo: v || undefined })}
                  opcoes={[
                    { valor: '', rotulo: 'Todos os tipos' },
                    ...GRUPOS_TIPO.flatMap((grupo) =>
                      grupo.tipos
                        .filter((t) => facetas.tipos.some((f) => f.valor === t))
                        .map((t) => ({
                          valor: t,
                          rotulo: `${t} (${facetas.tipos.find((f) => f.valor === t)?.total ?? 0})`,
                          grupo: grupo.rotulo,
                        })),
                    ),
                  ]}
                />
              </div>

              <div className="campo">
                <label htmlFor="f-cidade">Cidade</label>
                <Seletor
                  id="f-cidade"
                  rotulo="Cidade"
                  className="campo-seletor"
                  valor={rascunho.cidade ?? ''}
                  aoMudar={(v) => setRascunho({ ...rascunho, cidade: v || undefined })}
                  opcoes={[
                    { valor: '', rotulo: 'Todas as cidades' },
                    ...facetas.cidades.map((c) => ({
                      valor: c.valor,
                      rotulo: `${c.valor} (${c.total})`,
                    })),
                  ]}
                />
              </div>

              <div className="campo">
                <label htmlFor="f-bairro">Bairro</label>
                <Seletor
                  id="f-bairro"
                  rotulo="Bairro"
                  className="campo-seletor"
                  valor={rascunho.bairro ?? ''}
                  aoMudar={(v) => setRascunho({ ...rascunho, bairro: v || undefined })}
                  opcoes={[
                    { valor: '', rotulo: 'Todos os bairros' },
                    ...facetas.bairros.map((b) => ({
                      valor: b.valor,
                      rotulo: `${b.valor} (${b.total})`,
                    })),
                  ]}
                />
              </div>

              {facetas.condominios.length > 0 && (
                <div className="campo">
                  <label htmlFor="f-condominio">Condomínio</label>
                  <Seletor
                    id="f-condominio"
                    rotulo="Condomínio"
                    className="campo-seletor"
                    valor={rascunho.condominio ?? ''}
                    aoMudar={(v) => setRascunho({ ...rascunho, condominio: v || undefined })}
                    opcoes={[
                      { valor: '', rotulo: 'Qualquer condomínio' },
                      ...facetas.condominios.map((c) => ({
                        valor: c.valor,
                        rotulo: `${c.valor} (${c.total})`,
                      })),
                    ]}
                  />
                </div>
              )}

              <div className="campo">
                <label htmlFor="f-faixa">Faixa de valor</label>
                <Seletor
                  id="f-faixa"
                  rotulo="Faixa de valor"
                  className="campo-seletor"
                  valor={chaveDaFaixa(rascunho.valorMin, rascunho.valorMax)}
                  aoMudar={(v) => {
                    const f = FAIXAS_VALOR.find((x) => x.chave === v);
                    setRascunho({ ...rascunho, valorMin: f?.min, valorMax: f?.max });
                  }}
                  opcoes={[
                    { valor: '', rotulo: 'Qualquer valor' },
                    ...FAIXAS_VALOR.map((f) => ({ valor: f.chave, rotulo: f.rotulo })),
                  ]}
                />
              </div>

              {degrau('quartos', 'Quartos, no mínimo')}
              {degrau('suites', 'Suítes, no mínimo')}
              {degrau('vagas', 'Vagas, no mínimo')}

              <div className="linha-campos">
                <div className="campo">
                  <label htmlFor="f-area-min">Área mínima</label>
                  <input
                    id="f-area-min"
                    inputMode="numeric"
                    placeholder="m²"
                    value={rascunho.areaMin ?? ''}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, areaMin: Number(e.target.value) || undefined })
                    }
                  />
                </div>
                <div className="campo">
                  <label htmlFor="f-area-max">Área máxima</label>
                  <input
                    id="f-area-max"
                    inputMode="numeric"
                    placeholder="m²"
                    value={rascunho.areaMax ?? ''}
                    onChange={(e) =>
                      setRascunho({ ...rascunho, areaMax: Number(e.target.value) || undefined })
                    }
                  />
                </div>
              </div>

              <div className="grupo-filtro">
                <span>Diferenciais</span>
                <div className="lista-caracteristicas">
                  {CARACTERISTICAS_COMUNS.map((c) => (
                    <label key={c} className="caixa-marcar">
                      <input
                        type="checkbox"
                        checked={(rascunho.caracteristicas ?? []).includes(c)}
                        onChange={() => alternarCaracteristica(c)}
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="caixa-marcar">
                <input
                  type="checkbox"
                  checked={Boolean(rascunho.somenteDestaque)}
                  onChange={(e) =>
                    setRascunho({ ...rascunho, somenteDestaque: e.target.checked || undefined })
                  }
                />
                <span>Somente imóveis em super destaque</span>
              </label>
            </div>

            <footer className="gaveta-rodape">
              <button className="btn btn-contorno" onClick={limparTudo}>
                Limpar
              </button>
              <button className="btn btn-ouro btn-bloco" onClick={aplicar}>
                Ver imóveis
              </button>
            </footer>
          </aside>
        </>
      )}
    </>
  );
}
