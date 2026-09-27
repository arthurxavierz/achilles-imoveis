/**
 * Dados institucionais da Achilles.
 *
 * Ficam num arquivo so porque aparecem em muitos lugares: cabecalho,
 * rodape, JSON-LD do Google, link do WhatsApp, e-mail de contato. Mudar
 * o telefone aqui muda em todo o site.
 *
 * ATENCAO ANTES DE ENTREGAR AO CLIENTE: confira telefone, CRECI e
 * endereco. O CRECI e obrigatorio por lei em anuncio imobiliario
 * (Lei 6.530/78) e a ausencia dele pode gerar autuacao.
 */

export const SITE = {
  nome: 'Achilles Imóveis',
  nomeCurto: 'Achilles',
  descricao:
    'Imóveis de alto padrão, condomínios de luxo, áreas rurais e oportunidades de investimento ' +
    'em Uberlândia e região. Curadoria, exclusividade e atendimento consultivo.',
  tagline: 'Os melhores imóveis da região, com quem conhece cada endereço.',

  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://achillesimoveis.com.br',
  urlApp: process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.achillesimoveis.com.br',

  creci: process.env.NEXT_PUBLIC_CRECI ?? 'CRECI-MG 00000-J',
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? '5534999990000',
  email: process.env.NEXT_PUBLIC_EMAIL ?? 'contato@achillesimoveis.com.br',

  endereco: {
    logradouro: 'Av. Rondon Pacheco, 0000',
    complemento: 'Sala 000',
    bairro: 'Tibery',
    cidade: 'Uberlândia',
    uf: 'MG',
    cep: '38400-000',
  },

  redes: {
    instagram: 'https://instagram.com/achillesimoveis',
    facebook: 'https://facebook.com/achillesimoveis',
    linkedin: 'https://linkedin.com/company/achillesimoveis',
  },

  horario: 'Segunda a sexta, 8h às 18h. Sábado, 9h às 13h.',

  /**
   * Foto aérea da cidade, em tela cheia, atrás do título da home.
   *
   * Fica em variável de ambiente e não no código porque a imagem certa é
   * uma decisão do cliente, não do desenvolvedor: ela precisa ser uma
   * foto que a Achilles tenha direito de usar. Enquanto não houver uma, o
   * hero cai num gradiente noturno com silhueta de skyline desenhada em
   * CSS, que sustenta a página sem depender de banco de imagem.
   *
   * Para usar uma foto local, coloque o arquivo em apps/site/public e
   * aponte a variável para o caminho, por exemplo /hero-uberlandia.jpg.
   */
  heroImagem: process.env.NEXT_PUBLIC_HERO_IMAGEM ?? null,
} as const;

/** "(34) 99999-0000" a partir do numero cru do WhatsApp. */
export function telefoneVisivel(): string {
  const d = SITE.whatsapp.replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return SITE.whatsapp;
}

/** Link do WhatsApp com a mensagem ja escrita. */
export function linkWhatsApp(mensagem?: string): string {
  const texto = encodeURIComponent(
    mensagem ?? `Olá! Vim pelo site da ${SITE.nomeCurto} e gostaria de mais informações.`,
  );
  return `https://wa.me/${SITE.whatsapp}?text=${texto}`;
}

export const NAVEGACAO = [
  { rotulo: 'Imóveis', href: '/imoveis' },
  { rotulo: 'Condomínios', href: '/condominios' },
  { rotulo: 'Anuncie seu imóvel', href: '/anuncie' },
  { rotulo: 'Sobre a Achilles', href: '/sobre' },
  { rotulo: 'Contato', href: '/contato' },
] as const;

/**
 * Atalhos do painel de menu.
 *
 * Sao buscas prontas, e nao paginas. Quem abre o menu de uma imobiliaria
 * quase sempre quer um recorte, nao uma secao institucional: "casa em
 * condominio" resolve mais que "institucional".
 */
export const ATALHOS_MENU = [
  { rotulo: 'Apartamentos à venda', apoio: 'Uberlândia', href: '/imoveis?tipo=Apartamento' },
  { rotulo: 'Casas em condomínio', apoio: 'Alto padrão', href: '/imoveis?tipo=Casa+em+condom%C3%ADnio' },
  { rotulo: 'Coberturas', apoio: 'Seleção da casa', href: '/imoveis?tipo=Cobertura' },
  { rotulo: 'Terrenos e áreas', apoio: 'Investimento', href: '/imoveis?tipo=Terreno' },
  { rotulo: 'Fazendas e sítios', apoio: 'Rural', href: '/imoveis?tipo=Fazenda' },
  { rotulo: 'Salas e galpões', apoio: 'Comercial', href: '/imoveis?tipo=Sala+comercial' },
  { rotulo: 'Imóveis para alugar', apoio: 'Locação', href: '/imoveis?finalidade=locacao' },
  { rotulo: 'Super destaque', apoio: 'Curadoria', href: '/imoveis?destaque=1' },
] as const;

/**
 * Atalhos que aparecem embaixo da busca do hero.
 * Poucos e diretos: cada um vira uma consulta de uma linha.
 */
export const ATALHOS_HERO = [
  { rotulo: 'Apartamentos', href: '/imoveis?tipo=Apartamento' },
  { rotulo: 'Casas', href: '/imoveis?tipo=Casa' },
  { rotulo: 'Terrenos', href: '/imoveis?tipo=Terreno' },
  { rotulo: 'Rural', href: '/imoveis?tipo=Fazenda' },
  { rotulo: 'Comercial', href: '/imoveis?tipo=Sala+comercial' },
  { rotulo: 'Super destaque', href: '/imoveis?destaque=1' },
] as const;

/** Links institucionais do rodapé, agrupados por coluna. */
export const RODAPE_COLUNAS = [
  {
    titulo: 'Imóveis',
    itens: [
      { rotulo: 'Todos os imóveis', href: '/imoveis' },
      { rotulo: 'Condomínios', href: '/condominios' },
      { rotulo: 'Imóveis salvos', href: '/favoritos' },
      { rotulo: 'Cadastre seu imóvel', href: '/anuncie' },
    ],
  },
  {
    titulo: 'Serviços',
    itens: [
      { rotulo: 'Avaliação de imóvel', href: '/anuncie' },
      { rotulo: 'Financiamento e bancos', href: '/contato' },
      { rotulo: 'Consultoria de investimento', href: '/sobre' },
    ],
  },
  {
    titulo: 'Institucional',
    itens: [
      { rotulo: 'Sobre a Achilles', href: '/sobre' },
      { rotulo: 'Fale conosco', href: '/contato' },
      { rotulo: 'Política de privacidade', href: '/politica-de-privacidade' },
    ],
  },
] as const;

/** O endereço de produção. Só ele entra em buscador. */
export const DOMINIO_OFICIAL = 'achillesimoveis.com.br';

/**
 * O site está rodando no endereço definitivo?
 *
 * Decide se o robô pode indexar e se o `<meta robots>` sai como
 * `noindex`. A conta é feita sobre NEXT_PUBLIC_SITE_URL, que é a
 * mesma variável usada para montar as URLs canônicas — assim não há
 * um segundo interruptor que alguém possa esquecer de virar no dia da
 * publicação.
 */
export function ehDominioOficial(): boolean {
  try {
    const { hostname } = new URL(SITE.url);
    return hostname === DOMINIO_OFICIAL || hostname === `www.${DOMINIO_OFICIAL}`;
  } catch {
    return false;
  }
}
