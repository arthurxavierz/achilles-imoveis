-- ============================================================
-- ACHILLES IMOVEIS - 0007 VENDAS E COMISSAO
-- ============================================================
-- A tabela transacoes, criada em 0001, e um livro caixa: cada linha e
-- uma entrada ou uma saida. Ela responde "quanto entrou em agosto",
-- mas nao responde "quanto sobrou nesta venda depois de pagar todo
-- mundo", que e a pergunta que o dono da imobiliaria realmente faz.
--
-- Esta migration cria a camada de NEGOCIO acima do caixa:
--
--   vendas          -> o negocio fechado, com valor, comissao e margem
--   venda_parcelas  -> como a comissao entra, parcela a parcela
--   transacoes      -> continua sendo o caixa, agora ligado a venda
--
-- Os valores derivados (comissao bruta, parte da casa, parte do
-- consultor, margem) sao colunas geradas pelo proprio Postgres. Isso
-- importa: se a conta ficasse no JavaScript, cada tela poderia calcular
-- de um jeito, e um relatorio exportado divergiria da tela. Aqui existe
-- uma unica verdade, e ela mora no banco.
-- ============================================================

create table if not exists vendas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique,                -- VEN-0001, gerado por trigger

  tipo          text not null default 'venda' check (tipo in ('venda','locacao')),

  imovel_id     uuid references imoveis (id) on delete set null,
  -- Copia do titulo no momento do fechamento. Se o imovel for apagado
  -- ou renomeado depois, o historico financeiro continua legivel.
  imovel_titulo text not null,
  lead_id       uuid references leads (id) on delete set null,

  comprador_nome     text not null,
  comprador_telefone text,
  comprador_email    text,
  proprietario_nome  text,

  -- ---------- VALORES ----------
  valor_tabela  numeric(14,2) not null default 0,   -- pedido no anuncio
  valor_venda   numeric(14,2) not null check (valor_venda >= 0),

  -- Quanto o proprietario cedeu na negociacao. Coluna gerada porque
  -- desconto digitado a mao diverge do valor real na primeira correcao.
  desconto      numeric(14,2)
                generated always as (greatest(valor_tabela - valor_venda, 0)) stored,

  forma_pagamento text not null default 'financiado'
                  check (forma_pagamento in ('a_vista','financiado','permuta','misto','consorcio')),
  entrada          numeric(14,2) not null default 0,
  valor_financiado numeric(14,2) not null default 0,
  banco            text,

  -- ---------- COMISSAO ----------
  -- percentual_comissao : o que o proprietario paga a imobiliaria
  -- percentual_casa     : quanto desse total fica com a imobiliaria
  -- percentual_captador : premio de quem trouxe o imovel para a carteira
  --
  -- O que sobra e do consultor que fechou. Este e o modelo mais comum no
  -- mercado: a casa fica com metade, o captador leva um premio quando
  -- nao e a mesma pessoa que vendeu, e o restante e do vendedor.
  percentual_comissao numeric(6,3) not null default 6
                      check (percentual_comissao >= 0 and percentual_comissao <= 100),
  percentual_casa     numeric(6,3) not null default 50
                      check (percentual_casa >= 0 and percentual_casa <= 100),
  percentual_captador numeric(6,3) not null default 0
                      check (percentual_captador >= 0 and percentual_captador <= 100),

  comissao_bruta numeric(14,2)
    generated always as (round(valor_venda * percentual_comissao / 100, 2)) stored,

  comissao_casa numeric(14,2)
    generated always as (
      round(valor_venda * percentual_comissao / 100 * percentual_casa / 100, 2)
    ) stored,

  comissao_captador numeric(14,2)
    generated always as (
      round(valor_venda * percentual_comissao / 100 * percentual_captador / 100, 2)
    ) stored,

  -- O consultor recebe o que sobra depois da casa e do captador. Nao e
  -- um percentual proprio de proposito: assim as tres partes sempre
  -- somam exatamente a comissao bruta, sem centavo perdido em
  -- arredondamento.
  comissao_consultor numeric(14,2)
    generated always as (
      round(valor_venda * percentual_comissao / 100, 2)
      - round(valor_venda * percentual_comissao / 100 * percentual_casa / 100, 2)
      - round(valor_venda * percentual_comissao / 100 * percentual_captador / 100, 2)
    ) stored,

  -- Custos atribuiveis ao negocio: fotografia, anuncio pago, cartorio,
  -- deslocamento. Entram na conta da margem real.
  custos numeric(14,2) not null default 0 check (custos >= 0),

  -- O numero que interessa ao dono: o que ficou com a casa depois de
  -- pagar consultor, captador e os custos do negocio.
  margem numeric(14,2)
    generated always as (
      round(valor_venda * percentual_comissao / 100 * percentual_casa / 100, 2) - custos
    ) stored,

  -- ---------- PESSOAS ----------
  consultor_id uuid references perfis (id) on delete set null,
  captador_id  uuid references perfis (id) on delete set null,

  -- ---------- ANDAMENTO ----------
  status text not null default 'proposta'
         check (status in ('proposta','aprovada','contrato','concluida','cancelada')),

  data_proposta   date not null default current_date,
  data_assinatura date,
  data_conclusao  date,

  motivo_cancelamento text,
  observacoes         text,

  criado_por    uuid references perfis (id) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- A soma dos dois percentuais nao pode passar de 100: se passasse, o
  -- consultor receberia comissao negativa.
  constraint venda_divisao_coerente check (percentual_casa + percentual_captador <= 100),
  -- Venda cancelada precisa dizer por que. Sem isso o relatorio de
  -- perdas nao ensina nada.
  constraint venda_cancelamento_justificado
    check (status <> 'cancelada' or motivo_cancelamento is not null)
);

