-- ============================================================
-- ACHILLES IMOVEIS - 0004 LOCACAO (ESTRUTURA PREPARADA)
-- ============================================================
-- A Achilles opera VENDA nesta fase. Estas tabelas ficam criadas e
-- protegidas desde ja para que a entrada da locacao seja ligar tela,
-- e nao reformar banco com dado de producao dentro.
--
-- Nenhuma tela consome estas tabelas ainda. Com RLS ligado e acesso
-- restrito a gestao, elas nao ampliam a superficie de ataque.
-- ============================================================

-- ------------------------------------------------------------
-- CONTRATOS DE LOCACAO
-- ------------------------------------------------------------
create table if not exists contratos (
  id             uuid primary key default gen_random_uuid(),
  numero         text unique,
  imovel_id      uuid not null references imoveis (id) on delete restrict,
  proprietario_id uuid references proprietarios (id) on delete set null,

  -- Inquilino. Vira tabela propria quando o modulo entrar de verdade.
  inquilino_nome     text not null,
  inquilino_cpf_cnpj text,
  inquilino_email    text,
  inquilino_telefone text,

  inicio         date not null,
  fim            date not null,
  dia_vencimento int not null default 10 check (dia_vencimento between 1 and 28),

  valor_aluguel    numeric(14,2) not null,
  valor_condominio numeric(14,2) not null default 0,
  valor_iptu       numeric(14,2) not null default 0,
  taxa_administracao numeric(6,3) not null default 10,   -- % que fica com a Achilles

  indice_reajuste text not null default 'IGPM' check (indice_reajuste in ('IGPM','IPCA','INCC','sem_reajuste')),
  proximo_reajuste date,

  garantia       text not null default 'fiador'
                 check (garantia in ('fiador','caucao','seguro_fianca','titulo_capitalizacao','sem_garantia')),
  garantia_detalhes text,

  status         text not null default 'ativo'
                 check (status in ('rascunho','ativo','encerrado','inadimplente','rescindido')),
  corretor_id    uuid references perfis (id) on delete set null,
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
create index if not exists idx_contratos_imovel on contratos (imovel_id);
create index if not exists idx_contratos_status on contratos (status);

-- ------------------------------------------------------------
-- PARCELAS. Base do boleto, do repasse e do DIMOB.
-- ------------------------------------------------------------
create table if not exists contrato_parcelas (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references contratos (id) on delete cascade,
  competencia  date not null,                  -- mes de referencia
  vencimento   date not null,
  valor_aluguel    numeric(14,2) not null default 0,
  valor_condominio numeric(14,2) not null default 0,
  valor_iptu       numeric(14,2) not null default 0,
  valor_multa      numeric(14,2) not null default 0,
  valor_desconto   numeric(14,2) not null default 0,
  valor_total  numeric(14,2) generated always as (
    valor_aluguel + valor_condominio + valor_iptu + valor_multa - valor_desconto
  ) stored,
  pago_em      date,
  repassado_em date,
  status       text not null default 'aberto'
               check (status in ('aberto','pago','atrasado','cancelado')),
  criado_em    timestamptz not null default now(),
  unique (contrato_id, competencia)
);
create index if not exists idx_parcelas_venc on contrato_parcelas (vencimento, status);

-- ------------------------------------------------------------
-- VISTORIAS (entrada e saida)
-- ------------------------------------------------------------
create table if not exists vistorias (
  id          uuid primary key default gen_random_uuid(),
  contrato_id uuid references contratos (id) on delete cascade,
  imovel_id   uuid not null references imoveis (id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida','periodica')),
  realizada_em date not null default current_date,
  responsavel_id uuid references perfis (id) on delete set null,
  laudo       jsonb not null default '{}'::jsonb,   -- comodo a comodo
  observacoes text,
  criado_em   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- SEGURANCA
-- ------------------------------------------------------------
alter table contratos          enable row level security;
alter table contrato_parcelas  enable row level security;
alter table vistorias          enable row level security;

grant select, insert, update, delete on contratos         to authenticated;
grant select, insert, update, delete on contrato_parcelas to authenticated;
grant select, insert, update, delete on vistorias         to authenticated;

drop policy if exists "contratos - gestao" on contratos;
create policy "contratos - gestao" on contratos
  for all to authenticated
  using (eh_gestor() or corretor_id = auth.uid())
  with check (eh_gestor() or corretor_id = auth.uid());

drop policy if exists "parcelas - gestao" on contrato_parcelas;
create policy "parcelas - gestao" on contrato_parcelas
  for all to authenticated
  using (exists (
    select 1 from contratos c
    where c.id = contrato_parcelas.contrato_id and (eh_gestor() or c.corretor_id = auth.uid())
  ))
  with check (exists (
    select 1 from contratos c
    where c.id = contrato_parcelas.contrato_id and (eh_gestor() or c.corretor_id = auth.uid())
  ));

drop policy if exists "vistorias - gestao" on vistorias;
create policy "vistorias - gestao" on vistorias
  for all to authenticated
  using (eh_gestor() or responsavel_id = auth.uid())
  with check (eh_gestor() or responsavel_id = auth.uid());

drop trigger if exists trg_contratos_atualizado on contratos;
create trigger trg_contratos_atualizado before update on contratos
  for each row execute function public.tocar_atualizado_em();
