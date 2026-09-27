/**
 * Resposta imediata a cada troca de aba do painel.
 *
 * Todas as paginas daqui sao force-dynamic: nada e servido de cache, e
 * o HTML so sai depois de validar a sessao e consultar o banco. Sem uma
 * fronteira de carregamento, o navegador nao tinha o que mostrar nesse
 * intervalo e ficava parado na tela anterior — o clique parecia nao ter
 * funcionado, e a pessoa clicava de novo. O trabalho demorava o mesmo
 * tanto; o que faltava era dizer que ele comecou.
 *
 * Vale tambem por um segundo motivo, menos visivel: o <Link> do Next so
 * consegue pre-carregar uma rota dinamica ate a fronteira de loading.
 * Sem este arquivo nao havia fronteira, entao o prefetch dos itens do
 * menu nao guardava nada e cada navegacao comecava do zero.
 *
 * O desenho imita o esqueleto do que vem depois — topo, faixa de
 * resumo e um cartao de tabela — porque um esqueleto com a forma da
 * tela final nao desloca o conteudo quando ele chega.
 */
export default function CarregandoPainel() {
  return (
    <>
      <header className="topo">
        <div className="esqueleto" style={{ width: 190, height: 27 }} />
      </header>

      <div className="corpo" aria-busy="true" aria-live="polite">
        <span className="acessivel-oculto">Carregando…</span>

        <div className="painel-resumo">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="resumo-item">
              <div className="esqueleto" style={{ width: '58%', height: 10 }} />
              <div className="esqueleto" style={{ width: '42%', height: 19, marginTop: 9 }} />
            </div>
          ))}
        </div>

        <div className="cartao" style={{ marginTop: 16 }}>
          <div style={{ padding: '14px 16px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="esqueleto"
                style={{
                  height: 15,
                  marginBottom: i === 7 ? 0 : 15,
                  // Larguras irregulares: uma pilha de barras identicas
                  // parece um grafico, nao uma lista carregando.
                  width: ['94%', '78%', '86%', '69%', '90%', '74%', '83%', '65%'][i],
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
