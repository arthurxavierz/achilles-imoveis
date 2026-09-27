/** Teto de linhas por resposta do PostgREST. Pedir mais nao adianta. */
const PAGINA = 1000;

interface Resposta {
  data: unknown;
  error: { message: string } | null;
}

/**
 * Le uma consulta inteira, em faixas de mil.
 *
 * Existe porque o PostgREST corta toda resposta em mil linhas e nao
 * avisa. Um `.limit(5000)` parece pedir cinco mil e recebe mil, sem
 * erro: a tela passa a contar menos do que existe. Ja aconteceu tres
 * vezes neste projeto, e nas tres o defeito so apareceu quando alguem
 * estranhou um numero.
 *
 * Nao pesa mais do que o codigo que substitui. Consulta com menos de mil
 * linhas custa exatamente uma requisicao, igual a antes; a segunda so
 * acontece quando existe mesmo uma milesima primeira linha para buscar.
 *
 * Quem chama monta a propria consulta e so recebe a faixa a buscar. E de
 * proposito: a tipagem do construtor do Supabase depende dos filtros
 * encadeados, e tentar embrulhar isso numa funcao generica gera um tipo
 * que o compilador nao consegue resolver. No ponto de chamada tudo se
 * resolve sozinho.
 *
 *   const leads = await lerTudo<Lead>((de, ate) =>
 *     supabase.from('leads').select('*').eq('arquivado', false).range(de, ate),
 *   );
 */
export async function lerTudo<T>(
  faixa: (de: number, ate: number) => PromiseLike<Resposta>,
  teto = 20000,
): Promise<T[]> {
  const linhas: T[] = [];

  while (linhas.length < teto) {
    const de = linhas.length;
    const ate = Math.min(de + PAGINA, teto) - 1;

    const { data, error } = await faixa(de, ate);

    if (error) {
      console.error(`[consultas] falha ao ler a partir de ${de}:`, error.message);
      break;
    }

    const bloco = (Array.isArray(data) ? data : []) as T[];
    linhas.push(...bloco);

    // Faixa incompleta significa fim dos dados, e nao erro.
    if (bloco.length < ate - de + 1) break;
  }

  return linhas;
}
