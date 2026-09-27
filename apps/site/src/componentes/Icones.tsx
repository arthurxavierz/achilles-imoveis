/**
 * Icones do site.
 *
 * Sao SVG escritos a mao, sem biblioteca externa. Motivo: uma biblioteca
 * de icones custa entre 30 e 300 KB no pacote que o visitante baixa, e
 * aqui usamos vinte e poucos icones. O traco herda a cor e a espessura
 * do CSS, entao todos ficam coerentes sem esforco.
 */

type Props = React.SVGProps<SVGSVGElement>;

const base: Props = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const IconeQuarto = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8" />
    <path d="M3 14h18M3 18h18M7 8V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
  </svg>
);

export const IconeBanheiro = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    <path d="M7 12V6a2 2 0 0 1 4 0M5 19l-1.5 2M19 19l1.5 2" />
  </svg>
);

export const IconeVaga = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M6 14l1.6-4.8A2 2 0 0 1 9.5 8h5a2 2 0 0 1 1.9 1.2L18 14" />
    <path d="M4 14h16v4H4zM7 18v2M17 18v2M7.5 16h.01M16.5 16h.01" />
  </svg>
);

export const IconeArea = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 4h16v16H4z" />
    <path d="M4 9h5V4M20 15h-5v5" />
  </svg>
);

export const IconeSuite = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 21V9l9-6 9 6v12" />
    <path d="M9 21v-6h6v6" />
  </svg>
);

export const IconeLocal = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="2.8" />
  </svg>
);

export const IconeCoracao = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20.4 5.6a5.2 5.2 0 0 0-7.4 0L12 6.6l-1-1a5.2 5.2 0 1 0-7.4 7.4l1 1L12 21.2l7.4-7.2 1-1a5.2 5.2 0 0 0 0-7.4z" />
  </svg>
);

export const IconeCompartilhar = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
);

export const IconeSeta = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconeSetaEsquerda = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const IconeBusca = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.6-3.6" />
  </svg>
);

export const IconeFiltro = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </svg>
);

export const IconeCheck = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconeFechar = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const IconeCalendario = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

export const IconeRelogio = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 1.9" />
  </svg>
);

export const IconeTelefone = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M21 16.5v3a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-8.5-3 19 19 0 0 1-6-6 19.5 19.5 0 0 1-3-8.6A2 2 0 0 1 3.3 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.4 9.6a16 16 0 0 0 6 6l1-1.1a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

export const IconeEmail = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const IconeWhatsApp = (p: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.15a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.25 8.23zm4.53-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.15.16-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.66.31-.23.25-.87.85-.87 2.07s.89 2.4 1.02 2.56c.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.2-.58.2-1.07.15-1.18-.06-.1-.23-.17-.48-.29z" />
  </svg>
);

export const IconeInstagram = (p: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.25.07 1.63.07 4.81s0 3.56-.07 4.81c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.25.06-1.63.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.56 2.2 15.18 2.2 12s0-3.56.07-4.81c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.44 2.21 8.82 2.2 12 2.2zm0 1.98c-3.13 0-3.5.01-4.73.07-1.14.05-1.76.24-2.17.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.23-.07 1.6-.07 4.73s.01 3.5.07 4.73c.05 1.14.24 1.76.4 2.17.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.17.4 1.23.06 1.6.07 4.73.07s3.5-.01 4.73-.07c1.14-.05 1.76-.24 2.17-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.23.07-1.6.07-4.73s-.01-3.5-.07-4.73c-.05-1.14-.24-1.76-.4-2.17a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.23-.06-1.6-.07-4.73-.07zm0 3.37a5.45 5.45 0 1 1 0 10.9 5.45 5.45 0 0 1 0-10.9zm0 8.99a3.54 3.54 0 1 0 0-7.08 3.54 3.54 0 0 0 0 7.08zm6.94-9.2a1.27 1.27 0 1 1-2.55 0 1.27 1.27 0 0 1 2.55 0z" />
  </svg>
);

export const IconeFacebook = (p: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z" />
  </svg>
);

export const IconeLinkedin = (p: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.850-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57z" />
  </svg>
);

export const IconeCasa = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 10.5L12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </svg>
);

export const IconeCalculadora = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="4" y="2.5" width="16" height="19" rx="2" />
    <path d="M8 6.5h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h4" />
  </svg>
);

export const IconeAlerta = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16.2h.01" />
  </svg>
);

export const IconeImagem = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M21 16l-5-5-9 9" />
  </svg>
);

export const IconeImpressora = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M7 8V3h10v5M7 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
    <rect x="7" y="15" width="10" height="6" />
  </svg>
);

export const IconeGrade = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </svg>
);

export const IconeLista = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);

export const IconeEstrela = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.9 6.7 19.7l1.1-6.1L3.4 9.4l6-.8L12 3Z" />
  </svg>
);

export const IconePredio = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 21V6.5A1.5 1.5 0 0 1 5.5 5H12v16M12 21V10h6.5A1.5 1.5 0 0 1 20 11.5V21M3 21h18" />
    <path d="M7.5 9h1.5M7.5 13h1.5M7.5 17h1.5M15 14h1.5M15 17.5h1.5" />
  </svg>
);

export const IconeTerreno = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M3 17.5 12 21l9-3.5V9L12 5.5 3 9v8.5Z" />
    <path d="M3 9l9 3.5L21 9M12 12.5V21" />
  </svg>
);

export const IconeFolha = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 20c0-8 6-14 16-15 0 10-5 15-11 15-2.5 0-5-1-5-1Z" />
    <path d="M9 15c2-3 5-5 8-6" />
  </svg>
);

export const IconeMais = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconeEnviar = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m21 3-9.5 9.5M21 3l-6.5 18-3.5-8L3 9.5 21 3Z" />
  </svg>
);
