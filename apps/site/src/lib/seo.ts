/**
 * Dados estruturados (JSON-LD) para o Google.
 *
 * Isto e o que separa "aparecer na busca" de "aparecer bem na busca".
 * O schema RealEstateListing faz a pagina do imovel concorrer aos
 * resultados ricos, com foto, preco e numero de quartos direto no
 * Google, e alimenta o painel de negocio local.
 */

import type { ImovelPublico } from '@imob/core';
import { enderecoPublico, precoVigente } from '@imob/core';
import { urlCapa } from '@imob/db';

import { SITE, telefoneVisivel } from './site';

export function jsonLdImobiliaria() {
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${SITE.url}/#organizacao`,
    name: SITE.nome,
    description: SITE.descricao,
    url: SITE.url,
    telephone: telefoneVisivel(),
    email: SITE.email,
    areaServed: { '@type': 'City', name: 'Uberlândia', addressRegion: 'MG' },
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${SITE.endereco.logradouro}, ${SITE.endereco.complemento}`,
      addressLocality: SITE.endereco.cidade,
      addressRegion: SITE.endereco.uf,
      postalCode: SITE.endereco.cep,
      addressCountry: 'BR',
    },
    sameAs: Object.values(SITE.redes),
  };
}

export function jsonLdImovel(imovel: ImovelPublico) {
  const { valor } = precoVigente(imovel);
  const foto = urlCapa(imovel.fotos);

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': `${SITE.url}/imovel/${imovel.slug}`,
    url: `${SITE.url}/imovel/${imovel.slug}`,
    name: imovel.titulo,
    description: imovel.descricao ?? SITE.descricao,
    datePosted: imovel.criado_em,
    ...(foto ? { image: [foto] } : {}),
    offers: {
      '@type': 'Offer',
      price: valor,
      priceCurrency: 'BRL',
      availability:
        imovel.status === 'disponivel'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/LimitedAvailability',
    },
    about: {
      '@type': imovel.tipo === 'Casa' ? 'House' : 'Apartment',
      name: imovel.titulo,
      numberOfRooms: imovel.quartos,
      numberOfBathroomsTotal: imovel.banheiros,
      floorSize: { '@type': 'QuantitativeValue', value: imovel.area_util, unitCode: 'MTK' },
      address: {
        '@type': 'PostalAddress',
        streetAddress: enderecoPublico(imovel),
        addressLocality: imovel.cidade,
        addressRegion: imovel.uf,
        addressCountry: 'BR',
      },
    },
    broker: { '@id': `${SITE.url}/#organizacao` },
  };
}

/** Trilha de navegacao. O Google usa para mostrar o caminho no resultado. */
export function jsonLdMigalhas(itens: { nome: string; href: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.nome,
      item: `${SITE.url}${item.href}`,
    })),
  };
}
