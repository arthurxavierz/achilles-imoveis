import Image from 'next/image';
import Link from 'next/link';

import {
  DESTINO_EMPREENDIMENTO,
  EMPREENDIMENTOS,
  arteDoEmpreendimento,
} from '@/lib/empreendimentos';

import { IconeSeta } from './Icones';

/**
 * Grade dos empreendimentos com site próprio.
 *
 * Só no desktop, por decisão de quem pediu: no celular a grade viria
 * depois do hero e antes de qualquer imóvel, empurrando a vitrine para
 * baixo do terceiro rolar. O CSS esconde tudo abaixo de 1200px, e a
 * marcação continua no HTML.
 *
 * Os dez levam ao contato, e é por isso que o link é interno e abre na
 * mesma aba: quem clica num lançamento está começando uma conversa, não
 * saindo do site.
 *
 * Sem componente de cliente e sem JavaScript. A entrada escalonada é
 * uma animação de CSS com atraso por índice, e o realce no hover é
 * seletor puro. Isso não é economia de linha: a seção equivalente que
 * dependia do observador de interseção ficou invisível em parte das
 * máquinas, e aqui não há nada que possa deixar de acontecer.
 */
export function GradeEmpreendimentos() {
  if (EMPREENDIMENTOS.length === 0) return null;

  return (
    <div className="grade-empreendimentos">
      {EMPREENDIMENTOS.map((item, i) => (
        <Link
          key={item.arquivo}
          className="empreendimento"
          href={DESTINO_EMPREENDIMENTO}
          aria-label={`Falar sobre o ${item.nome}`}
          // O atraso vem do índice: são dez elementos fixos, e uma
          // variável por item evita dez regras nth-child no CSS.
          style={{ '--ordem': i } as React.CSSProperties}
        >
          <Image
            src={arteDoEmpreendimento(item.arquivo)}
            alt={item.nome}
            fill
            sizes="(max-width: 1200px) 0px, 20vw"
            style={{ objectFit: 'cover' }}
          />

          <span className="empreendimento-veu" aria-hidden="true" />

          <span className="empreendimento-nome">
            {item.nome}
            <IconeSeta />
          </span>
        </Link>
      ))}
    </div>
  );
}
