/**
 * Icones do painel.
 *
 * SVG escritos a mao, sem biblioteca. Sao pouco mais de trinta simbolos:
 * uma biblioteca completa custaria centenas de kilobytes no pacote que a
 * equipe baixa toda manha, para usar uma fracao disso. O traco herda cor
 * e espessura do CSS, entao todos ficam coerentes sem ajuste manual.
 */

type Props = React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const IconePainel = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7.5" height="8.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
    <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
    <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.5" />
  </svg>
);

export const IconeAgenda = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M8 14h2M14 14h2M8 17.5h2" />
  </svg>
);

export const IconeImovel = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const IconeFunil = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 4h18l-7 8v7l-4 2v-9L3 4z" />
  </svg>
);

export const IconeFinanceiro = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 17l5.5-5.5 3.5 3.5L21 6" />
    <path d="M15 6h6v6" />
  </svg>
);

export const IconeEquipe = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M18 20a6.5 6.5 0 0 0-2.6-5.2" />
  </svg>
);

export const IconeRelatorio = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const IconeConfiguracao = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

export const IconeMais = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconeFechar = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const IconeCheck = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconeEsquerda = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

export const IconeDireita = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

export const IconeBusca = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);

export const IconeMenu = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

export const IconeRelogio = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 1.9" />
  </svg>
);

export const IconeLocal = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="2.8" />
  </svg>
);

export const IconeUsuario = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const IconeCadeado = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10" width="15" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconeLapis = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4 1 1-4z" />
  </svg>
);

export const IconeLixeira = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
    <path d="M6.5 7l.8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

export const IconeSair = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M15 17l5-5-5-5M20 12H9" />
    <path d="M12 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6" />
  </svg>
);

export const IconeAlerta = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16.2h.01" />
  </svg>
);

export const IconeInfo = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4.5M12 8h.01" />
  </svg>
);

export const IconeSubindo = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />
  </svg>
);

export const IconeDescendo = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />
  </svg>
);

export const IconeDinheiro = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 10v4M18 10v4" />
  </svg>
);

export const IconeAlvo = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

export const IconeChave = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l8-8M17 4l3 3M14.5 6.5l2.5 2.5" />
  </svg>
);

export const IconeEmail = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const IconeTelefone = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-8.5-3 19 19 0 0 1-6-6 19.5 19.5 0 0 1-3-8.6A2 2 0 0 1 3.3 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.4 9.6a16 16 0 0 0 6 6l1-1.1a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

export const IconeWhatsApp = (p: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.54-3.7 8.24-8.25 8.24zm4.53-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.02 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.15-1.18-.06-.1-.23-.17-.48-.29z" />
  </svg>
);

export const IconeCalendarioMais = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
    <path d="M3 10h18M8 3v4M16 3v4" />
    <path d="M18 15v6M15 18h6" />
  </svg>
);

export const IconeFiltro = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const IconeGrade = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.4" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.4" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.4" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.4" />
  </svg>
);

export const IconeLista = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

export const IconeVazio = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 9l1.6-4.2A2 2 0 0 1 6.5 3.5h11a2 2 0 0 1 1.9 1.3L21 9" />
    <path d="M3 9h5l1.5 3h5L16 9h5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);
