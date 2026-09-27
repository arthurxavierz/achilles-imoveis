'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

import { urlFoto } from '@imob/db';

import {
  area as fmtArea,
  brl,
  brlCurto,
  contarFiltrosCarteira,
  data as fmtData,
  FAIXAS_CARTEIRA,
  filtrarCarteira,
  FILTRO_CARTEIRA_VAZIO,
  podeGerenciarImovel,
  STATUS_IMOVEL,
  TIPOS_IMOVEL,
  type FiltroCarteira,
  type Imovel,
  type ImovelResumo,
  type Perfil,
  type Proprietario,
} from '@imob/core';

import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Recado } from '@/componentes/Recado';
import {
  IconeAlerta,
  IconeBusca,
  IconeDireita,
  IconeFiltro,
  IconeImovel,
  IconeMais,
  IconeVazio,
} from '@/componentes/Icones';
import {
  alternarDestaque,
  alternarPublicacao,
  atribuirCorretor,
  buscarCapas,
  buscarFichaImovel,
  excluirEmLote,
  vincularProprietario,
  vincularProprietarioEmLote,
  mudarStatusImovel,
  publicarEmLote,
  type EstadoLote,
} from '@/app/(painel)/imoveis/acoes';
import { GavetaImovel } from './GavetaImovel';

/**
 * Linhas desenhadas por vez.
 *
 * A carteira inteira continua em memoria de proposito: filtro, VGV,
 * contagem e a selecao em lote precisam enxergar o conjunto todo, e e o
 * que permite dizer "461 fora da vitrine" olhando para o real. Caro era
 * desenhar tudo de uma vez — cada linha traz dois <select>, e um deles
 * lista a equipe inteira, o que com novecentos imoveis passa de quinze
 * mil <option> montadas e hidratadas a cada abertura da aba.
 *
 * Paginar aqui e so sobre o desenho. Marcar "todos" segue marcando a
 * carteira filtrada inteira, e nao os cinquenta da tela.
 */
const POR_PAGINA = 50;

const ESTILO_SELECT_CELULA: React.CSSProperties = {
  minHeight: 34,
  padding: '5px 28px 5px 10px',
  fontSize: '0.82rem',
  border: '1px solid var(--linha-forte)',
  borderRadius: 'var(--raio-p)',
  background: 'var(--branco)',
  appearance: 'none',
};

/**
 * Carteira de imóveis.
 *
 * A busca aqui não é a mesma da vitrine, e a diferença é o ponto da
 * tela. O visitante escolhe entre o que está publicado; a equipe
 * precisa achar o que está fora do ar, o que não tem responsável e o
 * que ficou sem proprietário — que são justamente os registros que
 * ninguém quer mostrar mas alguém precisa resolver.
 *
 * Os filtros ficam em dois níveis. Na barra, os três que resolvem a
 * maioria das buscas. Atrás do botão, o resto: faixa de preço, bairro,
 * proprietário, consultor, quartos, vagas. Doze campos abertos o dia
 * inteiro custam mais atenção do que economizam, e quem precisa da
 * busca fina sabe que ela existe depois de usar a tela uma semana.
 *
 * A regra de filtragem mora em @imob/core, e não neste arquivo: a
 * exportação de XML e o relatório por consultor vão precisar do mesmo
 * recorte, e regra de filtro duplicada é regra que diverge.
 *
 * A tabela vira lista de cartões abaixo de 860px pelo CSS, com o rótulo
 * de cada campo vindo do atributo data-rotulo. É por isso que cada
 * célula carrega esse atributo: sem ele, no celular a linha vira uma
 * sequência de números sem significado.
 */
