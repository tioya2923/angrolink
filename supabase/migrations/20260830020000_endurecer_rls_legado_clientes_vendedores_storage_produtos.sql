begin;

-- Remove o acesso legado permissivo antes de declarar os contratos estreitos.
drop policy if exists "DEV admin pode eliminar clientes" on public.clientes;
drop policy if exists "DEV admin pode ver clientes" on public.clientes;
drop policy if exists "Cliente pode criar proprio perfil" on public.clientes;
drop policy if exists "Clientes podem criar o proprio perfil" on public.clientes;
drop policy if exists "Cliente pode ver proprio perfil" on public.clientes;
drop policy if exists "Clientes podem ver o proprio perfil" on public.clientes;
drop policy if exists "Cliente pode atualizar proprio perfil" on public.clientes;
drop policy if exists "Clientes podem atualizar o proprio perfil" on public.clientes;
drop policy if exists "clientes_proprios_ou_admin" on public.clientes;
drop policy if exists "clientes_contactos_do_vendedor" on public.clientes;
drop policy if exists "DEV admin pode gerir vendedores" on public.vendedores;
drop policy if exists "Admin pode atualizar vendedores" on public.vendedores;
drop policy if exists "Admin update vendedores" on public.vendedores;
drop policy if exists "Allow update vendedores" on public.vendedores;
drop policy if exists "Public can read vendedores" on public.vendedores;
drop policy if exists "Public vendedores com contacto" on public.vendedores;
drop policy if exists "Vendedores aprovados visiveis publicamente" on public.vendedores;
drop policy if exists "Vendedor pode ver proprio perfil" on public.vendedores;
drop policy if exists "Vendedores podem ver o proprio perfil" on public.vendedores;
drop policy if exists "vendedores_leitura" on public.vendedores;
drop policy if exists "Utilizadores podem criar o proprio perfil vendedor" on public.vendedores;
drop policy if exists "Vendedor pode criar proprio perfil" on public.vendedores;
drop policy if exists "vendedores_criar_proprio" on public.vendedores;
drop policy if exists "Vendedor atualiza apenas dados permitidos" on public.vendedores;
drop policy if exists "Vendedor pode atualizar proprio perfil" on public.vendedores;
drop policy if exists "Vendedores podem atualizar o próprio perfil" on public.vendedores;
drop policy if exists "vendedores_editar_proprio" on public.vendedores;
drop policy if exists "vendedores_eliminar_admin" on public.vendedores;

revoke all on table public.clientes from anon, authenticated;
revoke all on table public.vendedores from anon, authenticated;
-- REVOKE de tabela não remove grants SELECT por coluna concedidos pelo legado.
-- Revogamos explicitamente todas as colunas conhecidas antes de abrir o
-- subconjunto público abaixo.
revoke select (id,user_id,nome_comercial,nome_responsavel,descricao,email,email_login,telefone_whatsapp,whatsapp,indicativo_telefone,telefone_nacional,provincia,municipio,bairro,mercado_bairro,endereco_detalhado,tipo_vendedor,documentos,verificado,foto_perfil,ano_inicio,data_inicio_atividade,horario_atendimento,entrega_disponivel,tipo_producao,area_cultivada,principais_culturas,producao_mensal,venda_grosso,venda_retalho,tipos_produtos,compra_produtores,volume_minimo,entrega_outras_provincias,tipo_loja,mercado_localizado,venda_presencial,status_aprovacao,motivo_rejeicao,conta_ativa,pode_destacar,plano,aprovado_em,aprovado_por,proximo_destaque_produto_em,proximo_destaque_servico_em,criado_em,atualizado_em) on public.vendedores from anon, authenticated;
grant select, insert, update, delete on table public.clientes to authenticated;
grant select (id,nome_comercial,descricao,telefone_whatsapp,whatsapp,provincia,municipio,bairro,mercado_bairro,endereco_detalhado,tipo_vendedor,verificado,foto_perfil,ano_inicio,data_inicio_atividade,horario_atendimento,entrega_disponivel,tipo_producao,area_cultivada,principais_culturas,producao_mensal,venda_grosso,venda_retalho,tipos_produtos,compra_produtores,volume_minimo,entrega_outras_provincias,tipo_loja,mercado_localizado,venda_presencial,criado_em) on public.vendedores to anon, authenticated;
grant insert (user_id,nome_comercial,nome_responsavel,descricao,email,email_login,telefone_whatsapp,whatsapp,indicativo_telefone,telefone_nacional,provincia,municipio,bairro,mercado_bairro,endereco_detalhado,tipo_vendedor,foto_perfil,ano_inicio,data_inicio_atividade,horario_atendimento,entrega_disponivel,tipo_producao,area_cultivada,principais_culturas,producao_mensal,venda_grosso,venda_retalho,tipos_produtos,compra_produtores,volume_minimo,entrega_outras_provincias,tipo_loja,mercado_localizado,venda_presencial,atualizado_em) on public.vendedores to authenticated;
grant update (nome_comercial,nome_responsavel,descricao,email,email_login,telefone_whatsapp,whatsapp,indicativo_telefone,telefone_nacional,provincia,municipio,bairro,mercado_bairro,endereco_detalhado,tipo_vendedor,foto_perfil,ano_inicio,data_inicio_atividade,horario_atendimento,entrega_disponivel,tipo_producao,area_cultivada,principais_culturas,producao_mensal,venda_grosso,venda_retalho,tipos_produtos,compra_produtores,volume_minimo,entrega_outras_provincias,tipo_loja,mercado_localizado,venda_presencial,atualizado_em) on public.vendedores to authenticated;

