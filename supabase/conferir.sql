-- ============================================================
-- CONFERENCIA DA INSTALACAO
-- ============================================================
-- Rode isto no SQL Editor depois das dez migrations. Ele nao muda
-- nada: so olha e diz o que falta.
--
-- Existe porque a falha silenciosa aqui e cara. Uma migration que
-- parou no meio deixa o banco parecendo funcional — as telas abrem,
-- os dados aparecem — e o buraco so se revela quando alguem consulta
-- pelo caminho que dependia da parte que faltou. Pior: se o que ficou
-- de fora foi a 0003, o banco esta aberto e ninguem percebe, porque
-- ler dado demais nunca gera erro na tela.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABELAS
-- ------------------------------------------------------------
with esperadas(nome) as (
  select unnest(array[
    'agenda','audit_log','compromissos','condominios','contrato_parcelas',
    'contratos','imoveis','imovel_fotos','lead_interacoes','leads','perfis',
    'proprietarios','tarefas','transacoes','venda_parcelas','vendas','vistorias'
  ])
)
select
  'TABELAS' as bloco,
  case when count(*) filter (where t.table_name is null) = 0
       then 'ok' else 'FALTANDO' end as situacao,
  count(*) filter (where t.table_name is not null) || ' de ' || count(*) as encontrado,
  coalesce(string_agg(e.nome, ', ') filter (where t.table_name is null), '--') as detalhe
from esperadas e
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.nome;

-- ------------------------------------------------------------
-- 2. VIEWS
-- ------------------------------------------------------------
-- As tres da vitrine. A vitrine_imoveis e a que protege o dado de
-- captacao: o site le por ela, nunca pela tabela imoveis.
select
  'VIEWS' as bloco,
  case when count(*) = 3 then 'ok' else 'FALTANDO' end as situacao,
  count(*) || ' de 3' as encontrado,
  string_agg(table_name, ', ' order by table_name) as detalhe
from information_schema.views
where table_schema = 'public'
  and table_name in ('vitrine_imoveis', 'vitrine_condominios', 'proprietarios_com_carteira');

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ------------------------------------------------------------
-- O item mais importante desta conferencia. Sem RLS, qualquer pessoa
-- com a chave publica — que vai dentro do JavaScript do site, visivel
-- a quem abrir o inspetor — le proprietario, comissao e telefone de
-- cliente. Se alguma linha aparecer aqui, pare e rode a 0003.
select
  'RLS DESLIGADO' as bloco,
  case when count(*) = 0 then 'ok' else 'PERIGO' end as situacao,
  count(*) || ' tabela(s) sem RLS' as encontrado,
  coalesce(string_agg(relname, ', ' order by relname), '--') as detalhe
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and not c.relrowsecurity
  and c.relname in (
    'agenda','audit_log','compromissos','condominios','contrato_parcelas',
    'contratos','imoveis','imovel_fotos','lead_interacoes','leads','perfis',
    'proprietarios','tarefas','transacoes','venda_parcelas','vendas','vistorias'
  );

-- ------------------------------------------------------------
-- 4. GATILHOS DA 0010
-- ------------------------------------------------------------
select
  'GATILHOS 0010' as bloco,
  case when count(*) = 2 then 'ok' else 'FALTANDO' end as situacao,
  count(*) || ' de 2' as encontrado,
  coalesce(string_agg(tgname, ', ' order by tgname), '--') as detalhe
from pg_trigger
where not tgisinternal
  and tgname in (
    'trg_imoveis_exige_proprietario',
    'trg_proprietarios_protege_exclusao'
  );

-- ------------------------------------------------------------
-- 5. FUNCOES DA IMPORTACAO
-- ------------------------------------------------------------
select
  'FUNCOES' as bloco,
  case when count(*) = 2 then 'ok' else 'FALTANDO' end as situacao,
  count(*) || ' de 2' as encontrado,
  coalesce(string_agg(proname, ', ' order by proname), '--') as detalhe
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('importar_imovel', 'facetas_vitrine');

-- ------------------------------------------------------------
-- 6. SEU ACESSO
-- ------------------------------------------------------------
-- Confere que o gatilho novo_usuario criou o perfil e que o papel
-- ficou como admin. Se vier vazio, o usuario existe em auth.users mas
-- nao ganhou perfil — e sem perfil o painel recusa a entrada.
select
  'SEU PERFIL' as bloco,
  case
    when count(*) = 0 then 'SEM PERFIL'
    when bool_or(papel = 'admin') then 'ok'
    else 'NAO E ADMIN'
  end as situacao,
  coalesce(string_agg(email || ' (' || papel || ')', ', '), '--') as encontrado,
  coalesce(string_agg(permissoes::text, ' | '), '--') as detalhe
from perfis;
