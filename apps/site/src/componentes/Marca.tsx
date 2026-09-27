import Link from 'next/link';

import { SITE } from '../lib/site';
import { NomeMarca, SeloMarca } from './MarcaDemo';

/**
 * A marca da Achilles, por extenso.
 *
 * O logotipo é composto aqui em HTML, e não importado como um SVG
 * pronto, por três razões práticas:
 *
 *   O nome fica sendo texto de verdade. Leitor de tela lê "achilles", o
 *   Google indexa a palavra, e quem copia o cabeçalho copia o nome —
 *   nada disso acontece com um SVG achatado.
 *
 *   Escala sem decisão. Um SVG de logotipo tem uma proporção fixa
 *   entre símbolo e palavra; aqui os dois acompanham o corpo de texto
 *   do contexto, e a versão compacta do celular sai da mesma fonte.
 *
 *   Uma família só. O wordmark usa a mesma Outfit do resto do site,
 *   então trocar a fonte troca o logotipo junto, sem alguém precisar
 *   lembrar de reexportar um arquivo.
 *
 * O símbolo continua vindo do SVG, porque desenho é desenho.
 */
export function Marca({
  href = '/',
  rotulo,
  compacta = false,
}: {
  href?: string;
  rotulo?: string;
  /** Só o símbolo e a palavra, sem a linha de apoio. */
  compacta?: boolean;
}) {
  return (
    <Link href={href} className="marca" aria-label={rotulo ?? SITE.nome}>
      <SeloMarca />
      <span className="marca-texto">
        <span className="marca-nome" aria-hidden="true">
          <NomeMarca padrao="achilles" />
        </span>
        {!compacta && (
          <span className="marca-sub" aria-hidden="true">
            imóveis de alto padrão
          </span>
        )}
      </span>
    </Link>
  );
}
