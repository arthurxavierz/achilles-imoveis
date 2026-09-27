/**
 * Tipos do dominio da Achilles.
 *
 * Espelham as colunas das migrations em supabase/migrations. Quando uma
 * coluna mudar la, mude aqui: o TypeScript passa a acusar todo lugar do
 * site e do app que dependia do formato antigo.
 */

export type Papel = 'admin' | 'gestor' | 'corretor';

export type AreaPermissao = 'imoveis' | 'leads' | 'financeiro' | 'usuarios';

export type Permissoes = Record<AreaPermissao, boolean>;

export interface Perfil {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  creci: string | null;
  avatar_url: string | null;
  papel: Papel;
  permissoes: Permissoes;
  meta_mensal: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export type Finalidade = 'venda' | 'locacao' | 'venda_locacao';

/**
 * Condominio ou empreendimento.
 *
 * Existe como entidade propria, e nao como texto no imovel, por dois
 * motivos praticos. O primeiro e a vitrine: a Achilles trabalha alto padrao,
 * e boa parte da procura comeca pelo nome do condominio, nao pelo bairro.
 * O segundo e a importacao: o XML do portal repete o nome do
 * empreendimento em cada unidade, com grafias diferentes, e sem uma
 * tabela para ancorar isso o site mostraria "Vista Galassi" e "Vista
 * Galassi " como dois lugares distintos.
 */
export interface Condominio {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;

  bairro: string | null;
  cidade: string;
  uf: string;
  logradouro: string | null;
  latitude: number | null;
  longitude: number | null;

  construtora: string | null;
  ano_entrega: number | null;
  /** Marca o empreendimento de alto padrao na vitrine. */
  luxo: boolean;
  destaque: boolean;
  publicado: boolean;

  /** Lazer e servicos do condominio, nao da unidade. */
  lazer: string[];
  capa: string | null;
  galeria: string[];
  /** Gradiente de fachada usado quando ainda nao ha foto. */
  cover: string;

  meta_titulo: string | null;
  meta_descricao: string | null;

  criado_em: string;
  atualizado_em: string;
}

/** Condominio com o que a vitrine calcula na hora de listar. */
export interface CondominioComResumo extends Condominio {
  total_imoveis: number;
  menor_valor: number;
  maior_valor: number;
}

/**
 * Quem entrega o imovel para a Achilles vender.
 *
 * Existe como entidade propria, e nao como dois campos de texto no
 * imovel, pela mesma razao que condominio existe: uma pessoa costuma
 * ter mais de um imovel na carteira. Guardado como texto, o telefone
 * que mudou teria de ser corrigido em cada anuncio, e sempre sobra um
 * desatualizado — que e justamente o que alguem vai ligar as sete da
 * noite para negociar uma proposta.
 *
 * O dado aqui e sensivel de verdade: CPF, telefone particular e
 * endereco residencial. E por isso que a view da vitrine nao alcanca
 * esta tabela, e que o RLS da migration 0003 so entrega o registro a
 * gestao ou ao consultor que tem um imovel daquela pessoa na propria
 * carteira.
 */
export interface Proprietario {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
}

/**
 * Proprietario com o que a tela de listagem calcula.
 *
 * Os numeros nao moram na tabela: sao contagem dos imoveis vinculados,
 * e guardar copia deles significaria mante-los certos a cada cadastro,
 * exclusao e transferencia. Sai mais barato contar na hora de mostrar.
 */
export interface ProprietarioComCarteira extends Proprietario {
  total_imoveis: number;
  imoveis_publicados: number;
  valor_carteira: number;
}

export type StatusImovel = 'disponivel' | 'reservado' | 'vendido' | 'locado' | 'inativo';

/** De onde o registro veio. Importado nao se edita na mao sem aviso. */
export type FonteImovel = 'manual' | 'xml' | 'portal';

export interface Imovel {
  id: string;
  codigo: string;
  slug: string;

  titulo: string;
  descricao: string | null;
  tipo: string;
  finalidade: Finalidade;
  status: StatusImovel;

  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string;
  uf: string;
  latitude: number | null;
  longitude: number | null;
  exibir_endereco: boolean;

  valor: number;
  valor_locacao: number | null;
  valor_condominio: number | null;
  valor_iptu: number | null;
  aceita_permuta: boolean;
  aceita_financiamento: boolean;

  area_util: number;
  area_total: number;
  /** Area em hectares. So faz sentido em fazenda, sitio, chacara e area. */
  hectares: number | null;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  ano_construcao: number | null;
  andar: number | null;
  mobiliado: boolean;
  caracteristicas: string[];

  /** Empreendimento ao qual a unidade pertence, quando houver. */
  condominio_id: string | null;
  /** Nome congelado do condominio, para o cartao nao depender do join. */
  condominio_nome: string | null;

  /**
   * Codigo do imovel no sistema de origem, quando veio de importacao.
   * E a chave que evita duplicar o mesmo anuncio a cada sincronizacao do
   * XML: a importacao procura por ela antes de inserir.
   */
  referencia_externa: string | null;
  fonte: FonteImovel;
  importado_em: string | null;

  proprietario_id: string | null;
  corretor_id: string | null;
  exclusividade: boolean;
  autorizacao_ate: string | null;
  matricula: string | null;
  observacoes_internas: string | null;

  publicado: boolean;
  destaque: boolean;
  publicar_portais: boolean;
  cover: string;
  visualizacoes: number;

