-- ============================================================
-- ACHILLES IMOVEIS - 0001 ESTRUTURA CENTRAL
-- ============================================================
-- Modelado para VENDA agora, com os campos de LOCACAO ja previstos
-- (ver 0004_locacao.sql). Rode as migrations em ordem numerica.
-- ============================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ------------------------------------------------------------
-- PERFIS. Estende auth.users com dados e permissoes da Achilles.
-- ------------------------------------------------------------
create table if not exists perfis (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null default 'Consultor',
  email       text,
  telefone    text,
  creci       text,
  avatar_url  text,
  -- admin: tudo. gestor: gestao sem administracao de usuarios. corretor: carteira propria.
  papel       text not null default 'corretor' check (papel in ('admin','gestor','corretor')),
  -- Liga e desliga areas por pessoa. O papel admin ignora este mapa.
  permissoes  jsonb not null default '{"imoveis":true,"leads":true,"financeiro":false,"usuarios":false}'::jsonb,
  meta_mensal numeric(14,2) not null default 0,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- PROPRIETARIOS. Quem entrega o imovel para a Achilles vender.
-- ------------------------------------------------------------
create table if not exists proprietarios (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  cpf_cnpj   text,
  email      text,
  telefone   text,
  endereco   text,
  observacoes text,
  criado_por uuid references perfis (id) on delete set null,
  criado_em  timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- IMOVEIS
-- ------------------------------------------------------------
create sequence if not exists imovel_codigo_seq start 1000;

create table if not exists imoveis (
  id            uuid primary key default gen_random_uuid(),
  -- Codigo curto que a equipe usa no dia a dia e no anuncio: BO-1042
  codigo        text unique not null default ('BO-' || nextval('imovel_codigo_seq')),
  slug          text unique,                       -- URL publica, gerada por trigger

  titulo        text not null,
  descricao     text,
  tipo          text not null default 'Apartamento',
  finalidade    text not null default 'venda' check (finalidade in ('venda','locacao','venda_locacao')),
  status        text not null default 'disponivel'
                check (status in ('disponivel','reservado','vendido','locado','inativo')),

  -- Localizacao
  cep           text,
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text not null default 'Uberlandia',
  uf            text not null default 'MG',
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  -- Endereco completo some da vitrine quando o proprietario pede sigilo.
  exibir_endereco boolean not null default true,

  -- Valores
  valor            numeric(14,2) not null default 0,   -- venda
  valor_locacao    numeric(14,2),                      -- preparado para a fase de locacao
  valor_condominio numeric(14,2),
  valor_iptu       numeric(14,2),
  aceita_permuta   boolean not null default false,
  aceita_financiamento boolean not null default true,

  -- Metragens e comodos
  area_util     numeric(10,2) not null default 0,
  area_total    numeric(10,2) not null default 0,
  quartos       int not null default 0,
  suites        int not null default 0,
  banheiros     int not null default 0,
  vagas         int not null default 0,
  ano_construcao int,
  andar         int,
  mobiliado     boolean not null default false,

  -- Lista livre: piscina, churrasqueira, academia, portaria 24h...
  caracteristicas text[] not null default '{}',

  -- Captacao
  proprietario_id uuid references proprietarios (id) on delete set null,
  corretor_id     uuid references perfis (id) on delete set null,
  exclusividade   boolean not null default false,
  autorizacao_ate date,
  matricula       text,
  observacoes_internas text,                      -- nunca sai para a vitrine

  -- Publicacao
  publicado     boolean not null default false,
  destaque      boolean not null default false,
  publicar_portais boolean not null default false, -- entra no XML de ZAP/VivaReal/OLX
  cover         text not null default 'cv1',       -- estilo do cartao enquanto nao ha foto
  visualizacoes int not null default 0,

  -- SEO
  meta_titulo   text,
  meta_descricao text,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Busca em portugues, alimentada automaticamente pelo proprio banco
  busca tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(titulo,'') || ' ' || coalesce(descricao,'') || ' ' ||
      coalesce(bairro,'') || ' ' || coalesce(cidade,'') || ' ' ||
      coalesce(tipo,'')   || ' ' || coalesce(codigo,'')
    )
  ) stored
);

create index if not exists idx_imoveis_publicado on imoveis (publicado, status);
create index if not exists idx_imoveis_corretor  on imoveis (corretor_id);
create index if not exists idx_imoveis_bairro    on imoveis (cidade, bairro);
create index if not exists idx_imoveis_valor     on imoveis (valor);
create index if not exists idx_imoveis_busca     on imoveis using gin (busca);
create index if not exists idx_imoveis_caract    on imoveis using gin (caracteristicas);

-- ------------------------------------------------------------
-- FOTOS. O arquivo vive no Supabase Storage; aqui fica o caminho.
-- ------------------------------------------------------------
create table if not exists imovel_fotos (
  id        uuid primary key default gen_random_uuid(),
  imovel_id uuid not null references imoveis (id) on delete cascade,
  path      text not null,              -- caminho dentro do bucket 'imoveis'
  legenda   text,
  ordem     int not null default 0,
  capa      boolean not null default false,
  largura   int,
  altura    int,
  criado_em timestamptz not null default now()
);
create index if not exists idx_fotos_imovel on imovel_fotos (imovel_id, ordem);

