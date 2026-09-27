/**
 * Importacao de imoveis por feed externo.
 *
 * A carteira da Achilles vive hoje no portal, e vai chegar aqui por XML. O
 * desenho deste modulo parte de tres fatos dessa realidade:
 *
 * 1. O MESMO IMOVEL VOLTA A CADA SINCRONIZACAO. Por isso a reconciliacao
 *    e feita por referencia externa, e nao por titulo ou endereco: o
 *    portal reescreve o titulo a cada edicao do anuncio, e casar por
 *    texto criaria um imovel novo toda vez.
 *
 * 2. O FEED TRAZ O ANUNCIO, NAO A ESTRATEGIA DA CASA. Publicar, destacar
 *    e definir o consultor responsavel continuam sendo decisao da
 *    gestao. Uma reimportacao nunca repoe no ar o que alguem tirou.
 *
 * 3. A FOTO JA ESTA HOSPEDADA. Guardamos a URL de origem em vez de
 *    baixar cada imagem: mil imoveis com quinze fotos sao quinze mil
 *    downloads a cada rodada, e o portal serve por CDN de qualquer jeito.
 *
 * A leitura do XML em si fica de fora de proposito. Cada portal usa um
 * formato diferente, e o unico contrato estavel e o objeto normalizado
 * abaixo: quem escrever o adaptador do Kenlo, do ZAP ou do VivaReal
 * entrega esta forma, e o resto do caminho e o mesmo.
 */

import type { Cliente } from './clientes';

export interface ImovelImportado {
  /** Codigo do anuncio no sistema de origem. E a chave da importacao. */
  referencia_externa: string;

  titulo: string;
  descricao?: string | null;
  tipo?: string | null;
  finalidade?: 'venda' | 'locacao' | 'venda_locacao' | null;

  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  latitude?: number | null;
  longitude?: number | null;

  /** Nome do empreendimento. Cria o condominio quando ainda nao existe. */
  condominio?: string | null;

  valor?: number | null;
  valor_locacao?: number | null;
  valor_condominio?: number | null;
  valor_iptu?: number | null;

  area_util?: number | null;
  area_total?: number | null;
  hectares?: number | null;
  quartos?: number | null;
  suites?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  ano_construcao?: number | null;
  andar?: number | null;

  caracteristicas?: string[];
  /** URLs completas. A primeira vira capa. */
  fotos?: string[];
}

export interface RelatorioImportacao {
  total: number;
  gravados: number;
  falhas: { referencia: string; motivo: string }[];
  duracaoMs: number;
}

/**
 * Grava um lote de imoveis vindos do feed.
 *
 * Vai em blocos pequenos e sequenciais, nao em paralelo. Numa carteira
 * de mil imoveis, disparar mil chamadas simultaneas derruba a conexao do
 * Supabase antes de terminar; em blocos, a importacao demora mais e
 * termina. Uma falha individual nao interrompe o lote: ela entra no
 * relatorio e a rodada continua, porque perder novecentos imoveis por
 * causa de um registro torto seria o pior resultado possivel.
 */
export async function importarLote(
  cliente: Cliente,
  registros: ImovelImportado[],
  opcoes: { tamanhoBloco?: number; aoProgredir?: (feitos: number, total: number) => void } = {},
): Promise<RelatorioImportacao> {
  const comeco = Date.now();
  const tamanho = Math.max(1, Math.min(50, opcoes.tamanhoBloco ?? 20));

  const relatorio: RelatorioImportacao = {
    total: registros.length,
    gravados: 0,
    falhas: [],
    duracaoMs: 0,
  };

  for (let i = 0; i < registros.length; i += tamanho) {
    const bloco = registros.slice(i, i + tamanho);

    const resultados = await Promise.allSettled(
      bloco.map(async (registro) => {
        const { error } = await cliente.rpc('importar_imovel', { p_dados: registro });
        if (error) throw new Error(error.message);
        return registro.referencia_externa;
      }),
    );

    resultados.forEach((r, indice) => {
      if (r.status === 'fulfilled') {
        relatorio.gravados++;
      } else {
        relatorio.falhas.push({
          referencia: bloco[indice].referencia_externa,
          motivo: String(r.reason?.message ?? r.reason),
        });
      }
    });

    opcoes.aoProgredir?.(Math.min(i + tamanho, registros.length), registros.length);
  }

  relatorio.duracaoMs = Date.now() - comeco;
  return relatorio;
}

