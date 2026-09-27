-- ============================================================
-- ACHILLES IMOVEIS - 0009 CONDOMINIOS, IMPORTACAO E ESCALA DA VITRINE
-- ============================================================
-- Tres mudancas que andam juntas:
--
--   1. CONDOMINIOS como entidade propria. A Achilles trabalha alto padrao,
--      e boa parte da procura comeca pelo nome do empreendimento, nao
--      pelo bairro. Sem uma tabela para ancorar isso, o mesmo condominio
--      apareceria escrito de tres formas diferentes na vitrine.
--
--   2. IMPORTACAO por XML. O cadastro passa a ter referencia externa,
--      fonte e data de importacao. A referencia e o que permite
--      sincronizar o feed sem duplicar anuncio a cada rodada.
--
--   3. ESCALA. A carteira sai de dezenas para mais de novecentos
--      imoveis. Isso muda o que precisa de indice: busca por texto,
--      ordenacao por valor e filtro por cidade deixam de caber numa
--      varredura de tabela.
-- ============================================================

create extension if not exists pg_trgm;

-- ------------------------------------------------------------
-- 1. CONDOMINIOS
-- ------------------------------------------------------------
create table if not exists condominios (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,
  nome        text not null,
  descricao   text,

  bairro      text,
  cidade      text not null default 'Uberlândia',
  uf          text not null default 'MG',
  logradouro  text,
  latitude    numeric(10,7),
  longitude   numeric(10,7),

  construtora text,
  ano_entrega int,

  -- luxo marca o empreendimento de alto padrao; destaque escolhe quem
  -- aparece na home. Sao coisas diferentes: existe lancamento popular
  -- que a casa quer destacar por causa de campanha.
  luxo        boolean not null default false,
  destaque    boolean not null default false,
  publicado   boolean not null default true,

  lazer       text[] not null default '{}',
  capa        text,
  galeria     text[] not null default '{}',
  cover       text not null default 'cv1',

  meta_titulo    text,
  meta_descricao text,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create unique index if not exists idx_condominio_nome_cidade
  on condominios (lower(nome), lower(cidade));

create index if not exists idx_condominio_publicado on condominios (publicado, destaque);
create index if not exists idx_condominio_cidade    on condominios (cidade, bairro);
create index if not exists idx_condominio_nome_trgm on condominios using gin (nome gin_trgm_ops);

drop trigger if exists trg_condominios_atualizado on condominios;
create trigger trg_condominios_atualizado
  before update on condominios
  for each row execute function public.tocar_atualizado_em();

-- Slug do condominio, pela mesma funcao que ja gera o slug do imovel.
create or replace function public.condominio_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := slugify(new.nome || '-' || coalesce(new.cidade, ''));
  end if;
  return new;
end;
$$;

drop trigger if exists ao_criar_condominio on condominios;
create trigger ao_criar_condominio
  before insert or update of nome, cidade on condominios
  for each row execute function public.condominio_slug();

-- ------------------------------------------------------------
-- 2. IMOVEIS: VINCULO, IMPORTACAO E MEDIDA RURAL
-- ------------------------------------------------------------
alter table imoveis
  add column if not exists condominio_id   uuid references condominios (id) on delete set null,
  -- Nome congelado: o cartao da vitrine nao precisa de join para
  -- escrever "Condomínio Splêndido" embaixo do titulo.
  add column if not exists condominio_nome text,
  add column if not exists referencia_externa text,
  add column if not exists fonte           text not null default 'manual'
                                           check (fonte in ('manual','xml','portal')),
  add column if not exists importado_em    timestamptz,
  -- Hectares em fazenda, sitio, chacara e area. Em apartamento fica nulo,
  -- e a vitrine cai de volta para o metro quadrado util.
  add column if not exists hectares        numeric(12,4);

-- As quatro colunas acima precisam entrar no grant do visitante.
--
-- O grant da 0003 e por COLUNA, nao por tabela: o anon recebe select
-- numa lista explicita de imoveis, e matricula, proprietario_id e
-- observacoes_internas ficam de fora. E defesa em profundidade, e vale
-- a pena. O preco e este: toda coluna nova que a vitrine mostrar
-- precisa ser somada aqui.
--
-- Sem isso, vitrine_imoveis quebra inteira para quem nao esta logado,
-- com 42501 — porque a view usa security_invoker e o Postgres vai
-- conferir a permissao do chamador nas colunas da tabela de baixo. E
-- uma falha que so aparece deslogado: no painel, com sessao, tudo
-- funciona e ninguem percebe.
grant select (hectares, condominio_id, condominio_nome, referencia_externa)
  on imoveis to anon;

create unique index if not exists idx_imovel_referencia
  on imoveis (referencia_externa) where referencia_externa is not null;

create index if not exists idx_imoveis_condominio on imoveis (condominio_id);
create index if not exists idx_imoveis_tipo       on imoveis (tipo);
create index if not exists idx_imoveis_fonte      on imoveis (fonte, importado_em desc);

-- Ordenacao da vitrine. O indice parcial cobre so o que e publico, que
-- e a unica fatia que a listagem percorre, e fica uma fracao do tamanho
-- de um indice sobre a tabela inteira.
create index if not exists idx_imoveis_vitrine_valor
  on imoveis (valor desc, id) where publicado and status <> 'inativo';

create index if not exists idx_imoveis_vitrine_area
  on imoveis (area_util desc, id) where publicado and status <> 'inativo';

create index if not exists idx_imoveis_vitrine_recentes
  on imoveis (criado_em desc, id) where publicado and status <> 'inativo';

-- Busca por trecho de texto. O tsvector da 0001 resolve palavra inteira;
-- o trigrama resolve "karaiba" digitado sem acento e "splen" digitado
-- pela metade, que e como as pessoas realmente buscam.
create index if not exists idx_imoveis_titulo_trgm on imoveis using gin (titulo gin_trgm_ops);
create index if not exists idx_imoveis_bairro_trgm on imoveis using gin (bairro gin_trgm_ops);
create index if not exists idx_imoveis_cond_trgm   on imoveis using gin (condominio_nome gin_trgm_ops);

-- Mantem o nome congelado em dia quando o vinculo muda.
create or replace function public.sincronizar_condominio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.condominio_id is null then
    new.condominio_nome := null;
  else
    select nome into new.condominio_nome from condominios where id = new.condominio_id;
  end if;
  return new;
end;
$$;

drop trigger if exists ao_vincular_condominio on imoveis;
create trigger ao_vincular_condominio
  before insert or update of condominio_id on imoveis
  for each row execute function public.sincronizar_condominio();

-- ------------------------------------------------------------
-- 3. SEGURANCA DOS CONDOMINIOS
-- ------------------------------------------------------------
alter table condominios enable row level security;

grant select on condominios to anon, authenticated;
grant insert, update, delete on condominios to authenticated;

drop policy if exists "condominios - vitrine publica" on condominios;
create policy "condominios - vitrine publica" on condominios
  for select to anon
  using (publicado = true);

drop policy if exists "condominios - equipe le" on condominios;
create policy "condominios - equipe le" on condominios
  for select to authenticated
  using (pode('imoveis'));

drop policy if exists "condominios - gerenciar" on condominios;
create policy "condominios - gerenciar" on condominios
  for all to authenticated
  using (pode('imoveis') and eh_gestor())
  with check (pode('imoveis') and eh_gestor());

-- ------------------------------------------------------------
-- 4. VIEWS DA VITRINE
-- ------------------------------------------------------------
-- A view ja existe desde a 0003, e aqui ela ganha tres colunas no meio
-- da lista: hectares entre area_total e quartos, e o trio de condominio
-- depois de caracteristicas.
--
-- `create or replace view` nao da conta disso. O Postgres so aceita
-- acrescentar coluna no FIM de uma view existente; inserir no meio ele
-- le como renomear a coluna daquela posicao, e recusa com
--
--   ERROR 42P16: cannot change name of view column "quartos" to "hectares"
--
-- Derrubar e recriar resolve. E seguro aqui porque nenhuma outra view
-- depende desta, e facetas_vitrine() e criada depois, mais abaixo neste
-- mesmo arquivo. As colunas ficam agrupadas por assunto de proposito:
-- ler a view deve dizer o que a vitrine mostra, e uma coluna jogada no
-- fim so para agradar o motor esconderia isso.
drop view if exists vitrine_imoveis;

create view vitrine_imoveis
with (security_invoker = true)
as
  select
    id, codigo, slug, titulo, descricao, tipo, finalidade, status,
    bairro, cidade, uf,
    case when exibir_endereco then logradouro end as logradouro,
    case when exibir_endereco then numero end     as numero,
    case when exibir_endereco then cep end        as cep,
    case when exibir_endereco then latitude end   as latitude,
    case when exibir_endereco then longitude end  as longitude,
    valor, valor_locacao, valor_condominio, valor_iptu,
    aceita_permuta, aceita_financiamento,
    area_util, area_total, hectares,
    quartos, suites, banheiros, vagas,
    ano_construcao, andar, mobiliado, caracteristicas,
    condominio_id, condominio_nome, referencia_externa,
    destaque, cover, meta_titulo, meta_descricao,
    criado_em, atualizado_em
  from imoveis
  where publicado = true and status <> 'inativo';

grant select on vitrine_imoveis to anon, authenticated;

-- Condominio com a contagem e a faixa de preco das unidades disponiveis.
-- Uma view resolve o que na aplicacao seria uma consulta por cartao.
drop view if exists vitrine_condominios;

create view vitrine_condominios
with (security_invoker = true)
as
  select
    c.*,
    coalesce(u.total, 0)      as total_imoveis,
    coalesce(u.menor_valor, 0) as menor_valor,
    coalesce(u.maior_valor, 0) as maior_valor
  from condominios c
  left join lateral (
    select
      count(*)      as total,
      min(i.valor) filter (where i.valor > 0) as menor_valor,
      max(i.valor)  as maior_valor
    from imoveis i
    where i.condominio_id = c.id
      and i.publicado = true
      and i.status not in ('inativo','vendido','locado')
  ) u on true
  where c.publicado = true;

grant select on vitrine_condominios to anon, authenticated;

-- ------------------------------------------------------------
-- 5. IMPORTACAO DE XML
-- ------------------------------------------------------------
-- Escreve um imovel vindo do feed sem duplicar o que ja existe.
--
-- A chave de reconciliacao e referencia_externa, e nao o titulo nem o
-- endereco: o portal reescreve titulo a cada edicao do anuncio, e casar
-- por texto criaria um imovel novo a cada sincronizacao.
--
-- Campos de captacao (proprietario, matricula, observacoes internas) e a
-- decisao de publicar ficam de fora de proposito. O feed traz o anuncio,
-- nao a estrategia da casa: quem decide o que vai para a vitrine e a
-- gestao, e uma reimportacao nao pode repor no ar o que alguem tirou.
create or replace function public.importar_imovel(p_dados jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id         uuid;
  v_referencia text := nullif(p_dados ->> 'referencia_externa', '');
  v_cond_nome  text := nullif(p_dados ->> 'condominio', '');
  v_cond_id    uuid;
  v_novo       boolean := false;
begin
  if not (eh_gestor() and pode('imoveis')) then
    raise exception 'Apenas a gestao importa imoveis.' using errcode = '42501';
  end if;

  if v_referencia is null then
    raise exception 'O registro do feed nao trouxe referencia externa.' using errcode = '22023';
  end if;

  -- Condominio: acha pelo nome na cidade, cria se ainda nao existir.
  if v_cond_nome is not null then
    select id into v_cond_id
      from condominios
     where lower(nome) = lower(v_cond_nome)
       and lower(cidade) = lower(coalesce(p_dados ->> 'cidade', 'Uberlândia'))
     limit 1;

    if v_cond_id is null then
      insert into condominios (nome, cidade, uf, bairro)
      values (
        v_cond_nome,
        coalesce(p_dados ->> 'cidade', 'Uberlândia'),
        coalesce(p_dados ->> 'uf', 'MG'),
        p_dados ->> 'bairro'
      )
      returning id into v_cond_id;
    end if;
  end if;

  select id into v_id from imoveis where referencia_externa = v_referencia;
  v_novo := v_id is null;

  if v_novo then
    insert into imoveis (referencia_externa, fonte, titulo, publicado)
    values (v_referencia, 'xml', coalesce(p_dados ->> 'titulo', 'Imóvel importado'), false)
    returning id into v_id;
  end if;

  update imoveis set
    titulo        = coalesce(nullif(p_dados ->> 'titulo', ''), titulo),
    descricao     = coalesce(p_dados ->> 'descricao', descricao),
    tipo          = coalesce(nullif(p_dados ->> 'tipo', ''), tipo),
    finalidade    = coalesce(nullif(p_dados ->> 'finalidade', ''), finalidade),
    cep           = coalesce(p_dados ->> 'cep', cep),
    logradouro    = coalesce(p_dados ->> 'logradouro', logradouro),
    numero        = coalesce(p_dados ->> 'numero', numero),
    bairro        = coalesce(p_dados ->> 'bairro', bairro),
    cidade        = coalesce(nullif(p_dados ->> 'cidade', ''), cidade),
    uf            = coalesce(nullif(p_dados ->> 'uf', ''), uf),
    latitude      = coalesce((p_dados ->> 'latitude')::numeric, latitude),
    longitude     = coalesce((p_dados ->> 'longitude')::numeric, longitude),
    valor         = coalesce((p_dados ->> 'valor')::numeric, valor),
    valor_locacao = coalesce((p_dados ->> 'valor_locacao')::numeric, valor_locacao),
    valor_condominio = coalesce((p_dados ->> 'valor_condominio')::numeric, valor_condominio),
    valor_iptu    = coalesce((p_dados ->> 'valor_iptu')::numeric, valor_iptu),
    area_util     = coalesce((p_dados ->> 'area_util')::numeric, area_util),
    area_total    = coalesce((p_dados ->> 'area_total')::numeric, area_total),
    hectares      = coalesce((p_dados ->> 'hectares')::numeric, hectares),
    quartos       = coalesce((p_dados ->> 'quartos')::int, quartos),
    suites        = coalesce((p_dados ->> 'suites')::int, suites),
    banheiros     = coalesce((p_dados ->> 'banheiros')::int, banheiros),
    vagas         = coalesce((p_dados ->> 'vagas')::int, vagas),
    ano_construcao = coalesce((p_dados ->> 'ano_construcao')::int, ano_construcao),
    andar         = coalesce((p_dados ->> 'andar')::int, andar),
    caracteristicas = coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(p_dados -> 'caracteristicas')),
      caracteristicas
    ),
    condominio_id = coalesce(v_cond_id, condominio_id),
    fonte         = 'xml',
    importado_em  = now()
  where id = v_id;

  -- Fotos: o feed e a fonte da verdade para a galeria, entao a lista e
  -- refeita. Guardar a URL de origem evita baixar imagem na importacao.
  if p_dados ? 'fotos' then
    delete from imovel_fotos where imovel_id = v_id;

    insert into imovel_fotos (imovel_id, path, ordem, capa)
    select v_id, foto, indice - 1, indice = 1
    from jsonb_array_elements_text(p_dados -> 'fotos') with ordinality as t(foto, indice);
  end if;

  return v_id;
end;
$$;

revoke all on function public.importar_imovel(jsonb) from public, anon;
grant execute on function public.importar_imovel(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6. FACETAS DA VITRINE
-- ------------------------------------------------------------
-- Bairros, cidades e tipos com contagem, numa consulta so.
--
-- Com quase mil imoveis, montar os filtros lendo todas as linhas e
-- contando no JavaScript passa a ser a parte mais cara da pagina. Aqui o
-- Postgres agrupa e devolve algumas dezenas de linhas.
create or replace function public.facetas_vitrine()
returns table (dimensao text, valor text, total bigint)
language sql
stable
set search_path = public
as $$
  select 'bairro', bairro, count(*) from vitrine_imoveis
   where bairro is not null and status = 'disponivel'
   group by bairro
  union all
  select 'cidade', cidade, count(*) from vitrine_imoveis
   where status = 'disponivel'
   group by cidade
  union all
  select 'tipo', tipo, count(*) from vitrine_imoveis
   where status = 'disponivel'
   group by tipo
  union all
  select 'condominio', condominio_nome, count(*) from vitrine_imoveis
   where condominio_nome is not null and status = 'disponivel'
   group by condominio_nome
$$;

grant execute on function public.facetas_vitrine() to anon, authenticated;