-- ------------------------------------------------------------
-- LEADS
-- ------------------------------------------------------------
create table if not exists leads (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  telefone  text,
  email     text,
  mensagem  text,

  origem    text not null default 'manual'
            check (origem in ('site','vitrine','whatsapp','portal','indicacao','instagram','telefone','manual')),
  etapa     text not null default 'novo'
            check (etapa in ('novo','contato','visita','proposta','fechado','perdido')),
  temperatura text not null default 'morno' check (temperatura in ('frio','morno','quente')),
  score     int not null default 0,

  imovel_id uuid references imoveis (id) on delete set null,
  imovel_titulo text,                     -- congela o titulo mesmo se o imovel sair do ar
  valor     numeric(14,2) not null default 0,
  corretor_id uuid references perfis (id) on delete set null,

  -- LGPD: guarda a prova de consentimento do formulario publico.
  consentimento_lgpd boolean not null default false,
  consentimento_em   timestamptz,
  ip_origem   text,

  -- Atribuicao de midia paga
  utm_source text, utm_medium text, utm_campaign text, utm_term text, utm_content text,
  pagina_origem text,

  arquivado     boolean not null default false,
  motivo_perda  text,
  proximo_contato date,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_leads_etapa    on leads (etapa);
create index if not exists idx_leads_corretor on leads (corretor_id);
create index if not exists idx_leads_telefone on leads (telefone);
create index if not exists idx_leads_criado   on leads (criado_em desc);

-- ------------------------------------------------------------
-- INTERACOES. A linha do tempo do lead.
-- ------------------------------------------------------------
create table if not exists lead_interacoes (
  id        uuid primary key default gen_random_uuid(),
  lead_id   uuid not null references leads (id) on delete cascade,
  tipo      text not null default 'nota'
            check (tipo in ('nota','ligacao','whatsapp','email','visita','proposta','sistema')),
  conteudo  text not null,
  autor_id  uuid references perfis (id) on delete set null,
  autor_nome text,                        -- congela o nome para o historico
  criado_em timestamptz not null default now()
);
create index if not exists idx_interacoes_lead on lead_interacoes (lead_id, criado_em desc);

-- ------------------------------------------------------------
-- AGENDA. Visitas e compromissos do corretor.
-- ------------------------------------------------------------
create table if not exists agenda (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  tipo       text not null default 'visita'
             check (tipo in ('visita','reuniao','ligacao','assinatura','outro')),
  lead_id    uuid references leads (id) on delete set null,
  imovel_id  uuid references imoveis (id) on delete set null,
  corretor_id uuid not null references perfis (id) on delete cascade,
  inicio     timestamptz not null,
  fim        timestamptz,
  local      text,
  observacoes text,
  status     text not null default 'agendado'
             check (status in ('agendado','confirmado','realizado','cancelado','nao_compareceu')),
  criado_em  timestamptz not null default now()
);
create index if not exists idx_agenda_corretor on agenda (corretor_id, inicio);

-- ------------------------------------------------------------
-- TAREFAS
-- ------------------------------------------------------------
create table if not exists tarefas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  responsavel_id uuid references perfis (id) on delete cascade,
  lead_id     uuid references leads (id) on delete cascade,
  imovel_id   uuid references imoveis (id) on delete cascade,
  prazo       date,
  prioridade  text not null default 'media' check (prioridade in ('baixa','media','alta')),
  concluida   boolean not null default false,
  concluida_em timestamptz,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_tarefas_resp on tarefas (responsavel_id, concluida, prazo);

-- ------------------------------------------------------------
-- FINANCEIRO
-- ------------------------------------------------------------
create table if not exists transacoes (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null check (tipo in ('comissao','receita','despesa')),
  descricao   text not null,
  categoria   text,
  consultor_id uuid references perfis (id) on delete set null,
  imovel_id   uuid references imoveis (id) on delete set null,
  valor_venda numeric(14,2) not null default 0,   -- base de calculo da comissao
  percentual  numeric(6,3),
  valor       numeric(14,2) not null default 0,   -- valor efetivo do lancamento
  data        date not null default current_date,
  vencimento  date,
  status      text not null default 'pendente' check (status in ('pendente','pago','cancelado')),
  observacoes text,
  criado_por  uuid references perfis (id) on delete set null,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_transacoes_data on transacoes (data desc);
create index if not exists idx_transacoes_cons on transacoes (consultor_id);

-- ------------------------------------------------------------
-- AUDITORIA. Quem mudou o que. Exigencia de sistema entregue a cliente.
-- ------------------------------------------------------------
create table if not exists audit_log (
  id        bigint generated always as identity primary key,
  tabela    text not null,
  registro_id text,
  acao      text not null,                -- INSERT, UPDATE, DELETE
  autor_id  uuid,
  dados_antes jsonb,
  dados_depois jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists idx_audit_tabela on audit_log (tabela, criado_em desc);
