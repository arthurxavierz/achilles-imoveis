'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';

import {
  COR_FAIXA,
  FILTRO_PROSPECCAO_PADRAO,
  LIMITES_PROSPECCAO,
  RAIOS_PROSPECCAO,
  SEGMENTOS_SUGERIDOS,
  telefone as fmtTelefone,
  telefoneWhatsApp,
  type FiltroProspeccao,
  type Perfil,
  type Prospecto,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Recado } from '@/componentes/Recado';
import {
  IconeAlerta,
  IconeAlvo,
  IconeBusca,
  IconeInfo,
  IconeMais,
  IconeTelefone,
  IconeWhatsApp,
} from '@/componentes/Icones';
import { buscarEmpresas, importarProspecto } from '@/app/(painel)/prospeccao/acoes';

/**
 * Prospecção ativa.
 *
 * A tela responde uma pergunta que o funil não responde: quem ainda
 * não procurou a Achilles, mas deveria. O funil trabalha quem chegou; aqui
 * a casa vai atrás.
 *
 * Duas decisões que moldam a tela:
 *
 * O resultado não é salvo. Ele pode ser refeito pela mesma consulta a
 * qualquer momento, e guardá-lo criaria uma segunda lista de contatos
 * para manter em dia, ao lado do funil que já existe. O que se guarda
 * é a decisão de abordar, e essa decisão vira lead.
 *
 * O score vem acompanhado dos motivos. Score sozinho não sustenta
 * ligação: quem disca precisa saber o que dizer nos primeiros dez
 * segundos, e "vi que vocês têm 340 avaliações" abre conversa, "score
 * 82" não abre.
 */
