begin;

-- Fase 1: o domínio de Serviços permanece legível para compatibilidade,
-- mas não aceita escrita de vendedores enquanto o modelo de prestadores está dormente.
drop policy if exists "servicos_gerir_proprios" on public.servicos;
drop policy if exists "vendedor aprovado pode atualizar seus servicos" on public.servicos;
drop policy if exists "vendedor aprovado pode criar servico" on public.servicos;
drop policy if exists "vendedor aprovado pode eliminar seus servicos" on public.servicos;

create policy "servicos_admin_gerir_fase1"
  on public.servicos
  for all
  to authenticated
  using (public.eh_admin())
  with check (public.eh_admin());

commit;
