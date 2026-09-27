import type { Metadata } from 'next';

import { ListaFavoritos } from '@/componentes/ListaFavoritos';

export const metadata: Metadata = {
  title: 'Imóveis salvos',
  description: 'Os imóveis que você marcou para comparar depois.',
  // Lista pessoal do visitante, guardada no navegador dele. Nao ha o
  // que indexar aqui, e a pagina nao deve competir na busca.
  robots: { index: false, follow: true },
};

export default function PaginaFavoritos() {
  return (
    <div className="container pagina">
      <span className="rotulo">Sua seleção</span>
      <h1 className="titulo-2" style={{ marginTop: 16 }}>
        Imóveis salvos
      </h1>
      <p className="texto-apoio" style={{ marginTop: 16 }}>
        Esta lista fica guardada neste navegador, sem cadastro. Quando quiser, envie tudo de uma vez
        para um consultor comparar com você.
      </p>

      <ListaFavoritos />
    </div>
  );
}
