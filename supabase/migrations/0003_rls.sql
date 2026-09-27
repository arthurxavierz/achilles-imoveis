-- ============================================================
-- ACHILLES IMOVEIS - 0003 SEGURANCA (RLS E PRIVILEGIOS)
-- ============================================================
-- Duas travas independentes, uma sobre a outra:
--
--   1. GRANT  decide QUAIS TABELAS E COLUNAS cada papel toca.
--   2. RLS    decide QUAIS LINHAS dentro do que sobrou.
--
-- O Supabase concede tudo para anon e authenticated por padrao. Este
-- arquivo comeca revogando esse padrao e devolvendo so o necessario.
-- Sem o revoke, um corretor conseguiria se promover a admin com um
-- unico UPDATE, porque o RLS sozinho nao restringe coluna.
--
-- anon  = visitante do achillesimoveis.com.br (nao logado)
-- authenticated = equipe logada no app.achillesimoveis.com.br
-- ============================================================

-- ------------------------------------------------------------
-- ZERA OS PRIVILEGIOS PADRAO
-- ------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table perfis          enable row level security;
alter table proprietarios   enable row level security;
alter table imoveis         enable row level security;
alter table imovel_fotos    enable row level security;
alter table leads           enable row level security;
alter table lead_interacoes enable row level security;
alter table agenda          enable row level security;
alter table tarefas         enable row level security;
alter table transacoes      enable row level security;
alter table audit_log       enable row level security;

-- ============================================================
-- PERFIS
-- ============================================================
-- Coluna a coluna: a pessoa edita os proprios dados de contato, mas
-- papel, permissoes e ativo so mudam pela funcao administrativa no fim
-- deste arquivo, que exige ser admin.
grant select on perfis to authenticated;
grant update (nome, telefone, creci, avatar_url) on perfis to authenticated;

drop policy if exists "perfis - equipe le a equipe" on perfis;
create policy "perfis - equipe le a equipe" on perfis
  for select to authenticated
  using (true);

drop policy if exists "perfis - edita o proprio" on perfis;
create policy "perfis - edita o proprio" on perfis
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- PROPRIETARIOS  (dado sensivel: CPF, contato particular)
-- ============================================================
grant select, insert, update on proprietarios to authenticated;
grant delete on proprietarios to authenticated;

drop policy if exists "proprietarios - ler" on proprietarios;
create policy "proprietarios - ler" on proprietarios
  for select to authenticated
  using (
    eh_gestor()
    or criado_por = auth.uid()
    or exists (
      select 1 from imoveis i
      where i.proprietario_id = proprietarios.id and i.corretor_id = auth.uid()
    )
  );

drop policy if exists "proprietarios - criar" on proprietarios;
create policy "proprietarios - criar" on proprietarios
  for insert to authenticated
  with check (pode('imoveis') and criado_por = auth.uid());

drop policy if exists "proprietarios - editar" on proprietarios;
create policy "proprietarios - editar" on proprietarios
  for update to authenticated
  using (eh_gestor() or criado_por = auth.uid())
  with check (eh_gestor() or criado_por = auth.uid());

drop policy if exists "proprietarios - excluir" on proprietarios;
create policy "proprietarios - excluir" on proprietarios
  for delete to authenticated
  using (eh_gestor());

-- ============================================================
-- IMOVEIS
-- ============================================================
-- Defesa em profundidade. O visitante anonimo nao recebe select na
-- tabela inteira, e sim nas colunas publicaveis. Mesmo que alguem monte
-- na mao um GET /rest/v1/imoveis?select=observacoes_internas, o banco
-- recusa. matricula, proprietario_id, observacoes_internas e os dados de
-- captacao simplesmente nao existem para o anon.
grant select (
  id, codigo, slug, titulo, descricao, tipo, finalidade, status,
  cep, logradouro, numero, complemento, bairro, cidade, uf, latitude, longitude, exibir_endereco,
  valor, valor_locacao, valor_condominio, valor_iptu, aceita_permuta, aceita_financiamento,
  area_util, area_total, quartos, suites, banheiros, vagas, ano_construcao, andar, mobiliado,
  caracteristicas, publicado, destaque, cover, meta_titulo, meta_descricao,
  criado_em, atualizado_em
) on imoveis to anon;
grant select, insert, update, delete on imoveis to authenticated;
grant usage on sequence imovel_codigo_seq to authenticated;

-- A vitrine publica so enxerga o que foi explicitamente publicado.
-- observacoes_internas e matricula continuam na linha, por isso o site
-- NUNCA faz select *: ele usa a view vitrine_imoveis (fim do arquivo).
drop policy if exists "imoveis - vitrine publica" on imoveis;
create policy "imoveis - vitrine publica" on imoveis
  for select to anon
  using (publicado = true and status <> 'inativo');

drop policy if exists "imoveis - equipe le a carteira" on imoveis;
create policy "imoveis - equipe le a carteira" on imoveis
  for select to authenticated
  using (pode('imoveis'));

