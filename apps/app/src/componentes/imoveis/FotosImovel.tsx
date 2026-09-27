'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import type { Foto } from '@imob/core';
import { caminhoFoto, urlFoto } from '@imob/db';

import {
  definirCapa,
  excluirFoto,
  listarFotos,
  registrarFoto,
  reordenarFotos,
} from '@/app/(painel)/imoveis/acoes';
import { IconeCheck, IconeEsquerda, IconeDireita, IconeLixeira, IconeMais } from '@/componentes/Icones';
import { supabaseNavegador } from '@/lib/supabase-navegador';

/** Espelha o file_size_limit do bucket, definido na migration 0005. */
const TAMANHO_MAXIMO = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Álbum do imóvel.
 *
 * O bucket, os tipos aceitos e as políticas de escrita existem desde a
 * migration 0005, e o site publica as fotos há meses. O que faltava era
 * caminho para a equipe mexer nelas: imóvel cadastrado pelo painel
 * nascia sem foto e sem como ganhar uma, e só tinha álbum quem veio da
 * importação.
 *
 * O arquivo sobe do navegador direto para o storage, com a sessão da
 * pessoa, e a ação do servidor só grava a linha na tabela. A escolha é
 * de peso: passar a foto pela ação faria cada envio ocupar memória e
 * banda da função, e o limite do bucket é de dez megabytes por arquivo.
 *
 * As fotos são carregadas quando a aba abre, e não junto com a carteira.
 * São dezesseis por imóvel na média: multiplicado por 964, seria a tela
 * inteira travando para mostrar o álbum de um.
 */
