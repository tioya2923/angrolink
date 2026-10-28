-- Incremento I: contratos passivos. Nao envia, confirma, submete ou habilita parceiros.
-- PostgreSQL >= 15 (UNIQUE NULLS NOT DISTINCT). Executar pelo owner postgres.
-- Colisoes de nomes falham: nao recaptura legados nem repara objetos existentes.
begin;

create schema parceiros_email_verificacao_privado authorization postgres;
revoke all on schema parceiros_email_verificacao_privado from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema parceiros_email_verificacao_privado
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema parceiros_email_verificacao_privado
  revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges for role postgres in schema parceiros_email_verificacao_privado
  revoke all on sequences from public, anon, authenticated, service_role;

create table parceiros_email_verificacao_privado.desafios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_normalizado text not null,
  finalidade text not null default 'email_candidatura_parceiro'
    check (finalidade = 'email_candidatura_parceiro'),
  geracao bigint not null check (geracao > 0),
  versao_criptografica integer not null check (versao_criptografica > 0),
  algoritmo_verificador text not null default 'hmac-sha256'
    check (algoritmo_verificador = 'hmac-sha256'),
  verificador bytea,
  estado text not null default 'ativo'
    check (estado in ('ativo', 'consumido', 'expirado', 'invalidado')),
  estado_envio text not null default 'pendente'
    check (estado_envio in ('pendente', 'aceite', 'incerto', 'falhou')),
  tentativas integer not null default 0,
  limite_tentativas integer not null default 5 check (limite_tentativas between 1 and 20),
  criado_em timestamptz not null default transaction_timestamp(),
  expira_em timestamptz not null,
  proximo_envio_em timestamptz not null,
  finalizado_em timestamptz,
  verificador_eliminado_em timestamptz,
  constraint desafios_email_check check (
    email_normalizado = lower(btrim(email_normalizado))
    and email_normalizado ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
    and split_part(email_normalizado, '@', 2) <> 'telefone.angrolink'
  ),
  constraint desafios_tentativas_check check (tentativas between 0 and limite_tentativas),
  constraint desafios_prazos_check check (expira_em > criado_em and proximo_envio_em >= criado_em),
  constraint desafios_estado_datas_check check (
    (estado = 'ativo' and finalizado_em is null)
    or (estado <> 'ativo' and finalizado_em is not null and finalizado_em >= criado_em)
  ),
  constraint desafios_verificador_check check (
    (verificador is not null and octet_length(verificador) = 32 and verificador_eliminado_em is null)
    or (verificador is null and estado <> 'ativo' and verificador_eliminado_em is not null
        and verificador_eliminado_em >= finalizado_em)
  ),
  unique (user_id, finalidade, geracao),
  unique (id, user_id, email_normalizado, finalidade, estado),
  unique (id, user_id, geracao)
);

create table parceiros_email_verificacao_privado.comprovacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_normalizado text not null,
  finalidade text not null default 'email_candidatura_parceiro'
    check (finalidade = 'email_candidatura_parceiro'),
  desafio_id uuid not null,
  estado_desafio text not null default 'consumido' check (estado_desafio = 'consumido'),
  versao integer not null check (versao > 0),
  referencia_auditoria uuid not null unique default gen_random_uuid(),
  confirmada_em timestamptz not null default transaction_timestamp(),
  estado text not null default 'ativa' check (estado in ('ativa', 'substituida', 'revogada')),
  substituida_em timestamptz,
  revogada_em timestamptz,
  constraint comprovacoes_origem_fkey foreign key
    (desafio_id, user_id, email_normalizado, finalidade, estado_desafio)
    references parceiros_email_verificacao_privado.desafios
    (id, user_id, email_normalizado, finalidade, estado)
    on delete no action deferrable initially deferred,
  constraint comprovacoes_estado_datas_check check (
    (estado = 'ativa' and substituida_em is null and revogada_em is null)
    or (estado = 'substituida' and substituida_em is not null
        and substituida_em >= confirmada_em and revogada_em is null)
    or (estado = 'revogada' and revogada_em is not null
        and revogada_em >= confirmada_em and substituida_em is null)
  ),
  unique (desafio_id),
  unique (id, user_id, email_normalizado, finalidade)
);
create unique index comprovacoes_uma_ativa_por_identidade
  on parceiros_email_verificacao_privado.comprovacoes(user_id, finalidade) where estado = 'ativa';

