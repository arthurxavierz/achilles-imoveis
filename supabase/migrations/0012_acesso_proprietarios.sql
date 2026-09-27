-- ============================================================
-- ACHILLES IMOVEIS - 0012 ACESSO A PROPRIETARIO POR VIGENCIA
-- ============================================================
-- Pedido do dono da imobiliaria: o consultor so alcanca o dado de
-- proprietario enquanto aquele proprietario for dele NAQUELE INSTANTE.
-- Saiu da carteira, acabou o acesso, no mesmo segundo. CPF, telefone e
-- endereco de quem entrega imovel para a Achilles sao o ativo da casa, nao
-- do corretor que passa por ela.
--
-- O QUE MUDA EM RELACAO A 0003
--
-- A politica antiga liberava a leitura por dois caminhos: ter um imovel
-- daquele dono, OU ter sido quem cadastrou. O segundo caminho nao
-- expirava nunca. Quem cadastrasse um proprietario continuava lendo o
-- CPF e o telefone dele para sempre, mesmo depois de a gestao passar o
-- imovel inteiro para outro consultor. Era exatamente o caso que a
-- imobiliaria quer fechar: consultor que sai da conta leva a agenda.
--
-- Agora o acesso vem de uma coisa so: existir, agora, um imovel com
-- aquele proprietario na carteira do consultor. E uma pergunta feita no
-- momento da consulta, entao a transferencia do imovel tira o acesso
-- sozinha, sem ninguem precisar lembrar de revogar nada.
--
-- A UNICA EXCECAO, E POR QUE ELA PRECISA EXISTIR
--
-- Cadastrar um proprietario e vincula-lo a um imovel sao dois gestos, e
-- entre um e outro existe um instante em que aquela pessoa nao esta na
-- carteira de ninguem. Sem uma saida para esse instante, o consultor
-- cadastraria o proprietario e o perderia de vista na hora, antes de
-- conseguir usa-lo: ele nao apareceria no seletor da ficha do imovel, e
-- o cadastro que ele acabou de fazer viraria um registro invisivel.
--
-- Por isso ele enxerga tambem o proprietario que ele mesmo cadastrou E
-- que ainda nao esta em imovel nenhum, de ninguem. E uma janela estreita
-- de proposito: no segundo em que aquele proprietario entra na carteira
-- de alguem, a excecao se fecha, e dali em diante vale so a vigencia.
-- Se o imovel for para outro consultor, quem cadastrou perde o acesso
-- como qualquer um.
--
-- A PORTA DOS FUNDOS, QUE TAMBEM FECHA AQUI
--
-- O corretor le a carteira inteira da casa, de proposito, porque quem
-- vende precisa saber o que existe em estoque. Isso inclui a coluna
-- proprietario_id de todo imovel. O id sozinho e um uuid opaco e nao
-- vale nada, mas o vinculo valia: bastava copiar o proprietario_id de um
-- imovel de outro consultor, gravar num imovel proprio, e a politica
-- passava a liberar a leitura, porque agora existia mesmo um imovel dele
-- apontando para la. O vinculo era a chave, e qualquer um forjava a
-- chave. O gatilho da secao 3 acaba com isso.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A MESMA PERGUNTA, AGORA CHAMAVEL
-- ------------------------------------------------------------
-- A regra tambem esta escrita por extenso nas politicas da secao 2, e a
-- repeticao e deliberada: politica que consulta a propria tabela que
-- filtra so nao entra em recursao enquanto ninguem declarar force row
-- level security, e essa e uma condicao que ninguem lembra de conferir.
-- Ali embaixo a regra le colunas da propria linha e nao corre esse
-- risco. Aqui ela vira funcao porque o gatilho, que roda sobre imoveis,
-- precisa fazer a mesma pergunta sobre uma linha que ainda nao existe.
--
-- Mudou uma, mude a outra. As duas estao neste arquivo, uma logo abaixo
-- da outra, justamente para que ninguem mexa numa sem ver a segunda.
--
-- security definer para poder olhar proprietarios e imoveis por cima do
-- RLS: sem isso a funcao seria filtrada pelas proprias politicas que ela
-- existe para decidir, e responderia sempre "nao". search_path fixo pelo
-- motivo de todas as outras funcoes do projeto: sem ele, quem consegue
-- criar uma funcao num schema a frente na busca faz o Postgres executar
-- codigo proprio com poder de dono.
create or replace function public.pode_ver_proprietario(p_proprietario_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_proprietario_id is not null
    and (
      eh_gestor()
      -- Vigencia: tem imovel deste dono na carteira, agora.
      or exists (
        select 1 from imoveis i
        where i.proprietario_id = p_proprietario_id and i.corretor_id = auth.uid()
      )
      -- Janela do cadastro: criou e ainda nao vinculou a lugar nenhum.
      or (
        exists (
          select 1 from proprietarios p
          where p.id = p_proprietario_id and p.criado_por = auth.uid()
        )
        and not exists (
          select 1 from imoveis i where i.proprietario_id = p_proprietario_id
        )
      )
    )
$$;

revoke all on function public.pode_ver_proprietario(uuid) from public;
grant execute on function public.pode_ver_proprietario(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. LER E EDITAR PASSAM A SEGUIR A VIGENCIA
-- ------------------------------------------------------------
-- Escritas por extenso, e nao chamando a funcao acima, pelo motivo
-- explicado na secao 1. Repare que aqui a regra le criado_por e id da
-- propria linha que esta sendo filtrada, sem voltar a consultar
-- proprietarios: e o que a mantem fora de qualquer risco de recursao.
drop policy if exists "proprietarios - ler" on proprietarios;
create policy "proprietarios - ler" on proprietarios
  for select to authenticated
  using (
    eh_gestor()
    or exists (
      select 1 from imoveis i
      where i.proprietario_id = proprietarios.id and i.corretor_id = auth.uid()
    )
    or (
      criado_por = auth.uid()
      and not exists (
        select 1 from imoveis i where i.proprietario_id = proprietarios.id
      )
    )
  );

-- Editar segue a leitura, e nao mais o "criou uma vez, manda para
-- sempre" da 0003. Quem nao pode nem ver o telefone nao tem por que
-- poder troca-lo.
drop policy if exists "proprietarios - editar" on proprietarios;
create policy "proprietarios - editar" on proprietarios
  for update to authenticated
  using (
    eh_gestor()
    or exists (
      select 1 from imoveis i
      where i.proprietario_id = proprietarios.id and i.corretor_id = auth.uid()
    )
    or (
      criado_por = auth.uid()
      and not exists (
        select 1 from imoveis i where i.proprietario_id = proprietarios.id
      )
    )
  )
  with check (
    eh_gestor()
    or exists (
      select 1 from imoveis i
      where i.proprietario_id = proprietarios.id and i.corretor_id = auth.uid()
    )
    or (
      criado_por = auth.uid()
      and not exists (
        select 1 from imoveis i where i.proprietario_id = proprietarios.id
      )
    )
  );

-- Criar e excluir nao mudam: a 0003 ja exige pode('imoveis') com
-- criado_por = auth.uid() para criar, e so a gestao exclui.

-- ------------------------------------------------------------
-- 3. O VINCULO DEIXA DE SER CHAVE MESTRA
-- ------------------------------------------------------------
-- Gatilho, e nao um with check na politica de update de imoveis, por
-- duas razoes. A primeira e a mensagem: with check falha com o texto
-- generico de violacao de RLS, que na tela do painel vira "este imovel
-- esta na carteira de outro consultor", o que aqui seria mentira. O
-- imovel e dele; quem nao e dele e o proprietario. A segunda e o
-- alcance: o gatilho pega insert e update pelo mesmo caminho.
--
-- A conferencia so acontece quando o vinculo de fato muda. Publicar em
-- lote, mudar status, corrigir valor: nada disso toca proprietario_id, e
-- pagar uma consulta a mais em toda escrita da carteira por causa de um
-- campo que quase nunca muda seria caro a toa.
create or replace function public.conferir_vinculo_proprietario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Desvincular e sempre permitido: nao da acesso a nada.
  if new.proprietario_id is null then
    return new;
  end if;

  -- Rotina de servidor passa direto: importacao, seed e qualquer job com
  -- a service_role nao tem auth.uid(), e sem esta saida o gatilho os
  -- barraria a todos, porque eh_gestor() de ninguem e falso. Nao ha
  -- afrouxamento aqui: quem chega sem uid ja precisou da chave mestra,
  -- que nunca sai do servidor.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.proprietario_id is not distinct from old.proprietario_id then
    return new;
  end if;

  -- Em UPDATE a linha ainda nao mudou na tabela, e em INSERT ela ainda
  -- nao existe. Nos dois casos pode_ver_proprietario enxerga o mundo de
  -- antes desta escrita, que e exatamente a pergunta certa: o consultor
  -- ja alcancava este proprietario, ou esta tentando alcanca-lo agora?
  if not pode_ver_proprietario(new.proprietario_id) then
    raise exception
      'Este proprietario nao esta na sua carteira. Vincule apenas quem voce acabou de cadastrar ou quem ja e dono de outro imovel seu; a gestao pode vincular qualquer um.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists conferir_vinculo_proprietario on imoveis;
create trigger conferir_vinculo_proprietario
  before insert or update of proprietario_id on imoveis
  for each row
  execute function public.conferir_vinculo_proprietario();

-- ------------------------------------------------------------
-- 4. A VIEW SEGUE PELO MESMO CRIVO
-- ------------------------------------------------------------
-- Registro, nao mudanca: proprietarios_com_carteira ja nasceu com
-- security_invoker = true na 0010, entao ela le com o RLS de quem
-- consulta e nao contorna nada. Se alguem recriar a view um dia, perder
-- essa clausula reabre o buraco inteiro de uma vez.
