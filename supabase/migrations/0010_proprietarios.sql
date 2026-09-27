-- ============================================================
-- 0010  PROPRIETARIOS: OBRIGATORIEDADE E CONSULTA
-- ============================================================
-- A tabela proprietarios existe desde a 0001, com RLS na 0003. O que
-- faltava era o que esta migration entrega:
--
--   1. Garantir, no banco, que imovel novo nao entra sem proprietario.
--   2. Indices para as buscas que a tela de carteira passou a fazer.
--   3. Uma view que conta a carteira de cada proprietario sem obrigar
--      o painel a trazer a tabela de imoveis inteira para contar.
--
-- Rode depois da 0009. E idempotente: pode rodar duas vezes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. OBRIGATORIEDADE
-- ------------------------------------------------------------
-- Nao usamos `alter table imoveis alter column proprietario_id set not
-- null` de proposito.
--
-- Um NOT NULL falharia na hora em qualquer base que ja tenha imovel
-- sem proprietario — e toda base que importou XML tem, porque o feed
-- do portal nao carrega dado de captacao. A migration morreria no meio
-- e deixaria o banco pela metade.
--
-- O gatilho abaixo resolve o mesmo problema sem esse risco: exige
-- proprietario em todo INSERT e em todo UPDATE que mexa na coluna,
-- e deixa em paz as linhas antigas que ninguem tocou. A carteira
-- legada e regularizada aos poucos, conforme a equipe abre cada ficha,
-- em vez de tudo num sabado.

create or replace function exigir_proprietario()
returns trigger
language plpgsql
as $$
begin
  -- Importacao tem passe livre: importar_imovel() da migration 0009
  -- grava o registro antes de existir alguem para vincular, e travar
  -- aqui faria a sincronizacao do portal falhar inteira por causa de
  -- um dado que o portal nao envia. Esses registros nascem marcados
  -- como pendencia e aparecem no filtro "sem proprietario" do painel.
  if new.fonte in ('xml', 'portal') then
    return new;
  end if;

  if new.proprietario_id is null then
    raise exception 'Todo imovel precisa de um proprietario vinculado.'
      using errcode = 'check_violation',
            hint = 'Cadastre o proprietario antes, ou vincule um existente.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_imoveis_exige_proprietario on imoveis;
create trigger trg_imoveis_exige_proprietario
  before insert or update of proprietario_id, fonte on imoveis
  for each row execute function exigir_proprietario();

-- ------------------------------------------------------------
-- 2. INDICES
-- ------------------------------------------------------------
-- A carteira filtra por proprietario o tempo todo agora, e a ficha do
-- proprietario lista os imoveis dele. Sem indice, as duas viram varredura
-- da tabela inteira de imoveis.
create index if not exists idx_imoveis_proprietario
  on imoveis (proprietario_id);

-- O painel destaca quem ainda esta sem vinculo. Indice parcial porque
-- so as linhas nulas interessam nesta consulta, e ele fica pequeno:
-- conforme a equipe regulariza a carteira, o indice encolhe sozinho.
create index if not exists idx_imoveis_sem_proprietario
  on imoveis (atualizado_em) where proprietario_id is null;

-- Busca por nome de proprietario, sem acento e sem diferenciar
-- maiuscula. E como a equipe procura: a pessoa liga, se identifica pelo
-- nome, e ninguem lembra o codigo do anuncio dela.
create index if not exists idx_proprietarios_nome
  on proprietarios (lower(nome));

-- Documento e o segundo caminho de busca, na hora da escritura.
create index if not exists idx_proprietarios_documento
  on proprietarios (cpf_cnpj) where cpf_cnpj is not null;

-- ------------------------------------------------------------
-- 3. VIEW DA CARTEIRA
-- ------------------------------------------------------------
-- Conta os imoveis de cada proprietario no banco, em vez de trazer as
-- duas tabelas para o Node e cruzar la. Com dezenas de proprietarios e
-- centenas de imoveis a diferenca ja aparece, e a conta e a mesma que
-- resumirCarteira() faz em packages/core/src/carteira.ts.
--
-- security_invoker faz a view respeitar o RLS de quem consulta, e nao
-- o de quem a criou. Sem isso, a view seria um buraco no RLS de
-- proprietarios: um corretor leria por ela a carteira inteira da casa,
-- que e exatamente o que a politica da 0003 impede na tabela.
-- Derrubada antes de criar pelo mesmo motivo da 0009: `create or
-- replace view` recusa mudanca na lista de colunas, e o `p.*` daqui
-- muda sozinho toda vez que a tabela proprietarios ganhar um campo.
drop view if exists proprietarios_com_carteira;

create view proprietarios_com_carteira
with (security_invoker = true)
as
select
  p.*,
  coalesce(c.total_imoveis, 0)      as total_imoveis,
  coalesce(c.imoveis_publicados, 0) as imoveis_publicados,
  coalesce(c.valor_carteira, 0)     as valor_carteira
from proprietarios p
left join (
  select
    proprietario_id,
    count(*)                                        as total_imoveis,
    count(*) filter (where publicado)               as imoveis_publicados,
    -- Vendido e locado saem da conta: o valor em carteira e o que
    -- ainda pode virar comissao, nao o que ja virou.
    sum(valor) filter (where status in ('disponivel', 'reservado')) as valor_carteira
  from imoveis
  where proprietario_id is not null
  group by proprietario_id
) c on c.proprietario_id = p.id;

grant select on proprietarios_com_carteira to authenticated;

-- ------------------------------------------------------------
-- 4. EXCLUSAO PROTEGIDA
-- ------------------------------------------------------------
-- A 0001 declarou `on delete set null` no vinculo. Isso significa que
-- apagar um proprietario deixaria os imoveis dele apontando para lugar
-- nenhum, em silencio — o pior jeito de perder dado de captacao,
-- porque ninguem percebe ate precisar do telefone.
--
-- O gatilho recusa a exclusao enquanto houver imovel vinculado. Quem
-- quer mesmo remover, primeiro transfere a carteira. A mensagem diz
-- quantos sao, para a pessoa saber o tamanho do trabalho antes de
-- comecar.
create or replace function impedir_exclusao_com_carteira()
returns trigger
language plpgsql
as $$
declare
  vinculados int;
begin
  select count(*) into vinculados from imoveis where proprietario_id = old.id;

  if vinculados > 0 then
    raise exception
      'Este proprietario tem % imovel(is) vinculado(s). Transfira ou exclua antes.', vinculados
      using errcode = 'foreign_key_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_proprietarios_protege_exclusao on proprietarios;
create trigger trg_proprietarios_protege_exclusao
  before delete on proprietarios
  for each row execute function impedir_exclusao_com_carteira();

-- ------------------------------------------------------------
-- 5. AUDITORIA
-- ------------------------------------------------------------
-- O carimbo de atualizado_em ja existe: a 0002 criou
-- trg_proprietarios_atualizado sobre public.tocar_atualizado_em().
-- Nao ha nada a fazer aqui, e a nota fica para quem vier procurar por
-- que esta migration nao mexe nisso.
