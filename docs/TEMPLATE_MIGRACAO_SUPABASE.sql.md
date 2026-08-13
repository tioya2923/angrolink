# Template de migration Supabase

Este ficheiro é apenas um modelo. Não o copie para produção sem adaptar e rever cada bloco. Uma migration real deve ficar em `supabase/migrations/YYYYMMDDHHMMSS_descricao_curta.sql`.

```sql
-- ANGROLINK — descrição clara e única da alteração.
-- Pré-condições, impacto esperado e plano de verificação.

begin;

-- 1. Alterações aditivas.
-- Use IF NOT EXISTS apenas quando a repetição for segura e não ocultar uma
-- divergência de schema que precise de investigação.
create table if not exists public.exemplo (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now()
);

-- 2. Índices necessários para as consultas reais.
create index if not exists exemplo_criado_em_idx
  on public.exemplo (criado_em desc);

-- 3. RLS explícito para tabelas sensíveis.
alter table public.exemplo enable row level security;

-- 4. Policies mínimas, restritas ao papel/dono correto.
create policy exemplo_leitura_propria
on public.exemplo for select to authenticated
using (false); -- substituir por regra real revista.

-- 5. Funções e triggers, quando necessários, com search_path explícito.
-- create or replace function public.exemplo_funcao()
-- returns trigger language plpgsql security definer set search_path = public as $$
-- begin
--   return new;
-- end;
-- $$;

-- 6. Grants somente quando necessários; nunca conceder permissões amplas
-- sem confirmar RLS e necessidade do papel.
-- grant select on public.exemplo to authenticated;

commit;
```

Para uma correção posterior, criar uma nova migration. Não editar uma migration já aplicada e não usar rollback destrutivo como plano padrão.
