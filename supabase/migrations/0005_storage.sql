-- ============================================================
-- ACHILLES IMOVEIS - 0005 ARMAZENAMENTO DE FOTOS
-- ============================================================
-- As fotos NAO ficam no banco. No prototipo elas eram data URLs em
-- memoria: some no F5 e, se fosse para o Postgres assim, cada imovel
-- levaria alguns megabytes de base64 dentro de uma linha. Aqui elas vao
-- para o Storage e a tabela imovel_fotos guarda so o caminho.
--
-- Bucket publico: a vitrine precisa servir a imagem direto pelo CDN,
-- sem token. Escrita, apagamento e reordenacao continuam trancados.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imoveis',
  'imoveis',
  true,
  10485760,   -- 10 MB por arquivo
  array['image/jpeg','image/png','image/webp','image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura publica: qualquer visitante carrega a foto do anuncio.
drop policy if exists "fotos imoveis - leitura publica" on storage.objects;
create policy "fotos imoveis - leitura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'imoveis');

-- Escrita: so a equipe com permissao de imoveis.
drop policy if exists "fotos imoveis - equipe envia" on storage.objects;
create policy "fotos imoveis - equipe envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imoveis' and pode('imoveis'));

drop policy if exists "fotos imoveis - equipe atualiza" on storage.objects;
create policy "fotos imoveis - equipe atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'imoveis' and pode('imoveis'))
  with check (bucket_id = 'imoveis' and pode('imoveis'));

drop policy if exists "fotos imoveis - equipe apaga" on storage.objects;
create policy "fotos imoveis - equipe apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'imoveis' and pode('imoveis'));

-- Avatares da equipe.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatares - leitura publica" on storage.objects;
create policy "avatares - leitura publica" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatares');

-- Cada pessoa so mexe na pasta com o proprio id: avatares/<uid>/foto.jpg
drop policy if exists "avatares - dono gerencia" on storage.objects;
create policy "avatares - dono gerencia" on storage.objects
  for all to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
