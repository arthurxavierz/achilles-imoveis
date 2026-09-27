import { Assinatura } from '@/componentes/Assinatura';
import { BarraDemo } from '@/componentes/BarraDemo';
import { Navegacao } from '@/componentes/Navegacao';
import { equipeDemo, modoDemo } from '@/lib/demonstracao';
import { exigirUsuario } from '@/lib/sessao';

/**
 * Casca do painel.
 *
 * exigirUsuario() roda aqui, uma vez, e protege tudo que estiver abaixo
 * deste layout. Cada pagina pode assumir que existe alguem logado e
 * ativo, sem repetir a checagem. O middleware ja barrou quem nao tem
 * sessao; esta segunda verificacao pega o caso do perfil desativado
 * enquanto a sessao ainda era valida.
 */
export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const demo = modoDemo();

  return (
    <div className={`painel${demo ? ' com-faixa-demo' : ''}`}>
      {demo && <BarraDemo usuario={usuario} equipe={equipeDemo()} />}
      <Navegacao usuario={usuario} />
      <div className="conteudo">
        {children}
        <Assinatura />
      </div>
    </div>
  );
}
