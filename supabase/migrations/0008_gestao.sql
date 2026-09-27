-- ============================================================
-- ACHILLES IMOVEIS - 0008 GESTAO DE EQUIPE E ORIGEM DE LEAD
-- ============================================================
-- Tres coisas que a operacao pediu depois que o painel entrou em uso:
--
--   1. Atendimento presencial como origem de lead. Quem entra na loja
--      nao vem "do site" nem e "inclusao manual" sem contexto, e essa
--      diferenca muda a leitura de qual canal traz negocio.
--
--   2. O administrador editando o cadastro da equipe pela tela, e nao
--      pelo painel do Supabase. Continua sendo ato exclusivo de admin,
--      so que agora com uma porta propria em vez de nenhuma.
--
--   3. Transferencia de carteira antes de remover alguem. Apagar um
--      perfil sem isso deixa lead sem responsavel e imovel sem captador,
--      e a operacao descobre no pior momento, que e quando o cliente
--      liga perguntando por quem o atendia.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORIGEM DE LEAD: ATENDIMENTO PRESENCIAL
-- ------------------------------------------------------------
alter table leads drop constraint if exists leads_origem_check;

alter table leads add constraint leads_origem_check check (
  origem in (
    'site','vitrine','whatsapp','portal','indicacao',
    'instagram','telefone','presencial','manual'
  )
);

-- ------------------------------------------------------------
-- 2. CADASTRO DA EQUIPE
-- ------------------------------------------------------------
-- O grant de coluna da migration 0003 permite que cada pessoa edite os
-- proprios dados de contato, e so isso. Esta funcao abre a mesma
-- operacao para o administrador sobre qualquer perfil, sem alargar o
-- grant: papel, permissoes e ativo continuam inalcancaveis por UPDATE
-- direto, e so mudam por definir_acesso().
create or replace function public.atualizar_perfil(
  p_usuario_id uuid,
  p_nome       text default null,
  p_email      text default null,
  p_telefone   text default null,
  p_creci      text default null
)
returns perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado perfis;
begin
  if not (eh_admin() or p_usuario_id = auth.uid()) then
    raise exception 'Apenas o administrador edita o cadastro de outra pessoa.'
      using errcode = '42501';
  end if;

  if p_nome is not null and length(btrim(p_nome)) < 2 then
    raise exception 'Informe o nome completo.' using errcode = '22023';
  end if;

  update perfis set
    nome     = coalesce(nullif(btrim(p_nome), ''), nome),
    email    = coalesce(nullif(btrim(p_email), ''), email),
    telefone = case when p_telefone is null then telefone
                    else nullif(btrim(p_telefone), '') end,
    creci    = case when p_creci is null then creci
                    else nullif(btrim(p_creci), '') end,
    atualizado_em = now()
  where id = p_usuario_id
  returning * into resultado;

  if resultado is null then
    raise exception 'Usuario nao encontrado.' using errcode = 'P0002';
  end if;

  return resultado;
end;
$$;

revoke all on function public.atualizar_perfil(uuid, text, text, text, text) from public, anon;
grant execute on function public.atualizar_perfil(uuid, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
-- 3. TRANSFERENCIA DE CARTEIRA
-- ------------------------------------------------------------
-- Roda antes de desligar alguem. Negocio ja concluido nao troca de dono:
-- ele e historico contabil, e a comissao daquele mes pertence a quem
-- vendeu, mesmo que a pessoa nao esteja mais na casa.
create or replace function public.transferir_carteira(
  p_de   uuid,
  p_para uuid
)
returns table (leads_movidos int, imoveis_movidos int, negocios_movidos int, compromissos_movidos int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_leads int;
  v_imoveis int;
  v_negocios int;
  v_compromissos int;
begin
  if not eh_admin() then
    raise exception 'Apenas administradores transferem carteira.' using errcode = '42501';
  end if;

  if p_de = p_para then
    raise exception 'Origem e destino sao a mesma pessoa.' using errcode = '22023';
  end if;

  if not exists (select 1 from perfis where id = p_para and ativo) then
    raise exception 'Quem recebe a carteira precisa estar ativo na equipe.' using errcode = '22023';
  end if;

  update leads set corretor_id = p_para where corretor_id = p_de;
  get diagnostics v_leads = row_count;

  update imoveis set corretor_id = p_para where corretor_id = p_de;
  get diagnostics v_imoveis = row_count;

  update vendas set consultor_id = p_para
   where consultor_id = p_de and status not in ('concluida','cancelada');
  get diagnostics v_negocios = row_count;

  update compromissos set responsavel_id = p_para
   where responsavel_id = p_de and status not in ('concluido','cancelado');
  get diagnostics v_compromissos = row_count;

  return query select v_leads, v_imoveis, v_negocios, v_compromissos;
end;
$$;

revoke all on function public.transferir_carteira(uuid, uuid) from public, anon;
grant execute on function public.transferir_carteira(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. CARTEIRA DE CADA PESSOA
-- ------------------------------------------------------------
-- Alimenta o aviso que a tela de equipe mostra antes de desativar ou
-- remover alguem. Uma consulta so, para a tela nao precisar de quatro.
--
-- Fica como security invoker de proposito: assim o RLS continua valendo
-- dentro da funcao, e ela nao vira uma porta lateral para um corretor
-- contar a carteira do colega.
create or replace function public.carteira_da_pessoa(p_usuario_id uuid)
returns table (leads int, imoveis int, negocios int, compromissos int)
language sql
stable
set search_path = public
as $$
  select
    (select count(*)::int from leads    where corretor_id = p_usuario_id and not arquivado),
    (select count(*)::int from imoveis  where corretor_id = p_usuario_id),
    (select count(*)::int from vendas   where consultor_id = p_usuario_id
       and status not in ('concluida','cancelada')),
    (select count(*)::int from compromissos where responsavel_id = p_usuario_id
       and status not in ('concluido','cancelado'))
$$;

revoke all on function public.carteira_da_pessoa(uuid) from public, anon;
grant execute on function public.carteira_da_pessoa(uuid) to authenticated;
