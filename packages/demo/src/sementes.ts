/**
 * Dados de partida da demonstração.
 *
 * As datas são geradas em relação ao dia de hoje, e não fixas: assim a
 * agenda sempre tem compromissos no mês que você está olhando, e o
 * financeiro sempre tem vendas no mês corrente, independentemente de
 * quando isto for aberto.
 */

import type {
  Compromisso,
  Condominio,
  Foto,
  Imovel,
  Interacao,
  Lead,
  Perfil,
  Proprietario,
  Venda,
  VendaParcela,
} from '@imob/core';
import { slugify } from '@imob/core';

export interface BaseDemo {
  versao: number;
  perfis: Perfil[];
  condominios: Condominio[];
  proprietarios: Proprietario[];
  imoveis: Imovel[];
  compromissos: Compromisso[];
  vendas: Venda[];
  parcelas: VendaParcela[];
  leads: Lead[];
  interacoes: Interacao[];
  /**
   * Fotos dos imoveis.
   *
   * Entrou depois das outras listas, quando o painel ganhou gestao de
   * album. Por isso a versao da base subiu junto: arquivo antigo nao tem
   * o campo, e ler undefined aqui quebraria a aba de fotos.
   */
  fotos: Foto[];
}

/** A versão sobe quando a estrutura muda, para o arquivo ser refeito. */
export const VERSAO_BASE = 9;

// ------------------------------------------------------------
// AJUDANTES DE DATA
// ------------------------------------------------------------

const HOJE = new Date();

function dia(deslocamento: number): string {
  const d = new Date(HOJE);
  d.setDate(d.getDate() + deslocamento);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Instante local convertido para UTC, no fuso de Uberlândia (-03). */
function instante(deslocamentoDias: number, hora: number, minuto = 0): string {
  const d = new Date(HOJE);
  d.setDate(d.getDate() + deslocamentoDias);
  // Uberlândia não observa horário de verão desde 2019, então o
  // deslocamento é fixo em três horas.
  return new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hora + 3, minuto, 0),
  ).toISOString();
}