-- Ao cadastrar, o corretor so consegue se colocar como dono.
-- Gestor e admin podem cadastrar em nome de outro consultor.
drop policy if exists "imoveis - cadastrar" on imoveis;
create policy "imoveis - cadastrar" on imoveis
  for insert to authenticated
  with check (pode('imoveis') and (corretor_id = auth.uid() or eh_gestor()));

-- A REGRA DE OURO: so o dono do imovel ou a gestao edita e exclui.
drop policy if exists "imoveis - editar" on imoveis;
create policy "imoveis - editar" on imoveis
  for update to authenticated
  using (pode('imoveis') and (eh_gestor() or corretor_id = auth.uid()))
  with check (pode('imoveis') and (eh_gestor() or corretor_id = auth.uid()));

drop policy if exists "imoveis - excluir" on imoveis;
create policy "imoveis - excluir" on imoveis
  for delete to authenticated
  using (pode('imoveis') and (eh_gestor() or corretor_id = auth.uid()));

-- ============================================================
-- FOTOS  (acompanham o imovel)
-- ============================================================
grant select on imovel_fotos to anon;
grant select, insert, update, delete on imovel_fotos to authenticated;

drop policy if exists "fotos - vitrine publica" on imovel_fotos;
create policy "fotos - vitrine publica" on imovel_fotos
  for select to anon
  using (exists (
    select 1 from imoveis i
    where i.id = imovel_fotos.imovel_id and i.publicado = true and i.status <> 'inativo'
  ));

drop policy if exists "fotos - equipe le" on imovel_fotos;
create policy "fotos - equipe le" on imovel_fotos
  for select to authenticated
  using (pode('imoveis'));

drop policy if exists "fotos - gerenciar" on imovel_fotos;
create policy "fotos - gerenciar" on imovel_fotos
  for all to authenticated
  using (exists (
    select 1 from imoveis i
    where i.id = imovel_fotos.imovel_id
      and pode('imoveis') and (eh_gestor() or i.corretor_id = auth.uid())
  ))
  with check (exists (
    select 1 from imoveis i
    where i.id = imovel_fotos.imovel_id
      and pode('imoveis') and (eh_gestor() or i.corretor_id = auth.uid())
  ));

-- ============================================================
-- LEADS
-- ============================================================
-- O visitante do site NAO escreve aqui. O formulario publico passa pela
-- Netlify Function, que valida o Turnstile e grava com a service_role.
-- Assim nao existe endpoint aberto de escrita no banco.
grant select, insert, update on leads to authenticated;
grant delete on leads to authenticated;

drop policy if exists "leads - ler" on leads;
create policy "leads - ler" on leads
  for select to authenticated
  using (pode('leads') and (eh_gestor() or corretor_id = auth.uid() or corretor_id is null));

drop policy if exists "leads - criar" on leads;
create policy "leads - criar" on leads
  for insert to authenticated
  with check (pode('leads'));

drop policy if exists "leads - editar" on leads;
create policy "leads - editar" on leads
  for update to authenticated
  using (pode('leads') and (eh_gestor() or corretor_id = auth.uid() or corretor_id is null))
  with check (pode('leads'));

-- Corretor arquiva, nao apaga. Excluir de vez e ato da gestao, e fica
-- registrado no audit_log.
drop policy if exists "leads - excluir" on leads;
create policy "leads - excluir" on leads
  for delete to authenticated
  using (eh_gestor());

-- ============================================================
-- INTERACOES DO LEAD
-- ============================================================
grant select, insert on lead_interacoes to authenticated;
grant update, delete on lead_interacoes to authenticated;

drop policy if exists "interacoes - ler" on lead_interacoes;
create policy "interacoes - ler" on lead_interacoes
  for select to authenticated
  using (exists (
    select 1 from leads l
    where l.id = lead_interacoes.lead_id
      and pode('leads') and (eh_gestor() or l.corretor_id = auth.uid() or l.corretor_id is null)
  ));

drop policy if exists "interacoes - criar" on lead_interacoes;
create policy "interacoes - criar" on lead_interacoes
  for insert to authenticated
  with check (autor_id = auth.uid() and exists (
    select 1 from leads l where l.id = lead_id and pode('leads')
  ));

-- Historico nao se reescreve. Só o proprio autor corrige a propria nota.
drop policy if exists "interacoes - corrigir a propria" on lead_interacoes;
create policy "interacoes - corrigir a propria" on lead_interacoes
  for update to authenticated
  using (autor_id = auth.uid())
  with check (autor_id = auth.uid());

drop policy if exists "interacoes - excluir" on lead_interacoes;
create policy "interacoes - excluir" on lead_interacoes
  for delete to authenticated
  using (autor_id = auth.uid() or eh_gestor());

-- ============================================================
-- AGENDA
-- ============================================================
grant select, insert, update, delete on agenda to authenticated;

