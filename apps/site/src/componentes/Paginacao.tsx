import Link from 'next/link';

type Params = Record<string, string | string[] | undefined>;

/**
 * Paginacao em links de verdade (<a href>), nao em botoes com onClick.
 * E o que permite ao Google seguir e indexar a pagina 2, 3, 4 da
 * listagem. Uma paginacao feita so com JavaScript esconde do buscador
 * todo o acervo que nao esta na primeira pagina.
 */
export function Paginacao({
  pagina,
  totalPaginas,
  params,
}: {
  pagina: number;
  totalPaginas: number;
  params: Params;
}) {
  if (totalPaginas <= 1) return null;

  const href = (n: number): string => {
    const q = new URLSearchParams();
    for (const [chave, valor] of Object.entries(params)) {
      if (chave === 'pagina' || valor == null) continue;
      q.set(chave, Array.isArray(valor) ? valor[0] : valor);
    }
    if (n > 1) q.set('pagina', String(n));
    const s = q.toString();
    return s ? `/imoveis?${s}` : '/imoveis';
  };

  return (
    <nav className="paginacao" aria-label="Paginação dos resultados">
      {pagina > 1 ? (
        <Link href={href(pagina - 1)} rel="prev">
          Anterior
        </Link>
      ) : (
        <span className="inativo">Anterior</span>
      )}

      {janela(pagina, totalPaginas).map((n, i) =>
        n === null ? (
          <span key={`sep-${i}`} className="inativo">
            …
          </span>
        ) : n === pagina ? (
          <span key={n} className="atual" aria-current="page">
            {n}
          </span>
        ) : (
          <Link key={n} href={href(n)}>
            {n}
          </Link>
        ),
      )}

      {pagina < totalPaginas ? (
        <Link href={href(pagina + 1)} rel="next">
          Próxima
        </Link>
      ) : (
        <span className="inativo">Próxima</span>
      )}
    </nav>
  );
}

/** Primeira, ultima, e as vizinhas da atual. O resto vira reticencia. */
function janela(atual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  const lista = [...paginas].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const saida: (number | null)[] = [];
  let anterior = 0;
  for (const n of lista) {
    if (n - anterior > 1) saida.push(null);
    saida.push(n);
    anterior = n;
  }
  return saida;
}
