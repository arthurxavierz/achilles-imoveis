# Assets da marca

Imagens que pertencem à **Achilles**, não a um imóvel: logo, símbolo, favicon
e as fotos institucionais do site.

Foto de imóvel **não entra aqui**. Ela é conteúdo cadastrado, muda toda
semana, pertence a um registro do banco e vive no Supabase Storage
(bucket `imoveis`, criado em `supabase/migrations/0005_storage.sql`).
O que mora nesta pasta é o contrário: muda uma vez por ano, é igual para
todo mundo e precisa estar no repositório para o build funcionar sem
depender de rede.

```
assets/
├── marca/
│   ├── simbolo.svg    O "B" sozinho. Herda currentColor.
│   └── favicon.svg    O "B" em ouro sobre preto, com margem.
└── site/
    └── hero-uberlandia.jpg  Foto de fundo da home. (ver abaixo)
```

## Por que uma pasta na raiz e não `public/` de cada app

São dois apps, `apps/site` e `apps/app`, e os dois usam a mesma logo. Se
cada um tivesse a própria cópia, uma trocaria e a outra não — e o dia em
que a Achilles mudar a marca, alguém vai esquecer metade dos lugares.

Aqui existe um original só. O script `scripts/sincronizar-assets.mjs`
copia esta pasta para `apps/site/public/assets` e `apps/app/public/assets`
antes de cada `dev` e de cada `build`, automaticamente — os dois destinos
estão no `.gitignore`, porque são cópia, não fonte.

Para adicionar uma imagem: solte o arquivo aqui e use o caminho
`/assets/<pasta>/<arquivo>` no código. Nada mais.

## O símbolo não tem cor

`simbolo.svg` é desenhado com `stroke="currentColor"`. Ele fica
ouro no site, branco no menu do painel e preto no documento impresso
sem precisar de três arquivos — basta a cor do texto ao redor. Um
arquivo com a cor cravada viraria três, e três viram duas
desatualizadas.

## A foto do hero

`assets/site/hero-uberlandia.jpg` é a foto aérea que fica atrás do
título da home. **Ela não está no repositório**: é uma foto que precisa
de direito de uso, e essa é uma decisão do cliente, não do
desenvolvedor.

Enquanto o arquivo não existir, o hero cai sozinho num gradiente noturno
com silhueta de skyline desenhada em CSS — a home continua de pé, sem
buraco e sem imagem quebrada. Para ligar a foto, basta colocar o arquivo
com esse nome exato nesta pasta.

Peso: a home carrega essa imagem antes de qualquer outra coisa. Acima de
600 KB ela atrasa a primeira tela em conexão de celular. Exporte em JPEG
com qualidade 80 e largura máxima de 2400px.
