import Link from 'next/link';

export default function NaoEncontrado() {
  return (
    <div className="container pagina" style={{ textAlign: 'center' }}>
      <span className="rotulo">Erro 404</span>
      <h1 className="titulo-2">
        Esta página <em>não existe</em> mais.
      </h1>
      <p className="texto-apoio" style={{ margin: '16px auto 0' }}>
        O imóvel pode ter sido vendido ou saído da vitrine. Veja o que está disponível agora na
        nossa carteira.
      </p>
      <div
        style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 36, flexWrap: 'wrap' }}
      >
        <Link className="btn btn-ouro" href="/imoveis">
          Ver imóveis disponíveis
        </Link>
        <Link className="btn btn-contorno" href="/">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