create index if not exists idx_vendas_consultor on vendas (consultor_id, data_proposta desc);
create index if not exists idx_vendas_status on vendas (status, data_proposta desc);
create index if not exists idx_vendas_imovel on vendas (imovel_id) where imovel_id is not null;
create index if not exists idx_vendas_periodo on vendas (data_conclusao desc)
  where status = 'concluida';

create trigger trg_vendas_atualizado before update on vendas
  for each row execute function tocar_atualizado_em();

comment on table vendas is
  'Negocios fechados. Comissao e margem sao colunas geradas: a conta mora no banco, nao na tela.';
comment on column vendas.margem is
  'O que sobrou para a imobiliaria: parte da casa menos os custos do negocio.';

-- ------------------------------------------------------------
-- PARCELAS DA COMISSAO
-- ------------------------------------------------------------
-- Comissao raramente entra de uma vez. O padrao e sinal na assinatura e
-- o restante na liberacao do financiamento, que pode levar 60 dias. Sem
-- controlar parcela, o financeiro nunca sabe o que ja caiu de fato.

create table if not exists venda_parcelas (
  id         uuid primary key default gen_random_uuid(),
  venda_id   uuid not null references vendas (id) on delete cascade,

  descricao  text not null,
  -- Quem recebe: a casa ou uma pessoa da equipe.
  beneficiario_id uuid references perfis (id) on delete set null,
  destino    text not null default 'casa' check (destino in ('casa','consultor','captador','terceiro')),

  valor      numeric(14,2) not null check (valor >= 0),
  vencimento date not null,
  pago_em    date,
  status     text not null default 'pendente' check (status in ('pendente','pago','cancelado')),

  observacoes text,
  criado_em   timestamptz not null default now(),

  -- Parcela marcada como paga precisa da data do pagamento. E o que
  -- separa "o cliente disse que pagou" de "entrou na conta".
  constraint parcela_pagamento_datado check (status <> 'pago' or pago_em is not null)
);

create index if not exists idx_parcelas_venda on venda_parcelas (venda_id);
create index if not exists idx_parcelas_vencimento on venda_parcelas (vencimento)
  where status = 'pendente';

comment on table venda_parcelas is
  'Como a comissao de uma venda entra ao longo do tempo. Alimenta a previsao de caixa.';

-- ------------------------------------------------------------
-- LIGACAO COM O CAIXA
-- ------------------------------------------------------------

alter table transacoes add column if not exists venda_id uuid references vendas (id) on delete set null;
create index if not exists idx_transacoes_venda on transacoes (venda_id) where venda_id is not null;

comment on column transacoes.venda_id is
  'Liga o lancamento de caixa ao negocio que o originou.';

