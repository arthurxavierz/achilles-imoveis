'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { FAIXAS_VALOR, GRUPOS_TIPO, PRETENSOES, slugify } from '@imob/core';

import { Seletor } from './Seletor';
import type { Faceta } from '@imob/db';

import { IconeBusca, IconeFiltro, IconeLocal, IconePredio } from './Icones';

/**
 * Busca principal do hero.
 *
 * Um campo de texto so, que aceita condominio, bairro, cidade ou codigo,
 * porque e assim que a pessoa pensa: ela nao sabe se "Splêndido" e um
 * bairro ou um predio, e nao deveria precisar saber. A sugestao mostra a
 * qual dimensao cada resultado pertence e o formulario decide o filtro
 * certo na hora de montar a URL.
 *
 * A comparacao ignora acento de proposito: quem digita "karaiba" precisa
 * encontrar "Jardim Karaíba" sem acertar o acento.
 */
export function BuscaHero({
  bairros = [],
  cidades = [],
  condominios = [],
}: {
  bairros?: Faceta[];
  cidades?: Faceta[];
  condominios?: Faceta[];
}) {
  const router = useRouter();

  const [pretensao, setPretensao] = useState('venda');
  const [tipo, setTipo] = useState('');
  const [faixa, setFaixa] = useState('');
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destacado, setDestacado] = useState(-1);
  const [maisAberto, setMaisAberto] = useState(false);

  const caixa = useRef<HTMLDivElement>(null);

  interface Sugestao {
    valor: string;
    dimensao: 'condominio' | 'bairro' | 'cidade';
    rotulo: string;
    total: number;
  }

  const universo = useMemo<Sugestao[]>(
    () => [
      ...condominios.map((c) => ({
        valor: c.valor,
        dimensao: 'condominio' as const,
        rotulo: 'condomínio',
        total: c.total,
      })),
      ...bairros.map((b) => ({
        valor: b.valor,
        dimensao: 'bairro' as const,
        rotulo: 'bairro',
        total: b.total,
      })),
      ...cidades.map((c) => ({
        valor: c.valor,
        dimensao: 'cidade' as const,
        rotulo: 'cidade',
        total: c.total,
      })),
    ],
    [bairros, cidades, condominios],
  );

  const sugestoes = useMemo(() => {
    const busca = normalizar(termo);
    if (busca.length < 2) return [];

    return universo
      .filter((s) => normalizar(s.valor).includes(busca))
      .sort((a, b) => {
        // Quem começa com o que foi digitado vem antes de quem apenas
        // contém: buscar "jar" deve trazer Jardim Karaíba antes de
        // Cidade Jardim.
        const aComeca = normalizar(a.valor).startsWith(busca) ? 0 : 1;
        const bComeca = normalizar(b.valor).startsWith(busca) ? 0 : 1;
        return aComeca - bComeca || b.total - a.total;
      })
      .slice(0, 7);
  }, [termo, universo]);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (caixa.current && !caixa.current.contains(evento.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const [escolhida, setEscolhida] = useState<Sugestao | null>(null);

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto || sugestoes.length === 0) return;

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setDestacado((i) => (i + 1) % sugestoes.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setDestacado((i) => (i - 1 + sugestoes.length) % sugestoes.length);
    } else if (evento.key === 'Enter' && destacado >= 0) {
      evento.preventDefault();
      escolher(sugestoes[destacado]);
    } else if (evento.key === 'Escape') {
      setAberto(false);
    }
  }

  function escolher(s: Sugestao) {
    setTermo(s.valor);
    setEscolhida(s);
    setAberto(false);
    setDestacado(-1);
  }

  function montarConsulta(): string {
    const params = new URLSearchParams();

    if (pretensao === 'locacao') params.set('finalidade', 'locacao');
    if (tipo) params.set('tipo', tipo);

    const texto = termo.trim();
    if (texto) {
      // Quando a pessoa escolheu uma sugestão, o filtro vira exato e o
      // resultado fica muito melhor do que um "contém" no título.
      if (escolhida && normalizar(escolhida.valor) === normalizar(texto)) {
        params.set(escolhida.dimensao, escolhida.valor);
      } else {
        const exata = universo.find((s) => normalizar(s.valor) === normalizar(texto));
        if (exata) params.set(exata.dimensao, exata.valor);
        else params.set('termo', texto);
      }
    }

    const escolhidaFaixa = FAIXAS_VALOR.find((f) => f.chave === faixa);
    if (escolhidaFaixa?.min) params.set('valorMin', String(escolhidaFaixa.min));
    if (escolhidaFaixa?.max) params.set('valorMax', String(escolhidaFaixa.max));

    return params.toString();
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const consulta = montarConsulta();
    router.push(consulta ? `/imoveis?${consulta}` : '/imoveis');
  }

  function abrirComFiltros() {
    const consulta = montarConsulta();
    router.push(`/imoveis?${consulta}${consulta ? '&' : ''}filtros=1`);
  }

  return (
    <form className="busca" onSubmit={enviar} role="search">
      <div className="busca-campo">
        <label htmlFor="busca-pretensao">Pretensão</label>
        <Seletor
          id="busca-pretensao"
          rotulo="Pretensão"
          valor={pretensao}
          aoMudar={setPretensao}
          opcoes={PRETENSOES.map((p) => ({ valor: p.chave, rotulo: p.rotulo }))}
        />
      </div>

      <div className="busca-campo">
        <label htmlFor="busca-tipo">Tipo de imóvel</label>
        <div className="busca-com-icone">
          <IconePredio />
          <Seletor
            id="busca-tipo"
            rotulo="Tipo de imóvel"
            valor={tipo}
            aoMudar={setTipo}
            opcoes={[
              { valor: '', rotulo: 'Todos os tipos' },
              ...GRUPOS_TIPO.flatMap((grupo) =>
                grupo.tipos.map((t) => ({ valor: t, rotulo: t, grupo: grupo.rotulo })),
              ),
            ]}
          />
        </div>
      </div>

      <div className="busca-campo busca-campo-largo" ref={caixa}>
        <label htmlFor="busca-local">Onde</label>
        <div className="busca-com-icone">
          <IconeLocal />
          <input
            id="busca-local"
            type="text"
            value={termo}
            autoComplete="off"
            placeholder="Digite condomínio, bairro, cidade ou código"
            onChange={(e) => {
              setTermo(e.target.value);
              setEscolhida(null);
              setAberto(true);
              setDestacado(-1);
            }}
            onFocus={() => setAberto(true)}
            onKeyDown={aoTeclar}
            role="combobox"
            aria-expanded={aberto && sugestoes.length > 0}
            aria-controls="lista-sugestoes"
            aria-autocomplete="list"
          />
        </div>

        {aberto && sugestoes.length > 0 && (
          <div className="sugestoes" id="lista-sugestoes" role="listbox">
            {sugestoes.map((s, i) => (
              <button
                key={`${s.dimensao}-${s.valor}`}
                type="button"
                className="sugestao"
                role="option"
                aria-selected={i === destacado}
                data-ativo={i === destacado}
                onMouseEnter={() => setDestacado(i)}
                onClick={() => escolher(s)}
              >
                <span>{s.valor}</span>
                <small>
                  {s.rotulo} · {s.total}
                </small>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* O campo de valor só aparece quando a pessoa pede mais filtros.
          Ele cabe na barra, mas deixar quatro campos abertos de uma vez
          faz a busca parecer um formulário, e a barra deixa de convidar. */}
      {maisAberto && (
        <div className="busca-campo busca-campo-largo">
          <label htmlFor="busca-faixa">Faixa de valor</label>
          <Seletor
            id="busca-faixa"
            rotulo="Faixa de valor"
            valor={faixa}
            aoMudar={setFaixa}
            opcoes={[
              { valor: '', rotulo: 'Qualquer valor' },
              ...FAIXAS_VALOR.map((f) => ({ valor: f.chave, rotulo: f.rotulo })),
            ]}
          />
        </div>
      )}

      <button
        type="button"
        className="busca-mais"
        onClick={() => (maisAberto ? abrirComFiltros() : setMaisAberto(true))}
        aria-expanded={maisAberto}
      >
        <IconeFiltro />
        {maisAberto ? 'Todos os filtros' : 'Mais filtros'}
      </button>

      <button className="btn btn-ouro" type="submit">
        <IconeBusca />
        Encontrar imóvel
      </button>
    </form>
  );
}

/**
 * Texto comparavel: sem acento, sem pontuacao e em minusculas.
 *
 * Reaproveita o slugify do pacote core em vez de escrever outra
 * normalizacao aqui. Sao duas linhas a menos e, principalmente, e a
 * mesma regra que o banco usa para gerar o endereco do imovel: se as
 * duas divergissem, buscar pelo nome exato do condominio poderia nao
 * encontrar a pagina dele.
 */
function normalizar(texto: string): string {
  return slugify(texto);
}
