'use client';

import { useEffect, useState } from 'react';

/**
 * Fio dourado no topo, que acompanha a rolagem da pagina.
 *
 * Numa vitrine longa como a home, ele responde uma pergunta que o
 * visitante faz sem perceber: falta muito? A resposta muda o
 * comportamento, porque quem sabe que esta perto do fim rola ate o fim.
 *
 * Fica escondido nos dois primeiros por cento para nao aparecer um
 * risquinho solto no topo de quem acabou de chegar.
 */
export function BarraProgresso() {
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    let quadro = 0;

    const medir = () => {
      quadro = 0;
      const rolavel = document.documentElement.scrollHeight - window.innerHeight;
      if (rolavel <= 0) {
        setProgresso(0);
        return;
      }
      setProgresso(Math.min(1, Math.max(0, window.scrollY / rolavel)));
    };

    const agendar = () => {
      if (quadro) return;
      quadro = requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar, { passive: true });

    return () => {
      window.removeEventListener('scroll', agendar);
      window.removeEventListener('resize', agendar);
      if (quadro) cancelAnimationFrame(quadro);
    };
  }, []);

  return (
    <div
      className="barra-progresso"
      aria-hidden="true"
      style={{ transform: `scaleX(${progresso})`, opacity: progresso > 0.02 ? 1 : 0 }}
    />
  );
}
