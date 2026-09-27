-- ============================================================
-- ACHILLES IMOVEIS - 0002 FUNCOES E GATILHOS
-- ============================================================
-- As funcoes de permissao abaixo sao SECURITY DEFINER de proposito.
-- Sem isso, uma policy da tabela perfis que consulta a propria tabela
-- perfis entraria em recursao infinita. Com SECURITY DEFINER a funcao
-- roda como dona da tabela e ignora o RLS, quebrando o ciclo.
--
-- Todas fixam search_path = public. Isso impede que alguem crie um
-- schema temporario com uma tabela "perfis" falsa e sequestre a funcao.
-- ============================================================

-- ------------------------------------------------------------
-- PERMISSOES
-- ------------------------------------------------------------

-- Papel do usuario logado: admin, gestor ou corretor.
create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from perfis where id = auth.uid() and ativo = true
$$;

-- Administrador. Manda em tudo.
create or replace function public.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select papel = 'admin' from perfis where id = auth.uid() and ativo = true), false)
$$;

-- Admin ou gestor. Enxerga a operacao inteira, nao so a carteira propria.
create or replace function public.eh_gestor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select papel in ('admin','gestor') from perfis where id = auth.uid() and ativo = true), false)
$$;

-- Permissao por area: imoveis, leads, financeiro, usuarios.
create or replace function public.pode(area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select papel = 'admin' or coalesce((permissoes ->> area)::boolean, false)
    from perfis where id = auth.uid() and ativo = true
  ), false)
$$;

-- ------------------------------------------------------------
-- UTILITARIOS
-- ------------------------------------------------------------

-- "Cobertura Duplex Morada da Colina" -> "cobertura-duplex-morada-da-colina"
--
-- Usa translate em vez da extensao unaccent de proposito: no Supabase a
-- unaccent fica no schema "extensions", e depender dela deixaria a funcao
-- refem de onde a extensao foi instalada. translate e nativo e deterministico.
create or replace function public.slugify(txt text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      coalesce(txt, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
    )),
    '[^a-z0-9]+', '-', 'g'
  ))
$$;

-- Carimba atualizado_em em qualquer tabela que tenha a coluna.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- Monta a URL publica do imovel: /imovel/cobertura-morada-da-colina-bo-1042
create or replace function public.imovel_slug()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.titulo is distinct from old.titulo or new.slug is null then
    new.slug := public.slugify(new.titulo) || '-' || lower(new.codigo);
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- GATILHOS DE MANUTENCAO
-- ------------------------------------------------------------
drop trigger if exists trg_perfis_atualizado on perfis;
create trigger trg_perfis_atualizado before update on perfis
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_proprietarios_atualizado on proprietarios;
create trigger trg_proprietarios_atualizado before update on proprietarios
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_imoveis_atualizado on imoveis;
create trigger trg_imoveis_atualizado before update on imoveis
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_leads_atualizado on leads;
create trigger trg_leads_atualizado before update on leads
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_transacoes_atualizado on transacoes;
create trigger trg_transacoes_atualizado before update on transacoes
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists trg_imoveis_slug on imoveis;
create trigger trg_imoveis_slug before insert or update on imoveis
  for each row execute function public.imovel_slug();

-- ------------------------------------------------------------
-- PERFIL AUTOMATICO AO CRIAR USUARIO NO AUTH
-- ------------------------------------------------------------
-- O primeiro usuario criado no projeto vira admin. Resolve o ovo e a
-- galinha do primeiro acesso. Do segundo em diante, todos entram como
-- corretor e o admin promove pela tela de Usuarios.
create or replace function public.novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ja_existe_admin boolean;
begin
  select exists (select 1 from perfis where papel = 'admin') into ja_existe_admin;

  insert into perfis (id, nome, email, telefone, papel, permissoes)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(coalesce(new.email, 'Consultor'), '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'telefone',
    case when ja_existe_admin then 'corretor' else 'admin' end,
    case when ja_existe_admin
      then '{"imoveis":true,"leads":true,"financeiro":false,"usuarios":false}'::jsonb
      else '{"imoveis":true,"leads":true,"financeiro":true,"usuarios":true}'::jsonb
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();

-- ------------------------------------------------------------
-- AUDITORIA
-- ------------------------------------------------------------
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_log (tabela, registro_id, acao, autor_id, dados_antes, dados_depois)
  values (
    tg_table_name,
    coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id')),
    tg_op,
    auth.uid(),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_imoveis on imoveis;
create trigger trg_audit_imoveis after insert or update or delete on imoveis
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_transacoes on transacoes;
create trigger trg_audit_transacoes after insert or update or delete on transacoes
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_perfis on perfis;
create trigger trg_audit_perfis after insert or update or delete on perfis
  for each row execute function public.registrar_auditoria();

-- ------------------------------------------------------------
-- RPC: contador de visualizacoes da vitrine
-- ------------------------------------------------------------
-- O site publico chama esta funcao. Ela e SECURITY DEFINER porque o
-- visitante anonimo nao tem (e nao pode ter) UPDATE na tabela imoveis.
-- So mexe no contador, e so de imovel publicado.
create or replace function public.contar_visualizacao(p_imovel_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update imoveis set visualizacoes = visualizacoes + 1
  where id = p_imovel_id and publicado = true
$$;

revoke all on function public.contar_visualizacao(uuid) from public;
grant execute on function public.contar_visualizacao(uuid) to anon, authenticated;