create policy clientes_leitura_propria_ou_admin on public.clientes for select to authenticated using (id=auth.uid() or public.eh_admin());
create policy clientes_criar_proprio_ou_admin on public.clientes for insert to authenticated with check (id=auth.uid() or public.eh_admin());
create policy clientes_atualizar_proprio_ou_admin on public.clientes for update to authenticated using (id=auth.uid() or public.eh_admin()) with check (id=auth.uid() or public.eh_admin());
create policy clientes_eliminar_somente_admin on public.clientes for delete to authenticated using (public.eh_admin());
create policy vendedores_leitura_publica on public.vendedores for select to anon,authenticated using (status_aprovacao='aprovado' and coalesce(conta_ativa,false)=true);
create policy vendedores_criar_proprio on public.vendedores for insert to authenticated with check (user_id=auth.uid());
create policy vendedores_atualizar_proprio on public.vendedores for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

create or replace function public.proteger_campos_vendedor() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.eh_admin() then
   if tg_op='INSERT' and (coalesce(new.status_aprovacao,'pendente')<>'pendente' or coalesce(new.verificado,false) or coalesce(new.pode_destacar,false) or coalesce(new.plano,'gratuito')<>'gratuito' or new.aprovado_em is not null or new.aprovado_por is not null or new.motivo_rejeicao is not null or new.proximo_destaque_produto_em is not null or new.proximo_destaque_servico_em is not null) then raise exception 'Campos administrativos só podem ser definidos por um administrador'; end if;
   if tg_op='UPDATE' and (new.status_aprovacao is distinct from old.status_aprovacao or new.verificado is distinct from old.verificado or new.pode_destacar is distinct from old.pode_destacar or new.plano is distinct from old.plano or new.user_id is distinct from old.user_id or new.conta_ativa is distinct from old.conta_ativa or new.aprovado_em is distinct from old.aprovado_em or new.aprovado_por is distinct from old.aprovado_por or new.motivo_rejeicao is distinct from old.motivo_rejeicao or new.proximo_destaque_produto_em is distinct from old.proximo_destaque_produto_em or new.proximo_destaque_servico_em is distinct from old.proximo_destaque_servico_em) then raise exception 'Campos administrativos não podem ser alterados pelo vendedor'; end if;
 end if; return new;
end $$;

create or replace function public.obter_meu_vendedor() returns table(id uuid,nome_comercial text,descricao text,telefone_whatsapp text,whatsapp text,provincia text,municipio text,bairro text,mercado_bairro text,endereco_detalhado text,tipo_vendedor text,verificado boolean,foto_perfil text,ano_inicio integer,data_inicio_atividade date,horario_atendimento text,entrega_disponivel boolean,tipo_producao text,area_cultivada numeric,principais_culturas text,producao_mensal text,venda_grosso boolean,venda_retalho boolean,tipos_produtos text,compra_produtores boolean,volume_minimo text,entrega_outras_provincias boolean,tipo_loja text,mercado_localizado text,venda_presencial boolean,user_id uuid,nome_responsavel text,email text,indicativo_telefone text,telefone_nacional text,status_aprovacao text,motivo_rejeicao text,conta_ativa boolean,pode_destacar boolean,plano text,aprovado_em timestamptz,criado_em timestamp,atualizado_em timestamptz) language sql stable security definer set search_path=public as $$ select v.id,v.nome_comercial,v.descricao,v.telefone_whatsapp,v.whatsapp,v.provincia,v.municipio,v.bairro,v.mercado_bairro,v.endereco_detalhado,v.tipo_vendedor,v.verificado,v.foto_perfil,v.ano_inicio,v.data_inicio_atividade,v.horario_atendimento,v.entrega_disponivel,v.tipo_producao,v.area_cultivada,v.principais_culturas,v.producao_mensal,v.venda_grosso,v.venda_retalho,v.tipos_produtos,v.compra_produtores,v.volume_minimo,v.entrega_outras_provincias,v.tipo_loja,v.mercado_localizado,v.venda_presencial,v.user_id,v.nome_responsavel,v.email,v.indicativo_telefone,v.telefone_nacional,v.status_aprovacao,v.motivo_rejeicao,v.conta_ativa,v.pode_destacar,v.plano,v.aprovado_em,v.criado_em,v.atualizado_em from public.vendedores v where v.user_id=auth.uid() $$;
revoke all on function public.obter_meu_vendedor() from public,anon; grant execute on function public.obter_meu_vendedor() to authenticated;

