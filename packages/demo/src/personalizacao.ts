/**
 * Modo apresentação: a marca do cliente por cima da demonstração.
 *
 * Na reunião, quem apresenta digita o nome da imobiliária do cliente e
 * escolhe a cor dela. Site e painel passam a se apresentar com essa
 * marca na hora, sem deploy e sem mexer em código. É a forma mais curta
 * de a pessoa do outro lado da mesa enxergar o sistema como dela.
 *
 * A escolha vive num cookie, e não no banco: é uma preferência de quem
 * está apresentando naquele navegador. Em localhost o cookie vale para
 * as duas portas (site e painel), então personalizar num muda o outro.
 *
 * Só é lido atrás de modoDemo(). Em produção a marca vem do código,
 * e nenhum visitante consegue trocá-la por cookie.
 */

export const COOKIE_MARCA = 'imob-demo-marca';

export interface Personalizacao {
  nome: string;
  cor: string;
}

export interface CoresMarca {
  base: string;
  claro: string;
  escuro: string;
  /** "r, g, b", para compor rgba() no CSS. */
  rgb: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Valor cru do cookie -> personalização válida, ou null. */
export function lerPersonalizacao(valor: string | null | undefined): Personalizacao | null {
  if (!valor) return null;

  try {
    const dados = JSON.parse(decodeURIComponent(valor)) as Partial<Personalizacao>;
    const nome = String(dados.nome ?? '').trim().slice(0, 40);
    const cor = String(dados.cor ?? '').trim();
    if (!nome && !HEX.test(cor)) return null;

    return { nome, cor: HEX.test(cor) ? cor.toLowerCase() : '' };
  } catch {
    return null;
  }
}

function paraRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paraHex([r, g, b]: number[]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function misturar(de: number[], para: number[], quanto: number): number[] {
  return de.map((c, i) => c + (para[i] - c) * quanto);
}

/**
 * Deriva a família de tons a partir de uma cor só.
 *
 * O site escreve texto escuro sobre a cor de destaque (botão principal,
 * etiqueta de destaque). Cor escura demais ali vira botão ilegível, então
 * ela é clareada até ter luminância suficiente: o cliente escolhe o
 * matiz, e a legibilidade continua garantida.
 */
export function coresDaMarca(hex: string): CoresMarca {
  let rgb: number[] = paraRgb(hex);
  const luminancia = (c: number[]) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

  for (let i = 0; i < 8 && luminancia(rgb) < 0.45; i++) rgb = misturar(rgb, [255, 255, 255], 0.18);

  return {
    base: paraHex(rgb),
    claro: paraHex(misturar(rgb, [255, 255, 255], 0.28)),
    escuro: paraHex(misturar(rgb, [0, 0, 0], 0.2)),
    rgb: rgb.map(Math.round).join(', '),
  };
}

/** Iniciais para o selo: "Prime Imóveis" -> "P", "JK" -> "JK". */
export function iniciais(nome: string): string {
  const palavras = nome
    .replace(/\b(im[oó]veis|imobili[aá]ria|neg[oó]cios|imobili[aá]rios|ltda)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (palavras.length === 0) return nome.slice(0, 1).toUpperCase();
  if (palavras.length === 1) return palavras[0].slice(0, palavras[0].length <= 3 ? 3 : 1).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}