function idFalso(prefixo: string, n: number): string {
  const base = prefixo.padEnd(8, '0').slice(0, 8);
  return `${base}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

// ------------------------------------------------------------
// EQUIPE
// ------------------------------------------------------------

const AGORA = new Date().toISOString();

export const ID_ADMIN = idFalso('aaaaaaaa', 1);
export const ID_GESTOR = idFalso('bbbbbbbb', 2);
export const ID_CORRETOR = idFalso('cccccccc', 3);
export const ID_CORRETOR_2 = idFalso('dddddddd', 4);

function perfil(
  id: string,
  nome: string,
  papel: Perfil['papel'],
  email: string,
  telefone: string,
  creci: string | null,
  meta: number,
  permissoes: Partial<Perfil['permissoes']> = {},
): Perfil {
  return {
    id,
    nome,
    email,
    telefone,
    creci,
    avatar_url: null,
    papel,
    permissoes: {
      imoveis: permissoes.imoveis ?? true,
      leads: permissoes.leads ?? true,
      financeiro: permissoes.financeiro ?? false,
      usuarios: permissoes.usuarios ?? false,
    },
    meta_mensal: meta,
    ativo: true,
    criado_em: AGORA,
    atualizado_em: AGORA,
  };
}

const PERFIS: Perfil[] = [
  perfil(ID_ADMIN, 'Diego Martins', 'admin', 'diego@achillesimoveis.com.br', '34999110001', 'CRECI-MG 12345', 3000000, {
    financeiro: true,
    usuarios: true,
  }),
  perfil(ID_GESTOR, 'Larissa Prado', 'gestor', 'larissa@achillesimoveis.com.br', '34999110002', 'CRECI-MG 23456', 2200000, {
    financeiro: true,
  }),
  perfil(ID_CORRETOR, 'Rafael Nunes', 'corretor', 'rafael@achillesimoveis.com.br', '34999110003', 'CRECI-MG 34567', 1500000),
  perfil(ID_CORRETOR_2, 'Camila Souza', 'corretor', 'camila@achillesimoveis.com.br', '34999110004', 'CRECI-MG 45678', 1200000),
];

// ------------------------------------------------------------
// CONDOMÍNIOS
// ------------------------------------------------------------

interface RascunhoCondominio {
  nome: string;
  bairro: string;
  cidade?: string;
  uf?: string;
  construtora: string;
  entrega: number;
  luxo: boolean;
  destaque: boolean;
  cover: string;
  descricao: string;
  lazer: string[];
}

const RASCUNHOS_CONDOMINIO: RascunhoCondominio[] = [
  {
    nome: 'Condomínio Splêndido',
    bairro: 'Morada da Colina',
    construtora: 'Vértice Empreendimentos',
    entrega: 2021,
    luxo: true,
    destaque: true,
    cover: 'cv1',
    descricao:
      'Torre única de vinte andares com quatro unidades por pavimento, hall privativo e vista aberta para o Parque do Sabiá. Projeto arquitetônico assinado por escritório paulista, com fachada em pele de vidro e brises verticais que reduzem a incidência de sol da tarde.',
    lazer: ['Piscina aquecida', 'Espaço gourmet', 'Academia', 'Sauna', 'Salão de festas', 'Portaria 24h'],
  },
  {
    nome: 'Jardins Gênova',
    bairro: 'Jardim Karaíba',
    construtora: 'Vitalis Construtora',
    entrega: 2023,
    luxo: true,
    destaque: true,
    cover: 'cv2',
    descricao:
      'Condomínio de casas com lotes a partir de 600 m2, ruas arborizadas e clube próprio. A implantação preservou o bosque nativo do terreno, que virou a área de caminhada interna.',
    lazer: ['Clube privativo', 'Quadra de tênis', 'Piscina', 'Playground', 'Pista de caminhada', 'Portaria 24h'],
  },
  {
    nome: 'Varandas Sul',
    bairro: 'Vigilato Pereira',
    construtora: 'Sul Incorporadora',
    entrega: 2022,
    luxo: true,
    destaque: true,
    cover: 'cv3',
    descricao:
      'Apartamentos garden e coberturas com varanda integrada de ponta a ponta. As unidades de térreo têm quintal privativo com churrasqueira, e as coberturas contam com piscina individual.',
    lazer: ['Piscina', 'Espaço gourmet', 'Academia', 'Coworking', 'Pet place'],
  },
  {
    nome: 'Condomínio Arts',
    bairro: 'Granja Marileusa',
    construtora: 'Horizonte Urbanismo',
    entrega: 2020,
    luxo: true,
    destaque: true,
    cover: 'cv4',
    descricao:
      'Loteamento fechado dentro do distrito de inovação da cidade, com infraestrutura subterrânea, ciclovia interna e portaria com reconhecimento facial.',
    lazer: ['Portaria 24h', 'Ciclovia interna', 'Praça central', 'Quadra poliesportiva'],
  },
  {
    nome: 'Edifício Chess',
    bairro: 'Santa Mônica',
    construtora: 'Rezende Engenharia',
    entrega: 2024,
    luxo: true,
    destaque: false,
    cover: 'cv5',
    descricao:
      'Torre de apartamentos compactos e coberturas duplex, com rooftop aberto ao morador e vista para a Praça Sérgio Pacheco.',
    lazer: ['Rooftop', 'Academia', 'Lavanderia coletiva', 'Bicicletário', 'Portaria 24h'],
  },
  {
    nome: 'Edifício Brasil',
    bairro: 'Osvaldo Rezende',
    construtora: 'Construtora Umuarama',
    entrega: 2019,
    luxo: false,
    destaque: false,
    cover: 'cv6',
    descricao:
      'Prédio residencial no coração do bairro, a duas quadras da avenida João Naves. Plantas de dois e três quartos com suíte e vaga coberta.',
    lazer: ['Salão de festas', 'Playground', 'Portaria 24h'],
  },
  {
    nome: 'Vista Vértice',
    bairro: 'Tibery',
    construtora: 'Vértice Empreendimentos',
    entrega: 2023,
    luxo: false,
    destaque: true,
    cover: 'cv1',
    descricao:
      'Duas torres com apartamentos de três quartos e área de lazer completa no pavimento intermediário, sem perder a vista das unidades superiores.',
    lazer: ['Piscina', 'Academia', 'Salão de festas', 'Espaço gourmet', 'Portaria 24h'],
  },
  {
    nome: 'Edge Corporate',
    bairro: 'Granja Marileusa',
    construtora: 'Torre Atlântica',
    entrega: 2021,
    luxo: true,
    destaque: false,
    cover: 'cv2',
    descricao:
      'Edifício corporativo com certificação de eficiência energética, lajes divisíveis a partir de 45 m2 e auditório compartilhado no térreo.',
    lazer: ['Auditório', 'Estacionamento coberto', 'Segurança 24h', 'Praça de alimentação'],
  },
  {
    nome: 'Reserva Miranda',
    bairro: 'Jardim Karaíba',
    construtora: 'Grupo Aurora',
    entrega: 2018,
    luxo: true,
    destaque: false,
    cover: 'cv3',
    descricao:
      'Condomínio de alto padrão com lotes amplos, lago artificial e clube com restaurante. Referência de segurança na zona sul da cidade.',
    lazer: ['Clube privativo', 'Lago', 'Quadra de tênis', 'Campo de futebol', 'Portaria 24h'],
  },
  {
    nome: 'Vega Studios',
    bairro: 'Cazeca',
    construtora: 'Vega Incorporadora',
    entrega: 2024,
    luxo: false,
    destaque: false,
    cover: 'cv4',
    descricao:
      'Studios de 26 a 42 m2 voltados a investidor e a quem estuda na região central. Unidades entregues mobiliadas e prontas para locação.',
    lazer: ['Coworking', 'Lavanderia coletiva', 'Rooftop', 'Bicicletário'],
  },
  {
    nome: 'Residencial Íris',
    bairro: 'Shopping Park',
    construtora: 'Íris Construtora',
    entrega: 2025,
    luxo: false,
    destaque: false,
    cover: 'cv5',
    descricao:
      'Lançamento com apartamentos de dois quartos, área de lazer completa e financiamento direto com a construtora durante a obra.',
    lazer: ['Piscina', 'Playground', 'Salão de festas', 'Quadra poliesportiva'],
  },
  {
    nome: 'Reserva do Cerrado',
    bairro: 'Zona Rural',
    cidade: 'Indianópolis',
    construtora: 'Cerrado Empreendimentos',
    entrega: 2022,
    luxo: true,
    destaque: true,
    cover: 'cv6',
    descricao:
      'Condomínio de chácaras às margens do Rio Araguari, com acesso à represa, marina própria e lotes de 5.000 m2. Cinquenta minutos de Uberlândia por asfalto.',
    lazer: ['Marina', 'Piscina', 'Campo de futebol', 'Trilha ecológica', 'Portaria 24h'],
  },
];

const CONDOMINIOS: Condominio[] = RASCUNHOS_CONDOMINIO.map((r, i) => ({
  id: idFalso('77777777', i + 1),
  slug: slugify(`${r.nome}-${r.cidade ?? 'Uberlândia'}`),
  nome: r.nome,
  descricao: r.descricao,

  bairro: r.bairro,
  cidade: r.cidade ?? 'Uberlândia',
  uf: r.uf ?? 'MG',
  logradouro: null,
  latitude: null,
  longitude: null,

  construtora: r.construtora,
  ano_entrega: r.entrega,
  luxo: r.luxo,
  destaque: r.destaque,
  publicado: true,

  lazer: r.lazer,
  capa: null,
  galeria: [],
  cover: r.cover,

  meta_titulo: null,
  meta_descricao: null,

  criado_em: AGORA,
  atualizado_em: AGORA,
}));

// ------------------------------------------------------------
// IMÓVEIS
// ------------------------------------------------------------

interface RascunhoImovel {
  titulo: string;
  descricao: string;
  tipo: string;
  bairro: string;
  valor: number;
  condominio: number;
  iptu: number;
  areaUtil: number;
  areaTotal: number;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  caracteristicas: string[];
  destaque: boolean;
  publicado: boolean;
  status: Imovel['status'];
  cover: string;
  corretor: string;
  ano?: number;
}

const RASCUNHOS: RascunhoImovel[] = [
  {
    titulo: 'Cobertura Duplex Morada da Colina',
    descricao:
      'Cobertura duplex com terraço gourmet, piscina privativa e vista panorâmica para o Parque do Sabiá. Acabamento em porcelanato importado, automação completa e elevador privativo.\n\nAndar único no último pavimento, com quatro suítes e living integrado de pé-direito duplo. A planta foi reformulada em 2023 por escritório de arquitetura local, ampliando o estar e criando uma adega climatizada integrada ao espaço gourmet.',
    tipo: 'Cobertura',
    bairro: 'Morada da Colina',
    valor: 2850000,
    condominio: 2400,
    iptu: 980,
    areaUtil: 412,
    areaTotal: 468,
    quartos: 4,
    suites: 4,
    banheiros: 5,
    vagas: 4,
    caracteristicas: ['Piscina privativa', 'Espaço gourmet', 'Automação', 'Elevador privativo', 'Vista panorâmica', 'Adega climatizada'],
    destaque: true,
    publicado: true,
    status: 'disponivel',
    cover: 'cv2',
    corretor: ID_ADMIN,
    ano: 2018,
  },
  {
    titulo: 'Residência Alto Padrão Jardim Karaíba',
    descricao:
      'Residência assinada em condomínio fechado, com projeto paisagístico, adega climatizada, home theater e espaço de bem-estar com sauna e piscina aquecida.\n\nCinco suítes, sendo a master com closet duplo e varanda privativa voltada para o jardim interno. Terreno de mil metros com área construída de 680, distribuída em dois pavimentos e um subsolo de lazer.',
    tipo: 'Casa',
    bairro: 'Jardim Karaíba',
    valor: 3200000,
    condominio: 1250,
    iptu: 1800,
    areaUtil: 680,
    areaTotal: 1000,
    quartos: 5,
    suites: 5,
    banheiros: 6,
    vagas: 6,
    caracteristicas: ['Condomínio fechado', 'Piscina aquecida', 'Sauna', 'Home theater', 'Adega climatizada', 'Paisagismo assinado'],
    destaque: true,
    publicado: true,
    status: 'disponivel',
    cover: 'cv3',
    corretor: ID_GESTOR,
    ano: 2016,
  },
  {
    titulo: 'Casa Contemporânea Granja Marileusa',
    descricao:
      'Casa contemporânea no bairro planejado mais premiado de Uberlândia. Arquitetura de linhas retas, pé-direito duplo e integração total com a área externa.\n\nInfraestrutura de fibra ótica, ciclovia e parque linear na porta. O condomínio conta com portaria com reconhecimento facial e área de convívio com quadra e playground.',
    tipo: 'Casa',
    bairro: 'Granja Marileusa',
    valor: 2650000,
    condominio: 890,
    iptu: 1400,
    areaUtil: 520,
    areaTotal: 700,
    quartos: 4,
    suites: 3,
    banheiros: 5,
    vagas: 4,
    caracteristicas: ['Condomínio fechado', 'Piscina', 'Espaço gourmet', 'Aceita pet', 'Portaria 24h'],
    destaque: true,
    publicado: true,
    status: 'disponivel',
    cover: 'cv5',
    corretor: ID_CORRETOR,
    ano: 2021,
  },
  {
    titulo: 'Cobertura Santa Mônica',
    descricao:
      'Cobertura com rooftop e vista aberta, próxima à Universidade Federal. Excelente liquidez, ideal para moradia de alto padrão ou investimento.\n\nReformada em 2024, com marcenaria planejada em todos os ambientes e sistema de aquecimento solar.',
    tipo: 'Cobertura',
    bairro: 'Santa Mônica',
    valor: 1980000,
    condominio: 980,
    iptu: 720,
    areaUtil: 288,
    areaTotal: 320,
    quartos: 4,
    suites: 2,
    banheiros: 4,
    vagas: 3,
    caracteristicas: ['Rooftop', 'Vista panorâmica', 'Espaço gourmet', 'Academia'],
    destaque: false,
    publicado: true,
    status: 'reservado',
    cover: 'cv6',
    corretor: ID_CORRETOR,
    ano: 2012,
  },
  {
    titulo: 'Apartamento Garden Vigilato Pereira',
    descricao:
      'Garden com jardim privativo integrado ao living. Plantas amplas, varanda gourmet com churrasqueira e infraestrutura de lazer completa no condomínio.\n\nDuas vagas cobertas e depósito privativo. Condomínio com piscina aquecida, salão de festas e espaço coworking.',
    tipo: 'Apartamento',
    bairro: 'Vigilato Pereira',
    valor: 1450000,
    condominio: 1100,
    iptu: 540,
    areaUtil: 210,
    areaTotal: 260,
    quartos: 3,
    suites: 1,
    banheiros: 3,
    vagas: 2,
    caracteristicas: ['Jardim privativo', 'Varanda gourmet', 'Churrasqueira', 'Academia'],
    destaque: false,
    publicado: true,
    status: 'disponivel',
    cover: 'cv4',
    corretor: ID_CORRETOR_2,
    ano: 2019,
  },
  {
    titulo: 'Torre Atlântica Corporate',
    descricao:
      'Laje corporativa na Torre Atlântica, o endereço de negócios mais valorizado da cidade. Infraestrutura completa, heliponto, certificação internacional e segurança 24 horas.\n\nIdeal para escritório de advocacia, consultoria ou sede regional. Entrega com piso elevado e forro modular instalados.',
    tipo: 'Sala comercial',
    bairro: 'Granja Marileusa',
    valor: 890000,
    condominio: 1800,
    iptu: 620,
    areaUtil: 96,
    areaTotal: 96,
    quartos: 0,
    suites: 0,
    banheiros: 2,
    vagas: 3,
    caracteristicas: ['Portaria 24h', 'Academia'],
    destaque: true,
    publicado: true,
    status: 'disponivel',
    cover: 'cv1',
    corretor: ID_GESTOR,
    ano: 2022,
  },
  {
    titulo: 'Studios Francisco Galassi',
    descricao:
      'Studios de alto giro no coração da cidade. Retorno inteligente para investidores, com gestão de locação por temporada, rooftop exclusivo e coworking no térreo.\n\nUnidade entregue mobiliada e pronta para gerar renda desde o primeiro mês.',
    tipo: 'Studio',
    bairro: 'Osvaldo Rezende',
    valor: 325000,
    condominio: 480,
    iptu: 210,
    areaUtil: 38,
    areaTotal: 41,
    quartos: 1,
    suites: 0,
    banheiros: 1,
    vagas: 1,
    caracteristicas: ['Mobiliado', 'Rooftop', 'Academia', 'Aceita pet'],
    destaque: false,
    publicado: true,
    status: 'disponivel',
    cover: 'cv5',
    corretor: ID_CORRETOR_2,
    ano: 2023,
  },
  {
    titulo: 'Apartamento Alto Umuarama',
    descricao:
      'Apartamento em prédio novo, planta inteligente e boa ventilação cruzada. Região em franca valorização, a cinco minutos do centro empresarial.\n\nEntrega prevista com armários planejados na cozinha e nos dormitórios.',
    tipo: 'Apartamento',
    bairro: 'Alto Umuarama',
    valor: 780000,
    condominio: 620,
    iptu: 380,
    areaUtil: 118,
    areaTotal: 134,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    vagas: 2,
    caracteristicas: ['Varanda gourmet', 'Academia', 'Portaria 24h'],
    destaque: false,
    publicado: true,
    status: 'disponivel',
    cover: 'cv1',
    corretor: ID_CORRETOR,
    ano: 2024,
  },
  {
    titulo: 'Casa Térrea Tibery',
    descricao:
      'Casa térrea reformada, com quintal amplo e área gourmet coberta. Rua tranquila e arborizada, perto de escolas e do comércio do bairro.\n\nBoa opção para quem quer espaço externo sem abrir mão da localização central.',
    tipo: 'Casa',
    bairro: 'Tibery',
    valor: 690000,
    condominio: 0,
    iptu: 310,
    areaUtil: 165,
    areaTotal: 300,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    vagas: 2,
    caracteristicas: ['Churrasqueira', 'Espaço gourmet', 'Aceita pet'],
    destaque: false,
    publicado: true,
    status: 'disponivel',
    cover: 'cv3',
    corretor: ID_CORRETOR_2,
    ano: 2005,
  },
  {
    // Fora do ar de propósito: serve para você testar o botão de
    // publicar no painel e ver o imóvel surgir no site.
    titulo: 'Apartamento Novo Mundo',
    descricao:
      'Apartamento em fase de captação, ainda sem fotografia profissional. Bom custo por metro quadrado e condomínio enxuto.\n\nEste imóvel está fora da vitrine: use o botão de publicar no painel para vê-lo aparecer no site.',
    tipo: 'Apartamento',
    bairro: 'Santa Mônica',
    valor: 520000,
    condominio: 450,
    iptu: 240,
    areaUtil: 92,
    areaTotal: 104,
    quartos: 3,
    suites: 1,
    banheiros: 2,
    vagas: 1,
    caracteristicas: ['Portaria 24h', 'Aceita pet'],
    destaque: false,
    publicado: false,
    status: 'disponivel',
    cover: 'cv6',
    corretor: ID_CORRETOR,
    ano: 2015,
  },
];

// ------------------------------------------------------------
// PROPRIETARIOS
// ------------------------------------------------------------

/**
 * Quem entregou cada imovel a Achilles.
 *
 * Os dez primeiros correspondem, na ordem, aos dez imoveis curados
 * logo abaixo — PROPRIETARIOS[i] e o dono de IMOVEIS_CURADOS[i]. A
 * correspondencia por indice existe para os nomes baterem com os das
 * vendas ja registradas: a venda da casa da Granja Marileusa cita
 * "Espolio Marileusa Participacoes" como proprietario, e seria
 * estranho a ficha do imovel apontar outra pessoa.
 *
 * A mistura de pessoa fisica, espolio e construtora e proposital. Sao
 * os tres casos que a operacao encontra de verdade, e cada um se
 * comporta diferente na hora da documentacao: o espolio depende de
 * inventario, a construtora tem procurador, e a pessoa fisica assina
 * sozinha. Quem for desenhar a tela de captacao precisa ver os tres.
 */
/*
 * Os documentos abaixo sao propositalmente invalidos: dígito repetido
 * (111.111.111-11 e afins) e recusado por qualquer validador de CPF e
 * CNPJ. Como este repositorio e publico, um documento com aparencia
 * plausivel poderia coincidir com o de uma pessoa real. Assim nao ha
 * duvida de que sao dados de demonstracao.
 */
const PROPRIETARIOS: Proprietario[] = [
  ['Helena Machado', '222.222.222-22', 'helena.machado@email.com', '34999330001', 'Rua Coronel Antônio Alves, 820 - Osvaldo Rezende, Uberlândia - MG', 'Mora em Ribeirão Preto. Prefere tratar por WhatsApp, e só depois das 18h.'],
  ['Ricardo e Sônia Vasconcelos', '333.333.333-33', 'rvasconcelos@email.com', '34999330002', 'Alameda das Acácias, 145 - Jardim Karaíba, Uberlândia - MG', 'Casal. Qualquer proposta precisa do aceite dos dois por escrito.'],
  ['Espólio Marileusa Participações', '22.222.222/0001-22', 'inventario@marileusaparticipacoes.com.br', '34999330003', 'Av. Floriano Peixoto, 2100 - Centro, Uberlândia - MG', 'Venda depende de alvará judicial. Inventariante: Dra. Regina Portilho, OAB-MG 88.402.'],
  ['Antônio Bernardes', '444.444.444-44', 'antonio.bernardes@email.com', '34999330004', 'Rua Rio de Janeiro, 55 - Santa Mônica, Uberlândia - MG', 'Aceita proposta a partir de 1,85 milhão. Não divulgar o piso.'],
  ['Cláudia Ferreira', '555.555.555-55', 'claudia.ferreira@email.com', '34999330005', 'Rua Vigilato Pereira, 1180 - Lídice, Uberlândia - MG', 'Aceita permuta por imóvel menor na região central.'],
  ['Torre Atlântica', '33.333.333/0001-33', 'locacao@torreatlantica.com.br', '3432220100', 'Av. Rondon Pacheco, 4600 - Tibery, Uberlândia - MG', 'Pessoa jurídica. Contato pelo departamento comercial, nunca direto com a diretoria.'],
  ['Vértice Empreendimentos', '44.444.444/0001-44', 'comercial@verticeempreendimentos.com.br', '3432220200', 'Av. João Naves de Ávila, 1331 - Tibery, Uberlândia - MG', 'Construtora. Repassa unidades em lote, com tabela própria de comissão.'],
  ['Construtora Umuarama', '55.555.555/0001-55', 'vendas@construtoraumuarama.com.br', '3432220300', 'Rua Arthur Bernardes, 900 - Umuarama, Uberlândia - MG', null],
  ['Marta Siqueira', '666.666.666-66', 'marta.siqueira@email.com', '34999330006', 'Rua Bernardo Guimarães, 300 - Tibery, Uberlândia - MG', 'Viúva, documentação em nome dela desde 2021. Escritura em mãos.'],
  ['Paulo Henrique Drumond', '777.777.777-77', 'ph.drumond@email.com', '34999330007', 'Rua das Palmeiras, 77 - Novo Mundo, Uberlândia - MG', 'Investidor. Tem outros três imóveis para colocar à venda ainda este ano.'],
  ['Imobiliária São Jorge Participações', '66.666.666/0001-66', 'contato@saojorgepart.com.br', '3432220400', 'Av. Cesário Alvim, 1200 - Centro, Uberlândia - MG', 'Parceria de repasse. Comissão dividida meio a meio.'],
  ['Lucas Andrade Ferraz', '888.888.888-88', 'lucas.ferraz@email.com', '34999330008', 'Rua Goiás, 410 - Martins, Uberlândia - MG', null],
  ['Terezinha Alves de Melo', '999.999.999-99', null, '34999330009', 'Rua Ipiranga, 88 - Brasil, Uberlândia - MG', 'Não usa e-mail. Todo contato por telefone fixo, em horário comercial.'],
  ['Grupo Cedro Empreendimentos', '77.777.777/0001-77', 'novos.negocios@grupocedro.com.br', '3432220500', 'Av. Anselmo Alves dos Santos, 3500 - Santa Mônica, Uberlândia - MG', null],
].map(([nome, cpf_cnpj, email, telefone, endereco, observacoes], i) => ({
  id: idFalso('44444444', i + 1),
  nome: nome as string,
  cpf_cnpj: cpf_cnpj as string | null,
  email: email as string | null,
  telefone: telefone as string | null,
  endereco: endereco as string | null,
  observacoes: observacoes as string | null,
  criado_por: [ID_ADMIN, ID_GESTOR, ID_CORRETOR, ID_CORRETOR_2][i % 4],
  criado_em: AGORA,
  atualizado_em: AGORA,
}));

const IMOVEIS_CURADOS: Imovel[] = RASCUNHOS.map((r, i) => ({
  id: idFalso('11111111', i + 1),
  codigo: `ACH-${String(i + 1).padStart(4, '0')}`,
  slug: slugify(r.titulo),

  titulo: r.titulo,
  descricao: r.descricao,
  tipo: r.tipo,
  finalidade: 'venda',
  status: r.status,

  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: r.bairro,
  cidade: 'Uberlândia',
  uf: 'MG',
  latitude: null,
  longitude: null,
  exibir_endereco: false,

  valor: r.valor,
  valor_locacao: null,
  valor_condominio: r.condominio,
  valor_iptu: r.iptu,
  aceita_permuta: i % 3 === 0,
  aceita_financiamento: true,

  area_util: r.areaUtil,
  area_total: r.areaTotal,
  hectares: null,
  quartos: r.quartos,
  suites: r.suites,
  banheiros: r.banheiros,
  vagas: r.vagas,
  ano_construcao: r.ano ?? null,
  andar: null,
  mobiliado: r.caracteristicas.includes('Mobiliado'),
  caracteristicas: r.caracteristicas,

  // Os curados moram nos condomínios da vitrine: é o que permite abrir
  // a página do empreendimento e encontrar unidade de verdade nela.
  condominio_id: CONDOMINIOS[i % CONDOMINIOS.length].id,
  condominio_nome: CONDOMINIOS[i % CONDOMINIOS.length].nome,

  referencia_externa: null,
  fonte: 'manual' as const,
  importado_em: null,

  proprietario_id: PROPRIETARIOS[i].id,
  corretor_id: r.corretor,
  exclusividade: i % 2 === 0,
  autorizacao_ate: null,
  matricula: `MAT-${10000 + i}`,
  observacoes_internas:
    i === 0 ? 'Proprietário aceita proposta a partir de 2,7 milhões. Não divulgar.' : null,

  publicado: r.publicado,
  destaque: r.destaque,
  publicar_portais: r.publicado,
  cover: r.cover,
  visualizacoes: Math.floor(Math.random() * 400) + 40,

  meta_titulo: null,
  meta_descricao: null,

  criado_em: AGORA,
  atualizado_em: AGORA,
}));

// ------------------------------------------------------------
// CARTEIRA AMPLA
// ------------------------------------------------------------
// Os dez imóveis acima são escritos à mão, com descrição de verdade, e
// servem para conferir o texto na tela. Estes aqui existem por outro
// motivo: sem volume não dá para testar paginação, ordenação por valor,
// filtro por cidade nem o comportamento da busca quando o resultado
// passa de uma página. O site real receberá quase mil imóveis por
// importação de XML, e a vitrine precisa se comportar igual antes disso.
//
// Nada aqui é aleatório em tempo de execução: cada campo sai de uma
// conta sobre o índice. Assim o arquivo gerado é sempre o mesmo, e um
// bug de listagem pode ser reproduzido.

interface Praca {
  cidade: string;
  uf: string;
  bairros: string[];
  /**
   * Distritos e áreas rurais da praça. Fazenda em bairro urbano é o tipo
   * de incoerência que denuncia dado inventado na primeira olhada.
   */
  rurais: string[];
  /** Multiplicador de preço da praça em relação a Uberlândia. */
  fator: number;
}

const PRACAS: Praca[] = [
  {
    cidade: 'Uberlândia',
    uf: 'MG',
    fator: 1,
    bairros: [
      'Morada da Colina',
      'Jardim Karaíba',
      'Granja Marileusa',
      'Santa Mônica',
      'Vigilato Pereira',
      'Osvaldo Rezende',
      'Alto Umuarama',
      'Tibery',
      'Cidade Jardim',
      'Jardim Botânico',
      'Patrimônio',
      'Copacabana',
      'Nova Uberlândia',
      'Gávea',
      'Shopping Park',
      'Cazeca',
      'Daniel Fonseca',
      'Presidente Roosevelt',
      'Segismundo Pereira',
      'Jardim Inconfidência',
      'Laranjeiras',
      'Chácaras Tubalina',
    ],
    rurais: ['Zona Rural', 'Martinésia', 'Cruzeiro dos Peixotos', 'Tapuirama'],
  },
  {
    cidade: 'Indianópolis',
    uf: 'MG',
    fator: 0.72,
    bairros: ['Centro', 'Miranda'],
    rurais: ['Zona Rural', 'Represa de Miranda'],
  },
  {
    cidade: 'Araguari',
    uf: 'MG',
    fator: 0.68,
    bairros: ['Centro', 'Sibipiruna', 'Bosque'],
    rurais: ['Zona Rural', 'Amanhece'],
  },
  {
    cidade: 'Patrocínio',
    uf: 'MG',
    fator: 0.7,
    bairros: ['Centro', 'Cidade Jardim'],
    rurais: ['Zona Rural', 'Salitre de Minas'],
  },
  { cidade: 'Prata', uf: 'MG', fator: 0.62, bairros: ['Centro'], rurais: ['Zona Rural'] },
  { cidade: 'Unaí', uf: 'MG', fator: 0.66, bairros: ['Centro'], rurais: ['Zona Rural'] },
  {
    cidade: 'Belo Horizonte',
    uf: 'MG',
    fator: 1.45,
    bairros: ['Lourdes', 'Savassi', 'Belvedere'],
    rurais: [],
  },
  {
    cidade: 'São Carlos',
    uf: 'SP',
    fator: 1.1,
    bairros: ['CEAT', 'Centro', 'Parque Faber'],
    rurais: ['Zona Rural'],
  },
  {
    cidade: 'Palmas',
    uf: 'TO',
    fator: 0.95,
    bairros: ['Plano Diretor Norte', 'Plano Diretor Sul'],
    rurais: ['Zona Rural'],
  },
];

interface Modelo {
  tipo: string;
  titulo: string;
  base: number;
  areaBase: number;
  quartos: number;
  suites: number;
  vagas: number;
  rural?: boolean;
  comercial?: boolean;
  caracteristicas: string[];
  descricao: string;
}

const MODELOS: Modelo[] = [
  {
    tipo: 'Apartamento',
    titulo: 'Apartamento',
    base: 780_000,
    areaBase: 96,
    quartos: 3,
    suites: 1,
    vagas: 2,
    caracteristicas: ['Portaria 24h', 'Academia', 'Salão de festas'],
    descricao:
      'Apartamento com planta bem resolvida, sala integrada à varanda e cozinha com passagem para a área de serviço. Prédio com lazer completo e portaria com controle de acesso.',
  },
  {
    tipo: 'Apartamento Garden',
    titulo: 'Garden',
    base: 1_180_000,
    areaBase: 148,
    quartos: 3,
    suites: 2,
    vagas: 3,
    caracteristicas: ['Espaço gourmet', 'Churrasqueira', 'Jardim privativo', 'Portaria 24h'],
    descricao:
      'Unidade térrea com quintal privativo e churrasqueira, ligada ao living por porta de vidro de correr. A metragem descoberta dobra a área de convívio nos fins de semana.',
  },
  {
    tipo: 'Cobertura',
    titulo: 'Cobertura',
    base: 2_450_000,
    areaBase: 240,
    quartos: 4,
    suites: 3,
    vagas: 4,
    caracteristicas: ['Piscina', 'Espaço gourmet', 'Vista panorâmica', 'Elevador privativo'],
    descricao:
      'Cobertura no último pavimento, com terraço gourmet, piscina privativa e vista aberta. Acabamento em porcelanato de grande formato e marcenaria planejada em toda a unidade.',
  },
  {
    tipo: 'Studio',
    titulo: 'Studio',
    base: 315_000,
    areaBase: 34,
    quartos: 1,
    suites: 0,
    vagas: 1,
    caracteristicas: ['Mobiliado', 'Coworking', 'Portaria 24h'],
    descricao:
      'Studio entregue mobiliado, pronto para morar ou para locação. Localização a poucos minutos do centro e das principais avenidas.',
  },
  {
    tipo: 'Casa',
    titulo: 'Casa',
    base: 690_000,
    areaBase: 180,
    quartos: 3,
    suites: 1,
    vagas: 2,
    caracteristicas: ['Churrasqueira', 'Quintal', 'Aceita pet'],
    descricao:
      'Casa térrea com quintal, área gourmet coberta e garagem para dois carros. Rua tranquila, com comércio e escola a distância de caminhada.',
  },
  {
    tipo: 'Casa em condomínio',
    titulo: 'Residência',
    base: 1_950_000,
    areaBase: 320,
    quartos: 4,
    suites: 4,
    vagas: 4,
    caracteristicas: ['Piscina aquecida', 'Espaço gourmet', 'Automação', 'Condomínio fechado'],
    descricao:
      'Residência em condomínio fechado, com projeto de arquitetura e paisagismo assinados. Living de pé-direito duplo, cozinha integrada e suíte máster com closet e varanda.',
  },
  {
    tipo: 'Sobrado',
    titulo: 'Sobrado',
    base: 890_000,
    areaBase: 210,
    quartos: 3,
    suites: 2,
    vagas: 3,
    caracteristicas: ['Churrasqueira', 'Portaria 24h'],
    descricao:
      'Sobrado com estar e cozinha no pavimento térreo e dormitórios no superior, solução que separa bem a área social da íntima.',
  },
  {
    tipo: 'Sala comercial',
    titulo: 'Sala comercial',
    base: 520_000,
    areaBase: 62,
    quartos: 0,
    suites: 0,
    vagas: 2,
    comercial: true,
    caracteristicas: ['Ar-condicionado', 'Segurança 24h', 'Estacionamento'],
    descricao:
      'Sala comercial em edifício corporativo, com recepção compartilhada, elevadores sociais e estacionamento para visitantes.',
  },
  {
    tipo: 'Loja',
    titulo: 'Loja',
    base: 780_000,
    areaBase: 110,
    quartos: 0,
    suites: 0,
    vagas: 1,
    comercial: true,
    caracteristicas: ['Vitrine para a rua', 'Depósito'],
    descricao:
      'Loja de rua com vitrine ampla, mezanino e depósito nos fundos. Fluxo constante de pedestres e vaga de carga e descarga em frente.',
  },
  {
    tipo: 'Galpão',
    titulo: 'Galpão logístico',
    base: 3_400_000,
    areaBase: 1_200,
    quartos: 0,
    suites: 0,
    vagas: 10,
    comercial: true,
    caracteristicas: ['Pé-direito alto', 'Doca', 'Pátio de manobra'],
    descricao:
      'Galpão com pé-direito de nove metros, doca nivelada e pátio de manobra para carreta. Energia trifásica instalada e escritório administrativo anexo.',
  },
  {
    tipo: 'Terreno',
    titulo: 'Terreno',
    base: 420_000,
    areaBase: 360,
    quartos: 0,
    suites: 0,
    vagas: 0,
    caracteristicas: ['Documentação em ordem'],
    descricao:
      'Terreno plano, murado e com documentação em ordem, pronto para aprovação de projeto. Infraestrutura completa de água, esgoto e energia na rua.',
  },
  {
    tipo: 'Área',
    titulo: 'Área',
    base: 2_800_000,
    areaBase: 5_000,
    quartos: 0,
    suites: 0,
    vagas: 0,
    rural: true,
    caracteristicas: ['Frente para rodovia'],
    descricao:
      'Área com frente para rodovia, topografia favorável e vocação para uso logístico ou loteamento. Estudo de viabilidade disponível para interessados.',
  },
  {
    tipo: 'Chácara',
    titulo: 'Chácara',
    base: 950_000,
    areaBase: 20_000,
    quartos: 3,
    suites: 1,
    vagas: 4,
    rural: true,
    caracteristicas: ['Piscina', 'Churrasqueira', 'Pomar', 'Poço artesiano'],
    descricao:
      'Chácara com sede de alvenaria, piscina, campo de futebol e pomar formado. Poço artesiano e energia trifásica instalados.',
  },
  {
    tipo: 'Sítio',
    titulo: 'Sítio',
    base: 1_700_000,
    areaBase: 60_000,
    quartos: 4,
    suites: 2,
    vagas: 6,
    rural: true,
    caracteristicas: ['Nascente', 'Curral', 'Pomar'],
    descricao:
      'Sítio com nascente própria, curral, casa de sede e casa de caseiro. Pastagem formada e acesso por estrada em bom estado o ano inteiro.',
  },
  {
    tipo: 'Fazenda',
    titulo: 'Fazenda',
    base: 12_000_000,
    areaBase: 1_800_000,
    quartos: 5,
    suites: 3,
    vagas: 8,
    rural: true,
    caracteristicas: ['Irrigação', 'Curral', 'Barracão', 'Casa de sede'],
    descricao:
      'Fazenda de alta aptidão agrícola, com área mecanizável, irrigação instalada, barracão de máquinas e casa de sede reformada. Documentação georreferenciada.',
  },
];

/**
 * Sequência determinística.
 *
 * Espalha os valores sem repetir o mesmo padrão a cada praça, e sem
 * depender de Math.random: com semente fixa o arquivo gerado é sempre
 * igual, o que torna um defeito de listagem reproduzível.
 */
function passo(n: number, modulo: number, semente = 7): number {
  // Finalizador de mistura: sem ele, o resto de uma multiplicação simples
  // depende só dos bits baixos e o resultado repete a cada poucos passos,
  // o que deixaria a carteira inteira em duas ou três cidades.
  let x = (n + 1 + semente * 977) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 2246822519) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 3266489917) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x % modulo;
}

const CARTEIRA: Imovel[] = [];
const QUANTIDADE_GERADA = 84;

for (let n = 0; n < QUANTIDADE_GERADA; n++) {
  const modelo = MODELOS[passo(n, MODELOS.length, 3)];
  const rural = Boolean(modelo.rural);

  // Uberlândia concentra a carteira, como na operação real. As demais
  // praças aparecem em uma a cada três fichas, e o imóvel rural sempre
  // cai numa praça que tenha área rural cadastrada.
  const candidatas = rural ? PRACAS.filter((p) => p.rurais.length > 0) : PRACAS;
  const praca =
    n % 3 === 2 || rural
      ? candidatas[passo(n, candidatas.length, 11)]
      : PRACAS[0];

  const lista = rural && praca.rurais.length > 0 ? praca.rurais : praca.bairros;
  const bairro = lista[passo(n, lista.length, 5)];

  const variacao = 0.75 + passo(n, 70, 13) / 100;
  const valor = Math.round((modelo.base * praca.fator * variacao) / 1000) * 1000;

  const area = Math.round(modelo.areaBase * (0.82 + passo(n, 45, 17) / 100));
  const quartos = modelo.quartos > 0 ? Math.max(1, modelo.quartos - passo(n, 2, 19)) : 0;
  const suites = Math.min(quartos, modelo.suites);
  const vagas = modelo.vagas > 0 ? Math.max(1, modelo.vagas - passo(n, 2, 23)) : 0;

  // O condomínio só entra em tipo que de fato vive dentro de um.
  const cabeCondominio =
    ['Apartamento', 'Apartamento Garden', 'Cobertura', 'Studio', 'Casa em condomínio', 'Sala comercial'].includes(
      modelo.tipo,
    ) && praca.cidade === 'Uberlândia' && !rural;
  const condominio = cabeCondominio ? CONDOMINIOS[passo(n, CONDOMINIOS.length - 1, 29)] : null;

  const titulo = rural
    ? `${modelo.titulo} em ${praca.cidade}`
    : `${modelo.titulo} ${bairro}${n % 7 === 0 ? ' com vista livre' : ''}`;
  const locacao = n % 9 === 4;

  CARTEIRA.push({
    id: idFalso('88888888', n + 1),
    codigo: `ACH-${String(100 + n).padStart(4, '0')}`,
    slug: slugify(`${titulo}-${praca.cidade}-${100 + n}`),

    titulo,
    descricao: `${modelo.descricao}\n\nO imóvel fica em ${bairro}, ${praca.cidade}. Agende uma visita para conhecer a planta e a vizinhança com um consultor da casa.`,
    tipo: modelo.tipo,
    finalidade: locacao ? 'venda_locacao' : 'venda',
    status: n % 17 === 5 ? 'reservado' : 'disponivel',

    cep: null,
    logradouro: null,
    numero: null,
    complemento: null,
    bairro,
    cidade: praca.cidade,
    uf: praca.uf,
    latitude: null,
    longitude: null,
    exibir_endereco: false,

    valor,
    valor_locacao: locacao ? Math.round((valor * 0.0045) / 50) * 50 : null,
    valor_condominio: condominio ? 400 + passo(n, 1400, 31) : null,
    valor_iptu: Math.round(valor * 0.0035),
    aceita_permuta: n % 5 === 0,
    aceita_financiamento: !modelo.rural,

    area_util: area,
    area_total: Math.round(area * 1.18),
    hectares: modelo.rural ? Math.round((area / 10_000) * 100) / 100 : null,
    quartos,
    suites,
    banheiros: quartos > 0 ? quartos + 1 : 1,
    vagas,
    ano_construcao: modelo.rural ? null : 2010 + passo(n, 14, 37),
    andar: modelo.tipo === 'Apartamento' ? 1 + passo(n, 18, 41) : null,
    mobiliado: modelo.caracteristicas.includes('Mobiliado'),
    caracteristicas: modelo.caracteristicas,

    condominio_id: condominio?.id ?? null,
    condominio_nome: condominio?.nome ?? null,

    // Como se tivessem chegado pelo feed do portal, que é como a
    // carteira real vai ser preenchida.
    referencia_externa: `${modelo.tipo.slice(0, 2).toUpperCase()}${String(n + 1).padStart(4, '0')}-INYK`,
    fonte: 'xml',
    importado_em: AGORA,

    /**
     * Um em cada sete fica sem proprietario, de proposito.
     *
     * Estes imoveis chegaram por importacao de XML, e o feed do portal
     * nao carrega dado de captacao — nome e telefone de proprietario
     * nao trafegam num anuncio publico. Entao o buraco e real: quem
     * importa carteira herda registros que ninguem sabe de quem sao,
     * e alguem precisa regularizar um por um.
     *
     * E exatamente o caso que o filtro "sem proprietario" atende. Sem
     * esses registros na base, a demonstracao mostraria uma carteira
     * limpa demais e o filtro pareceria sobrar.
     */
    proprietario_id: n % 7 === 3 ? null : PROPRIETARIOS[passo(n, PROPRIETARIOS.length, 61)].id,
    corretor_id: [ID_ADMIN, ID_GESTOR, ID_CORRETOR, ID_CORRETOR_2][passo(n, 4, 43)],
    exclusividade: n % 6 === 0,
    autorizacao_ate: null,
    matricula: `MAT-${20000 + n}`,
    observacoes_internas: null,

    publicado: true,
    destaque: n % 11 === 2,
    publicar_portais: true,
    cover: `cv${1 + passo(n, 6, 47)}`,
    visualizacoes: 20 + passo(n, 900, 53),

    meta_titulo: null,
    meta_descricao: null,

    criado_em: new Date(Date.now() - passo(n, 300, 59) * 86_400_000).toISOString(),
    atualizado_em: AGORA,
  });
}

const IMOVEIS: Imovel[] = [...IMOVEIS_CURADOS, ...CARTEIRA];

// ------------------------------------------------------------
// AGENDA
// ------------------------------------------------------------

interface RascunhoCompromisso {
  titulo: string;
  observacao: string | null;
  tipo: Compromisso['tipo'];
  deslocamento: number;
  hora: number;
  duracao: number;
  local: string | null;
  responsavel: string;
  criadoPor: string;
  status?: Compromisso['status'];
  travado?: boolean;
  imovel?: number;
}

const RASCUNHOS_AGENDA: RascunhoCompromisso[] = [
  {
    titulo: 'Visita à cobertura do Morada da Colina',
    observacao:
      'Cliente vem de Araguari e chega por volta das 9h30. Levar a planta impressa e confirmar com a portaria que o elevador privativo estará liberado.',
    tipo: 'visita',
    deslocamento: 0,
    hora: 10,
    duracao: 90,
    local: 'Rua Rio de Janeiro, 1200',
    responsavel: ID_ADMIN,
    criadoPor: ID_ADMIN,
    imovel: 0,
  },
  {
    titulo: 'Reunião de alinhamento da equipe',
    observacao: 'Fechamento do mês e distribuição das captações novas. Presença obrigatória.',
    tipo: 'reuniao',
    deslocamento: 0,
    hora: 14,
    duracao: 60,
    local: 'Escritório, sala de reunião',
    responsavel: ID_CORRETOR,
    criadoPor: ID_ADMIN,
    travado: true,
  },
  {
    titulo: 'Assinatura de contrato Granja Marileusa',
    observacao: 'Cartório do 2º Ofício. Levar as duas vias e a certidão atualizada.',
    tipo: 'assinatura',
    deslocamento: 1,
    hora: 15,
    duracao: 120,
    local: 'Cartório do 2º Ofício',
    responsavel: ID_CORRETOR,
    criadoPor: ID_CORRETOR,
    imovel: 2,
  },
  {
    titulo: 'Captação no Jardim Karaíba',
    observacao: 'Proprietária quer avaliação antes de decidir. Levar comparativo da região.',
    tipo: 'captacao',
    deslocamento: 2,
    hora: 9,
    duracao: 60,
    local: 'Alameda dos Ipês, 340',
    responsavel: ID_GESTOR,
    criadoPor: ID_GESTOR,
  },
  {
    titulo: 'Plantão de vendas no stand',
    observacao: 'Escala de sábado. Abertura às 9h, fechamento às 17h.',
    tipo: 'plantao',
    deslocamento: proximoSabado(),
    hora: 9,
    duracao: 480,
    local: 'Stand Granja Marileusa',
    responsavel: ID_CORRETOR_2,
    criadoPor: ID_ADMIN,
    travado: true,
  },
  {
    titulo: 'Visita ao garden do Vigilato',
    observacao: 'Segunda visita do casal. Já perguntaram sobre reforma da cozinha.',
    tipo: 'visita',
    deslocamento: 3,
    hora: 16,
    duracao: 60,
    local: 'Rua Alexandre Marquez, 88',
    responsavel: ID_CORRETOR_2,
    criadoPor: ID_CORRETOR_2,
    imovel: 4,
  },
  {
    titulo: 'Retorno ao cliente da Torre Atlântica',
    observacao: 'Ligar para confirmar se a diretoria aprovou a proposta.',
    tipo: 'outro',
    deslocamento: 4,
    hora: 11,
    duracao: 30,
    local: null,
    responsavel: ID_GESTOR,
    criadoPor: ID_GESTOR,
    imovel: 5,
  },
  {
    titulo: 'Visita ao studio Francisco Galassi',
    observacao: 'Investidor. Focar em rentabilidade e taxa de ocupação.',
    tipo: 'visita',
    deslocamento: 5,
    hora: 10,
    duracao: 45,
    local: 'Av. Francisco Galassi, 500',
    responsavel: ID_CORRETOR_2,
    criadoPor: ID_CORRETOR_2,
    imovel: 6,
  },
  {
    titulo: 'Vistoria de entrega Santa Mônica',
    observacao: 'Conferir a lista de pendências antes de liberar as chaves.',
    tipo: 'outro',
    deslocamento: 7,
    hora: 14,
    duracao: 90,
    local: 'Rua Bernardo Cupertino, 210',
    responsavel: ID_CORRETOR,
    criadoPor: ID_ADMIN,
    imovel: 3,
  },
  {
    titulo: 'Visita realizada no Alto Umuarama',
    observacao: 'Cliente gostou, mas achou o valor alto. Vai pensar.',
    tipo: 'visita',
    deslocamento: -2,
    hora: 15,
    duracao: 60,
    local: 'Rua das Acácias, 77',
    responsavel: ID_CORRETOR,
    criadoPor: ID_CORRETOR,
    status: 'concluido',
    imovel: 7,
  },
  {
    titulo: 'Reunião com a construtora',
    observacao: 'Negociação da tabela de comissão do próximo lançamento.',
    tipo: 'reuniao',
    deslocamento: -4,
    hora: 10,
    duracao: 90,
    local: 'Escritório da construtora',
    responsavel: ID_ADMIN,
    criadoPor: ID_ADMIN,
    status: 'concluido',
  },
  {
    titulo: 'Visita cancelada Tibery',
    observacao: 'Cliente desmarcou na véspera. Tentar remarcar para a semana que vem.',
    tipo: 'visita',
    deslocamento: -1,
    hora: 11,
    duracao: 60,
    local: 'Rua Piauí, 450',
    responsavel: ID_CORRETOR_2,
    criadoPor: ID_CORRETOR_2,
    status: 'cancelado',
    imovel: 8,
  },
  {
    titulo: 'Fotografia profissional do Novo Mundo',
    observacao: 'Fotógrafo confirmado. Pedir para o proprietário deixar o apartamento arrumado.',
    tipo: 'outro',
    deslocamento: 9,
    hora: 8,
    duracao: 120,
    local: 'Rua Goiás, 1500',
    responsavel: ID_CORRETOR,
    criadoPor: ID_GESTOR,
    imovel: 9,
  },
  {
    titulo: 'Almoço com parceiro de captação',
    observacao: null,
    tipo: 'pessoal',
    deslocamento: 6,
    hora: 12,
    duracao: 90,
    local: null,
    responsavel: ID_ADMIN,
    criadoPor: ID_ADMIN,
  },
];

/** Quantos dias faltam para o próximo sábado. */
function proximoSabado(): number {
  const diaSemana = HOJE.getDay();
  return diaSemana === 6 ? 7 : 6 - diaSemana;
}

const COMPROMISSOS: Compromisso[] = RASCUNHOS_AGENDA.map((r, i) => ({
  id: idFalso('22222222', i + 1),
  titulo: r.titulo,
  observacao: r.observacao,
  tipo: r.tipo,
  inicio: instante(r.deslocamento, r.hora),
  fim: instante(r.deslocamento, r.hora + Math.floor(r.duracao / 60), r.duracao % 60),
  dia_inteiro: r.duracao >= 480,
  local: r.local,
  responsavel_id: r.responsavel,
  criado_por: r.criadoPor,
  imovel_id: r.imovel !== undefined ? IMOVEIS[r.imovel].id : null,
  lead_id: null,
  status: r.status ?? 'agendado',
  travado: r.travado ?? false,
  lembrete_minutos: 60,
  canais: ['app'],
  notificado_em: null,
  criado_em: AGORA,
  atualizado_em: AGORA,
}));

// ------------------------------------------------------------
// VENDAS
// ------------------------------------------------------------

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

interface RascunhoVenda {
  imovel: number;
  comprador: string;
  proprietario: string;
  tabela: number;
  fechado: number;
  pctComissao: number;
  pctCasa: number;
  pctCaptador: number;
  custos: number;
  consultor: string;
  captador: string | null;
  status: Venda['status'];
  forma: Venda['forma_pagamento'];
  proposta: number;
  conclusao: number | null;
  motivo?: string;
}

const RASCUNHOS_VENDA: RascunhoVenda[] = [
  {
    imovel: 2,
    comprador: 'Fernando e Beatriz Almeida',
    proprietario: 'Espólio Marileusa Participações',
    tabela: 2650000,
    fechado: 2520000,
    pctComissao: 6,
    pctCasa: 50,
    pctCaptador: 10,
    custos: 8400,
    consultor: ID_CORRETOR,
    captador: ID_GESTOR,
    status: 'concluida',
    forma: 'financiado',
    proposta: -22,
    conclusao: -6,
  },
  {
    imovel: 6,
    comprador: 'Marcelo Tavares',
    proprietario: 'Vértice Empreendimentos',
    tabela: 325000,
    fechado: 325000,
    pctComissao: 6,
    pctCasa: 55,
    pctCaptador: 0,
    custos: 1200,
    consultor: ID_CORRETOR_2,
    captador: null,
    status: 'concluida',
    forma: 'a_vista',
    proposta: -14,
    conclusao: -9,
  },
  {
    imovel: 4,
    comprador: 'Renata e Paulo Andrade',
    proprietario: 'Cláudia Ferreira',
    tabela: 1450000,
    fechado: 1380000,
    pctComissao: 6,
    pctCasa: 50,
    pctCaptador: 0,
    custos: 4200,
    consultor: ID_CORRETOR_2,
    captador: null,
    status: 'concluida',
    forma: 'financiado',
    proposta: -30,
    conclusao: -2,
  },
  {
    imovel: 3,
    comprador: 'Juliana Rezende',
    proprietario: 'Antônio Bernardes',
    tabela: 1980000,
    fechado: 1890000,
    pctComissao: 6,
    pctCasa: 50,
    pctCaptador: 10,
    custos: 3100,
    consultor: ID_CORRETOR,
    captador: ID_ADMIN,
    status: 'contrato',
    forma: 'financiado',
    proposta: -11,
    conclusao: null,
  },
  {
    imovel: 5,
    comprador: 'Vertex Consultoria Empresarial',
    proprietario: 'Torre Atlântica',
    tabela: 890000,
    fechado: 860000,
    pctComissao: 5,
    pctCasa: 60,
    pctCaptador: 0,
    custos: 900,
    consultor: ID_GESTOR,
    captador: null,
    status: 'aprovada',
    forma: 'consorcio',
    proposta: -5,
    conclusao: null,
  },
  {
    imovel: 0,
    comprador: 'Ricardo Vilela',
    proprietario: 'Helena Machado',
    tabela: 2850000,
    fechado: 2700000,
    pctComissao: 6,
    pctCasa: 50,
    pctCaptador: 0,
    custos: 0,
    consultor: ID_ADMIN,
    captador: null,
    status: 'proposta',
    forma: 'misto',
    proposta: -2,
    conclusao: null,
  },
  {
    imovel: 7,
    comprador: 'Douglas Pereira',
    proprietario: 'Construtora Umuarama',
    tabela: 780000,
    fechado: 740000,
    pctComissao: 6,
    pctCasa: 50,
    pctCaptador: 0,
    custos: 2600,
    consultor: ID_CORRETOR,
    captador: null,
    status: 'cancelada',
    forma: 'financiado',
    proposta: -40,
    conclusao: null,
    motivo: 'Crédito negado pelo banco após análise de renda.',
  },
];

const VENDAS: Venda[] = RASCUNHOS_VENDA.map((r, i) => {
  const bruta = arredondar((r.fechado * r.pctComissao) / 100);
  const casa = arredondar(bruta * (r.pctCasa / 100));
  const captador = arredondar(bruta * (r.pctCaptador / 100));

  return {
    id: idFalso('33333333', i + 1),
    codigo: `VEN-${String(i + 1).padStart(4, '0')}`,
    tipo: 'venda',

    imovel_id: IMOVEIS[r.imovel].id,
    imovel_titulo: IMOVEIS[r.imovel].titulo,
    lead_id: null,

    comprador_nome: r.comprador,
    comprador_telefone: '34999220000',
    comprador_email: null,
    proprietario_nome: r.proprietario,

    valor_tabela: r.tabela,
    valor_venda: r.fechado,
    desconto: Math.max(0, arredondar(r.tabela - r.fechado)),

    forma_pagamento: r.forma,
    entrada: Math.round(r.fechado * 0.25),
    valor_financiado: Math.round(r.fechado * 0.75),
    banco: r.forma === 'financiado' ? 'Caixa Econômica Federal' : null,

    percentual_comissao: r.pctComissao,
    percentual_casa: r.pctCasa,
    percentual_captador: r.pctCaptador,

    comissao_bruta: bruta,
    comissao_casa: casa,
    comissao_captador: captador,
    comissao_consultor: arredondar(bruta - casa - captador),

    custos: r.custos,
    margem: arredondar(casa - r.custos),

    consultor_id: r.consultor,
    captador_id: r.captador,

    status: r.status,
    data_proposta: dia(r.proposta),
    data_assinatura: r.conclusao !== null ? dia(r.conclusao - 3) : null,
    data_conclusao: r.conclusao !== null ? dia(r.conclusao) : null,

    motivo_cancelamento: r.motivo ?? null,
    observacoes: null,

    criado_por: r.consultor,
    criado_em: AGORA,
    atualizado_em: AGORA,
  };
});

const PARCELAS: VendaParcela[] = VENDAS.filter((v) => v.status === 'concluida').flatMap(
  (venda, i) => {
    const sinal = arredondar(venda.comissao_bruta * 0.3);

    return [
      {
        id: idFalso('44444444', i * 2 + 1),
        venda_id: venda.id,
        descricao: 'Sinal na assinatura',
        beneficiario_id: null,
        destino: 'casa' as const,
        valor: sinal,
        vencimento: dia(-8 + i * 3),
        pago_em: dia(-7 + i * 3),
        status: 'pago' as const,
        observacoes: null,
        criado_em: AGORA,
      },
      {
        id: idFalso('44444444', i * 2 + 2),
        venda_id: venda.id,
        descricao: 'Saldo na liberação do recurso',
        beneficiario_id: null,
        destino: 'casa' as const,
        valor: arredondar(venda.comissao_bruta - sinal),
        // A primeira fica vencida de propósito, para o painel de
        // recebíveis mostrar a situação de atraso.
        vencimento: i === 0 ? dia(-3) : dia(12 + i * 10),
        pago_em: null,
        status: 'pendente' as const,
        observacoes: null,
        criado_em: AGORA,
      },
    ];
  },
);

// ------------------------------------------------------------
// LEADS
// ------------------------------------------------------------

interface RascunhoLead {
  nome: string;
  telefone: string;
  email: string | null;
  etapa: Lead['etapa'];
  origem: Lead['origem'];
  imovel: number | null;
  valor: number;
  corretor: string | null;
  dias: number;
  mensagem: string;
  /** Dias a partir de hoje para o retorno combinado com o cliente. */
  retorno?: number;
  motivoPerda?: string;
}

const RASCUNHOS_LEAD: RascunhoLead[] = [
  {
    nome: 'Patrícia Coelho',
    telefone: '34999330001',
    email: 'patricia.coelho@example.com',
    etapa: 'novo',
    origem: 'site',
    imovel: 0,
    valor: 2850000,
    corretor: null,
    dias: 0,
    mensagem: 'Gostaria de agendar uma visita ainda esta semana.',
  },
  {
    nome: 'Anderson Lima',
    telefone: '34999330002',
    email: 'anderson.lima@example.com',
    etapa: 'novo',
    origem: 'whatsapp',
    imovel: 1,
    valor: 3200000,
    corretor: null,
    dias: 0,
    mensagem: 'Vi o anúncio no Instagram. O valor é negociável?',
  },
  {
    nome: 'Sandra Oliveira',
    telefone: '34999330003',
    email: 'sandra.oliveira@example.com',
    etapa: 'novo',
    origem: 'indicacao',
    imovel: null,
    valor: 900000,
    corretor: ID_CORRETOR,
    dias: 1,
    mensagem: 'Procuro apartamento de 3 quartos até 900 mil, perto do Santa Mônica.',
    retorno: 0,
  },
  {
    nome: 'Gustavo Prado',
    telefone: '34999330004',
    email: 'gustavo@pradoadvocacia.com.br',
    etapa: 'contato',
    origem: 'site',
    imovel: 5,
    valor: 890000,
    corretor: ID_GESTOR,
    dias: 3,
    mensagem: 'Preciso de sala comercial para escritório de advocacia.',
    retorno: 2,
  },
  {
    nome: 'Letícia Barbosa',
    telefone: '34999330005',
    email: 'leticia.barbosa92@example.com',
    etapa: 'contato',
    origem: 'portal',
    imovel: 4,
    valor: 1450000,
    corretor: ID_CORRETOR_2,
    dias: 5,
    mensagem: 'Tenho interesse no garden. Aceita permuta por apartamento menor?',
  },
  {
    nome: 'Eduardo Ramos',
    telefone: '34999330006',
    email: 'eduardo.ramos@example.com',
    etapa: 'visita',
    origem: 'site',
    imovel: 3,
    valor: 1980000,
    corretor: ID_CORRETOR,
    dias: 8,
    mensagem: 'Visita marcada. Quer ver a área de lazer também.',
    retorno: 1,
  },
  {
    nome: 'Mariana Castro',
    telefone: '34999330007',
    email: 'mari.castro@example.com',
    etapa: 'visita',
    origem: 'instagram',
    imovel: 8,
    valor: 690000,
    corretor: ID_CORRETOR_2,
    dias: 10,
    mensagem: 'Segunda visita agendada, veio com a mãe.',
  },
  {
    nome: 'Ricardo Vilela',
    telefone: '34999330008',
    email: 'ricardo.vilela@vilelaconstrucoes.com.br',
    etapa: 'proposta',
    origem: 'indicacao',
    imovel: 0,
    valor: 2700000,
    corretor: ID_ADMIN,
    dias: 12,
    mensagem: 'Proposta de 2,7 milhões apresentada ao proprietário.',
  },
  {
    nome: 'Juliana Rezende',
    telefone: '34999330009',
    email: 'juliana.rezende@example.com',
    etapa: 'proposta',
    origem: 'site',
    imovel: 3,
    valor: 1890000,
    corretor: ID_CORRETOR,
    dias: 14,
    mensagem: 'Aguardando aprovação do financiamento.',
  },
  {
    nome: 'Fernando e Beatriz Almeida',
    telefone: '34999330010',
    email: 'fernando.almeida@example.com',
    etapa: 'fechado',
    origem: 'portal',
    imovel: 2,
    valor: 2520000,
    corretor: ID_CORRETOR,
    dias: 22,
    mensagem: 'Negócio fechado, contrato assinado.',
  },
  {
    nome: 'Marcelo Tavares',
    telefone: '34999330011',
    email: 'marcelo.tavares@investe.com.br',
    etapa: 'fechado',
    origem: 'indicacao',
    imovel: 6,
    valor: 325000,
    corretor: ID_CORRETOR_2,
    dias: 14,
    mensagem: 'Investidor, comprou à vista.',
  },
  {
    nome: 'Renata e Paulo Andrade',
    telefone: '34999330012',
    email: 'renata.andrade@example.com',
    etapa: 'fechado',
    origem: 'vitrine',
    imovel: 4,
    valor: 1380000,
    corretor: ID_CORRETOR_2,
    dias: 34,
    mensagem: 'Casal com apartamento para dar em permuta. Fechou no garden do Vigilato.',
  },
  {
    nome: 'Vanessa Custódio',
    telefone: '34999000001',
    email: 'varcustodio@example.com',
    etapa: 'contato',
    origem: 'presencial',
    imovel: 7,
    valor: 780000,
    corretor: ID_CORRETOR_2,
    dias: 4,
    mensagem: 'Entrou na loja no sábado. Quer permutar o apartamento atual no Umuarama.',
    retorno: 1,
  },
  {
    nome: 'Cristiano Balbino',
    telefone: '34999000002',
    email: null,
    etapa: 'novo',
    origem: 'telefone',
    imovel: null,
    valor: 450000,
    corretor: null,
    dias: 2,
    mensagem: 'Ligou pedindo opções de terreno em condomínio fechado até 450 mil.',
  },
  {
    nome: 'Simone Firmo',
    telefone: '34999000003',
    email: 'simone.firmo@example.com',
    etapa: 'visita',
    origem: 'manual',
    imovel: 9,
    valor: 640000,
    corretor: ID_GESTOR,
    dias: 6,
    mensagem: 'Cadastrada pela Larissa depois do plantão no stand.',
  },
  {
    nome: 'Otávio Mendonça',
    telefone: '34999330014',
    email: 'otavio.mendonca@example.com',
    etapa: 'perdido',
    origem: 'site',
    imovel: 1,
    valor: 3200000,
    corretor: ID_ADMIN,
    dias: 33,
    mensagem: 'Buscava casa em condomínio fechado com campo de golfe.',
    motivoPerda: 'Comprou com outra imobiliária',
  },
  {
    nome: 'Beatriz Nogueira',
    telefone: '34999330015',
    email: 'bia.nogueira@example.com',
    etapa: 'perdido',
    origem: 'whatsapp',
    imovel: 8,
    valor: 690000,
    corretor: ID_CORRETOR_2,
    dias: 26,
    mensagem: 'Não conseguiu aprovar o financiamento no valor pretendido.',
    motivoPerda: 'Não tinha crédito aprovado',
  },
];

const LEADS: Lead[] = RASCUNHOS_LEAD.map((r, i) => {
  const criado = new Date(HOJE);
  criado.setDate(criado.getDate() - r.dias);

  // Score simplificado, coerente com a função do pacote core.
  let score = 25;
  if (r.email) score += 10;
  if (r.mensagem.length > 40) score += 15;
  if (r.imovel !== null) score += 20;
  if (r.valor >= 2000000) score += 15;
  else if (r.valor >= 800000) score += 10;
  else score += 5;
  if (r.origem === 'indicacao') score += 15;
  else if (r.origem === 'site' || r.origem === 'vitrine') score += 8;
  if (r.dias <= 1) score += 10;
  else if (r.dias <= 7) score += 5;
  else if (r.dias > 30) score -= 10;
  score = Math.max(0, Math.min(100, score));

  return {
    id: idFalso('55555555', i + 1),
    nome: r.nome,
    telefone: r.telefone,
    email: r.email,
    mensagem: r.mensagem,
    origem: r.origem,
    etapa: r.etapa,
    temperatura: score >= 70 ? 'quente' : score >= 40 ? 'morno' : 'frio',
    score,
    imovel_id: r.imovel !== null ? IMOVEIS[r.imovel].id : null,
    imovel_titulo: r.imovel !== null ? IMOVEIS[r.imovel].titulo : null,
    valor: r.valor,
    corretor_id: r.corretor,
    consentimento_lgpd: true,
    consentimento_em: criado.toISOString(),
    utm_source: r.origem === 'site' ? 'google' : null,
    utm_medium: r.origem === 'site' ? 'cpc' : null,
    utm_campaign: r.origem === 'site' ? 'alto-padrao-uberlandia' : null,
    utm_term: null,
    utm_content: null,
    pagina_origem: r.imovel !== null ? `/imovel/${IMOVEIS[r.imovel].slug}` : '/imoveis',
    arquivado: false,
    motivo_perda: r.motivoPerda ?? null,
    proximo_contato: r.retorno !== undefined ? dia(r.retorno) : null,
    criado_em: criado.toISOString(),
    atualizado_em: criado.toISOString(),
  };
});

/**
 * Liga cada venda ao lead que a originou, quando existe um com o mesmo
 * nome de comprador.
 *
 * Sem esse vínculo o painel de indicadores não conseguiria responder
 * duas perguntas que a gestão faz sempre: quanto tempo leva entre o
 * primeiro contato e a assinatura, e qual canal de entrada traz o
 * dinheiro de verdade, não apenas o maior volume de curiosos.
 */
for (const venda of VENDAS) {
  const lead = LEADS.find((l) => l.nome === venda.comprador_nome);
  if (lead) {
    venda.lead_id = lead.id;
    venda.comprador_telefone = lead.telefone;
    venda.comprador_email = lead.email;
  }
}

// ------------------------------------------------------------
// INTERAÇÕES
// ------------------------------------------------------------

interface RascunhoInteracao {
  /**
   * Nome do lead. Referência por nome, e não por posição na lista:
   * inserir um lead no meio do array deslocaria todas as interações
   * seguintes sem nenhum aviso, e o histórico apareceria na ficha
   * errada.
   */
  lead: string;
  tipo: Interacao['tipo'];
  autor: string | null;
  /** Dias atrás, contados de hoje. */
  dias: number;
  hora: number;
  conteudo: string;
}

const RASCUNHOS_INTERACAO: RascunhoInteracao[] = [
  { lead: 'Sandra Oliveira', tipo: 'ligacao', autor: ID_CORRETOR, dias: 1, hora: 9, conteudo: 'Liguei logo depois da indicação. Ela procura três quartos, uma vaga já resolve, e quer ficar perto da escola dos filhos no Santa Mônica.' },
  { lead: 'Sandra Oliveira', tipo: 'whatsapp', autor: ID_CORRETOR, dias: 0, hora: 14, conteudo: 'Mandei três opções pelo WhatsApp. Ficou de responder até amanhã qual quer visitar primeiro.' },

  { lead: 'Gustavo Prado', tipo: 'ligacao', autor: ID_GESTOR, dias: 3, hora: 11, conteudo: 'Escritório com quatro advogados, precisa de sala a partir de 90 m2 com duas vagas. A Torre Atlântica atende bem.' },
  { lead: 'Gustavo Prado', tipo: 'email', autor: ID_GESTOR, dias: 2, hora: 16, conteudo: 'Enviei a planta e a tabela de condomínio da Torre Atlântica. Pediu para retomar depois da reunião com os sócios.' },

  { lead: 'Letícia Barbosa', tipo: 'whatsapp', autor: ID_CORRETOR_2, dias: 5, hora: 10, conteudo: 'Confirmou interesse no garden. Tem um apartamento de 70 m2 no Tibery para dar em permuta.' },
  { lead: 'Letícia Barbosa', tipo: 'nota', autor: ID_CORRETOR_2, dias: 4, hora: 18, conteudo: 'Proprietário sinalizou que aceita permuta até 40 por cento do valor. Falta avaliar o imóvel dela.' },

  { lead: 'Eduardo Ramos', tipo: 'visita', autor: ID_CORRETOR, dias: 6, hora: 15, conteudo: 'Visita feita na cobertura do Santa Mônica. Gostou da vista, achou a suíte máster pequena.' },
  { lead: 'Eduardo Ramos', tipo: 'nota', autor: ID_CORRETOR, dias: 2, hora: 9, conteudo: 'Pediu para ver algo parecido no Karaíba antes de decidir. Agendar para esta semana.' },

  { lead: 'Mariana Castro', tipo: 'visita', autor: ID_CORRETOR_2, dias: 9, hora: 16, conteudo: 'Segunda visita ao studio. Veio com a mãe, que ficou de ajudar na entrada.' },
  { lead: 'Mariana Castro', tipo: 'whatsapp', autor: ID_CORRETOR_2, dias: 7, hora: 11, conteudo: 'Enviei a simulação de financiamento pela Caixa. Parcela ficou em 3.180 reais.' },

  { lead: 'Ricardo Vilela', tipo: 'proposta', autor: ID_ADMIN, dias: 4, hora: 17, conteudo: 'Proposta de 2,7 milhões protocolada com a proprietária. Ela pediu 48 horas para responder.' },
  { lead: 'Ricardo Vilela', tipo: 'ligacao', autor: ID_ADMIN, dias: 1, hora: 10, conteudo: 'Proprietária sinalizou contraproposta em 2,78 milhões. Levar ao comprador hoje.' },

  { lead: 'Juliana Rezende', tipo: 'proposta', autor: ID_CORRETOR, dias: 11, hora: 14, conteudo: 'Proposta aceita. Documentação enviada ao banco para análise de crédito.' },
  { lead: 'Juliana Rezende', tipo: 'nota', autor: ID_CORRETOR, dias: 3, hora: 9, conteudo: 'Banco pediu comprovante de renda atualizado. Cliente envia até sexta.' },

  { lead: 'Fernando e Beatriz Almeida', tipo: 'visita', autor: ID_CORRETOR, dias: 20, hora: 10, conteudo: 'Visita à casa da Granja Marileusa. Decidiu no mesmo dia.' },
  { lead: 'Fernando e Beatriz Almeida', tipo: 'proposta', autor: ID_CORRETOR, dias: 18, hora: 15, conteudo: 'Proposta de 2,52 milhões aceita pelo proprietário.' },
  { lead: 'Fernando e Beatriz Almeida', tipo: 'sistema', autor: null, dias: 6, hora: 12, conteudo: 'Negócio VEN-0001 concluído. Lead movido para a etapa fechado.' },

  { lead: 'Marcelo Tavares', tipo: 'ligacao', autor: ID_CORRETOR_2, dias: 13, hora: 9, conteudo: 'Investidor procura studio para locação. Pagamento à vista, quer escritura rápida.' },
  { lead: 'Marcelo Tavares', tipo: 'sistema', autor: null, dias: 9, hora: 12, conteudo: 'Negócio VEN-0002 concluído. Lead movido para a etapa fechado.' },

  { lead: 'Vanessa Custódio', tipo: 'nota', autor: ID_CORRETOR_2, dias: 4, hora: 11, conteudo: 'Atendida no balcão. Mora no Umuarama e quer trocar por algo maior sem sair do bairro.' },
  { lead: 'Vanessa Custódio', tipo: 'whatsapp', autor: ID_CORRETOR_2, dias: 2, hora: 19, conteudo: 'Enviei o apartamento do Alto Umuarama. Vai conversar com o marido e retorna.' },

  { lead: 'Simone Firmo', tipo: 'nota', autor: ID_GESTOR, dias: 6, hora: 20, conteudo: 'Cadastrada no plantão do stand. Interesse no Novo Mundo, orçamento até 640 mil.' },
  { lead: 'Simone Firmo', tipo: 'visita', autor: ID_GESTOR, dias: 1, hora: 15, conteudo: 'Visitou o decorado. Vai voltar no fim de semana com o esposo.' },

  { lead: 'Otávio Mendonça', tipo: 'ligacao', autor: ID_ADMIN, dias: 30, hora: 10, conteudo: 'Procurava casa em condomínio com campo de golfe. Não temos nada no perfil.' },
  { lead: 'Otávio Mendonça', tipo: 'nota', autor: ID_ADMIN, dias: 12, hora: 16, conteudo: 'Informou que fechou com outra imobiliária. Atendimento encerrado.' },

  { lead: 'Beatriz Nogueira', tipo: 'whatsapp', autor: ID_CORRETOR_2, dias: 24, hora: 14, conteudo: 'Enviei simulação. Renda comprovada não alcança o valor da parcela.' },
  { lead: 'Beatriz Nogueira', tipo: 'nota', autor: ID_CORRETOR_2, dias: 20, hora: 9, conteudo: 'Crédito reprovado em dois bancos. Retomar daqui a seis meses.' },
];

const NOMES_PERFIL = new Map(PERFIS.map((p) => [p.id, p.nome]));

const INTERACOES: Interacao[] = RASCUNHOS_INTERACAO.map((r, i) => ({
  id: idFalso('66666666', i + 1),
  lead_id: LEADS.find((l) => l.nome === r.lead)!.id,
  tipo: r.tipo,
  conteudo: r.conteudo,
  autor_id: r.autor,
  autor_nome: r.autor ? (NOMES_PERFIL.get(r.autor) ?? null) : 'Sistema',
  criado_em: instante(-r.dias, r.hora),
}));

// ------------------------------------------------------------
// FOTOS
// ------------------------------------------------------------
// O acervo mora em assets/fotos (baixado por scripts/baixar-fotos.mjs,
// licença Unsplash) e é servido pelo próprio site, sem depender de rede
// na hora da apresentação. Cada imóvel recebe um álbum coerente com o
// tipo: fazenda não abre com foto de sala, sala comercial não mostra
// quarto de casal.

const ACERVO: Record<string, number> = {
  casa: 14, predio: 7, sala: 12, cozinha: 7, quarto: 7, banheiro: 5, piscina: 6,
  cobertura: 5, studio: 5, escritorio: 5, loja: 3, galpao: 3, rural: 6, campo: 4,
  terreno: 3, condominio: 6,
};

/** Sequência de categorias do álbum, a primeira é a capa. */
const ALBUNS: Record<string, string[]> = {
  Apartamento: ['predio', 'sala', 'cozinha', 'quarto', 'banheiro', 'sala'],
  'Apartamento Garden': ['sala', 'piscina', 'cozinha', 'quarto', 'banheiro', 'sala'],
  Cobertura: ['cobertura', 'sala', 'piscina', 'cozinha', 'quarto', 'banheiro', 'cobertura'],
  Studio: ['studio', 'studio', 'cozinha', 'banheiro'],
  Casa: ['casa', 'sala', 'cozinha', 'quarto', 'banheiro', 'piscina'],
  'Casa em condomínio': ['casa', 'piscina', 'sala', 'cozinha', 'quarto', 'banheiro', 'condominio'],
  Sobrado: ['casa', 'sala', 'cozinha', 'quarto', 'banheiro'],
  'Sala comercial': ['escritorio', 'escritorio', 'escritorio', 'predio'],
  Loja: ['loja', 'loja', 'loja'],
  Galpão: ['galpao', 'galpao', 'galpao'],
  Terreno: ['terreno', 'terreno', 'condominio'],
  Área: ['campo', 'terreno', 'campo'],
  Chácara: ['rural', 'piscina', 'campo', 'sala', 'rural'],
  Sítio: ['rural', 'campo', 'rural', 'sala'],
  Fazenda: ['campo', 'rural', 'campo', 'rural'],
};

export function caminhoAcervo(categoria: string, n: number): string {
  const total = ACERVO[categoria] ?? 1;
  return `/assets/fotos/${categoria}-${String((n % total) + 1).padStart(2, '0')}.jpg`;
}

const LEGENDAS: Record<string, string> = {
  casa: 'Fachada', predio: 'Fachada do edifício', sala: 'Living', cozinha: 'Cozinha',
  quarto: 'Suíte', banheiro: 'Banheiro', piscina: 'Área de lazer', cobertura: 'Terraço',
  studio: 'Ambiente integrado', escritorio: 'Interior', loja: 'Salão de vendas',
  galpao: 'Área interna', rural: 'Sede', campo: 'Vista aérea', terreno: 'Terreno',
  condominio: 'Lazer do condomínio',
};

const FOTOS: Foto[] = IMOVEIS.filter((imovel) => imovel.titulo !== 'Apartamento Novo Mundo').flatMap(
  (imovel, i) => {
    const album = ALBUNS[imovel.tipo] ?? ALBUNS.Casa;
    // Deslocamento por imóvel e por posição: imóveis vizinhos na lista
    // não repetem a mesma capa, e fotos da mesma categoria no mesmo
    // álbum (duas salas) não são a mesma imagem.
    return album.map((categoria, ordem) => ({
      id: idFalso('99999999', i * 10 + ordem + 1),
      imovel_id: imovel.id,
      path: caminhoAcervo(categoria, i * 3 + ordem * 5),
      legenda: LEGENDAS[categoria] ?? null,
      ordem,
      capa: ordem === 0,
      largura: 1600,
      altura: 1067,
    }));
  },
);

CONDOMINIOS.forEach((condominio, i) => {
  condominio.capa = caminhoAcervo(i % 2 === 0 ? 'condominio' : 'predio', i);
  condominio.galeria = [
    caminhoAcervo('piscina', i),
    caminhoAcervo('sala', i + 4),
    caminhoAcervo('condominio', i + 3),
  ];
});

// ------------------------------------------------------------

/**
 * Estado de partida, sempre em cópia nova.
 *
 * A cópia profunda não é zelo excessivo: as listas acima são constantes
 * de módulo, e o armazém escreve direto no objeto que recebe. Sem o
 * structuredClone, publicar um imóvel alteraria a própria semente, e o
 * botão de reiniciar devolveria o estado já mexido em vez do original.
 */
export function baseInicial(): BaseDemo {
  return structuredClone({
    versao: VERSAO_BASE,
    perfis: PERFIS,
    condominios: CONDOMINIOS,
    proprietarios: PROPRIETARIOS,
    imoveis: IMOVEIS,
    compromissos: COMPROMISSOS,
    vendas: VENDAS,
    parcelas: PARCELAS,
    leads: LEADS,
    interacoes: INTERACOES,
    fotos: FOTOS,
  });
}
