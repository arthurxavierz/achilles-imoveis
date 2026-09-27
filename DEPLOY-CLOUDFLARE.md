# Publicar no Cloudflare Workers

São **dois Workers** a partir deste mesmo repositório, um por app:

| App | Pasta | Nome do Worker | Domínio |
| --- | --- | --- | --- |
| Site público | `apps/site` | `achilles-imoveis-site` | `imoveis.achillesmedia.com.br` |
| Painel de gestão | `apps/app` | `achilles-imoveis-gestao` | `gestaoimoveis.achillesmedia.com.br` |

O build é feito pelo [OpenNext](https://opennext.js.org/cloudflare), que empacota o
Next.js num Worker. As fotos do `next/image` são otimizadas pelo binding
`IMAGES` (Cloudflare Images), já declarado nos `wrangler.jsonc`.

---

## Caminho recomendado: build automático a cada push (Workers Builds)

Faça o processo abaixo **duas vezes**, uma para cada Worker. Só mudam três
campos: nome, diretório e comando.

1. No painel do Cloudflare: **Workers & Pages → Create → Workers → Import a repository**.
2. Conecte a conta do GitHub e escolha o repositório `arthurxavierz/achilles-imoveis`.
3. Preencha:

   | Campo | Site | Painel |
   | --- | --- | --- |
   | **Project name** | `achilles-imoveis-site` | `achilles-imoveis-gestao` |
   | **Path** (em *Advanced settings*) | `apps/site` | `apps/app` |
   | **Build command** | `npm install && npx opennextjs-cloudflare build` | igual |
   | **Deploy command** | `npx opennextjs-cloudflare deploy` | igual |

   > O **Project name** vira o nome do Worker e aparece no subdomínio
   > `*.workers.dev`. Os `wrangler.jsonc` não fixam nome de propósito: quem
   > manda é o nome do projeto. São dois projetos separados, então precisam
   > de nomes diferentes.
   >
   > O **Path** é o "root directory": a pasta de onde os comandos rodam.
   > É obrigatório apontar para `apps/site` ou `apps/app` — deixá-lo em `/`
   > faz o build rodar na raiz e falhar. O `npm install` roda nessa pasta,
   > sobe para a raiz sozinho (workspaces) e resolve `@imob/core`, `@imob/db`
   > e `@imob/demo`.

4. **Save and Deploy.** O primeiro build leva alguns minutos. A cada `git push`
   na branch `main`, os dois Workers reconstroem sozinhos.

---

## Ligar os domínios

Os dois domínios estão sob `achillesmedia.com.br`. Esse domínio precisa estar
como uma zona ativa no mesmo Cloudflare (em **Websites**). Com a zona no ar:

1. Abra o Worker → **Settings → Domains & Routes → Add → Custom Domain**.
2. **Site:** `imoveis.achillesmedia.com.br`.
3. **Painel:** `gestaoimoveis.achillesmedia.com.br`.

O Cloudflare cria o registro DNS e emite o certificado sozinho. Não precisa
mexer em CNAME na mão quando a zona é dele.

> No seu pedido o primeiro domínio veio escrito `achillesmdia` (sem o "e").
> Assumi que é `achillesmedia`, igual ao segundo. Se for outra zona mesmo,
> me avise.

---

## Variáveis de ambiente

Sem nenhuma variável, os dois apps sobem em **modo demonstração** (dados
simulados, painel abre sem login). É o suficiente para mostrar ao cliente.

Para conectar ao banco de verdade, cadastre em cada Worker
(**Settings → Variables and Secrets**) as chaves do `.env.example`. As
`NEXT_PUBLIC_*` precisam existir **no momento do build** — no fluxo de Workers
Builds acima, cadastre-as antes de disparar o build (ou refaça o build depois).

Mínimo para sair do modo demonstração:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      (marque como Secret; nos dois Workers)
SUPABASE_URL
NEXT_PUBLIC_SITE_URL=https://imoveis.achillesmedia.com.br
NEXT_PUBLIC_APP_URL=https://gestaoimoveis.achillesmedia.com.br
```

O site só é indexado pelo Google no domínio oficial definido em
`apps/site/src/lib/site.ts` (`DOMINIO_OFICIAL`). Em qualquer outro domínio ele
sai como `noindex`, então a demonstração não concorre com o site real na busca.

---

## Caminho alternativo: subir da sua máquina

Se preferir publicar direto do computador, sem a integração com o GitHub:

```bash
npm install
# Os wrangler.jsonc não fixam nome, então passe o nome do Worker aqui:
npm run cf:build:site && npx wrangler deploy --name achilles-imoveis-site  --cwd apps/site
npm run cf:build:app  && npx wrangler deploy --name achilles-imoveis-gestao --cwd apps/app
```

Na primeira vez o `wrangler` abre o navegador para você autorizar a conta.
Os domínios são ligados no painel do jeito descrito acima.

> **Nota sobre Windows:** o OpenNext avisa que não é totalmente compatível com
> Windows e recomenda WSL. Aqui o build e o teste local funcionaram, mas se
> algum `cf:build` falhar com erro de permissão em `.open-next`, feche os
> processos `workerd`/`wrangler` abertos e rode de novo. A integração com o
> GitHub (caminho recomendado) constrói no Linux e não tem esse risco.

---

## Limitação do modo demonstração no Cloudflare

No modo demonstração local, publicar um imóvel no painel aparecia no site,
porque os dois liam o mesmo arquivo em disco. No Workers **não há disco
gravável**: a base é recriada em memória a cada requisição a partir das
sementes. Ou seja, navegar por tudo funciona, mas alterações feitas no painel
não persistem entre requisições nem chegam ao site. Para o painel refletir o
site de verdade, use o Supabase (as variáveis acima). É uma limitação só do
modo demonstração — com banco, tudo grava normalmente.
