import Image from 'next/image';
import Link from 'next/link';

import type { ImovelPublico } from '@imob/core';
import { brl, ehRural, numero, precoVigente } from '@imob/core';
import { urlCapa } from '@imob/db';

import { BotaoFavorito } from './BotaoFavorito';
import {
  IconeArea,
  IconeBanheiro,
  IconeFolha,
  IconeLocal,
  IconeQuarto,
  IconeSeta,
  IconeVaga,
} from './Icones';

/**
 * Cartao de imovel.
 *
 * Mostra tipo, endereco, condominio, atributos e preco, nessa ordem, que
 * e a ordem em que a pessoa decide se clica. O codigo do anuncio fica na
 * foto porque e o que ela repete no WhatsApp quando liga perguntando.
 *
 * Em imovel rural o metro quadrado util nao diz nada, entao o cartao
 * troca a metragem por hectares. E o tipo de detalhe que separa uma
 * vitrine que entende do assunto de um catalogo generico.
 */
export function CartaoImovel({
  imovel,
  prioridade = false,
}: {
  imovel: ImovelPublico;
  /** Verdadeiro nos primeiros cartoes: a foto carrega antes das outras. */
  prioridade?: boolean;
}) {
  const capa = urlCapa(imovel.fotos);
  const { valor, sufixo } = precoVigente(imovel);
  const rural = ehRural(imovel.tipo);
  const hectares = Number(imovel.hectares ?? 0);

  return (
    <article className="cartao" data-brilho>
      <div className="cartao-midia">
        <div className="cartao-etiquetas">
          {imovel.destaque && <span className="etiqueta etiqueta-ouro">Destaque</span>}
          {imovel.status === 'reservado' && (
            <span className="etiqueta etiqueta-reservado">Reservado</span>
          )}
          {(imovel.finalidade === 'locacao' || imovel.finalidade === 'venda_locacao') && (
            <span className="etiqueta etiqueta-locacao">Aluga</span>
          )}
          {imovel.mobiliado && <span className="etiqueta">Mobiliado</span>}
        </div>

        <BotaoFavorito imovelId={imovel.id} titulo={imovel.titulo} />

        {capa ? (
          <Image
            src={capa}
            alt={imovel.titulo}
            fill
            sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 380px"
            style={{ objectFit: 'cover' }}
            priority={prioridade}
          />
        ) : (
          <div className="cartao-sem-foto" data-cover={imovel.cover} aria-hidden="true">
            B
          </div>
        )}

        <span className="cartao-codigo">{imovel.referencia_externa ?? imovel.codigo}</span>
      </div>

      <div className="cartao-corpo">
        <span className="cartao-tipo">{imovel.tipo}</span>

        <h3 className="cartao-titulo">
          {/* O link cobre o cartao inteiro sem engolir o botao de salvar,
              que fica acima dele na ordem de empilhamento. */}
          <Link href={`/imovel/${imovel.slug}`} className="cartao-link">
            <span className="cartao-area-clique" />
            {imovel.titulo}
          </Link>
        </h3>

        <span className="cartao-local">
          <IconeLocal />
          {imovel.bairro ? `${imovel.bairro}, ${imovel.cidade}` : imovel.cidade} - {imovel.uf}
        </span>

        {imovel.condominio_nome && (
          <span className="cartao-condominio">{imovel.condominio_nome}</span>
        )}

        <div className="cartao-atributos">
          {imovel.quartos > 0 && (
            <span className="atributo">
              <IconeQuarto />
              {imovel.quartos} {imovel.quartos === 1 ? 'quarto' : 'quartos'}
            </span>
          )}
          {imovel.banheiros > 0 && (
            <span className="atributo">
              <IconeBanheiro />
              {imovel.banheiros}
            </span>
          )}
          {imovel.vagas > 0 && (
            <span className="atributo">
              <IconeVaga />
              {imovel.vagas}
            </span>
          )}

          {rural && hectares > 0 ? (
            <span className="atributo">
              <IconeFolha />
              {numero(hectares)} ha
            </span>
          ) : (
            imovel.area_util > 0 && (
              <span className="atributo">
                <IconeArea />
                {numero(imovel.area_util)} m²
              </span>
            )
          )}
        </div>

        <div className="cartao-rodape">
          <div>
            <span className="cartao-preco-rotulo">
              {imovel.finalidade === 'locacao' ? 'Locação' : 'Venda'}
            </span>
            {valor > 0 ? (
              <span className="cartao-preco">
                {brl(valor)}
                {sufixo && <small>{sufixo}</small>}
              </span>
            ) : (
              <span className="cartao-preco-consulta">Sob consulta</span>
            )}
          </div>

          <span className="cartao-seta" aria-hidden="true">
            <IconeSeta />
          </span>
        </div>
      </div>
    </article>
  );
}
