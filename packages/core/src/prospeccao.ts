/**
 * Prospecção de empresas para locação e venda comercial.
 *
 * A ideia vem do Achilles Command, e a mecânica de busca é a mesma:
 * Google Places devolve empresas de um segmento numa cidade, com
 * telefone, site, nota e volume de avaliações.
 *
 * O que NÃO foi copiado é a pontuação. Lá o score responde "esta
 * empresa precisa de site?", porque a Achilles vende site. Aqui a
 * pergunta é outra: **esta empresa é candidata a alugar ou comprar um
 * imóvel comercial?** São perguntas diferentes e os sinais pesam ao
 * contrário — uma empresa com site bonito e quinhentas avaliações é um
 * cliente ruim para quem vende site e um ótimo candidato a sala maior.
 *
 * O que os sinais do Places dizem, e o que não dizem:
 *
 *   VOLUME DE AVALIAÇÕES é o melhor indicador de porte que existe de
 *   graça. Não mede faturamento, mas separa a empresa que atende três
 *   pessoas por dia da que atende trezentas — e é a segunda que cresce
 *   e precisa de espaço.
 *
 *   TIPO DE NEGÓCIO diz quanto o espaço importa. Clínica, academia e
 *   restaurante vivem do ponto: mudar de endereço é decisão de ano.
 *   Consultoria e serviço remoto podem operar de qualquer lugar.
 *
 *   NOTA alta com volume alto é sinal de operação saudável, e operação
 *   saudável é quem tem dinheiro para mudar.
 *
 * O que nenhum desses sinais diz: se a empresa está insatisfeita com o
 * imóvel atual, se o contrato vence, se ela é dona do ponto. Isso só a
 * ligação descobre — e é por isso que o score se chama "potencial", e
 * a tela mostra os motivos em vez de só o número.
 */

export interface Prospecto {
  /** `gplace_` + o id do Google. Estável entre buscas, e é a chave da
   *  reconciliação: a mesma empresa buscada duas vezes não duplica. */
  id: string;
  origem_id: string;

  nome: string;
  categoria: string;
  endereco: string;
  telefone: string;
  site: string;

  latitude: number;
  longitude: number;
  /** Distância até o centro da cidade buscada. Nulo quando não foi
   *  possível localizar a cidade. */
  distancia_km: number | null;
  mapa_url: string;

  nota: number;
  avaliacoes: number;
  situacao: string;
  tipos: string[];

  score: number;
  faixa: FaixaProspecto;
  motivos: string[];
  /** O que a Achilles tem a oferecer a esta empresa, em uma linha. */
  encaixe: string;
}

export type FaixaProspecto = 'Muito alta' | 'Alta' | 'Média' | 'Baixa';

export interface FiltroProspeccao {
  segmento: string;
  cidade: string;
  uf: string;
  raioKm: number;
  limite: number;
}

export const FILTRO_PROSPECCAO_PADRAO: FiltroProspeccao = {
  segmento: '',
  cidade: '',
  uf: 'MG',
  raioKm: 20,
  limite: 30,
};

export const RAIOS_PROSPECCAO = [5, 10, 20, 30, 50] as const;
export const LIMITES_PROSPECCAO = [20, 30, 40, 60] as const;

/**
 * Segmentos que valem a pena prospectar, com o porquê.
 *
 * A lista não é exaustiva: o campo aceita qualquer texto. Ela existe
 * para quem abre a tela pela primeira vez e não sabe o que digitar —
 * e porque estes são os segmentos onde o ponto comercial pesa mais na
 * operação, que é onde a conversa sobre imóvel começa mais fácil.
 */
export const SEGMENTOS_SUGERIDOS: { termo: string; porque: string }[] = [
  { termo: 'clínicas', porque: 'Precisam de sala com adaptação, e trocam quando crescem.' },
  { termo: 'academias', porque: 'Metragem grande e pé-direito alto. Poucos imóveis servem.' },
  { termo: 'restaurantes', porque: 'Vivem do ponto. Movimento e estacionamento decidem.' },
  { termo: 'escritórios de advocacia', porque: 'Buscam endereço de prestígio no centro.' },
  { termo: 'escolas', porque: 'Terreno amplo e licença de uso. Negociação longa e cara.' },
  { termo: 'pet shops', porque: 'Setor em expansão, muita abertura de segunda unidade.' },
  { termo: 'laboratórios', porque: 'Exigem instalação específica e contrato longo.' },
  { termo: 'concessionárias', porque: 'Área de exposição grande, quase sempre alugada.' },
];

const limitar = (n: number, min: number, max: number) => Math.max(min, Math.min(max, Number(n)));

/**
 * Quanto o ponto comercial pesa na operação deste negócio.
 *
 * É o multiplicador mais importante do score. Uma consultoria com mil
 * avaliações não vira cliente de imóvel; uma clínica com cem, sim.
 */
function pesoDoPonto(categoria: string, tipos: string[]): number {
  const texto = `${categoria} ${(tipos ?? []).join(' ')}`.toLowerCase();

  // O ponto É o negócio: mudar de endereço é reposicionar a empresa.
  if (
    /gym|fitness|academia|restaurant|food|cafe|bar|bakery|school|escola|hospital|clinic|dental|dent|veterinar|laborator|car_dealer|store|supermarket|market|hotel|lodging|church|event/.test(
      texto,
    )
  ) {
    return 26;
  }

  // O ponto importa, mas a empresa sobrevive a uma mudança.
  if (/lawyer|account|office|agency|insurance|real_estate|bank|finance|travel|beauty|spa|salon|pharmacy|repair|clinic/.test(texto)) {
    return 17;
  }

  return 9;
}

