import Image from 'next/image';
import Link from 'next/link';

import type { CondominioComResumo } from '@imob/core';
import { brlCurto } from '@imob/core';

import { IconeEstrela } from './Icones';

/**
 * Cartao de condominio.
 *
 * Formato vertical, com a foto ocupando o cartao inteiro e o texto
 * escrito sobre ela. E o formato que a vitrine original usa, e ele faz
 * sentido: o que vende um empreendimento de alto padrao e a fachada e o
 * lazer, nao uma lista de atributos.
 *
 * A contagem de unidades vem calculada da view, entao o cartao nao faz
 * consulta nenhuma. Quando o condominio ainda nao tem unidade publicada,
 * o texto muda em vez de mostrar um zero seco, que passaria a impressao
 * de vitrine desatualizada.
 */
export function CartaoCondominio({
  condominio,
  prioridade = false,
}: {
  condominio: CondominioComResumo;
  prioridade?: boolean;
}) {
  const { total_imoveis: total, menor_valor: menor } = condominio;

  return (
    <Link
      href={`/condominio/${condominio.slug}`}
      className="cartao-condominio-grande"
      data-brilho
      aria-label={`${condominio.nome}, ${condominio.cidade}`}
    >
      {condominio.capa ? (
        <Image
          src={condominio.capa}
          alt={condominio.nome}
          fill
          sizes="(max-width: 720px) 100vw, 320px"
          style={{ objectFit: 'cover' }}
          priority={prioridade}
        />
      ) : (
        <span className="cartao-condominio-fundo" data-cover={condominio.cover} aria-hidden="true" />
      )}

      <span className="cartao-condominio-veu" aria-hidden="true" />

      {condominio.luxo && (
        <span className="selo-luxo">
          <IconeEstrela />
          Alto padrão
        </span>
      )}

      <div className="cartao-condominio-corpo">
        <h3>{condominio.nome}</h3>
        <span className="cartao-condominio-local">
          {condominio.bairro ? `${condominio.bairro}, ` : ''}
          {condominio.cidade} - {condominio.uf}
        </span>

        <div className="cartao-condominio-meta">
          {total > 0 ? (
            <>
              <span>
                {total} {total === 1 ? 'imóvel disponível' : 'imóveis disponíveis'}
              </span>
              {menor > 0 && <span>a partir de {brlCurto(menor)}</span>}
            </>
          ) : (
            <span>Conheça o empreendimento</span>
          )}
        </div>
      </div>
    </Link>
  );
}
