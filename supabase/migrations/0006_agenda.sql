-- ============================================================
-- ACHILLES IMOVEIS - 0006 AGENDA DA EQUIPE
-- ============================================================
-- Uma agenda de imobiliaria tem uma particularidade que agenda comum
-- nao tem: o compromisso pertence a uma pessoa, mas a gestao precisa
-- enxergar e marcar compromisso para os outros. Visita de imovel,
-- plantao de fim de semana e reuniao de captacao sao decisoes de
-- coordenacao, nao de agenda pessoal.
--
-- Por isso existem DOIS donos em cada linha:
--
--   responsavel_id -> de quem e o compromisso, quem vai comparecer
--   criado_por     -> quem marcou
--
-- Quando o admin marca para o corretor, os dois campos diferem, e a
-- interface mostra "marcado por Fulano". O corretor ve na propria
-- agenda, mas nao consegue apagar um compromisso que a gestao travou.
--
-- As colunas de notificacao ja existem aqui, sem nada que as consuma
-- ainda. Sao o ponto de encaixe do envio por WhatsApp e e-mail: quando
-- essa integracao entrar, ela le compromissos com lembrete vencido e
-- notificado_em nulo, sem precisar mexer no schema de novo.
-- ============================================================

create table if not exists compromissos (
  id            uuid primary key default gen_random_uuid(),

  titulo        text not null check (length(trim(titulo)) between 2 and 160),
  observacao    text,                      -- o recado que precisa chegar junto
  tipo          text not null default 'visita'
                check (tipo in ('visita','reuniao','plantao','captacao','assinatura','pessoal','outro')),

  -- Instante com fuso. Guardar timestamptz e nao "data + hora solta"
  -- evita o classico erro de horario de verao e de servidor em UTC
  -- mostrando 3h a menos para quem esta em Uberlandia.
  inicio        timestamptz not null,
  fim           timestamptz not null,
  dia_inteiro   boolean not null default false,

  local         text,                      -- endereco, sala, "online"

  responsavel_id uuid not null references perfis (id) on delete cascade,
  criado_por     uuid references perfis (id) on delete set null,

  -- Vinculos opcionais: a visita quase sempre e de um imovel para um lead.
  imovel_id     uuid references imoveis (id) on delete set null,
  lead_id       uuid references leads (id) on delete set null,

  status        text not null default 'agendado'
                check (status in ('agendado','confirmado','concluido','cancelado','remarcado')),

  -- Quando verdadeiro, so a gestao altera ou apaga. E como o admin
  -- prende um plantao ou uma reuniao obrigatoria na agenda de alguem.
  travado       boolean not null default false,

  -- Encaixe para a notificacao futura.
  lembrete_minutos int not null default 60 check (lembrete_minutos between 0 and 10080),
  canais        text[] not null default array['app']::text[],
  notificado_em timestamptz,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Um compromisso que termina antes de comecar e erro de digitacao,
  -- e o banco nao deve aceitar. A interface tambem valida, mas a
  -- interface pode ser contornada.
  constraint compromisso_intervalo_valido check (fim >= inicio),
  -- Nada de compromisso de tres semanas de duracao por engano.
  constraint compromisso_duracao_sensata check (fim <= inicio + interval '30 days')
);

-- Consulta dominante da tela: "o que tem na agenda desta pessoa neste
-- mes". O indice cobre as duas colunas na ordem em que sao filtradas.
create index if not exists idx_compromissos_responsavel_periodo
  on compromissos (responsavel_id, inicio desc);

-- Visao do admin: o mes inteiro, de todo mundo.
create index if not exists idx_compromissos_periodo on compromissos (inicio desc);

create index if not exists idx_compromissos_imovel on compromissos (imovel_id)
  where imovel_id is not null;
create index if not exists idx_compromissos_lead on compromissos (lead_id)
  where lead_id is not null;

-- Fila da notificacao futura: so o que ainda nao foi avisado.
create index if not exists idx_compromissos_a_notificar
  on compromissos (inicio)
  where notificado_em is null and status in ('agendado','confirmado');

create trigger trg_compromissos_atualizado before update on compromissos
  for each row execute function tocar_atualizado_em();

comment on table compromissos is
  'Agenda da equipe. responsavel_id e de quem e o compromisso; criado_por e quem marcou.';
comment on column compromissos.travado is
  'Quando verdadeiro, somente a gestao altera ou exclui. Usado em plantao e reuniao obrigatoria.';
comment on column compromissos.canais is
  'Canais de aviso desejados. Hoje so app; whatsapp e email entram na fase de integracoes.';

-- ------------------------------------------------------------
-- REGRA DE QUEM PODE MARCAR PARA QUEM
-- ------------------------------------------------------------
-- Escrita em funcao, e nao repetida em cada policy, porque a mesma
-- pergunta aparece no insert, no update e no delete. Se a regra mudar,
-- muda em um lugar so.

