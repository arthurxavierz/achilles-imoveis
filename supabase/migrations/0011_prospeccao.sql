-- ============================================================
-- 0011  PROSPECCAO ATIVA
-- ============================================================
-- A tela de Prospeccao busca empresas no Google Places e traz as
-- escolhidas para o funil. Do lado do banco, a mudanca e pequena de
-- proposito: uma origem nova em leads, e mais nada.
--
-- NAO existe tabela de prospectos, e a ausencia e uma decisao.
--
-- O resultado da busca e descartavel: a mesma consulta pode ser refeita
-- a qualquer momento e devolve o mesmo conjunto, atualizado. Guardar
-- isso criaria uma segunda lista de contatos para manter em dia, ao
-- lado do funil que ja existe — com o risco classico de as duas
-- discordarem sobre quem ja foi abordado.
--
-- O que vale guardar e a DECISAO de abordar aquela empresa. E essa
-- decisao ja tem lugar no sistema: e um lead, com dono, etapa,
-- historico e o mesmo RLS de todos os outros.
--
-- Rode depois da 0010. E idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- 1. ORIGEM DE LEAD: PROSPECCAO
-- ------------------------------------------------------------
-- A 0008 ja tinha reescrito esta restricao para acrescentar
-- 'presencial'. Aqui ela e reescrita de novo, inteira, porque o
-- Postgres nao tem "adicionar valor a um check": a lista e substituida.
alter table leads drop constraint if exists leads_origem_check;

alter table leads add constraint leads_origem_check check (
  origem in (
    'site','vitrine','whatsapp','portal','indicacao',
    'instagram','telefone','presencial','prospeccao','manual'
  )
);

-- ------------------------------------------------------------
-- 2. INDICE PARA A CHECAGEM DE DUPLICADO
-- ------------------------------------------------------------
-- Antes de criar o lead, a importacao procura por telefone: a mesma
-- empresa buscada em duas rodadas viraria dois leads, e quem atende
-- ligaria duas vezes para o mesmo lugar.
--
-- Indice parcial porque lead sem telefone existe e nao interessa a esta
-- consulta. Nao e unique: dois leads com o mesmo telefone e uma
-- situacao real (o casal que liga do mesmo numero), entao a regra fica
-- na aplicacao, que avisa e deixa a pessoa decidir, em vez de o banco
-- recusar.
create index if not exists idx_leads_telefone
  on leads (telefone) where telefone is not null;

-- ------------------------------------------------------------
-- 3. DE ONDE VEIO CADA LEAD
-- ------------------------------------------------------------
-- Alimenta o relatorio que responde se a prospeccao ativa vale o
-- tempo que consome: quantos leads ela gerou, quantos avancaram e
-- quantos fecharam, contra as origens passivas.
create index if not exists idx_leads_origem_etapa
  on leads (origem, etapa);
