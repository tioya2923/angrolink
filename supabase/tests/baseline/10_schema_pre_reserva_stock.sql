-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- NÃO É MIGRATION. Estado mínimo pré-Reserva Stock V1, reconstruído para testes.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  papel text not null default 'cliente',
  ativo boolean not null default true,
  apagado_em timestamptz
);

create table public.vendedores (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid references auth.users(id) on delete restrict,
  nome_comercial text not null,
  nome_responsavel text,
  email text,
  telefone_whatsapp text,
  whatsapp text,
  provincia text,
  municipio text,
  bairro text,
  mercado_bairro text,
  endereco_detalhado text,
  status_aprovacao text not null default 'pendente',
  conta_ativa boolean not null default true,
  bloqueado boolean not null default false
);

create table public.clientes (
  id uuid primary key references auth.users(id) on delete restrict,
  nome text,
  email text,
  telefone text,
  provincia text,
  municipio text,
  conta_ativa boolean not null default true,
  tipo_comprador text
);

create table public.produtos (
  id uuid primary key default extensions.gen_random_uuid(),
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  nome_produto text not null,
  descricao text,
  imagem_url text,
  unidade text not null default 'unidade',
  tipo_venda text not null default 'retalho',
  preco_aproximado numeric not null,
  preco_promocional numeric,
  preco_grosso numeric,
  quantidade_minima numeric not null default 1,
  quantidade_minima_grosso numeric,
  publicado boolean not null default true,
  disponivel boolean not null default true
);

create table public.encomendas (
  id uuid primary key default extensions.gen_random_uuid(),
  codigo_publico text not null unique check (codigo_publico ~ '^ANG-[0-9]{4}-[A-F0-9]{8}$'),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  estado text not null default 'aguardando_confirmacao',
  modalidade_recebimento text not null check (modalidade_recebimento in ('levantamento', 'entrega')),
  moeda char(3) not null default 'AOA',
  subtotal_centimos bigint not null check (subtotal_centimos >= 0),
  desconto_centimos bigint not null default 0 check (desconto_centimos >= 0),
  entrega_centimos bigint not null default 0 check (entrega_centimos >= 0),
  total_centimos bigint not null check (total_centimos = subtotal_centimos - desconto_centimos + entrega_centimos),
  destinatario_nome text not null,
  destinatario_telefone text not null,
  provincia text,
  municipio text,
  bairro text,
  endereco_levantamento text,
  ponto_referencia text,
  observacoes_cliente text,
  motivo_recusa text,
  motivo_cancelamento text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  recusado_em timestamptz,
  cancelado_em timestamptz,
  concluido_em timestamptz
);

create table public.itens_encomenda (
  id uuid primary key default extensions.gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  produto_id uuid references public.produtos(id) on delete set null,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  quantidade numeric(18,3) not null check (quantidade > 0),
  unidade text not null,
  tipo_preco_snapshot text not null check (tipo_preco_snapshot in ('normal', 'promocional', 'grosso')),
  valor_unitario_centimos bigint not null check (valor_unitario_centimos >= 0),
  subtotal_centimos bigint not null check (subtotal_centimos >= 0),
  nome_produto_snapshot text not null,
  descricao_snapshot text,
  imagem_principal_snapshot text,
  criado_em timestamptz not null default now()
);

create table public.eventos_encomenda (
  id uuid primary key default extensions.gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  tipo_evento text not null,
  estado_anterior text,
  estado_novo text not null,
  ator_tipo text not null,
  utilizador_id uuid references auth.users(id) on delete set null,
  metadados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.enderecos_entrega_encomenda (
  encomenda_id uuid primary key references public.encomendas(id) on delete restrict,
  destinatario_nome text not null,
  destinatario_telefone text not null,
  provincia text not null,
  municipio text not null,
  bairro text not null,
  endereco_detalhado text not null,
  ponto_referencia text,
  instrucoes_entrega text,
  criado_em timestamptz not null default now()
);

create table public.codigos_levantamento (
  id uuid primary key default extensions.gen_random_uuid(),
  encomenda_id uuid not null unique references public.encomendas(id) on delete restrict,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0,
  max_tentativas smallint not null default 5,
  bloqueado_em timestamptz,
  usado_em timestamptz,
  atualizado_por uuid references auth.users(id)
);

create table public.parceiros_entrega (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  estado text not null default 'aprovado',
  disponibilidade boolean not null default true
);

create table public.atribuicoes_entrega_encomenda (
  id uuid primary key default extensions.gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  parceiro_entrega_id uuid not null references public.parceiros_entrega(id) on delete restrict,
  veiculo_id uuid,
  estado text not null default 'atribuida',
  chegou_origem_em timestamptz,
  recolhida_em timestamptz
);

create table public.pagamentos (
  id uuid primary key default extensions.gen_random_uuid(),
  encomenda_id uuid not null unique references public.encomendas(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  vendedor_id uuid not null references public.vendedores(id) on delete restrict,
  estado text not null default 'pendente',
  referencia_interna text not null unique,
  chave_idempotencia_criacao uuid not null unique,
  moeda char(3) not null default 'AOA',
  subtotal_centimos bigint not null default 0,
  desconto_centimos bigint not null default 0,
  entrega_centimos bigint not null default 0,
  taxa_processador_centimos bigint not null default 0,
  comissao_angrolink_centimos bigint not null default 0,
  valor_vendedor_centimos bigint not null default 0,
  valor_logistica_centimos bigint not null default 0,
  valor_total_centimos bigint not null default 0,
  total_cliente_centimos bigint not null default 0,
  comissao_bps_snapshot integer not null default 0,
  cancelado_em timestamptz
);

create table public.tentativas_pagamento (
  id uuid primary key default extensions.gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  metodo text not null,
  estado text not null default 'criada',
  referencia_interna text not null unique,
  chave_idempotencia uuid not null unique,
  cancelado_em timestamptz,
  codigo_erro text,
  mensagem_erro text
);

create table public.eventos_pagamento (
  id uuid primary key default extensions.gen_random_uuid(),
  pagamento_id uuid not null references public.pagamentos(id) on delete restrict,
  tentativa_pagamento_id uuid references public.tentativas_pagamento(id) on delete restrict,
  encomenda_id uuid not null references public.encomendas(id) on delete restrict,
  tipo_evento text not null,
  estado_anterior text,
  estado_novo text not null,
  ator_tipo text not null,
  utilizador_id uuid references auth.users(id),
  metadados jsonb not null default '{}'::jsonb
);

create table public.notificacoes (
  id uuid primary key default extensions.gen_random_uuid(),
  utilizador_id uuid not null references auth.users(id) on delete cascade,
  contexto text not null,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  entidade_tipo text,
  entidade_id uuid,
  url_destino text,
  metadata jsonb not null default '{}'::jsonb,
  chave_idempotencia text unique
);