-- ------------------------------------------------------------
-- CODIGO SEQUENCIAL
-- ------------------------------------------------------------

create sequence if not exists venda_codigo_seq start 1;

create or replace function public.venda_codigo()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null then
    new.codigo := 'VEN-' || lpad(nextval('venda_codigo_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger trg_venda_codigo before insert on vendas
  for each row execute function venda_codigo();

-- ------------------------------------------------------------
-- EFEITOS DE CONCLUIR UMA VENDA
-- ------------------------------------------------------------
-- Concluir a venda no sistema tem que fazer o que o corretor faria a
-- mao: tirar o imovel da vitrine, marcar o lead como fechado e lancar a
-- comissao no caixa. Deixar isso por conta da disciplina de cada um e
-- garantia de imovel vendido continuar anunciado no site.

create or replace function public.ao_concluir_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- So age na transicao para concluida, nao a cada update da linha.
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then

    if new.data_conclusao is null then
      new.data_conclusao := current_date;
    end if;

    if new.imovel_id is not null then
      update imoveis
         set status = case when new.tipo = 'locacao' then 'locado' else 'vendido' end,
             publicado = false,
             destaque = false
       where id = new.imovel_id;
    end if;

    if new.lead_id is not null then
      update leads set etapa = 'fechado' where id = new.lead_id and etapa <> 'fechado';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_venda_concluida before insert or update on vendas
  for each row execute function ao_concluir_venda();

comment on function public.ao_concluir_venda is
  'Venda concluida tira o imovel do ar, marca o lead como fechado e data a conclusao.';

-- Lancamento da comissao no caixa, depois que a linha ja existe (as
-- colunas geradas so tem valor no after).
create or replace function public.lancar_comissao_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'concluida' and (tg_op = 'INSERT' or old.status is distinct from 'concluida') then
    -- Idempotente: reconcluir a mesma venda nao duplica o lancamento.
    if not exists (select 1 from transacoes where venda_id = new.id and tipo = 'comissao') then
      insert into transacoes (
        tipo, descricao, categoria, consultor_id, imovel_id, venda_id,
        valor_venda, percentual, valor, data, status, criado_por
      ) values (
        'comissao',
        'Comissão da venda ' || coalesce(new.codigo, '') || ' - ' || new.imovel_titulo,
        'Venda',
        new.consultor_id,
        new.imovel_id,
        new.id,
        new.valor_venda,
        new.percentual_comissao,
        new.comissao_bruta,
        coalesce(new.data_conclusao, current_date),
        'pendente',
        new.criado_por
      );
    end if;
  end if;

  return null;
end;
$$;

create trigger trg_venda_lanca_comissao after insert or update on vendas
  for each row execute function lancar_comissao_venda();

-- ------------------------------------------------------------
-- SEGURANCA
-- ------------------------------------------------------------

alter table vendas enable row level security;
alter table venda_parcelas enable row level security;

grant select, insert, update, delete on vendas to authenticated;
grant select, insert, update, delete on venda_parcelas to authenticated;

-- Leitura: gestao ve tudo. Consultor ve as proprias vendas, porque
-- precisa acompanhar a comissao que tem a receber, mas nao ve o
-- resultado dos colegas.
drop policy if exists "vendas - ler" on vendas;
create policy "vendas - ler" on vendas
  for select to authenticated
  using (
    eh_gestor()
    or consultor_id = auth.uid()
    or captador_id = auth.uid()
  );

drop policy if exists "vendas - registrar" on vendas;
create policy "vendas - registrar" on vendas
  for insert to authenticated
  with check (pode('financeiro') or consultor_id = auth.uid());

-- Alteracao: quem tem financeiro mexe em tudo. O consultor ajusta a
-- propria venda enquanto ela nao foi concluida; depois de concluida o
-- numero vira historico contabil e so a gestao toca.
drop policy if exists "vendas - alterar" on vendas;
create policy "vendas - alterar" on vendas
  for update to authenticated
  using (
    pode('financeiro')
    or (consultor_id = auth.uid() and status in ('proposta','aprovada'))
  )
  with check (
    pode('financeiro')
    or (consultor_id = auth.uid() and status in ('proposta','aprovada'))
  );

-- Excluir venda e privilegio de admin. Cancelar e o caminho normal, e
-- preserva o historico.
drop policy if exists "vendas - excluir" on vendas;
create policy "vendas - excluir" on vendas
  for delete to authenticated
  using (eh_admin());

drop policy if exists "parcelas - ler" on venda_parcelas;
create policy "parcelas - ler" on venda_parcelas
  for select to authenticated
  using (
    eh_gestor()
    or beneficiario_id = auth.uid()
    or exists (
      select 1 from vendas v
      where v.id = venda_parcelas.venda_id
        and (v.consultor_id = auth.uid() or v.captador_id = auth.uid())
    )
  );

drop policy if exists "parcelas - gerenciar" on venda_parcelas;
create policy "parcelas - gerenciar" on venda_parcelas
  for all to authenticated
  using (pode('financeiro'))
  with check (pode('financeiro'));

-- ------------------------------------------------------------
-- PAINEL FINANCEIRO
-- ------------------------------------------------------------
-- Uma consulta so devolve o mes fechado. Sem isto o app baixaria todas
-- as vendas para somar no navegador, o que fica lento e, pior, faz cada
-- tela chegar a um total diferente.

create or replace function public.resumo_financeiro(
  p_inicio date default date_trunc('month', current_date)::date,
  p_fim    date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date
)
returns table (
  vgv                numeric,
  negocios           bigint,
  comissao_bruta     numeric,
  comissao_casa      numeric,
  comissao_equipe    numeric,
  custos             numeric,
  margem             numeric,
  ticket_medio       numeric,
  desconto_medio_pct numeric,
  em_negociacao      numeric,
  a_receber          numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with concluidas as (
    select * from vendas
    where status = 'concluida'
      and data_conclusao between p_inicio and p_fim
  )
  select
    coalesce(sum(c.valor_venda), 0)                       as vgv,
    count(c.id)                                           as negocios,
    coalesce(sum(c.comissao_bruta), 0)                    as comissao_bruta,
    coalesce(sum(c.comissao_casa), 0)                     as comissao_casa,
    coalesce(sum(c.comissao_consultor + c.comissao_captador), 0) as comissao_equipe,
    coalesce(sum(c.custos), 0)                            as custos,
    coalesce(sum(c.margem), 0)                            as margem,
    coalesce(avg(c.valor_venda), 0)                       as ticket_medio,
    -- Desconto medio so faz sentido onde havia preco de tabela.
    coalesce(avg(
      case when c.valor_tabela > 0
           then c.desconto / c.valor_tabela * 100
      end
    ), 0)                                                 as desconto_medio_pct,
    (select coalesce(sum(valor_venda), 0) from vendas
      where status in ('proposta','aprovada','contrato'))  as em_negociacao,
    (select coalesce(sum(valor), 0) from venda_parcelas
      where status = 'pendente')                           as a_receber
  from concluidas c
$$;

comment on function public.resumo_financeiro is
  'Fecha o periodo numa consulta so. Toda tela do financeiro le daqui, para todas mostrarem o mesmo numero.';

-- Ranking do time no periodo. Alimenta a tela de desempenho.
create or replace function public.desempenho_equipe(
  p_inicio date default date_trunc('month', current_date)::date,
  p_fim    date default (date_trunc('month', current_date) + interval '1 month - 1 day')::date
)
returns table (
  consultor_id   uuid,
  consultor_nome text,
  meta_mensal    numeric,
  vgv            numeric,
  negocios       bigint,
  comissao       numeric,
  atingimento    numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.nome,
    p.meta_mensal,
    coalesce(sum(v.valor_venda), 0)        as vgv,
    count(v.id)                            as negocios,
    coalesce(sum(v.comissao_consultor), 0) as comissao,
    case
      when p.meta_mensal > 0
        then round(coalesce(sum(v.valor_venda), 0) / p.meta_mensal * 100, 1)
      else 0
    end                                    as atingimento
  from perfis p
  left join vendas v
    on v.consultor_id = p.id
   and v.status = 'concluida'
   and v.data_conclusao between p_inicio and p_fim
  where p.ativo = true
  group by p.id, p.nome, p.meta_mensal
  order by vgv desc, p.nome
$$;

comment on function public.desempenho_equipe is
  'VGV, numero de negocios e atingimento de meta por consultor no periodo.';
