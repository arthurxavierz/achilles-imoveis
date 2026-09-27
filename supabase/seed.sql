-- ============================================================
-- ACHILLES IMOVEIS - DADOS DE PARTIDA
-- ============================================================
-- Rode DEPOIS de todas as migrations, no SQL Editor do Supabase.
-- Rode uma vez so. O "on conflict do nothing" evita duplicar se
-- alguem rodar de novo por engano.
--
-- Os imoveis entram sem corretor_id (a carteira ainda nao tem gente).
-- Ao criar os usuarios reais, o admin reatribui pela tela de Imoveis.
-- ============================================================

insert into imoveis (
  titulo, descricao, tipo, finalidade, status,
  bairro, cidade, uf, exibir_endereco,
  valor, valor_condominio, valor_iptu,
  area_util, area_total, quartos, suites, banheiros, vagas,
  caracteristicas, publicado, destaque, publicar_portais, cover
) values
(
  'Cobertura Duplex Morada da Colina',
  'Cobertura duplex com terraco gourmet, piscina privativa e vista panoramica para o Parque do Sabia. Acabamento em porcelanato importado, automacao completa e elevador privativo. Andar unico no ultimo pavimento, com quatro suites e living integrado de pe-direito duplo.',
  'Cobertura', 'venda', 'disponivel',
  'Morada da Colina', 'Uberlandia', 'MG', true,
  2850000, 2400, 980,
  412, 468, 4, 4, 5, 4,
  array['Piscina privativa','Terraco gourmet','Automacao','Elevador privativo','Vista panoramica','Adega'],
  true, true, true, 'cv2'
),
(
  'WTC Uberlandia Corporate',
  'Laje corporativa no World Trade Center Uberlandia, o endereco de negocios mais valorizado da cidade. Infraestrutura completa, heliponto, certificacao internacional e seguranca 24 horas. Ideal para escritorio de advocacia, consultoria ou sede regional.',
  'Sala comercial', 'venda', 'disponivel',
  'Granja Marileusa', 'Uberlandia', 'MG', true,
  890000, 1800, 620,
  96, 96, 0, 0, 2, 3,
  array['Heliponto','Seguranca 24h','Ar condicionado central','Certificacao LEED','Auditorio compartilhado'],
  true, true, true, 'cv1'
),
(
  'Studios Francisco Galassi',
  'Studios de alto giro no coracao da cidade. Retorno inteligente para investidores, com gestao de locacao por temporada, rooftop exclusivo e coworking no terreo. Unidade entregue mobiliada e pronta para gerar renda.',
  'Studio', 'venda', 'disponivel',
  'Osvaldo Rezende', 'Uberlandia', 'MG', true,
  325000, 480, 210,
  38, 41, 1, 0, 1, 1,
  array['Mobiliado','Rooftop','Coworking','Academia','Portaria remota'],
  true, false, true, 'cv5'
),
(
  'Residencia Alto Padrao Jardim Karaiba',
  'Residencia assinada em condominio fechado, com projeto paisagistico, adega climatizada, home theater e espaco de bem-estar com sauna e piscina aquecida. Cinco suites, sendo a master com closet duplo e varanda privativa.',
  'Casa', 'venda', 'reservado',
  'Jardim Karaiba', 'Uberlandia', 'MG', false,
  3200000, 1250, 1800,
  680, 1000, 5, 5, 6, 6,
  array['Condominio fechado','Piscina aquecida','Sauna','Home theater','Adega climatizada','Paisagismo assinado'],
  true, true, false, 'cv3'
),
(
  'Apartamento Garden Vigilato Pereira',
  'Garden com jardim privativo integrado ao living. Plantas amplas, varanda gourmet com churrasqueira e infraestrutura de lazer completa no condominio. Duas vagas cobertas e deposito privativo.',
  'Apartamento', 'venda', 'disponivel',
  'Vigilato Pereira', 'Uberlandia', 'MG', true,
  1450000, 1100, 540,
  210, 260, 3, 1, 3, 2,
  array['Jardim privativo','Varanda gourmet','Churrasqueira','Deposito privativo','Lazer completo'],
  true, false, true, 'cv4'
),
(
  'Cobertura Santa Monica',
  'Cobertura com rooftop e vista aberta, proxima a Universidade Federal. Excelente liquidez, ideal para moradia de alto padrao ou investimento. Reformada em 2024, com marcenaria planejada em todos os ambientes.',
  'Cobertura', 'venda', 'disponivel',
  'Santa Monica', 'Uberlandia', 'MG', true,
  1980000, 980, 720,
  288, 320, 4, 2, 4, 3,
  array['Rooftop','Marcenaria planejada','Reformado','Vista aberta','Churrasqueira'],
  true, false, true, 'cv6'
),
(
  'Casa Condominio Granja Marileusa',
  'Casa contemporanea no bairro planejado mais premiado de Uberlandia. Arquitetura de linhas retas, pe-direito duplo e integracao total com a area externa. Infraestrutura de fibra otica, ciclovia e parque linear na porta.',
  'Casa', 'venda', 'disponivel',
  'Granja Marileusa', 'Uberlandia', 'MG', true,
  2650000, 890, 1400,
  520, 700, 4, 3, 5, 4,
  array['Condominio fechado','Pe-direito duplo','Piscina','Espaco gourmet','Bairro planejado'],
  true, true, true, 'cv3'
),
(
  'Apartamento Tibery Premium',
  'Apartamento mobiliado para locacao executiva, com lazer completo e portaria 24 horas. Pronto para morar, a cinco minutos do centro empresarial.',
  'Apartamento', 'locacao', 'locado',
  'Tibery', 'Uberlandia', 'MG', true,
  0, 620, 310,
  124, 140, 3, 1, 2, 2,
  array['Mobiliado','Portaria 24h','Lazer completo'],
  false, false, false, 'cv1'
),
(
  'Terreno Alto Umuarama',
  'Terreno plano em regiao de expansao nobre, pronto para construir. Topografia regular, documentacao em ordem e frente para via arborizada.',
  'Terreno', 'venda', 'vendido',
  'Alto Umuarama', 'Uberlandia', 'MG', true,
  980000, 0, 460,
  800, 800, 0, 0, 0, 0,
  array['Topografia plana','Documentacao em ordem'],
  false, false, false, 'cv6'
)
on conflict do nothing;

-- Aluguel do imovel de locacao (a coluna valor guarda o preco de venda).
update imoveis set valor_locacao = 6800 where titulo = 'Apartamento Tibery Premium';