  meta_titulo: string | null;
  meta_descricao: string | null;

  criado_em: string;
  atualizado_em: string;
}

/**
 * O que a vitrine publica enxerga. E um subconjunto do Imovel: os campos
 * de captacao (proprietario, matricula, observacoes internas) nao existem
 * aqui, e o endereco some quando exibir_endereco e falso. Vem da view
 * vitrine_imoveis, nao da tabela.
 */
export type ImovelPublico = Pick<
  Imovel,
  | 'id' | 'codigo' | 'slug' | 'titulo' | 'descricao' | 'tipo' | 'finalidade' | 'status'
  | 'bairro' | 'cidade' | 'uf' | 'logradouro' | 'numero' | 'cep' | 'latitude' | 'longitude'
  | 'valor' | 'valor_locacao' | 'valor_condominio' | 'valor_iptu'
  | 'aceita_permuta' | 'aceita_financiamento'
  | 'area_util' | 'area_total' | 'hectares' | 'quartos' | 'suites' | 'banheiros' | 'vagas'
  | 'ano_construcao' | 'andar' | 'mobiliado' | 'caracteristicas'
  | 'condominio_id' | 'condominio_nome' | 'referencia_externa'
  | 'destaque' | 'cover' | 'meta_titulo' | 'meta_descricao'
  | 'criado_em' | 'atualizado_em'
> & {
  fotos?: Foto[];
};

export interface Foto {
  id: string;
  imovel_id: string;
  path: string;
  legenda: string | null;
  ordem: number;
  capa: boolean;
  largura: number | null;
  altura: number | null;
}

export type OrigemLead =
  | 'site' | 'vitrine' | 'whatsapp' | 'portal' | 'indicacao' | 'instagram' | 'telefone'
  | 'presencial' | 'prospeccao' | 'manual';

export type EtapaLead = 'novo' | 'contato' | 'visita' | 'proposta' | 'fechado' | 'perdido';

export type Temperatura = 'frio' | 'morno' | 'quente';

export interface Lead {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  mensagem: string | null;
  origem: OrigemLead;
  etapa: EtapaLead;
  temperatura: Temperatura;
  score: number;
  imovel_id: string | null;
  imovel_titulo: string | null;
  valor: number;
  corretor_id: string | null;
  consentimento_lgpd: boolean;
  consentimento_em: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  pagina_origem: string | null;
  arquivado: boolean;
  motivo_perda: string | null;
  proximo_contato: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type TipoInteracao =
  | 'nota' | 'ligacao' | 'whatsapp' | 'email' | 'visita' | 'proposta' | 'sistema';

export interface Interacao {
  id: string;
  lead_id: string;
  tipo: TipoInteracao;
  conteudo: string;
  autor_id: string | null;
  autor_nome: string | null;
  criado_em: string;
}

export type TipoTransacao = 'comissao' | 'receita' | 'despesa';
export type StatusTransacao = 'pendente' | 'pago' | 'cancelado';

export interface Transacao {
  id: string;
  tipo: TipoTransacao;
  descricao: string;
  categoria: string | null;
  consultor_id: string | null;
  imovel_id: string | null;
  valor_venda: number;
  percentual: number | null;
  valor: number;
  data: string;
  vencimento: string | null;
  status: StatusTransacao;
  observacoes: string | null;
  criado_em: string;
}

/** Filtros da busca da vitrine. Espelham os parametros da URL. */
export interface FiltroBusca {
  termo?: string;
  tipo?: string;
  finalidade?: Finalidade;
  bairro?: string;
  cidade?: string;
  condominio?: string;
  quartos?: number;
  suites?: number;
  banheiros?: number;
  vagas?: number;
  valorMin?: number;
  valorMax?: number;
  areaMin?: number;
  areaMax?: number;
  caracteristicas?: string[];
  /** Apenas os marcados como destaque na vitrine. */
  somenteDestaque?: boolean;
  ordem?: OrdemBusca;
  pagina?: number;
  porPagina?: number;
}

/**
 * Filtros da carteira interna, no painel.
 *
 * Nao e o mesmo que FiltroBusca. Aquele descreve o que o visitante
 * procura na vitrine; este descreve o que a equipe procura na propria
 * carteira, e inclui recorte que nunca pode aparecer no site: por
 * proprietario, por consultor responsavel e por imovel que ainda esta
 * fora do ar.
 */
export interface FiltroCarteira {
  termo: string;
  tipo: string;
  status: string;
  finalidade: string;
  bairro: string;
  cidade: string;
  proprietario: string;
  consultor: string;
  vitrine: '' | 'publicados' | 'fora' | 'destaque';
  valorMin: number | null;
  valorMax: number | null;
  quartosMin: number | null;
  vagasMin: number | null;
  areaMin: number | null;
  /** Imovel sem proprietario vinculado, que precisa de regularizacao. */
  semProprietario: boolean;
}

export const FILTRO_CARTEIRA_VAZIO: FiltroCarteira = {
  termo: '',
  tipo: '',
  status: '',
  finalidade: '',
  bairro: '',
  cidade: '',
  proprietario: '',
  consultor: '',
  vitrine: '',
  valorMin: null,
  valorMax: null,
  quartosMin: null,
  vagasMin: null,
  areaMin: null,
  semProprietario: false,
};

export type OrdemBusca =
  | 'relevancia'
  | 'recentes'
  | 'menor_preco'
  | 'maior_preco'
  | 'maior_area'
  | 'menor_area';