export function Prospeccao({ usuario }: { usuario: Perfil }) {
  const router = useRouter();
  const [buscando, iniciarBusca] = useTransition();
  const [importando, iniciarImportacao] = useTransition();

  const [filtro, setFiltro] = useState<FiltroProspeccao>(FILTRO_PROSPECCAO_PADRAO);
  const [resultados, setResultados] = useState<Prospecto[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [chamadas, setChamadas] = useState(0);
  const [importados, setImportados] = useState<Set<string>>(new Set());
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);

  const avisar = useCallback((texto: string, erro = false) => setRecado({ texto, erro }), []);

  function mudar<C extends keyof FiltroProspeccao>(campo: C, valor: FiltroProspeccao[C]) {
    setFiltro((atual) => ({ ...atual, [campo]: valor }));
  }

  function buscar(e?: React.FormEvent) {
    e?.preventDefault();

    iniciarBusca(async () => {
      const r = await buscarEmpresas(filtro);

      if (!r.ok) {
        setResultados(null);
        avisar(r.erro ?? 'Falha na busca.', true);
        return;
      }

      setResultados(r.resultados ?? []);
      setAviso(r.aviso ?? null);
      setChamadas(r.chamadas ?? 0);
      setImportados(new Set());

      if ((r.resultados ?? []).length === 0) {
        avisar('Nenhuma empresa encontrada com esse recorte. Tente um raio maior.', true);
      }
    });
  }

  function importar(p: Prospecto) {
    iniciarImportacao(async () => {
      const r = await importarProspecto(p);

      if (r.ok) {
        setImportados((atual) => new Set(atual).add(p.id));
        avisar(r.mensagem ?? 'Lead criado.');
        router.refresh();
      } else {
        avisar(r.erro ?? 'Falha ao importar.', true);
      }
    });
  }

  const comTelefone = resultados?.filter((p) => p.telefone).length ?? 0;
  const altoPotencial = resultados?.filter((p) => p.score >= 66).length ?? 0;

  return (
    <>
      <CabecalhoPagina titulo="Prospecção" />

      <div className="corpo">
        <form className="cartao painel-prospeccao" onSubmit={buscar}>
          <div className="prospeccao-topo">
            <div>
              <h2>Quem ainda não procurou a Achilles</h2>
              <p className="texto-mudo">
                Busca empresas de um segmento numa cidade e ordena por potencial de imóvel
                comercial. Telefone, nota e avaliações vêm do Google.
              </p>
            </div>
            <span className="etiqueta">Google Places</span>
          </div>

          <div className="prospeccao-campos">
            <div className="campo" style={{ flex: '2 1 260px' }}>
              <label htmlFor="segmento">
                Segmento<span className="obrigatorio">*</span>
              </label>
              <input
                id="segmento"
                value={filtro.segmento}
                onChange={(e) => mudar('segmento', e.target.value)}
                placeholder="clínicas, academias, restaurantes"
                required
                autoFocus
                list="segmentos-sugeridos"
              />
              <datalist id="segmentos-sugeridos">
                {SEGMENTOS_SUGERIDOS.map((s) => (
                  <option key={s.termo} value={s.termo} />
                ))}
              </datalist>
            </div>

            <div className="campo" style={{ flex: '2 1 200px' }}>
              <label htmlFor="cidade">
                Cidade<span className="obrigatorio">*</span>
              </label>
              <input
                id="cidade"
                value={filtro.cidade}
                onChange={(e) => mudar('cidade', e.target.value)}
                placeholder="Uberlândia"
                required
              />
            </div>

            <div className="campo" style={{ flex: '0 0 80px' }}>
              <label htmlFor="uf">UF</label>
              <input
                id="uf"
                value={filtro.uf}
                onChange={(e) => mudar('uf', e.target.value.toUpperCase())}
                maxLength={2}
              />
            </div>

            <div className="campo" style={{ flex: '0 0 120px' }}>
              <label htmlFor="raio">Raio</label>
              <select
                id="raio"
                value={filtro.raioKm}
                onChange={(e) => mudar('raioKm', Number(e.target.value))}
              >
                {RAIOS_PROSPECCAO.map((r) => (
                  <option key={r} value={r}>
                    {r} km
                  </option>
                ))}
              </select>
            </div>

            <div className="campo" style={{ flex: '0 0 110px' }}>
              <label htmlFor="limite">Limite</label>
              <select
                id="limite"
                value={filtro.limite}
                onChange={(e) => mudar('limite', Number(e.target.value))}
              >
                {LIMITES_PROSPECCAO.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-ouro" type="submit" disabled={buscando}>
              <IconeBusca />
              {buscando ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {!resultados && (
            <div className="prospeccao-sugestoes">
              <span className="indicador-rotulo">Segmentos onde o ponto pesa mais</span>
              <div className="linha-flex" style={{ gap: 8, marginTop: 10 }}>
                {SEGMENTOS_SUGERIDOS.slice(0, 5).map((s) => (
                  <button
                    key={s.termo}
                    type="button"
                    className="btn btn-claro btn-pequeno"
                    onClick={() => mudar('segmento', s.termo)}
                    title={s.porque}
                  >
                    {s.termo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {aviso && (
          <div className="aviso aviso-atencao" style={{ marginBottom: 16 }}>
            <IconeInfo />
            <span>{aviso}</span>
          </div>
        )}

        {resultados && resultados.length > 0 && (
          <>
            <div className="painel-resumo">
              <ResumoRapido rotulo="Encontradas" valor={String(resultados.length)} />
              <ResumoRapido rotulo="Com telefone" valor={String(comTelefone)} />
              <ResumoRapido rotulo="Potencial alto" valor={String(altoPotencial)} />
              <ResumoRapido
                rotulo="Consultas ao Google"
                valor={chamadas === 0 ? '--' : String(chamadas)}
              />
            </div>

            <div className="lista-prospectos">
              {resultados.map((p) => {
                const importado = importados.has(p.id);

                return (
                  <article key={p.id} className="cartao prospecto">
                    <header className="prospecto-topo">
                      <div style={{ minWidth: 0 }}>
                        <h3>{p.nome}</h3>
                        <p className="texto-mudo">
                          {p.categoria}
                          {p.distancia_km !== null && ` · ${p.distancia_km} km do centro`}
                        </p>
                      </div>

                      <div className="prospecto-score">
                        <span className={`etiqueta etiqueta-${COR_FAIXA[p.faixa]}`}>{p.faixa}</span>
                        <strong>{p.score}</strong>
                      </div>
                    </header>

                    <p className="prospecto-endereco">{p.endereco}</p>

                    <p className="prospecto-encaixe">{p.encaixe}</p>

                    <ul className="prospecto-motivos">
                      {p.motivos.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>

                    <footer className="prospecto-acoes">
                      {p.telefone ? (
                        <>
                          <a
                            className="btn btn-claro btn-pequeno btn-zap-cheio"
                            href={`https://wa.me/${telefoneWhatsApp(p.telefone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <IconeWhatsApp />
                            WhatsApp
                          </a>
                          <a className="btn btn-claro btn-pequeno" href={`tel:${p.telefone}`}>
                            <IconeTelefone />
                            {fmtTelefone(p.telefone.replace(/\D/g, '').slice(-11)) || p.telefone}
                          </a>
                        </>
                      ) : (
                        <span className="marca-pendencia">
                          <IconeAlerta />
                          Sem telefone
                        </span>
                      )}

                      <a
                        className="btn btn-claro btn-pequeno"
                        href={p.mapa_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Ver no mapa
                      </a>

                      {p.site && (
                        <a
                          className="btn btn-claro btn-pequeno"
                          href={p.site}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Site
                        </a>
                      )}

                      <button
                        className={importado ? 'btn btn-claro btn-pequeno empurra' : 'btn btn-pequeno empurra'}
                        onClick={() => importar(p)}
                        disabled={importando || importado}
                      >
                        <IconeMais />
                        {importado ? 'No funil' : 'Trazer para o funil'}
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>

            <p className="texto-mudo" style={{ marginTop: 18, fontSize: '0.82rem' }}>
              O potencial é uma estimativa a partir do que o Google publica: porte pelo volume de
              avaliações, e quanto o ponto comercial pesa naquele tipo de negócio. Ele não sabe se
              a empresa está satisfeita com o imóvel atual nem quando vence o contrato — isso só a
              ligação descobre.
            </p>
          </>
        )}

        {resultados && resultados.length === 0 && (
          <div className="vazio">
            <IconeAlvo />
            <h3>Nenhuma empresa nesta busca</h3>
            <p>
              O segmento pode estar escrito de um jeito que o Google não reconhece, ou o raio pode
              estar apertado demais. Tente um termo mais comum e 30 km.
            </p>
          </div>
        )}

        {!resultados && !buscando && (
          <div className="vazio">
            <IconeAlvo />
            <h3>Comece por um segmento e uma cidade</h3>
            <p>
              O resultado chega com telefone, nota do Google e uma leitura de potencial para imóvel
              comercial. De lá, cada empresa entra no funil com um clique, como lead de prospecção.
            </p>
          </div>
        )}
      </div>

      {recado && (
        <Recado texto={recado.texto} erro={recado.erro} aoFechar={() => setRecado(null)} />
      )}
    </>
  );
}

function ResumoRapido({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="resumo-item">
      <span className="indicador-rotulo">{rotulo}</span>
      <strong>{valor}</strong>
    </div>
  );
}
