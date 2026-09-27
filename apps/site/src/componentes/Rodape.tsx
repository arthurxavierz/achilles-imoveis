import Link from 'next/link';

import { AUTORIA } from '@imob/core';

import {
  IconeEmail,
  IconeFacebook,
  IconeInstagram,
  IconeLinkedin,
  IconeLocal,
  IconeRelogio,
  IconeTelefone,
  IconeWhatsApp,
} from './Icones';
import { Marca } from './Marca';
import { carregarFacetas } from '../lib/dados';
import { RODAPE_COLUNAS, SITE, linkWhatsApp, telefoneVisivel } from '../lib/site';

/**
 * Rodape.
 *
 * As duas listas do topo, condominios e cidades, nao sao enfeite: sao as
 * portas de entrada que o Google mais indexa numa vitrine imobiliaria.
 * Cada link vira uma busca pronta, e uma pagina de resultado com titulo
 * proprio compete por consultas do tipo "apartamento no jardim karaiba"
 * muito melhor do que a home.
 *
 * O rodape carrega as proprias listas, em vez de receber por
 * propriedade. Assim o layout nao precisa buscar dado que so o rodape
 * usa, e nenhuma pagina precisa lembrar de repassar. Quando nao houver
 * dado, a lista simplesmente nao aparece, em vez de mostrar um bloco
 * vazio com titulo.
 */
export async function Rodape() {
  const facetas = await carregarFacetas();

  const condominios = facetas.condominios.slice(0, 8);
  const cidades = facetas.cidades.slice(0, 8);
  const ano = new Date().getFullYear();

  return (
    <footer className="rodape">
      <div className="container">
        {(condominios.length > 0 || cidades.length > 0) && (
          <div className="rodape-listas">
            {condominios.length > 0 && (
              <section className="rodape-lista">
                <h3>Condomínios mais procurados</h3>
                <div className="rodape-lista-itens">
                  {condominios.map((c) => (
                    <Link
                      key={c.valor}
                      href={`/imoveis?condominio=${encodeURIComponent(c.valor)}`}
                    >
                      {c.valor}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {cidades.length > 0 && (
              <section className="rodape-lista">
                <h3>Cidades atendidas</h3>
                <div className="rodape-lista-itens">
                  {cidades.map((c) => (
                    <Link key={c.valor} href={`/imoveis?cidade=${encodeURIComponent(c.valor)}`}>
                      {c.valor}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        <div className="rodape-colunas">
          <div className="rodape-coluna rodape-sobre">
            <Marca />

            <p className="texto-apoio">
              Curadoria de imóveis de alto padrão, condomínios de luxo e oportunidades de
              investimento em Uberlândia e região.
            </p>

            <div className="rodape-redes">
              <a
                href={SITE.redes.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da Achilles"
              >
                <IconeInstagram />
              </a>
              <a
                href={SITE.redes.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook da Achilles"
              >
                <IconeFacebook />
              </a>
              <a
                href={SITE.redes.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn da Achilles"
              >
                <IconeLinkedin />
              </a>
              <a
                href={linkWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp da Achilles"
              >
                <IconeWhatsApp />
              </a>
            </div>
          </div>

          {RODAPE_COLUNAS.map((coluna) => (
            <div key={coluna.titulo} className="rodape-coluna">
              <h4>{coluna.titulo}</h4>
              {coluna.itens.map((item) => (
                <Link key={item.href + item.rotulo} href={item.href}>
                  {item.rotulo}
                </Link>
              ))}
            </div>
          ))}

          {/* O texto de cada item fica dentro de um <span> proprio, e nao
              solto ao lado do icone. E o que da ao grid duas celulas
              nomeadas em vez de uma celula e um texto anonimo, e o que
              faz o endereco de duas linhas alinhar consigo mesmo em vez
              de voltar para debaixo do icone. */}
          <div className="rodape-coluna rodape-contato">
            <h4>Contato</h4>

            <a href={`tel:+${SITE.whatsapp}`}>
              <IconeTelefone />
              <span>{telefoneVisivel()}</span>
            </a>

            <a href={`mailto:${SITE.email}`}>
              <IconeEmail />
              <span>{SITE.email}</span>
            </a>

            <p>
              <IconeLocal />
              <span>
                {SITE.endereco.logradouro}
                {SITE.endereco.complemento && `, ${SITE.endereco.complemento}`}
                <br />
                {SITE.endereco.bairro}, {SITE.endereco.cidade} - {SITE.endereco.uf}
                <br />
                CEP {SITE.endereco.cep}
              </span>
            </p>

            <p>
              <IconeRelogio />
              <span>{SITE.horario}</span>
            </p>
          </div>
        </div>

        <div className="rodape-base">
          <span>
            {ano} {SITE.nome}. Todos os direitos reservados.
          </span>

          <span className="rodape-creci">{SITE.creci}</span>

          <Link href="/politica-de-privacidade">Política de privacidade</Link>

          {/* Credito discreto de quem desenvolveu. Ultimo item da linha,
              no tom mais apagado do rodape: presente para quem procura,
              invisivel para quem nao esta procurando. */}
          <span className="rodape-autoria">
            Desenvolvido por {AUTORIA.nome}.{' '}
            <a href={AUTORIA.url} target="_blank" rel="noopener noreferrer">
              ({AUTORIA.arroba})
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