export function FotosImovel({
  imovelId,
  editavel,
  aoAvisar,
}: {
  imovelId: string;
  editavel: boolean;
  aoAvisar: (mensagem: string, erro?: boolean) => void;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0 });
  const [pendente, iniciar] = useTransition();
  const entrada = useRef<HTMLInputElement>(null);

  const recarregar = useCallback(async () => {
    const lista = await listarFotos(imovelId);
    setFotos(lista);
    setCarregando(false);
  }, [imovelId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  /**
   * Envia os arquivos escolhidos, um de cada vez.
   *
   * Em série, e não em paralelo: dez fotos de dez megabytes subindo
   * juntas saturam a conexão de quem está num escritório com internet
   * comum, e o navegador acaba derrubando parte delas. Uma de cada vez
   * demora igual e chega inteira, e o contador diz em qual está.
   */
  async function enviar(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;

    const validos = Array.from(arquivos).filter((a) => {
      if (!TIPOS.includes(a.type)) {
        aoAvisar(`${a.name}: formato não aceito. Use JPG, PNG, WebP ou AVIF.`, true);
        return false;
      }
      if (a.size > TAMANHO_MAXIMO) {
        aoAvisar(`${a.name}: passa de 10 MB. Reduza antes de enviar.`, true);
        return false;
      }
      return true;
    });

    if (validos.length === 0) return;

    /**
     * Sem banco configurado não há para onde subir arquivo.
     *
     * O bucket é do Supabase, e o cliente do navegador nem chega a ser
     * construído sem a URL do projeto: createBrowserClient lança na hora.
     * Sem esta saída, o botão ficaria preso em "Enviando 0 de 1" e não
     * apareceria aviso nenhum, porque o erro estouraria dentro de uma
     * promessa que ninguém observa. É o mesmo aviso que o perfil dá.
     */
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      aoAvisar(
        'Em modo demonstração não há onde guardar o arquivo. Configure o Supabase para enviar fotos de verdade.',
        true,
      );
      if (entrada.current) entrada.current.value = '';
      return;
    }

    setEnviando(true);
    setProgresso({ feitas: 0, total: validos.length });

    const supabase = supabaseNavegador();
    let enviadas = 0;

    for (const arquivo of validos) {
      const caminho = caminhoFoto(imovelId, arquivo.name);

      const { error } = await supabase.storage.from('imoveis').upload(caminho, arquivo, {
        cacheControl: '31536000',
        upsert: false,
      });

      if (error) {
        console.error('[fotos] falha no envio:', error);
        aoAvisar(`${arquivo.name}: ${error.message}`, true);
        continue;
      }

      // A linha só entra depois que o arquivo existe. Na ordem inversa,
      // uma falha no envio deixaria a vitrine apontando para o vazio.
      const r = await registrarFoto(imovelId, caminho);
      if (!r.ok) {
        aoAvisar(r.erro ?? 'Falha ao registrar a foto.', true);
        continue;
      }

      enviadas += 1;
      setProgresso({ feitas: enviadas, total: validos.length });
    }

    setEnviando(false);
    if (entrada.current) entrada.current.value = '';

    if (enviadas > 0) {
      aoAvisar(`${enviadas} ${enviadas === 1 ? 'foto adicionada' : 'fotos adicionadas'}.`);
      await recarregar();
    }
  }

  function remover(foto: Foto) {
    const certeza = window.confirm(
      'Remover esta foto do imóvel?\n\nEla sai do site e do armazenamento, e não há como desfazer.',
    );
    if (!certeza) return;

    iniciar(async () => {
      const r = await excluirFoto(foto.id);
      aoAvisar(r.ok ? (r.mensagem ?? 'Removida.') : (r.erro ?? 'Falha.'), !r.ok);
      if (r.ok) await recarregar();
    });
  }

  function marcarCapa(foto: Foto) {
    iniciar(async () => {
      const r = await definirCapa(imovelId, foto.id);
      aoAvisar(r.ok ? (r.mensagem ?? 'Capa definida.') : (r.erro ?? 'Falha.'), !r.ok);
      if (r.ok) await recarregar();
    });
  }

  /** Move uma foto uma posição para o lado e grava a ordem inteira. */
  function mover(indice: number, passo: -1 | 1) {
    const destino = indice + passo;
    if (destino < 0 || destino >= fotos.length) return;

    const nova = [...fotos];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];

    // A tela move na hora e o servidor confirma depois: esperar a ida ao
    // banco para redesenhar faria cada clique parecer travado.
    setFotos(nova);

    iniciar(async () => {
      const r = await reordenarFotos(
        imovelId,
        nova.map((f) => f.id),
      );
      if (!r.ok) {
        aoAvisar(r.erro ?? 'Falha ao salvar a ordem.', true);
        await recarregar();
      }
    });
  }

  if (carregando) {
    return <div className="esqueleto" style={{ height: 180 }} />;
  }

  return (
    <div className="album">
      {editavel && (
        <div className="album-envio">
          <input
            ref={entrada}
            id="album-arquivos"
            type="file"
            accept={TIPOS.join(',')}
            multiple
            disabled={enviando}
            onChange={(e) => enviar(e.target.files)}
            hidden
          />
          <label htmlFor="album-arquivos" className="btn btn-claro">
            <IconeMais />
            {enviando
              ? `Enviando ${progresso.feitas} de ${progresso.total}...`
              : 'Adicionar fotos'}
          </label>
          <span className="ajuda">
            JPG, PNG, WebP ou AVIF, até 10 MB cada. A primeira foto vira a capa, e a capa é o que
            aparece no cartão da vitrine.
          </span>
        </div>
      )}

      {fotos.length === 0 ? (
        <p className="texto-mudo" style={{ marginTop: 16 }}>
          {editavel
            ? 'Nenhuma foto ainda. Um imóvel sem foto aparece na vitrine com um fundo neutro, e praticamente não recebe contato.'
            : 'Este imóvel ainda não tem fotos.'}
        </p>
      ) : (
        <ul className="album-grade">
          {fotos.map((foto, i) => {
            const url = urlFoto(foto.path);

            return (
              <li key={foto.id} className={`album-item${foto.capa ? ' album-capa' : ''}`}>
                {url ? (
                  <Image
                    src={url}
                    alt={foto.legenda ?? `Foto ${i + 1}`}
                    fill
                    sizes="200px"
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="album-vazia" aria-hidden="true" />
                )}

                {foto.capa && <span className="album-selo">Capa</span>}

                {editavel && (
                  <div className="album-acoes">
                    <button
                      type="button"
                      onClick={() => mover(i, -1)}
                      disabled={pendente || i === 0}
                      title="Mover para trás"
                      aria-label="Mover para trás"
                    >
                      <IconeEsquerda />
                    </button>

                    {!foto.capa && (
                      <button
                        type="button"
                        onClick={() => marcarCapa(foto)}
                        disabled={pendente}
                        title="Usar como capa"
                        aria-label="Usar como capa"
                      >
                        <IconeCheck />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => remover(foto)}
                      disabled={pendente}
                      title="Remover a foto"
                      aria-label="Remover a foto"
                    >
                      <IconeLixeira />
                    </button>

                    <button
                      type="button"
                      onClick={() => mover(i, 1)}
                      disabled={pendente || i === fotos.length - 1}
                      title="Mover para a frente"
                      aria-label="Mover para a frente"
                    >
                      <IconeDireita />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