create or replace function public.verificar_disponibilidade_cadastro(p_telefone text,p_email text default null) returns table(telefone_existe boolean,email_existe boolean) language sql stable security definer set search_path=public as $$
  select
    exists (
      select 1 from public.clientes c where c.telefone=p_telefone
      union all
      select 1 from public.vendedores v where v.telefone_whatsapp=p_telefone
      union all
      select 1 from public.parceiros_entrega p where p.telefone=p_telefone
    ),
    case when nullif(btrim(p_email),'') is null then false else exists (
      select 1 from public.clientes c where lower(c.email)=lower(btrim(p_email)) or lower(c.email_login)=lower(btrim(p_email))
      union all
      select 1 from public.vendedores v where lower(v.email)=lower(btrim(p_email)) or lower(v.email_login)=lower(btrim(p_email))
      union all
      select 1 from public.parceiros_entrega p where lower(p.email)=lower(btrim(p_email))
    ) end
$$;
revoke all on function public.verificar_disponibilidade_cadastro(text,text) from public,anon,authenticated; grant execute on function public.verificar_disponibilidade_cadastro(text,text) to anon,authenticated;

create or replace function public.listar_contactos_produtos_vendedor() returns table(id uuid,cliente_id uuid,vendedor_id uuid,produto_id uuid,criado_em timestamptz,atualizado_em timestamptz,clientes jsonb,produtos jsonb) language sql stable security definer set search_path=public as $$
 select h.id,h.cliente_id,h.vendedor_id,h.produto_id,h.criado_em,h.atualizado_em,jsonb_build_object('nome',c.nome,'telefone',c.telefone,'foto_perfil',c.foto_perfil),jsonb_build_object('id',p.id,'nome_produto',p.nome_produto,'imagem_url',p.imagem_url)
 from public.historico_contactos h join public.vendedores v on v.id=h.vendedor_id left join public.clientes c on c.id=h.cliente_id left join public.produtos p on p.id=h.produto_id where v.user_id=auth.uid() order by h.atualizado_em desc $$;
create or replace function public.listar_contactos_servicos_vendedor() returns table(id uuid,cliente_id uuid,vendedor_id uuid,servico_id uuid,criado_em timestamptz,atualizado_em timestamptz,clientes jsonb,servicos jsonb) language sql stable security definer set search_path=public as $$
 select h.id,h.cliente_id,h.vendedor_id,h.servico_id,h.criado_em,h.atualizado_em,jsonb_build_object('nome',c.nome,'telefone',c.telefone,'foto_perfil',c.foto_perfil),jsonb_build_object('id',s.id,'nome_servico',s.nome_servico,'imagem_url',s.imagem_url)
 from public.historico_contactos_servicos h join public.vendedores v on v.id=h.vendedor_id left join public.clientes c on c.id=h.cliente_id left join public.servicos s on s.id=h.servico_id where v.user_id=auth.uid() order by h.atualizado_em desc $$;
revoke all on function public.listar_contactos_produtos_vendedor() from public,anon; grant execute on function public.listar_contactos_produtos_vendedor() to authenticated;
revoke all on function public.listar_contactos_servicos_vendedor() from public,anon; grant execute on function public.listar_contactos_servicos_vendedor() to authenticated;