/**
 * O quanto esta empresa parece candidata a um imóvel comercial.
 *
 * Devolve o número, a faixa, os motivos em português e uma linha de
 * encaixe. Os motivos existem porque score sozinho não sustenta uma
 * ligação: quem liga precisa saber o que dizer nos primeiros dez
 * segundos, e "vi que vocês têm 340 avaliações" é uma abertura, "score
 * 82" não é.
 */
export function pontuarProspecto(
  p: Pick<Prospecto, 'categoria' | 'tipos' | 'telefone' | 'site' | 'nota' | 'avaliacoes' | 'situacao'>,
): Pick<Prospecto, 'score' | 'faixa' | 'motivos' | 'encaixe'> {
  const avaliacoes = Number(p.avaliacoes || 0);
  const nota = Number(p.nota || 0);

  // A soma dos máximos dá 92, não 100, e isso é deliberado.
  //
  // Uma escala que estoura o teto perde justamente onde precisa
  // separar: se clínica com 400 avaliações e restaurante com 1.400
  // marcam 100 os dois, o número parou de ordenar e virou enfeite.
  // Deixando folga no topo, a diferença entre "muito bom" e
  // "excepcional" continua visível, e sobra espaço para um sinal novo
  // entrar um dia sem reescrever a escala inteira.
  let score = 24 + pesoDoPonto(p.categoria, p.tipos);

  // Porte, pelo volume de avaliações. Os degraus são largos de
  // propósito: a diferença entre 40 e 60 avaliações não significa
  // nada, a diferença entre 40 e 400 significa tudo.
  if (avaliacoes >= 30) score += 6;
  if (avaliacoes >= 120) score += 8;
  if (avaliacoes >= 400) score += 7;
  if (avaliacoes >= 1000) score += 4;

  // Operação saudável tem caixa para mudar.
  if (nota >= 4.0 && avaliacoes >= 20) score += 5;
  if (nota >= 4.5 && avaliacoes >= 50) score += 3;

  // Sem telefone não há prospecção: o lead existe mas não é acionável.
  if (p.telefone) score += 6;
  else score -= 14;

  // Site próprio indica empresa estruturada, não apenas um ponto.
  if (p.site) score += 3;

  if (p.situacao && p.situacao !== 'OPERATIONAL') score -= 25;

  score = limitar(Math.round(score), 0, 100);

  const motivos: string[] = [];

  if (avaliacoes >= 400) motivos.push(`${avaliacoes.toLocaleString('pt-BR')} avaliações: operação de porte`);
  else if (avaliacoes >= 120) motivos.push(`${avaliacoes.toLocaleString('pt-BR')} avaliações: movimento consolidado`);
  else if (avaliacoes >= 30) motivos.push(`${avaliacoes.toLocaleString('pt-BR')} avaliações no Google`);
  else if (avaliacoes > 0) motivos.push(`apenas ${avaliacoes} avaliações: pode ser recente`);
  else motivos.push('sem avaliações: empresa nova ou pouco ativa no Google');

  if (nota >= 4.5) motivos.push(`nota ${nota.toFixed(1)}: reputação forte`);
  else if (nota > 0) motivos.push(`nota ${nota.toFixed(1)}`);

  motivos.push(p.telefone ? 'telefone publicado' : 'sem telefone: precisa de outro caminho');
  if (p.site) motivos.push('tem site próprio');
  if (p.situacao && p.situacao !== 'OPERATIONAL') motivos.push('marcado como fechado no Google');

  // Os cortes acompanham o teto de 92: 'Muito alta' começa em 78, que
  // é o que uma empresa de porte num segmento de ponto forte alcança.
  const faixa: FaixaProspecto =
    score >= 78 ? 'Muito alta' : score >= 62 ? 'Alta' : score >= 46 ? 'Média' : 'Baixa';

  return { score, faixa, motivos, encaixe: encaixeComercial(p.categoria, p.tipos, avaliacoes) };
}

/** A frase que o consultor usa para abrir a conversa. */
function encaixeComercial(categoria: string, tipos: string[], avaliacoes: number): string {
  const peso = pesoDoPonto(categoria, tipos);

  if (peso >= 26) {
    return avaliacoes >= 200
      ? 'Ponto é o negócio, e o movimento sugere que o espaço atual pode estar apertado.'
      : 'Ponto é o negócio. Vale entender se o imóvel atual atende ao que planejam.';
  }
  if (peso >= 17) {
    return avaliacoes >= 200
      ? 'Empresa estruturada. Costuma buscar endereço melhor ao crescer.'
      : 'Serviço com atendimento presencial. Endereço pesa na captação de cliente.';
  }
  return 'Encaixe menos direto. Vale como contato de relacionamento, não como abordagem de imóvel.';
}

export const COR_FAIXA: Record<FaixaProspecto, string> = {
  'Muito alta': 'verde',
  Alta: 'ouro',
  Média: 'ambar',
  Baixa: 'cinza',
};