create table parceiros_email_verificacao_privado.continuacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comprovacao_id uuid not null,
  email_normalizado text not null,
  finalidade text not null default 'email_candidatura_parceiro'
    check (finalidade = 'email_candidatura_parceiro'),
  tentativa_id uuid not null,
  operacao text not null check (operacao ~ '^[a-z][a-z0-9_]{0,63}$'),
  chave_idempotencia uuid not null,
  criado_em timestamptz not null default transaction_timestamp(),
  expira_em timestamptz not null,
  estado text not null default 'ativa'
    check (estado in ('ativa', 'consumida', 'concluida', 'cancelada', 'expirada')),
  consumida_em timestamptz,
  concluida_em timestamptz,
  encerrada_em timestamptz,
  constraint continuacoes_comprovacao_fkey foreign key
    (comprovacao_id, user_id, email_normalizado, finalidade)
    references parceiros_email_verificacao_privado.comprovacoes
    (id, user_id, email_normalizado, finalidade)
    on delete no action deferrable initially deferred,
  constraint continuacoes_prazo_check check (expira_em > criado_em),
  constraint continuacoes_estado_datas_check check (
    (estado = 'ativa' and consumida_em is null and concluida_em is null and encerrada_em is null)
    or (estado = 'consumida' and consumida_em is not null and consumida_em >= criado_em
        and concluida_em is null and encerrada_em is null)
    or (estado = 'concluida' and consumida_em is not null and consumida_em >= criado_em
        and concluida_em is not null and concluida_em >= consumida_em and encerrada_em is null)
    or (estado in ('cancelada', 'expirada') and consumida_em is null and concluida_em is null
        and encerrada_em is not null and encerrada_em >= criado_em)
  ),
  unique (user_id, operacao, chave_idempotencia),
  unique (user_id, tentativa_id),
  unique (id, user_id, operacao, chave_idempotencia, tentativa_id)
);

create table parceiros_email_verificacao_privado.outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desafio_id uuid not null unique,
  geracao bigint not null,
  chave_deduplicacao uuid not null unique,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'processando', 'aceite', 'incerto', 'falhou', 'cancelado')),
  tentativas integer not null default 0,
  limite_tentativas integer not null default 5 check (limite_tentativas between 1 and 20),
  criado_em timestamptz not null default transaction_timestamp(),
  disponivel_em timestamptz not null default transaction_timestamp(),
  ultima_tentativa_em timestamptz,
  processado_em timestamptz,
  lease_id uuid,
  lease_ate timestamptz,
  ultimo_erro_codigo text check (ultimo_erro_codigo in
    ('smtp_temporario', 'smtp_permanente', 'resposta_incerta', 'limite', 'interno')),
  algoritmo_cifra text not null default 'aes-256-gcm' check (algoritmo_cifra = 'aes-256-gcm'),
  versao_chave integer not null check (versao_chave > 0),
  conteudo_cifrado bytea,
  nonce bytea,
  tag bytea,
  conteudo_eliminado_em timestamptz,
  constraint outbox_desafio_fkey foreign key (desafio_id, user_id, geracao)
    references parceiros_email_verificacao_privado.desafios(id, user_id, geracao)
    on delete no action deferrable initially deferred,
  constraint outbox_tentativas_check check (tentativas between 0 and limite_tentativas),
  constraint outbox_datas_check check (
    disponivel_em >= criado_em
    and (ultima_tentativa_em is null or ultima_tentativa_em >= criado_em)
    and (processado_em is null or processado_em >= criado_em)
  ),
  constraint outbox_lease_check check (
    (estado = 'processando' and lease_id is not null and lease_ate is not null and lease_ate > criado_em)
    or (estado <> 'processando' and lease_id is null and lease_ate is null)
  ),
  constraint outbox_processamento_check check (
    (estado in ('aceite', 'falhou', 'cancelado') and processado_em is not null)
    or (estado in ('pendente', 'processando', 'incerto') and processado_em is null)
  ),
  constraint outbox_envelope_check check (
    (conteudo_cifrado is not null and octet_length(conteudo_cifrado) between 1 and 16384
     and nonce is not null and octet_length(nonce) = 12
     and tag is not null and octet_length(tag) = 16 and conteudo_eliminado_em is null)
    or (conteudo_cifrado is null and nonce is null and tag is null
        and estado in ('aceite', 'falhou', 'cancelado')
        and conteudo_eliminado_em is not null and conteudo_eliminado_em >= processado_em)
  )
);

