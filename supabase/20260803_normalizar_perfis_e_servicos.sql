-- ANGROLINK — separa perfis profissionais de serviços prestados.
-- Executar no SQL Editor do Supabase antes de disponibilizar esta versão.
-- A migração é aditiva: não elimina contas, produtos, serviços ou documentos.

begin;

alter table public.vendedores drop constraint if exists tipo_vendedor_valido;
alter table public.vendedores drop constraint if exists vendedores_tipo_vendedor_check;

-- Taxista e moto-taxista deixam de ser tipos de vendedor. Contas existentes
-- continuam como prestadores de serviços, sem perder os documentos já guardados.
update public.vendedores
set tipo_vendedor = 'prestador_servico'
where tipo_vendedor in ('taxista', 'moto_taxista');

alter table public.vendedores
  add constraint vendedores_tipo_vendedor_check check (
    tipo_vendedor is null or tipo_vendedor in (
      'ambulante', 'quitandeira', 'produtor', 'revendedor',
      'mini_mercado', 'supermercado', 'hipermercado',
      'grossista', 'prestador_servico'
    )
  );

-- Atualiza apenas o vocabulário de serviços já existentes. Não cria anúncios novos.
update public.servicos
set tipo_servico = 'Transporte de mercadorias'
where tipo_servico = 'Transporte';

update public.servicos
set tipo_servico = 'Entrega de mercadorias'
where tipo_servico = 'Entrega';

commit;