create or replace function public.pode_gerir_compromisso(
  p_responsavel uuid,
  p_travado boolean
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      -- Gestao marca, altera e apaga qualquer compromisso.
      when eh_gestor() then true
      -- Compromisso travado pela gestao: o corretor so olha.
      when p_travado then false
      -- Fora isso, cada um cuida da propria agenda.
      else p_responsavel = auth.uid()
    end
$$;

comment on function public.pode_gerir_compromisso is
  'Gestao gerencia tudo. Corretor gerencia apenas a propria agenda, e nunca o que foi travado.';

-- ------------------------------------------------------------
-- SEGURANCA
-- ------------------------------------------------------------

alter table compromissos enable row level security;

grant select, insert, update, delete on compromissos to authenticated;

-- Leitura: a equipe inteira enxerga a agenda da equipe.
--
-- E deliberado. Numa imobiliaria, saber que o colega esta em visita as
-- 15h e o que evita marcar duas coisas no mesmo horario e o que permite
-- cobrir um atendimento. O que fica reservado e o conteudo sensivel do
-- negocio (lead, valor), que vive em outras tabelas com RLS propria.
drop policy if exists "compromissos - equipe ve a agenda" on compromissos;
create policy "compromissos - equipe ve a agenda" on compromissos
  for select to authenticated
  using (true);

drop policy if exists "compromissos - marcar" on compromissos;
create policy "compromissos - marcar" on compromissos
  for insert to authenticated
  with check (
    -- Corretor so marca para si; gestao marca para quem for.
    (eh_gestor() or responsavel_id = auth.uid())
    -- E ninguem trava compromisso a nao ser a gestao.
    and (travado = false or eh_gestor())
  );

drop policy if exists "compromissos - alterar" on compromissos;
create policy "compromissos - alterar" on compromissos
  for update to authenticated
  using (pode_gerir_compromisso(responsavel_id, travado))
  with check (
    pode_gerir_compromisso(responsavel_id, travado)
    and (travado = false or eh_gestor())
  );

drop policy if exists "compromissos - excluir" on compromissos;
create policy "compromissos - excluir" on compromissos
  for delete to authenticated
  using (pode_gerir_compromisso(responsavel_id, travado));

-- ------------------------------------------------------------
-- CONFLITO DE HORARIO
-- ------------------------------------------------------------
-- Nao bloqueia: avisa. Um corretor pode legitimamente ter dois
-- compromissos sobrepostos (uma ligacao durante um plantao), e um banco
-- que recusa o cadastro nesse caso vira inimigo do usuario. A interface
-- usa esta funcao para mostrar "voce ja tem algo neste horario".

create or replace function public.conflitos_agenda(
  p_responsavel uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_ignorar_id uuid default null
)
returns table (id uuid, titulo text, inicio timestamptz, fim timestamptz)
language sql
stable
security invoker           -- respeita o RLS de quem chamou, de proposito
set search_path = public
as $$
  select c.id, c.titulo, c.inicio, c.fim
  from compromissos c
  where c.responsavel_id = p_responsavel
    and c.status not in ('cancelado','remarcado')
    and (p_ignorar_id is null or c.id <> p_ignorar_id)
    -- Sobreposicao de intervalos: comeca antes do outro terminar e
    -- termina depois do outro comecar.
    and c.inicio < p_fim
    and c.fim > p_inicio
  order by c.inicio
$$;

comment on function public.conflitos_agenda is
  'Compromissos que se sobrepoem ao intervalo informado. Serve de aviso na interface, nao de bloqueio.';

-- ------------------------------------------------------------
-- RESUMO DO DIA
-- ------------------------------------------------------------
-- Alimenta o painel inicial sem obrigar o app a baixar a agenda toda.

create or replace function public.agenda_do_dia(p_data date default current_date)
returns table (
  id uuid,
  titulo text,
  observacao text,
  tipo text,
  inicio timestamptz,
  fim timestamptz,
  local text,
  status text,
  travado boolean,
  responsavel_id uuid,
  responsavel_nome text,
  criado_por_nome text,
  imovel_id uuid,
  imovel_titulo text,
  lead_id uuid,
  lead_nome text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id, c.titulo, c.observacao, c.tipo, c.inicio, c.fim, c.local,
    c.status, c.travado,
    c.responsavel_id, r.nome as responsavel_nome,
    a.nome as criado_por_nome,
    c.imovel_id, i.titulo as imovel_titulo,
    c.lead_id, l.nome as lead_nome
  from compromissos c
  join perfis r on r.id = c.responsavel_id
  left join perfis a on a.id = c.criado_por
  left join imoveis i on i.id = c.imovel_id
  left join leads l on l.id = c.lead_id
  -- O fuso de Uberlandia decide o que e "hoje". Sem o at time zone, um
  -- compromisso das 21h apareceria no dia seguinte para o servidor UTC.
  where (c.inicio at time zone 'America/Sao_Paulo')::date = p_data
  order by c.inicio
$$;

comment on function public.agenda_do_dia is
  'Compromissos de um dia, ja com nomes resolvidos. O RLS de quem chamou decide o que aparece.';