create table parceiros_email_verificacao_privado.idempotencia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  operacao text not null check (operacao ~ '^[a-z][a-z0-9_]{0,63}$'),
  chave_idempotencia uuid not null,
  tentativa_id uuid not null,
  continuacao_id uuid not null,
  versao_intencao integer not null check (versao_intencao > 0),
  algoritmo_hash text not null default 'sha256' check (algoritmo_hash = 'sha256'),
  hash_intencao bytea not null check (octet_length(hash_intencao) = 32),
  estado text not null default 'em_processamento'
    check (estado in ('em_processamento', 'concluida', 'cancelada')),
  criado_em timestamptz not null default transaction_timestamp(),
  finalizado_em timestamptz,
  resultado_parceiro_id uuid,
  resposta_minima jsonb,
  constraint idempotencia_continuacao_fkey foreign key
    (continuacao_id, user_id, operacao, chave_idempotencia, tentativa_id)
    references parceiros_email_verificacao_privado.continuacoes
    (id, user_id, operacao, chave_idempotencia, tentativa_id)
    on delete no action deferrable initially deferred,
  constraint idempotencia_estado_resultado_check check (
    (estado = 'em_processamento' and finalizado_em is null
      and resultado_parceiro_id is null and resposta_minima is null)
    or (estado = 'cancelada' and finalizado_em is not null and finalizado_em >= criado_em
      and resultado_parceiro_id is null and resposta_minima is null)
    or (estado = 'concluida' and finalizado_em is not null and finalizado_em >= criado_em
      and resultado_parceiro_id is not null and resposta_minima is not null
      and jsonb_typeof(resposta_minima) = 'object'
      and resposta_minima ?& array['parceiro_id', 'estado']
      and resposta_minima - array['parceiro_id', 'estado'] = '{}'::jsonb
      and jsonb_typeof(resposta_minima->'parceiro_id') = 'string'
      and resposta_minima->>'parceiro_id' = resultado_parceiro_id::text
      and jsonb_typeof(resposta_minima->'estado') = 'string'
      and resposta_minima->>'estado' in ('rascunho', 'documentos_pendentes', 'em_analise',
        'aprovado', 'rejeitado', 'suspenso', 'documentacao_expirada'))
  ),
  unique (user_id, operacao, chave_idempotencia)
);

create table parceiros_email_verificacao_privado.orcamentos (
  id uuid primary key default gen_random_uuid(),
  tipo_sujeito text not null check (tipo_sujeito in ('identidade', 'endereco', 'origem', 'global')),
  user_id uuid references auth.users(id) on delete cascade,
  sujeito_pseudonimo bytea,
  versao_pseudonimo integer,
  metrica text not null check (metrica in ('emissoes', 'falhas_validacao', 'tentativas_entrega')),
  janela_inicio timestamptz not null,
  janela_fim timestamptz not null,
  utilizado bigint not null default 0 check (utilizado >= 0),
  reservado bigint not null default 0 check (reservado >= 0),
  limite bigint not null check (limite > 0),
  proximo_permitido_em timestamptz,
  constraint orcamentos_sujeito_check check (
    (tipo_sujeito = 'identidade' and user_id is not null and sujeito_pseudonimo is null and versao_pseudonimo is null)
    or (tipo_sujeito in ('endereco', 'origem') and user_id is null and sujeito_pseudonimo is not null
        and octet_length(sujeito_pseudonimo) = 32 and versao_pseudonimo is not null and versao_pseudonimo > 0)
    or (tipo_sujeito = 'global' and user_id is null and sujeito_pseudonimo is null and versao_pseudonimo is null)
  ),
  constraint orcamentos_janela_check check (janela_fim > janela_inicio),
  constraint orcamentos_consumo_limite_check check (utilizado + reservado <= limite),
  unique nulls not distinct
    (tipo_sujeito, user_id, sujeito_pseudonimo, versao_pseudonimo, metrica, janela_inicio, janela_fim)
);

alter table parceiros_email_verificacao_privado.desafios owner to postgres;
alter table parceiros_email_verificacao_privado.comprovacoes owner to postgres;
alter table parceiros_email_verificacao_privado.continuacoes owner to postgres;
alter table parceiros_email_verificacao_privado.outbox owner to postgres;
alter table parceiros_email_verificacao_privado.idempotencia owner to postgres;
alter table parceiros_email_verificacao_privado.orcamentos owner to postgres;
alter table parceiros_email_verificacao_privado.desafios enable row level security;
alter table parceiros_email_verificacao_privado.comprovacoes enable row level security;
alter table parceiros_email_verificacao_privado.continuacoes enable row level security;
alter table parceiros_email_verificacao_privado.outbox enable row level security;
alter table parceiros_email_verificacao_privado.idempotencia enable row level security;
alter table parceiros_email_verificacao_privado.orcamentos enable row level security;
revoke all on all tables in schema parceiros_email_verificacao_privado from public, anon, authenticated, service_role;
revoke all on all sequences in schema parceiros_email_verificacao_privado from public, anon, authenticated, service_role;

comment on schema parceiros_email_verificacao_privado is
  'Contratos passivos de verificacao de email. Sem backend, envio ou enforcement comercial ativo.';
comment on table parceiros_email_verificacao_privado.comprovacoes is
  'Comprovacao persistente sem prazo OTP. Somente mecanismo servidor futuro pode comprovar posse real.';
comment on column parceiros_email_verificacao_privado.idempotencia.resultado_parceiro_id is
  'Referencia logica, sem FK comercial: nao impede recriacao de candidaturas. Validacao/replay pertencem ao incremento futuro.';
comment on table parceiros_email_verificacao_privado.orcamentos is
  'Janelas e contadores declarativos. Sem incremento atomico, normalizacao de janelas ou rate limiter implementado.';

commit;