export function ListaImoveis({
  usuario,
  imoveis,
  proprietarios,
  equipe,
  parametros,
  truncada = false,
}: {
  usuario: Perfil;
  imoveis: ImovelResumo[];
  proprietarios: Pick<Proprietario, 'id' | 'nome'>[];
  equipe: Perfil[];
  parametros: { imovel?: string; proprietario?: string; 'sem-proprietario'?: string };
  /** A consulta bateu no teto de linhas: existe carteira além desta tela. */
  truncada?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  const [filtros, setFiltros] = useState<FiltroCarteira>({
    ...FILTRO_CARTEIRA_VAZIO,
    proprietario: parametros.proprietario ?? '',
    semProprietario: parametros['sem-proprietario'] === '1',
  });
  const [avancadosAbertos, setAvancadosAbertos] = useState(
    Boolean(parametros.proprietario || parametros['sem-proprietario']),
  );
  const [abertoId, setAbertoId] = useState<string | null>(parametros.imovel ?? null);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const [pagina, setPagina] = useState(1);

  /**
   * A ficha completa do imóvel aberto.
   *
   * A lista carrega só as colunas que a tabela desenha, então o registro
   * inteiro chega sob demanda, quando a gaveta abre. É um clique
   * deliberado contra 964 registros em toda abertura da tela.
   */
  const [ficha, setFicha] = useState<Imovel | null>(null);

  const gestor = usuario.papel === 'admin' || usuario.papel === 'gestor';

  const porPessoa = useMemo(() => new Map(equipe.map((p) => [p.id, p.nome])), [equipe]);
  const porProprietario = useMemo(
    () => new Map(proprietarios.map((p) => [p.id, p.nome])),
    [proprietarios],
  );

  /** Bairros que existem de fato na carteira, não uma lista fixa. */
  const bairros = useMemo(() => {
    const conjunto = new Set(imoveis.map((i) => i.bairro).filter(Boolean) as string[]);
    return [...conjunto].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [imoveis]);

  const cidades = useMemo(() => {
    const conjunto = new Set(imoveis.map((i) => i.cidade).filter(Boolean));
    return [...conjunto].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [imoveis]);

  const filtrados = useMemo(
    () => filtrarCarteira(imoveis, filtros, proprietarios),
    [imoveis, filtros, proprietarios],
  );

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));

  /**
   * A pagina pedida, presa ao que existe. Excluir um lote encurta a
   * lista debaixo de quem estava na ultima pagina; sem o teto, a tela
   * ficaria vazia ate a pessoa entender que precisa voltar.
   */
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioFatia = (paginaAtual - 1) * POR_PAGINA;

  const visiveis = useMemo(
    () => filtrados.slice(inicioFatia, inicioFatia + POR_PAGINA),
    [filtrados, inicioFatia],
  );

  // Filtro novo, leitura nova: seguir na pagina sete de uma busca que
  // acabou de mudar mostra um pedaco do meio sem contexto.
  useEffect(() => {
    setPagina(1);
  }, [filtros]);

  /**
   * As capas dos cinquenta imóveis que estão na tela.
   *
   * Buscadas por página, e não com a carteira, porque a carteira tem 964
   * linhas e a tela desenha 50: trazer o caminho da capa de todas
   * engordaria o HTML da página sem que 914 delas fossem desenhadas.
   *
   * O acumulador não é zerado ao virar de página. Voltar uma página é
   * gesto comum aqui, e quem já buscou uma capa não precisa buscar de
   * novo: o mapa cresce até o tamanho do que a pessoa de fato percorreu
   * na sessão, que é pequeno.
   */
  const [capas, setCapas] = useState<Record<string, string>>({});

  /**
   * Sobe quando o álbum de um imóvel muda dentro da gaveta.
   *
   * O efeito abaixo só busca o que ainda não está no mapa, então apagar
   * a entrada não bastaria: sem uma dependência que mude, ele não roda
   * de novo e a miniatura ficaria mostrando a capa antiga até a pessoa
   * recarregar a página.
   */
  const [versaoCapas, setVersaoCapas] = useState(0);

  /**
   * Quais linhas estão com as informações abertas, no celular.
   *
   * A tabela vira lista de cartões abaixo de 860px, e cada cartão
   * empilhava sete campos: proprietário, situação, valor, consultor,
   * vitrine, atualizado. Sete linhas por imóvel, cinquenta imóveis por
   * página. Percorrer a carteira no celular virava rolagem sem fim, e o
   * que a pessoa procura ao rolar é o imóvel, não os campos dele.
   *
   * Resumida, a linha mostra o que identifica: seleção, capa e o texto
   * do imóvel. O resto abre por linha, no botão, sem precisar da ficha
   * inteira, que é um passo grande demais para só conferir um valor.
   *
   * Vale só no celular. No desktop as colunas cabem lado a lado e a
   * tabela já responde a pergunta de relance, então este estado
   * simplesmente não tem efeito lá: quem esconde é o CSS.
   */
  const [expandidas, setExpandidas] = useState<Set<string>>(() => new Set());

  const alternarDetalhes = useCallback((id: string) => {
    setExpandidas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }, []);

  const esquecerCapa = useCallback((id: string) => {
    setCapas((atual) => {
      const proximo = { ...atual };
      delete proximo[id];
      return proximo;
    });
    setVersaoCapas((v) => v + 1);
  }, []);

  useEffect(() => {
    const faltando = visiveis.map((i) => i.id).filter((id) => !(id in capas));
    if (faltando.length === 0) return;

    let valido = true;

    buscarCapas(faltando).then((novas) => {
      if (!valido) return;
      // Os ids sem foto entram como string vazia, e não ficam de fora:
      // sem isso eles contariam como "ainda não buscados" e a tela
      // pediria as mesmas capas inexistentes a cada redesenho.
      const registro: Record<string, string> = {};
      for (const id of faltando) registro[id] = novas[id] ?? '';
      setCapas((atual) => ({ ...atual, ...registro }));
    });

    return () => {
      valido = false;
    };
    // capas fica fora das dependências de propósito: ele é escrito por
    // este mesmo efeito, e incluí-lo faria o efeito se disparar em
    // resposta à própria escrita.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiveis, versaoCapas]);

  useEffect(() => {
    if (!abertoId) {
      setFicha(null);
      return;
    }

    let valido = true;

    buscarFichaImovel(abertoId).then((r) => {
      // A resposta de uma gaveta já fechada não pode reabrir nada: entre
      // o clique e a resposta cabe um Esc, e cabe abrir outro imóvel.
      if (valido) setFicha(r);
    });

    return () => {
      valido = false;
    };
  }, [abertoId]);

  const ativos = contarFiltrosCarteira(filtros);

  const vgv = filtrados
    .filter((i) => i.status === 'disponivel')
    .reduce((soma, i) => soma + Number(i.valor), 0);

  const semProprietario = imoveis.filter((i) => !i.proprietario_id).length;

  /**
   * Só entra na seleção o que este usuário pode de fato gerenciar. Um
   * consultor não marca o imóvel de outro, então a caixa nem aparece
   * nessas linhas — e a seleção nunca carrega um id que a ação do
   * servidor devolveria como "falha" por RLS.
   */
  const elegiveis = useMemo(
    () => new Set(filtrados.filter((i) => podeGerenciarImovel(usuario, i)).map((i) => i.id)),
    [filtrados, usuario],
  );

  /**
   * A seleção sobrevive à troca de filtro, mas agir sobre o que sumiu da
   * tela confunde. Então só age sobre o que está visível e elegível
   * agora — o resto fica guardado, e reaparece marcado se o filtro voltar.
   */
  const selecionadosAtivos = useMemo(
    () => [...selecionados].filter((id) => elegiveis.has(id)),
    [selecionados, elegiveis],
  );

  const totalSelecionado = selecionadosAtivos.length;
  const todosMarcados = elegiveis.size > 0 && totalSelecionado === elegiveis.size;
  const parcialMarcado = totalSelecionado > 0 && totalSelecionado < elegiveis.size;

  const refSelecionarTodos = useCallback(
    (el: HTMLInputElement | null) => {
      if (el) el.indeterminate = parcialMarcado;
    },
    [parcialMarcado],
  );

  const avisar = useCallback((texto: string, erro = false) => setRecado({ texto, erro }), []);

  function executar(acao: Promise<{ ok: boolean; erro?: string; mensagem?: string }>) {
    iniciar(async () => {
      const r = await acao;
      avisar(r.ok ? (r.mensagem ?? 'Atualizado.') : (r.erro ?? 'Falha.'), !r.ok);
      router.refresh();
    });
  }

  function executarLote(acao: Promise<EstadoLote>) {
    iniciar(async () => {
      const r = await acao;
      avisar(r.ok ? (r.mensagem ?? 'Pronto.') : (r.erro ?? 'Falha.'), !r.ok);
      setSelecionados(new Set());
      router.refresh();
    });
  }

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  /** Marca ou desmarca todos os elegíveis da seleção atual dos filtros. */
  function alternarTodos() {
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (todosMarcados) {
        for (const id of elegiveis) proximo.delete(id);
      } else {
        for (const id of elegiveis) proximo.add(id);
      }
      return proximo;
    });
  }

  function excluirSelecionados() {
    const n = totalSelecionado;
    const certeza = window.confirm(
      `Excluir ${n} ${n === 1 ? 'imóvel' : 'imóveis'} em definitivo?\n\n` +
        'O histórico de visitas vai junto e não há como desfazer. ' +
        'Imóvel com negociação em andamento é mantido automaticamente.\n\n' +
        'Para apenas tirar do site sem perder o registro, use "Tirar do ar".',
    );
    if (!certeza) return;
    executarLote(excluirEmLote(selecionadosAtivos));
  }

  function mudar<C extends keyof FiltroCarteira>(campo: C, valor: FiltroCarteira[C]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
  }

  /** Lê um campo de número que pode ficar vazio. Vazio é "sem limite". */
  function mudarNumero(campo: keyof FiltroCarteira, bruto: string) {
    const limpo = bruto.replace(/\D/g, '');
    mudar(campo, (limpo ? Number(limpo) : null) as FiltroCarteira[typeof campo]);
  }

  function fecharGaveta() {
    setAbertoId(null);
    setCriandoNovo(false);
    setFicha(null);
  }

  function aoConcluir(mensagem: string, erro = false) {
    if (!erro) fecharGaveta();
    avisar(mensagem, erro);
    router.refresh();
  }

  /**
   * O álbum mexeu, e a gaveta continua aberta.
   *
   * Além de mostrar o recado, esquece a capa deste imóvel: a foto que
   * acabou de entrar, ou a que acabou de ser marcada como capa, é
   * justamente a que a miniatura da lista deveria estar mostrando.
   * Sem isso a pessoa fecharia a gaveta e veria a imagem antiga.
   */
  function aoAvisarDaGaveta(mensagem: string, erro = false) {
    avisar(mensagem, erro);
    if (!erro && abertoId) esquecerCapa(abertoId);
  }

  return (
    <>
      <CabecalhoPagina titulo="Imóveis">
        <button className="btn somente-desktop" onClick={() => setCriandoNovo(true)}>
          <IconeMais />
          Novo imóvel
        </button>
      </CabecalhoPagina>

      <div className="corpo">
        <div className="painel-resumo">
          <ResumoRapido rotulo="Na seleção" valor={String(filtrados.length)} />
          <ResumoRapido rotulo="VGV disponível" valor={brlCurto(vgv)} />
          <ResumoRapido
            rotulo="No ar"
            valor={String(filtrados.filter((i) => i.publicado).length)}
          />
          <ResumoRapido
            rotulo="Sem proprietário"
            valor={String(semProprietario)}
            alerta={semProprietario > 0}
          />
        </div>

        {/* Sem este aviso o corte volta a ser invisível: a tela mostra
            uma carteira aparentemente inteira, e os imóveis que ficaram
            de fora só aparecem como número numa pendência que aponta
            para cá. */}
        {truncada && (
          <div className="aviso aviso-atencao" style={{ marginBottom: 18 }}>
            <IconeAlerta />
            <span>
              A carteira passou do teto desta tela e nem todos os imóveis estão carregados aqui.
              Os filtros e a seleção em lote só alcançam o que está nesta lista. Avise o
              desenvolvimento para paginar a consulta.
            </span>
          </div>
        )}

        <div className="filtros-barra">
          <div className="busca-rapida">
            <IconeBusca />
            <input
              value={filtros.termo}
              onChange={(e) => mudar('termo', e.target.value)}
              placeholder="Título, código, bairro, matrícula ou proprietário"
              aria-label="Buscar imóvel"
            />
          </div>

          <div className="campo campo-filtro">
            <select
              value={filtros.tipo}
              onChange={(e) => mudar('tipo', e.target.value)}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos os tipos</option>
              {TIPOS_IMOVEL.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="campo campo-filtro">
            <select
              value={filtros.status}
              onChange={(e) => mudar('status', e.target.value)}
              aria-label="Filtrar por situação"
            >
              <option value="">Todas as situações</option>
              {Object.entries(STATUS_IMOVEL).map(([chave, info]) => (
                <option key={chave} value={chave}>
                  {info.rotulo}
                </option>
              ))}
            </select>
          </div>

          <button
            className={avancadosAbertos ? 'btn btn-pequeno' : 'btn btn-claro btn-pequeno'}
            onClick={() => setAvancadosAbertos((v) => !v)}
            aria-expanded={avancadosAbertos}
          >
            <IconeFiltro />
            Mais filtros
            {ativos > 0 && <span className="contador-filtros">{ativos}</span>}
          </button>

          {ativos > 0 && (
            <button
              className="btn btn-fantasma btn-pequeno"
              onClick={() => setFiltros(FILTRO_CARTEIRA_VAZIO)}
            >
              Limpar
            </button>
          )}

          <span className="texto-mudo empurra somente-desktop">
            {filtrados.length} {filtrados.length === 1 ? 'imóvel' : 'imóveis'} · {brl(vgv)} em
            carteira disponível
          </span>
        </div>

        {avancadosAbertos && (
          <div className="filtros-avancados">
            <div className="campo">
              <label htmlFor="f-faixa">Faixa de valor</label>
              <select
                id="f-faixa"
                value={
                  FAIXAS_CARTEIRA.findIndex(
                    (f) => f.min === filtros.valorMin && f.max === filtros.valorMax,
                  ) === -1
                    ? 'livre'
                    : String(
                        FAIXAS_CARTEIRA.findIndex(
                          (f) => f.min === filtros.valorMin && f.max === filtros.valorMax,
                        ),
                      )
                }
                onChange={(e) => {
                  if (e.target.value === 'livre') return;
                  const faixa = FAIXAS_CARTEIRA[Number(e.target.value)];
                  setFiltros((atual) => ({
                    ...atual,
                    valorMin: faixa.min,
                    valorMax: faixa.max,
                  }));
                }}
              >
                {FAIXAS_CARTEIRA.map((f, i) => (
                  <option key={f.rotulo} value={i}>
                    {f.rotulo}
                  </option>
                ))}
                <option value="livre">Valor exato (abaixo)</option>
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-min">Valor exato</label>
              <div className="faixa-valor">
                <input
                  id="f-min"
                  inputMode="numeric"
                  placeholder="de"
                  value={filtros.valorMin ?? ''}
                  onChange={(e) => mudarNumero('valorMin', e.target.value)}
                  aria-label="Valor mínimo"
                />
                <span>até</span>
                <input
                  inputMode="numeric"
                  placeholder="1500000"
                  value={filtros.valorMax ?? ''}
                  onChange={(e) => mudarNumero('valorMax', e.target.value)}
                  aria-label="Valor máximo"
                />
              </div>
            </div>

            <div className="campo">
              <label htmlFor="f-bairro">Bairro</label>
              <select
                id="f-bairro"
                value={filtros.bairro}
                onChange={(e) => mudar('bairro', e.target.value)}
              >
                <option value="">Todos os bairros</option>
                {bairros.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-cidade">Cidade</label>
              <select
                id="f-cidade"
                value={filtros.cidade}
                onChange={(e) => mudar('cidade', e.target.value)}
              >
                <option value="">Todas as cidades</option>
                {cidades.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-proprietario">Proprietário</label>
              <select
                id="f-proprietario"
                value={filtros.proprietario}
                onChange={(e) => mudar('proprietario', e.target.value)}
              >
                <option value="">Todos os proprietários</option>
                {proprietarios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-consultor">Consultor</label>
              <select
                id="f-consultor"
                value={filtros.consultor}
                onChange={(e) => mudar('consultor', e.target.value)}
              >
                <option value="">Todos os consultores</option>
                <option value="sem-dono">Sem responsável</option>
                {equipe
                  .filter((p) => p.ativo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                      {p.id === usuario.id ? ' (você)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-finalidade">Finalidade</label>
              <select
                id="f-finalidade"
                value={filtros.finalidade}
                onChange={(e) => mudar('finalidade', e.target.value)}
              >
                <option value="">Venda e locação</option>
                <option value="venda">Somente venda</option>
                <option value="locacao">Somente locação</option>
                <option value="venda_locacao">Venda e locação</option>
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-vitrine">Vitrine</label>
              <select
                id="f-vitrine"
                value={filtros.vitrine}
                onChange={(e) => mudar('vitrine', e.target.value as FiltroCarteira['vitrine'])}
              >
                <option value="">No ar e fora do ar</option>
                <option value="publicados">Somente no ar</option>
                <option value="fora">Somente fora do ar</option>
                <option value="destaque">Somente destaques</option>
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-quartos">Quartos (mínimo)</label>
              <select
                id="f-quartos"
                value={filtros.quartosMin ?? ''}
                onChange={(e) =>
                  mudar('quartosMin', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">Qualquer</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-vagas">Vagas (mínimo)</label>
              <select
                id="f-vagas"
                value={filtros.vagasMin ?? ''}
                onChange={(e) => mudar('vagasMin', e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Qualquer</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}+
                  </option>
                ))}
              </select>
            </div>

            <div className="campo">
              <label htmlFor="f-area">Área útil mínima (m²)</label>
              <input
                id="f-area"
                inputMode="numeric"
                placeholder="120"
                value={filtros.areaMin ?? ''}
                onChange={(e) => mudarNumero('areaMin', e.target.value)}
              />
            </div>

            <div className="filtros-avancados-acoes">
              <label className="caixa-marcavel" style={{ minHeight: 36 }}>
                <input
                  type="checkbox"
                  checked={filtros.semProprietario}
                  onChange={(e) => mudar('semProprietario', e.target.checked)}
                />
                <span>Somente imóveis sem proprietário vinculado</span>
              </label>

              <button
                className="btn btn-fantasma btn-pequeno empurra"
                onClick={() => setFiltros(FILTRO_CARTEIRA_VAZIO)}
              >
                Limpar todos os filtros
              </button>
            </div>
          </div>
        )}

        {totalSelecionado > 0 && (
          <div className="barra-lote" role="region" aria-label="Ações em lote">
            <div className="barra-lote-info">
              <strong>
                {totalSelecionado} {totalSelecionado === 1 ? 'selecionado' : 'selecionados'}
              </strong>
              <button
                className="botao-texto"
                onClick={() => setSelecionados(new Set())}
                disabled={pendente}
              >
                Limpar seleção
              </button>
            </div>

            <div className="barra-lote-acoes">
              {/* Vincular em lote é o caminho para o que a importação
                  trouxe sem dono: filtra por "sem proprietário", marca
                  tudo daquela pessoa e resolve numa vez. */}
              {proprietarios.length > 0 && (
                <div className="campo campo-filtro">
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      executarLote(
                        vincularProprietarioEmLote(selecionadosAtivos, e.target.value),
                      );
                    }}
                    disabled={pendente}
                    aria-label="Vincular proprietário aos imóveis marcados"
                  >
                    <option value="">Vincular proprietário…</option>
                    {proprietarios.map((dono) => (
                      <option key={dono.id} value={dono.id}>
                        {dono.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                className="btn btn-pequeno"
                onClick={() => executarLote(publicarEmLote(selecionadosAtivos, true))}
                disabled={pendente}
                title="Colocar os selecionados no ar. Só publica os que estão disponíveis."
              >
                Colocar no ar
              </button>
              <button
                className="btn btn-claro btn-pequeno"
                onClick={() => executarLote(publicarEmLote(selecionadosAtivos, false))}
                disabled={pendente}
                title="Retirar os selecionados da vitrine"
              >
                Tirar do ar
              </button>
              {gestor && (
                <button
                  className="btn btn-perigo btn-pequeno"
                  onClick={excluirSelecionados}
                  disabled={pendente}
                  title="Excluir os selecionados em definitivo"
                >
                  Excluir
                </button>
              )}
            </div>
          </div>
        )}

        {filtrados.length === 0 ? (
          <div className="vazio">
            <IconeVazio />
            <h3>Nenhum imóvel nesta seleção</h3>
            <p>
              Ajuste os filtros ou cadastre um imóvel novo. Todo cadastro exige um proprietário
              vinculado, e entra fora do ar até alguém publicar.
            </p>
            <div className="linha-flex" style={{ justifyContent: 'center' }}>
              {ativos > 0 && (
                <button
                  className="btn btn-claro"
                  onClick={() => setFiltros(FILTRO_CARTEIRA_VAZIO)}
                >
                  Limpar filtros
                </button>
              )}
              <button className="btn" onClick={() => setCriandoNovo(true)}>
                <IconeMais />
                Novo imóvel
              </button>
            </div>
          </div>
        ) : (
          <div className="cartao">
            <div className="tabela-envelope">
              <table className="tabela tabela-responsiva">
                <thead>
                  <tr>
                    <th>
                      <label className="rotulo-selecao-todos">
                        <input
                          type="checkbox"
                          ref={refSelecionarTodos}
                          checked={todosMarcados}
                          onChange={alternarTodos}
                          disabled={elegiveis.size === 0 || pendente}
                          aria-label="Selecionar todos os imóveis desta seleção"
                        />
                        Imóvel
                      </label>
                    </th>
                    <th>Proprietário</th>
                    <th>Situação</th>
                    <th className="numerico">Valor</th>
                    <th>Consultor</th>
                    <th>Vitrine</th>
                    <th className="numerico">Atualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((imovel) => {
                    const editavel = podeGerenciarImovel(usuario, imovel);
                    const situacao = STATUS_IMOVEL[imovel.status];
                    const dono = imovel.proprietario_id
                      ? porProprietario.get(imovel.proprietario_id)
                      : null;

                    const aberta = expandidas.has(imovel.id);

                    return (
                      <tr key={imovel.id} className={aberta ? undefined : 'linha-resumida'}>
                        <td data-rotulo="Imóvel" className="celula-principal">
                          <div className="celula-com-selecao">
                            {editavel ? (
                              <input
                                type="checkbox"
                                className="marca-linha"
                                checked={selecionados.has(imovel.id)}
                                onChange={() => alternarSelecao(imovel.id)}
                                disabled={pendente}
                                aria-label={`Selecionar ${imovel.titulo}`}
                              />
                            ) : (
                              <span className="marca-linha-vazia" aria-hidden="true" />
                            )}

                            <Miniatura
                              path={capas[imovel.id]}
                              titulo={imovel.titulo}
                              aoAbrir={() => setAbertoId(imovel.id)}
                            />

                            <span className="celula-com-selecao-texto">
                              <button
                                className="botao-texto"
                                onClick={() => setAbertoId(imovel.id)}
                                title="Abrir a ficha do imóvel"
                              >
                                {imovel.titulo}
                              </button>
                              <span className="celula-apoio">
                                {imovel.codigo} · {imovel.tipo}
                                {imovel.bairro && ` · ${imovel.bairro}`}
                                {imovel.area_util > 0 && ` · ${fmtArea(imovel.area_util)}`}
                              </span>
                            </span>
                          </div>

                          {/* Só existe no celular: no desktop as colunas
                              já estão todas na tela, lado a lado. */}
                          <button
                            type="button"
                            className="abrir-detalhes somente-celular"
                            aria-expanded={aberta}
                            onClick={() => alternarDetalhes(imovel.id)}
                          >
                            {aberta ? 'Ocultar informações' : 'Exibir informações'}
                            <IconeDireita />
                          </button>
                        </td>

                        <td data-rotulo="Proprietário">
                          {dono ? (
                            <button
                              className="botao-texto"
                              onClick={() => {
                                mudar('proprietario', imovel.proprietario_id!);
                                setAvancadosAbertos(true);
                              }}
                              title="Filtrar a carteira por este proprietário"
                            >
                              {dono}
                            </button>
                          ) : editavel && proprietarios.length > 0 ? (
                            /* Sem dono, a célula deixa de ser um aviso e
                               vira o conserto. A ação já existia no
                               servidor e nada na tela chamava: para
                               regularizar era preciso abrir a gaveta de
                               um por um, e são dezenas de imóveis. */
                            <select
                              value=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                executar(vincularProprietario(imovel.id, e.target.value));
                              }}
                              disabled={pendente}
                              aria-label={`Vincular proprietário a ${imovel.titulo}`}
                              style={{ ...ESTILO_SELECT_CELULA, maxWidth: 190 }}
                            >
                              <option value="">Sem proprietário</option>
                              {proprietarios.map((dono) => (
                                <option key={dono.id} value={dono.id}>
                                  {dono.nome}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="marca-pendencia">
                              <IconeAlerta />
                              Sem proprietário
                            </span>
                          )}
                        </td>

                        <td data-rotulo="Situação">
                          {editavel ? (
                            <select
                              value={imovel.status}
                              onChange={(e) =>
                                executar(mudarStatusImovel(imovel.id, e.target.value))
                              }
                              disabled={pendente}
                              aria-label={`Situação de ${imovel.titulo}`}
                              style={ESTILO_SELECT_CELULA}
                            >
                              {Object.entries(STATUS_IMOVEL).map(([chave, info]) => (
                                <option key={chave} value={chave}>
                                  {info.rotulo}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`etiqueta etiqueta-${situacao.cor}`}>
                              {situacao.rotulo}
                            </span>
                          )}
                        </td>

                        <td data-rotulo="Valor" className="numerico">
                          {brl(
                            imovel.finalidade === 'locacao'
                              ? (imovel.valor_locacao ?? 0)
                              : imovel.valor,
                          )}
                          {imovel.finalidade === 'locacao' && (
                            <span className="celula-apoio">por mês</span>
                          )}
                        </td>

                        <td data-rotulo="Consultor">
                          {gestor ? (
                            <select
                              value={imovel.corretor_id ?? ''}
                              onChange={(e) => executar(atribuirCorretor(imovel.id, e.target.value))}
                              disabled={pendente}
                              aria-label={`Consultor de ${imovel.titulo}`}
                              style={{ ...ESTILO_SELECT_CELULA, maxWidth: 160 }}
                            >
                              <option value="">Sem responsável</option>
                              {equipe.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nome}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="texto-mudo">
                              {imovel.corretor_id
                                ? (porPessoa.get(imovel.corretor_id) ?? 'Outro consultor')
                                : 'Sem responsável'}
                            </span>
                          )}
                        </td>

                        <td data-rotulo="Vitrine">
                          <div className="celula-vitrine">
                            <button
                              className={
                                imovel.publicado ? 'btn btn-pequeno' : 'btn btn-claro btn-pequeno'
                              }
                              onClick={() =>
                                executar(alternarPublicacao(imovel.id, !imovel.publicado))
                              }
                              disabled={pendente || !editavel}
                              title={
                                editavel
                                  ? 'Publicar ou retirar do site'
                                  : 'Somente o responsável ou a gestão'
                              }
                            >
                              {imovel.publicado ? 'No ar' : 'Fora do ar'}
                            </button>

                            {imovel.publicado && (
                              <button
                                className="btn-icone"
                                style={{
                                  width: 34,
                                  height: 34,
                                  color: imovel.destaque ? 'var(--ouro-600)' : 'var(--cinza)',
                                }}
                                onClick={() =>
                                  executar(alternarDestaque(imovel.id, !imovel.destaque))
                                }
                                disabled={pendente || !editavel}
                                title={imovel.destaque ? 'Remover destaque' : 'Marcar como destaque'}
                                aria-label="Destaque na home"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="17"
                                  height="17"
                                  fill={imovel.destaque ? 'currentColor' : 'none'}
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                >
                                  <path d="M12 3l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 17l-5.6 3 1.4-6.2L3 9.5l6.4-.7z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>

                        <td data-rotulo="Atualizado" className="numerico">
                          {fmtData(imovel.atualizado_em)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="cartao-rodape">
              <span className="texto-mudo">
                Clique no título para abrir a ficha, editar ou excluir. Publicar ou retirar do ar
                reflete no site em até 5 minutos, tempo do cache da vitrine.
              </span>

              {totalPaginas > 1 && (
                <div className="paginacao-carteira">
                  <span className="texto-mudo">
                    {inicioFatia + 1}–{inicioFatia + visiveis.length} de {filtrados.length}
                  </span>

                  <button
                    className="btn btn-claro btn-pequeno"
                    onClick={() => setPagina(paginaAtual - 1)}
                    disabled={paginaAtual <= 1}
                  >
                    Anterior
                  </button>

                  <span className="texto-mudo">
                    {paginaAtual} / {totalPaginas}
                  </span>

                  <button
                    className="btn btn-claro btn-pequeno"
                    onClick={() => setPagina(paginaAtual + 1)}
                    disabled={paginaAtual >= totalPaginas}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        className="acao-flutuante"
        onClick={() => setCriandoNovo(true)}
        aria-label="Novo imóvel"
      >
        <IconeMais />
      </button>

      {/* A gaveta só monta com a ficha em mãos. Montar antes faria o
          formulário nascer com os campos vazios e preenchê-los depois,
          que é como se perde o que a pessoa já começou a digitar. */}
      {((abertoId && ficha) || criandoNovo) && (
        <GavetaImovel
          usuario={usuario}
          imovel={criandoNovo ? null : ficha}
          proprietarios={proprietarios}
          equipe={equipe}
          aoFechar={fecharGaveta}
          aoConcluir={aoConcluir}
          aoAvisar={aoAvisarDaGaveta}
          aoPedirProprietario={() => router.push('/proprietarios')}
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

/**
 * A foto de capa, do tamanho de um polegar, à esquerda do título.
 *
 * Existe por uma razão prática de quem administra: numa carteira de 964
 * imóveis, metade dos títulos começa igual ("Casa com 3 dormitórios à
 * venda...") e o que distingue um do outro fica no fim da linha. A
 * imagem resolve o reconhecimento antes da leitura, que é o gesto que
 * essa tela pede o tempo todo.
 *
 * Carrega preguiçosa e sem prioridade: são cinquenta por página, e
 * nenhuma delas é o conteúdo principal da tela. Quem chega e já digita
 * na busca não deve esperar por imagem nenhuma.
 *
 * O path vazio não é o mesmo que path indefinido. Indefinido quer dizer
 * "ainda não perguntei ao servidor" e desenha o bloco neutro em silêncio;
 * vazio quer dizer "perguntei e este imóvel não tem foto", que é a
 * informação que o administrador precisa enxergar para ir cadastrar uma.
 */
function Miniatura({
  path,
  titulo,
  aoAbrir,
}: {
  path: string | undefined;
  titulo: string;
  aoAbrir: () => void;
}) {
  const url = path ? urlFoto(path) : null;

  return (
    <button
      type="button"
      className={`miniatura-imovel${url ? '' : ' miniatura-vazia'}`}
      onClick={aoAbrir}
      tabIndex={-1}
      aria-hidden="true"
      title={url ? titulo : 'Este imóvel ainda não tem foto'}
    >
      {url ? (
        <Image src={url} alt="" fill sizes="72px" loading="lazy" style={{ objectFit: 'cover' }} />
      ) : (
        <IconeImovel />
      )}
    </button>
  );
}
