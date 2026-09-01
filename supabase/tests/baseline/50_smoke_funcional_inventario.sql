-- TEST-ONLY — NÃO APLICAR EM PRODUÇÃO
-- NÃO É MIGRATION. Smoke mínimo após aplicar a cópia COMMIT do draft.

begin;

insert into auth.users(id,email) values
  ('10000000-0000-0000-0000-000000000001','seller-a@example.test'),
  ('10000000-0000-0000-0000-000000000002','seller-b@example.test'),
  ('10000000-0000-0000-0000-000000000003','buyer-a@example.test');
insert into public.profiles(id,papel) values
  ('10000000-0000-0000-0000-000000000001','vendedor'),
  ('10000000-0000-0000-0000-000000000002','vendedor'),
  ('10000000-0000-0000-0000-000000000003','cliente');
insert into public.vendedores(id,user_id,nome_comercial,status_aprovacao,conta_ativa) values
  ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Vendedor A','aprovado',true),
  ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Vendedor B','aprovado',true);
insert into public.clientes(id,nome,telefone) values
  ('10000000-0000-0000-0000-000000000003','Cliente A','900000000');
insert into public.produtos(id,vendedor_id,nome_produto,unidade,preco_aproximado) values
  ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Produto sintético','kg',100);

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select public.obter_inventario_produto_vendedor('30000000-0000-0000-0000-000000000001');
select public.definir_inventario_produto_vendedor('30000000-0000-0000-0000-000000000001',true,10.500);

do $$
declare v jsonb;
begin
  select public.obter_inventario_produto_vendedor('30000000-0000-0000-0000-000000000001') into v;
  if v->>'quantidade_fisica' <> '10.500' or v->>'quantidade_reservada' <> '0' or v->>'quantidade_disponivel' <> '10.500' then
    raise exception 'Smoke de inventário não preservou 10.500/0/10.500: %', v;
  end if;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
begin
  begin
    perform public.obter_inventario_produto_vendedor('30000000-0000-0000-0000-000000000001');
    raise exception 'Vendedor alheio conseguiu ler inventário.';
  exception when others then
    if position('Produto não encontrado ou sem permissão.' in sqlerrm) = 0 then raise; end if;
  end;
end $$;

reset role;
do $$
begin
  if has_function_privilege('anon','public.obter_inventario_produto_vendedor(uuid)','execute') then
    raise exception 'anon recebeu execução indevida da leitura de inventário.';
  end if;
end $$;

rollback;
