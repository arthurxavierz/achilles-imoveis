/**
 * Lançamentos divulgados na home.
 *
 * Não saem do banco, e não é esquecimento: nenhum deles existe na
 * carteira importada. São lançamentos que a Achilles divulga à parte, e
 * amarrá-los à tabela de condomínios criaria dez registros vazios só
 * para segurar um nome e uma foto.
 *
 * Todos os cartões levam ao contato, e não ao site de cada lançamento.
 * A decisão é de quem vende: em lançamento a conversa começa com o
 * consultor, e mandar a pessoa para fora do site no meio da visita
 * entrega a intenção para outro lugar. O endereço de cada um fica
 * guardado abaixo, em `site`, para o dia em que a decisão mudar.
 *
 * Para trocar a arte de um deles, basta substituir o arquivo em
 * assets/fotos/ e apontando o campo arquivo para ela. O `npm run assets`
 * roda antes de todo build e leva a imagem nova para o site.
 *
 * Para tirar um do ar, apague a linha. Para acrescentar, some a linha e
 * ponha a imagem na pasta. A grade só aparece no desktop e foi desenhada
 * para dez, em cinco colunas por duas linhas: mexer na quantidade pede
 * um olhar no `.grade-empreendimentos` do globals.css.
 */
export interface Empreendimento {
  nome: string;
  /** Nome do arquivo em assets/fotos, sem a extensão. */
  arquivo: string;
  /**
   * Site próprio do lançamento. Registro, não destino: hoje o cartão
   * aponta para DESTINO_EMPREENDIMENTO.
   */
  site: string;
}

/** Para onde todo cartão de lançamento leva. */
export const DESTINO_EMPREENDIMENTO = '/contato';

export const EMPREENDIMENTOS: Empreendimento[] = [
  { nome: 'Vértice Residence', arquivo: 'predio-01', site: '' },
  { nome: 'Torre Atlântica', arquivo: 'predio-02', site: '' },
  { nome: 'Jardins do Lago', arquivo: 'condominio-02', site: '' },
  { nome: 'Casa Alta', arquivo: 'casa-05', site: '' },
  { nome: 'Mirante Parque', arquivo: 'predio-03', site: '' },
  { nome: 'Solar das Palmeiras', arquivo: 'condominio-03', site: '' },
  { nome: 'Reserva Aurora', arquivo: 'casa-08', site: '' },
  { nome: 'Horizonte Club', arquivo: 'condominio-04', site: '' },
  { nome: 'Edifício Ônix', arquivo: 'predio-04', site: '' },
  { nome: 'Villa Toscana', arquivo: 'casa-11', site: '' },
];

/** Caminho público da arte: o acervo de fotos, sincronizado para o public/ pelo npm run assets. */
export function arteDoEmpreendimento(arquivo: string): string {
  return `/assets/fotos/${arquivo}.jpg`;
}
