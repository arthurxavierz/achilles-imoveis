import { linkWhatsApp } from '@/lib/site';
import { IconeWhatsApp } from './Icones';

/**
 * Botao flutuante de WhatsApp.
 *
 * Verde da marca, glifo branco, com um halo que pulsa devagar. O halo
 * nao e enfeite: sobre um site inteiramente preto, um circulo verde
 * chapado some no canto da tela depois de alguns segundos, e este e o
 * canal que mais gera contato no mercado imobiliario brasileiro.
 *
 * Comeca redondo, so com o icone, e expande revelando o texto no hover.
 * Assim ele fica visivel em toda pagina sem competir com o conteudo
 * enquanto ninguem o procura.
 */
export function BotaoWhatsApp() {
  return (
    <a
      className="zap-flutuante"
      href={linkWhatsApp()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Conversar no WhatsApp"
    >
      <span className="zap-halo" aria-hidden="true" />
      <IconeWhatsApp />
      <span className="zap-texto">Fale com um consultor</span>
    </a>
  );
}
