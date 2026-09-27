import type { Metadata } from 'next';

import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Política de privacidade',
  description: `Como a ${SITE.nome} coleta, usa e protege seus dados pessoais, conforme a LGPD.`,
  alternates: { canonical: '/politica-de-privacidade' },
  robots: { index: true, follow: true },
};

/**
 * Base de politica de privacidade conforme a LGPD (Lei 13.709/2018).
 *
 * ATENCAO: este texto e um ponto de partida tecnico, escrito para
 * cobrir o que o site de fato faz. Antes de publicar, peca a revisao de
 * um advogado e preencha o encarregado de dados (DPO) da Achilles.
 */
export default function PaginaPrivacidade() {
  return (
    <div className="container pagina">
      <span className="rotulo">Documento legal</span>
      <h1 className="titulo-2">Política de privacidade</h1>

      <div className="prosa" style={{ marginTop: 40 }}>
        <p>
          Esta política explica como a {SITE.nome} trata os dados pessoais coletados no site{' '}
          {SITE.url}, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
        </p>

        <h2>1. Quais dados coletamos</h2>
        <p>
          Coletamos apenas o que você nos informa voluntariamente nos formulários de contato:{' '}
          <strong>nome, telefone, e-mail e a mensagem</strong> que você escreve. Registramos também
          o imóvel de interesse, a página de origem e o endereço IP do envio, para segurança e para
          entender de onde vêm nossos contatos.
        </p>
        <p>
          Não coletamos CPF, dados bancários ou documentos pelo site. Esses dados, quando
          necessários para uma negociação, são tratados fora do ambiente do site.
        </p>

        <h2>2. Por que tratamos esses dados</h2>
        <ul>
          <li>Responder ao seu contato e apresentar imóveis compatíveis com o que você procura;</li>
          <li>Agendar visitas e conduzir a negociação;</li>
          <li>Cumprir obrigações legais e regulatórias da atividade imobiliária;</li>
          <li>Medir o desempenho das nossas campanhas, de forma agregada.</li>
        </ul>
        <p>
          A base legal é o <strong>seu consentimento</strong>, dado ao marcar a caixa no formulário,
          e a <strong>execução de procedimentos preliminares de contrato</strong> a seu pedido.
        </p>

        <h2>3. Com quem compartilhamos</h2>
        <p>
          Seus dados ficam com a equipe da {SITE.nome} e com os fornecedores de tecnologia que
          operam nossa infraestrutura (hospedagem e banco de dados). Não vendemos, alugamos nem
          cedemos seus dados a terceiros para fins de marketing.
        </p>
        <p>
          Quando o imóvel de interesse pertence a outro proprietário, compartilhamos apenas o
          necessário para viabilizar a visita e a negociação.
        </p>

        <h2>4. Por quanto tempo guardamos</h2>
        <p>
          Mantemos seus dados enquanto durar o relacionamento comercial e por até 5 anos após o
          último contato, prazo compatível com a prescrição de eventuais questionamentos sobre a
          negociação. Depois disso, são eliminados ou anonimizados.
        </p>

        <h2>5. Cookies</h2>
        <p>
          Usamos cookies essenciais para o funcionamento do site e, mediante seu aceite, cookies de
          medição de audiência. Você pode bloquear cookies nas configurações do seu navegador; o
          site continuará funcionando, com algumas conveniências reduzidas.
        </p>

        <h2>6. Seus direitos</h2>
        <p>A LGPD garante que você pode, a qualquer momento:</p>
        <ul>
          <li>Confirmar se tratamos seus dados e acessar o que temos;</li>
          <li>Corrigir dados incompletos ou desatualizados;</li>
          <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>Revogar o consentimento e pedir a exclusão dos seus dados;</li>
          <li>Solicitar a portabilidade a outro fornecedor;</li>
          <li>Se opor a um tratamento feito com base em legítimo interesse.</li>
        </ul>
        <p>
          Para exercer qualquer um desses direitos, escreva para{' '}
          <a href={`mailto:${SITE.email}`} style={{ color: 'var(--marinho-700)' }}>
            {SITE.email}
          </a>
          . Respondemos em até 15 dias.
        </p>

        <h2>7. Segurança</h2>
        <p>
          O site trafega exclusivamente por HTTPS. O acesso aos dados é restrito por autenticação e
          por regras de permissão no banco, de modo que cada consultor alcança apenas os registros
          sob sua responsabilidade. Toda alteração relevante fica registrada em log de auditoria.
        </p>

        <h2>8. Encarregado de dados</h2>
        <p>
          Encarregado (DPO): a definir. Contato:{' '}
          <a href={`mailto:${SITE.email}`} style={{ color: 'var(--marinho-700)' }}>
            {SITE.email}
          </a>
          .
        </p>

        <h2>9. Alterações desta política</h2>
        <p>
          Podemos atualizar este documento. A versão vigente é sempre a publicada nesta página, com
          a data de atualização abaixo.
        </p>

        <p style={{ color: 'var(--cinza)', marginTop: 40, fontSize: 13 }}>
          Última atualização: {new Date().toLocaleDateString('pt-BR')}.
        </p>
      </div>
    </div>
  );
}