drop policy if exists "agenda - ver" on agenda;
create policy "agenda - ver" on agenda
  for select to authenticated
  using (eh_gestor() or corretor_id = auth.uid());

drop policy if exists "agenda - gerenciar" on agenda;
create policy "agenda - gerenciar" on agenda
  for all to authenticated
  using (eh_gestor() or corretor_id = auth.uid())
  with check (eh_gestor() or corretor_id = auth.uid());

-- ============================================================
-- TAREFAS
-- ============================================================
grant select, insert, update, delete on tarefas to authenticated;

drop policy if exists "tarefas - ver" on tarefas;
create policy "tarefas - ver" on tarefas
  for select to authenticated
  using (eh_gestor() or responsavel_id = auth.uid());

drop policy if exists "tarefas - gerenciar" on tarefas;
create policy "tarefas - gerenciar" on tarefas
  for all to authenticated
  using (eh_gestor() or responsavel_id = auth.uid())
  with check (eh_gestor() or responsavel_id = auth.uid());

-- ============================================================
-- FINANCEIRO
-- ============================================================
grant select, insert, update, delete on transacoes to authenticated;

-- Gestao ve o caixa inteiro. Consultor com permissao financeiro ve
-- apenas as proprias comissoes, nunca as do colega nem as despesas.
drop policy if exists "financeiro - ler" on transacoes;
create policy "financeiro - ler" on transacoes
  for select to authenticated
  using (
    (eh_gestor() and pode('financeiro'))
    or (pode('financeiro') and consultor_id = auth.uid())
  );

drop policy if exists "financeiro - lancar" on transacoes;
create policy "financeiro - lancar" on transacoes
  for insert to authenticated
  with check (eh_gestor() and pode('financeiro'));

drop policy if exists "financeiro - editar" on transacoes;
create policy "financeiro - editar" on transacoes
  for update to authenticated
  using (eh_gestor() and pode('financeiro'))
  with check (eh_gestor() and pode('financeiro'));

drop policy if exists "financeiro - excluir" on transacoes;
create policy "financeiro - excluir" on transacoes
  for delete to authenticated
  using (eh_admin());

-- ============================================================
-- AUDITORIA  (somente leitura, e so para o admin)
-- ============================================================
grant select on audit_log to authenticated;

drop policy if exists "auditoria - admin le" on audit_log;
create policy "auditoria - admin le" on audit_log
  for select to authenticated
  using (eh_admin());

-- ============================================================
-- ADMINISTRACAO DE USUARIOS
-- ============================================================
-- Papel e permissoes ficam fora do alcance do UPDATE direto (o grant de
-- coluna la em cima nao os inclui). A unica porta e esta funcao, que
-- confere se quem chama e admin antes de qualquer coisa.
create or replace function public.definir_acesso(
  p_usuario_id uuid,
  p_papel      text default null,
  p_permissoes jsonb default null,
  p_ativo      boolean default null,
  p_meta       numeric default null
)
returns perfis
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado perfis;
begin
  if not eh_admin() then
    raise exception 'Apenas administradores alteram acessos.' using errcode = '42501';
  end if;

  if p_papel is not null and p_papel not in ('admin','gestor','corretor') then
    raise exception 'Papel invalido: %', p_papel using errcode = '22023';
  end if;

  -- Trava de seguranca: impede a imobiliaria de ficar sem nenhum admin,
  -- seja por rebaixamento seja por desativacao da propria conta.
  if p_usuario_id = auth.uid()
     and ((p_papel is not null and p_papel <> 'admin') or p_ativo = false) then
    raise exception 'Voce nao pode remover ou desativar o proprio acesso de administrador.'
      using errcode = '42501';
  end if;

  update perfis set
    papel      = coalesce(p_papel, papel),
    permissoes = coalesce(p_permissoes, permissoes),
    ativo      = coalesce(p_ativo, ativo),
    meta_mensal = coalesce(p_meta, meta_mensal)
  where id = p_usuario_id
  returning * into resultado;

  if resultado is null then
    raise exception 'Usuario nao encontrado.' using errcode = 'P0002';
  end if;

  return resultado;
end;
$$;

revoke all on function public.definir_acesso(uuid, text, jsonb, boolean, numeric) from public, anon;
grant execute on function public.definir_acesso(uuid, text, jsonb, boolean, numeric) to authenticated;

-- ============================================================
-- VIEW DA VITRINE
-- ============================================================
-- O site publico consome esta view, nunca a tabela direto. Assim
-- observacoes_internas, matricula, proprietario e dados de captacao nao
-- tem como vazar por um select * distraido no frontend.
create or replace view vitrine_imoveis
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
    area_util, area_total, quartos, suites, banheiros, vagas,
    ano_construcao, andar, mobiliado, caracteristicas,
    destaque, cover, meta_titulo, meta_descricao,
    criado_em, atualizado_em
  from imoveis
  where publicado = true and status <> 'inativo';

grant select on vitrine_imoveis to anon, authenticated;