/**
 * Normaliza um registro solto vindo do XML.
 *
 * Aceita os nomes de campo mais comuns dos feeds brasileiros e devolve a
 * forma que importarLote() espera. Os apelidos existem porque nenhum
 * portal concorda com o outro: o mesmo dado se chama "ValorVenda",
 * "PrecoVenda" ou "valor" dependendo de quem exporta.
 */
export function normalizarRegistro(bruto: Record<string, unknown>): ImovelImportado | null {
  const texto = (...chaves: string[]): string | null => {
    for (const chave of chaves) {
      const v = bruto[chave];
      if (typeof v === 'string' && v.trim()) return v.trim();
      if (typeof v === 'number') return String(v);
    }
    return null;
  };

  const numero = (...chaves: string[]): number | null => {
    const v = texto(...chaves);
    if (!v) return null;
    // "R$ 1.250.000,00" e "1250000.00" precisam virar o mesmo numero.
    const limpo = v.replace(/[^\d,.-]/g, '');
    const normalizado =
      limpo.includes(',') && limpo.lastIndexOf(',') > limpo.lastIndexOf('.')
        ? limpo.replace(/\./g, '').replace(',', '.')
        : limpo.replace(/,/g, '');
    const n = Number(normalizado);
    return Number.isFinite(n) ? n : null;
  };

  const referencia = texto('referencia_externa', 'CodigoImovel', 'codigo', 'ListingID', 'id');
  const titulo = texto('titulo', 'TituloImovel', 'Title', 'nome');

  // Sem referencia nao ha como reconciliar, e sem titulo nao ha anuncio.
  // Registro torto entra no relatorio de falhas em vez de virar lixo na
  // vitrine.
  if (!referencia || !titulo) return null;

  const finalidadeBruta = (texto('finalidade', 'TipoOferta', 'TransactionType') ?? '').toLowerCase();
  const finalidade = finalidadeBruta.includes('alug') || finalidadeBruta.includes('rent')
    ? finalidadeBruta.includes('venda') || finalidadeBruta.includes('sale')
      ? ('venda_locacao' as const)
      : ('locacao' as const)
    : ('venda' as const);

  const lista = (chave: string): string[] => {
    const v = bruto[chave];
    if (Array.isArray(v)) return v.map(String).filter(Boolean);
    if (typeof v === 'string') return v.split(/[;|]/).map((s) => s.trim()).filter(Boolean);
    return [];
  };

  return {
    referencia_externa: referencia,
    titulo,
    descricao: texto('descricao', 'Observacao', 'Description'),
    tipo: texto('tipo', 'TipoImovel', 'PropertyType'),
    finalidade,

    cep: texto('cep', 'CEP'),
    logradouro: texto('logradouro', 'Endereco', 'Address'),
    numero: texto('numero', 'Numero'),
    bairro: texto('bairro', 'Bairro', 'Neighborhood'),
    cidade: texto('cidade', 'Cidade', 'City'),
    uf: texto('uf', 'UF', 'Estado', 'State'),
    latitude: numero('latitude', 'Latitude'),
    longitude: numero('longitude', 'Longitude'),

    condominio: texto('condominio', 'NomeCondominio', 'Empreendimento', 'Building'),

    valor: numero('valor', 'PrecoVenda', 'ValorVenda', 'ListPrice'),
    valor_locacao: numero('valor_locacao', 'PrecoLocacao', 'ValorLocacao', 'RentalPrice'),
    valor_condominio: numero('valor_condominio', 'PrecoCondominio', 'ValorCondominio'),
    valor_iptu: numero('valor_iptu', 'PrecoIptu', 'ValorIptu'),

    area_util: numero('area_util', 'AreaUtil', 'LivingArea'),
    area_total: numero('area_total', 'AreaTotal', 'LotArea'),
    hectares: numero('hectares', 'AreaHectares'),
    quartos: numero('quartos', 'QtdDormitorios', 'Bedrooms'),
    suites: numero('suites', 'QtdSuites', 'Suites'),
    banheiros: numero('banheiros', 'QtdBanheiros', 'Bathrooms'),
    vagas: numero('vagas', 'QtdVagas', 'Garage'),
    ano_construcao: numero('ano_construcao', 'AnoConstrucao', 'YearBuilt'),
    andar: numero('andar', 'Andar'),

    caracteristicas: lista('caracteristicas').concat(lista('Caracteristicas')),
    fotos: lista('fotos').concat(lista('Fotos'), lista('Media')),
  };
}
