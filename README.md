# Achilles Imóveis

Plataforma da Achilles, em dois domínios que dividem o mesmo banco de dados:

| Domínio | O que é | Pasta |
| --- | --- | --- |
| `achillesimoveis.com.br` | Site público, vitrine de imóveis | `apps/site` |
| `app.achillesimoveis.com.br` | Sistema de gestão da equipe | `apps/app` |

O código compartilhado entre os dois vive em `packages/`. As regras de segurança e
as contas de comissão vivem no banco, em `supabase/migrations/`.

---

## Como está organizado

```
achilles-imoveis/
├── apps/
│   ├── site/            Next.js. Vitrine pública, SEO, formulários.
│   └── app/             Next.js. Painel da equipe, protegido por login.
├── packages/
│   ├── core/            Tipos e regras de negócio. Sem dependências.
│   └── db/              Clientes Supabase e consultas da vitrine.
├── assets/              Logo, símbolo e fotos institucionais. Fonte única.
├── supabase/
│   ├── migrations/      O banco, em ordem. Rode na sequência.
│   └── seed.sql         Imóveis de exemplo para a primeira carga.
└── legacy/prototipo/    A versão anterior, preservada para consulta.
```

**Por que dois apps e não um só:** o site precisa ser rápido, indexável e público;
o painel precisa ser protegido, denso e nunca aparecer em buscador. São exigências
opostas. Separar permite que o site fique estático no CDN enquanto o painel exige
sessão em toda requisição.

---

## Primeira instalação

### 1. Dependências

```bash
npm install
```

Instala tudo de uma vez. Os pacotes internos (`@imob/core`, `@imob/db`) são
resolvidos pelos workspaces do npm, sem publicação em registro.

### 2. Banco de dados

No painel do Supabase, em **SQL Editor**, execute os arquivos **na ordem**:

```
supabase/migrations/0001_core.sql        tabelas
supabase/migrations/0002_funcoes.sql     funções, gatilhos, auditoria
supabase/migrations/0003_rls.sql         permissões (o mais importante)
supabase/migrations/0004_locacao.sql     estrutura de locação
supabase/migrations/0005_storage.sql     buckets de fotos
supabase/migrations/0006_agenda.sql      agenda da equipe
supabase/migrations/0007_vendas.sql      vendas, comissão e margem
supabase/migrations/0008_gestao.sql      administração de equipe e origem de lead
supabase/migrations/0009_vitrine.sql     condomínios, importação por XML e índices de escala
supabase/migrations/0010_proprietarios.sql  proprietário obrigatório, índices e view de carteira
supabase/migrations/0011_prospeccao.sql  origem de lead "prospecção" e índices
supabase/seed.sql                        imóveis de exemplo (opcional)
supabase/conferir.sql                    confere se tudo entrou; não altera nada
```

Rode **um arquivo por vez**. O SQL Editor executa tudo numa transação: se
você colar os dez juntos e o sétimo falhar, os seis anteriores voltam atrás
e fica difícil saber onde o banco parou.

Não pule o `0003`. Sem ele, o banco fica aberto: qualquer pessoa com a chave
pública conseguiria ler dados de proprietários e comissões.

Ao final, rode `supabase/conferir.sql`. Ele não altera nada: devolve seis
linhas dizendo o que entrou e o que faltou. É a diferença entre descobrir
uma migration incompleta agora ou daqui a três semanas.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` na raiz e preencha. As chaves ficam em
**Supabase → Settings → API**.

A regra que não pode ser quebrada: tudo que começa com `NEXT_PUBLIC_` vai dentro
do JavaScript que o visitante baixa. A `SUPABASE_SERVICE_ROLE_KEY` ignora todas
as regras de permissão e **nunca** pode receber esse prefixo.

### 4. Rodar localmente

```bash
npm run dev:site    # http://localhost:3000
npm run dev:app     # http://localhost:3001
```

### 5. Criar o primeiro usuário

O sistema não tem tela de cadastro, de propósito: acesso a dado de cliente é
concedido, não solicitado.

1. Supabase → **Authentication → Users → Add user**, com e-mail e senha.
2. O gatilho `novo_usuario` cria o perfil automaticamente, como `corretor`.
3. Para promover a administrador, no SQL Editor:

```sql
update perfis
   set papel = 'admin',
       permissoes = '{"imoveis":true,"leads":true,"financeiro":true,"usuarios":true}'
 where email = 'voce@achillesimoveis.com.br';
