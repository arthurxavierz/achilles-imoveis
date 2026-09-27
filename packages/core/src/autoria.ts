/**
 * Assinatura de quem desenvolveu a plataforma.
 *
 * Mora no core porque o credito aparece nos dois aplicativos — no rodape
 * do site publico e no rodape do painel de gestao — e um @ que diverge
 * entre eles vira um erro visivel para o cliente. Trocar o perfil aqui
 * troca nos dois.
 */
export const AUTORIA = {
  nome: 'Achilles',
  arroba: '@achilles.mediaz',
  url: 'https://instagram.com/achilles.mediaz',
} as const;