create or replace function public.listar_vendedores_admin() returns table(id uuid,nome_comercial text,descricao text,telefone_whatsapp text,whatsapp text,provincia text,municipio text,bairro text,mercado_bairro text,endereco_detalhado text,tipo_vendedor text,verificado boolean,foto_perfil text,user_id uuid,nome_responsavel text,email text,email_login text,indicativo_telefone text,telefone_nacional text,status_aprovacao text,motivo_rejeicao text,conta_ativa boolean,pode_destacar boolean,plano text,aprovado_em timestamptz,aprovado_por uuid,criado_em timestamp,atualizado_em timestamptz) language plpgsql stable security definer set search_path=public as $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; return query select v.id,v.nome_comercial,v.descricao,v.telefone_whatsapp,v.whatsapp,v.provincia,v.municipio,v.bairro,v.mercado_bairro,v.endereco_detalhado,v.tipo_vendedor,v.verificado,v.foto_perfil,v.user_id,v.nome_responsavel,v.email,v.email_login,v.indicativo_telefone,v.telefone_nacional,v.status_aprovacao,v.motivo_rejeicao,v.conta_ativa,v.pode_destacar,v.plano,v.aprovado_em,v.aprovado_por,v.criado_em,v.atualizado_em from public.vendedores v order by v.criado_em desc; end $$;
create or replace function public.atualizar_estado_vendedor_admin(p_vendedor_id uuid,p_estado text,p_motivo_rejeicao text default null) returns void language plpgsql security definer set search_path=public as $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; if p_estado not in ('pendente','aprovado','rejeitado','suspenso') then raise exception 'Estado de vendedor inválido.'; end if; if p_estado='rejeitado' and nullif(btrim(p_motivo_rejeicao),'') is null then raise exception 'Indique o motivo da rejeição.'; end if; update public.vendedores set status_aprovacao=p_estado,aprovado_em=case when p_estado='aprovado' then now() else aprovado_em end,aprovado_por=case when p_estado='aprovado' then auth.uid() else aprovado_por end,motivo_rejeicao=case when p_estado='rejeitado' then btrim(p_motivo_rejeicao) else null end,verificado=case when p_estado in ('rejeitado','suspenso') then false else verificado end,pode_destacar=case when p_estado in ('rejeitado','suspenso') then false else pode_destacar end,atualizado_em=now() where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;
create or replace function public.atualizar_plano_vendedor_admin(p_vendedor_id uuid,p_plano text) returns void language plpgsql security definer set search_path=public as $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; if p_plano not in ('gratuito','destaque','premium') then raise exception 'Plano de vendedor inválido.'; end if; update public.vendedores set plano=p_plano,atualizado_em=now() where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;
create or replace function public.atualizar_verificacao_vendedor_admin(p_vendedor_id uuid,p_verificado boolean) returns void language plpgsql security definer set search_path=public as $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; if p_verificado and not exists (select 1 from public.vendedores where id=p_vendedor_id and status_aprovacao='aprovado' and coalesce(conta_ativa,false)=true) then raise exception 'Apenas vendedores aprovados e ativos podem ser verificados.'; end if; update public.vendedores set verificado=p_verificado,atualizado_em=now() where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;
create or replace function public.eliminar_vendedor_admin(p_vendedor_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin if not public.eh_admin() then raise exception 'Sem permissão administrativa.'; end if; delete from public.vendedores where id=p_vendedor_id; if not found then raise exception 'Vendedor não encontrado.'; end if; end $$;
revoke all on function public.listar_vendedores_admin() from public,anon; grant execute on function public.listar_vendedores_admin() to authenticated;
revoke all on function public.atualizar_estado_vendedor_admin(uuid,text,text) from public,anon; grant execute on function public.atualizar_estado_vendedor_admin(uuid,text,text) to authenticated;
revoke all on function public.atualizar_plano_vendedor_admin(uuid,text) from public,anon; grant execute on function public.atualizar_plano_vendedor_admin(uuid,text) to authenticated;
revoke all on function public.atualizar_verificacao_vendedor_admin(uuid,boolean) from public,anon; grant execute on function public.atualizar_verificacao_vendedor_admin(uuid,boolean) to authenticated;
revoke all on function public.eliminar_vendedor_admin(uuid) from public,anon; grant execute on function public.eliminar_vendedor_admin(uuid) to authenticated;

-- Storage de produtos: escrita apenas no namespace autenticado; leitura pública permanece inalterada.
drop policy if exists "Permitir upload publico produtos" on storage.objects;
drop policy if exists "produtos_upload_proprio" on storage.objects;
drop policy if exists "produtos_atualizar_proprio" on storage.objects;
drop policy if exists "produtos_eliminar_proprio" on storage.objects;
create policy produtos_upload_proprio on storage.objects for insert to authenticated with check (bucket_id='produtos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy produtos_atualizar_proprio on storage.objects for update to authenticated using (bucket_id='produtos' and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='produtos' and (storage.foldername(name))[1]=auth.uid()::text);
create policy produtos_eliminar_proprio on storage.objects for delete to authenticated using (bucket_id='produtos' and (storage.foldername(name))[1]=auth.uid()::text);

alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon,authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated;

commit;