```

---

## Publicar no Netlify

São **dois sites** apontando para o mesmo repositório. Em cada um:

| Campo | Site público | Painel |
| --- | --- | --- |
| Base directory | *(vazio)* | *(vazio)* |
| Package directory | `apps/site` | `apps/app` |
| Build command | *(vem do netlify.toml)* | *(vem do netlify.toml)* |

Deixar o **Base directory vazio** é o que faz o `npm install` rodar na raiz e
enxergar os workspaces. Se você apontar a base para `apps/site`, o install roda
dentro da pasta, não encontra `@imob/core` e o build quebra.

Cadastre as variáveis de ambiente nos dois sites. A `SUPABASE_SERVICE_ROLE_KEY`
é necessária nos dois: no site público, que grava os leads recebidos pelo
formulário, e no painel, que envia o convite de acesso e remove o usuário quando
alguém sai da equipe. As duas operações escrevem em `auth.users`, que nenhuma
sessão de usuário alcança. A chave nunca chega ao navegador: `criarClienteAdmin()`
derruba o processo se for chamada onde exista `window`.

### DNS

```
achillesimoveis.com.br       → site público
www.achillesimoveis.com.br   → redireciona para o apex
app.achillesimoveis.com.br   → painel
```

---

## Decisões que valem conhecer antes de mexer

**A segurança está no banco, não na interface.** Cada tabela tem Row Level
Security. Um corretor só alcança a própria carteira porque o Postgres recusa o
resto, não porque a tela esconde. As checagens em `packages/core/src/regras.ts`
existem apenas para o botão não aparecer quando a ação seria negada.

**A vitrine lê uma view, nunca a tabela.** `vitrine_imoveis` já exclui matrícula,
proprietário e observações internas. Um `select *` distraído no site não tem como
vazar dado de captação.

**As contas de comissão são colunas geradas.** Comissão bruta, parte da casa,
parte do consultor e margem são calculadas pelo Postgres (migration `0007`). O
cálculo em `packages/core/src/vendas.ts` serve para mostrar o resultado enquanto
a pessoa digita, e usa a mesma sequência de arredondamento. Se algum dia
divergirem, quem está errado é o TypeScript.

**Datas da agenda são `timestamptz`, sempre.** O fuso de referência é
`America/Sao_Paulo`. Um compromisso das 21h gravado sem fuso apareceria no dia
seguinte para um servidor em UTC.

**A vitrine é preta, branca e ouro, e o ouro é raro.** O preto faz numa
vitrine de alto padrão o que a parede escura faz numa galeria: a foto do
imóvel vira a única coisa iluminada da tela. Se o ouro marcar botão,
borda, título e ícone ao mesmo tempo, deixa de significar sofisticação e
vira ruído de promoção. A regra em `apps/site/src/app/globals.css` é um
elemento em ouro por bloco visual.

**Condomínio é entidade, não texto no imóvel.** Boa parte da procura de
alto padrão começa pelo nome do empreendimento, e o XML do portal repete
esse nome em cada unidade, com grafias diferentes. Sem a tabela
`condominios` para ancorar, o site mostraria "Vista Galassi" e
"Vista Galassi " como dois lugares distintos.

**A importação reconcilia por `referencia_externa`.** É o código do
anúncio no sistema de origem. Casar por título ou endereço criaria um
imóvel novo a cada sincronização, porque o portal reescreve o título toda
vez que alguém edita o anúncio. Publicar, destacar e definir o consultor
continuam sendo decisão da gestão: uma reimportação nunca repõe no ar o
que alguém tirou.

**Papel e permissão não passam por UPDATE.** O `grant` de coluna da migration
`0003` deixa cada pessoa editar apenas os próprios dados de contato. Papel,
permissões e situação de acesso só mudam pela função `definir_acesso()`, que
confere se quem chama é administrador e recusa que alguém rebaixe ou desative a
própria conta. A tela de equipe chama essa função; não existe caminho por fora.

**Remover alguém exige transferir a carteira.** `transferir_carteira()` move
leads, imóveis, negócios em aberto e compromissos futuros para quem assume.
Negócio já concluído não troca de dono: a comissão daquele mês pertence a quem
vendeu, mesmo depois do desligamento.

**Os indicadores são calculados em memória.** `packages/core/src/indicadores.ts`
recebe as listas e devolve os números. São seis recortes sobre os mesmos
registros, e fazer seis consultas agregadas obrigaria a repetir em SQL uma regra
que já existe em TypeScript, com o risco clássico de as duas discordarem no dia
em que alguém mudar só uma delas. O ponto de troca, quando o volume pedir, é
`apps/app/src/lib/indicadores.ts`, sem tocar nas telas.

**Não existe imóvel sem proprietário.** A exigência vale em três
camadas: o `required` do formulário, a validação da ação de servidor em
`apps/app/src/app/(painel)/imoveis/acoes.ts`, e um gatilho no banco
(migration `0010`). A do formulário é conveniência; a do servidor é a
que vale; a do banco é a que sobrevive a um script que alguém rodar
direto no Postgres. Imóvel sem proprietário é imóvel que ninguém sabe de
quem é quando aparece uma proposta — não há quem autorize a visita, quem
assine, nem de onde sair a comissão.

A exceção é a importação por XML, que tem passe livre no gatilho: o feed
do portal não carrega dado de captação, e travar ali faria a
sincronização inteira falhar por um dado que a origem não envia. Esses
registros entram marcados e aparecem no filtro "sem proprietário" da
carteira, para regularização.

**A marca vive em `assets/`, e só lá.** São dois apps usando a mesma
logo. Um original só, copiado para o `public/` de cada app pelo
`scripts/sincronizar-assets.mjs`, que roda sozinho antes de cada `dev` e
de cada `build`. O símbolo é pintado por máscara CSS, não por um SVG
colorido: o mesmo arquivo sai ouro no site e branco no painel, e não
viram dois arquivos que um dia divergem.

**A prospecção não guarda o que achou.** A tela busca empresas no Google
Places e mostra o resultado, mas nada disso vai para o banco. O resultado
é refazível pela mesma consulta a qualquer momento, e guardá-lo criaria
uma segunda lista de contatos para manter em dia ao lado do funil — com o
risco clássico de as duas discordarem sobre quem já foi abordado. O que se
guarda é a decisão de abordar, e ela vira lead, com dono e histórico.

O score dali não é o mesmo do Achilles Command, de onde a ideia veio. Lá
ele responde "esta empresa precisa de site?"; aqui, "esta empresa é
candidata a um imóvel comercial?". Os sinais pesam ao contrário: empresa
grande e bem posicionada é cliente ruim para quem vende site e ótimo
candidato a sala maior.

**Concluir uma venda tem efeito em cascata.** O imóvel sai da vitrine, o lead vai
para "fechado" e a comissão entra no caixa. É um gatilho no banco, não uma
sequência de chamadas do front, justamente para não depender de a interface
lembrar de fazer as três coisas.

---

## O que ainda não existe

Deixado como ponto de encaixe, com a estrutura já preparada:

- **Notificação de compromisso** por WhatsApp e e-mail. As colunas
  `lembrete_minutos`, `canais` e `notificado_em` já existem em `compromissos`,
  e há índice para a fila de envio.
- **Upload de fotos** pelo painel. Os buckets e as políticas estão criados em
  `0005_storage.sql`.
- **Leitura do XML** do portal. A estrutura de destino está pronta:
  `importar_imovel()` na migration `0009`, e `importarLote()` com
  `normalizarRegistro()` em `packages/db/src/importacao.ts`. Falta o
  adaptador que lê o arquivo e entrega os registros normalizados, que
  muda conforme o portal de origem.
- **Exportação em XML** para ZAP, VivaReal e OLX.
- **Assistente de IA** para descrição de imóvel e triagem de lead.

---

## Comandos

```bash
npm run dev:site      # site público em desenvolvimento
npm run dev:app       # painel em desenvolvimento
npm run build:site    # build de produção do site
npm run build:app     # build de produção do painel
npm run typecheck     # verificação de tipos em todos os pacotes
npm run db:types      # regenera os tipos a partir do banco (requer Supabase CLI)
npm run assets        # copia assets/ para o public/ dos dois apps (roda sozinho no dev e no build)
```

No Windows, se o build falhar com erro de alocação de memória:

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build:app
```
