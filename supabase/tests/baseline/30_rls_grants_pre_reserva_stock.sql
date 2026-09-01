-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- NÃO É MIGRATION. RLS/grants mínimos para exercitar JWT claims locais.

alter table public.profiles enable row level security;
alter table public.vendedores enable row level security;
alter table public.clientes enable row level security;
alter table public.produtos enable row level security;
alter table public.encomendas enable row level security;
alter table public.itens_encomenda enable row level security;

create policy clientes_proprio_baseline on public.clientes for select to authenticated using (id = auth.uid());
create policy vendedores_publicos_baseline on public.vendedores for select to authenticated using (true);
create policy produtos_publicos_baseline on public.produtos for select to authenticated using (publicado and disponivel);
create policy encomendas_participante_baseline on public.encomendas for select to authenticated using (cliente_id = auth.uid() or exists (select 1 from public.vendedores v where v.id=vendedor_id and v.user_id=auth.uid()));

revoke all on all tables in schema public from public, anon, authenticated;
grant usage on schema public to authenticated, anon;

-- Não usar GRANT EXECUTE ON ALL FUNCTIONS: os helpers pré-draft são internos
-- aos SECURITY DEFINER do checkout. As RPCs públicas do draft recebem grants
-- explícitos no próprio draft, preservando o contrato de segurança real.
revoke all on function public.gerar_codigo_publico_encomenda() from public, anon, authenticated;
revoke all on function public.vendedor_pode_receber_encomendas(uuid) from public, anon, authenticated;
revoke all on function public.garantir_perfil_comprador() from public, anon, authenticated;
revoke all on function public.validar_compra_produto_alheio(jsonb) from public, anon, authenticated;
revoke all on function public.territorio_angola_valido(text,text) from public, anon, authenticated;
revoke all on function public.criar_pagamento_encomenda(uuid,uuid) from public, anon, authenticated;
revoke all on function public.criar_tentativa_pagamento(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.criar_notificacao(uuid,text,text,text,text,text,uuid,text,jsonb,text) from public, anon, authenticated;
