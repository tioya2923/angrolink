-- Permite preços promocionais nos serviços e impede promoções inválidas.
alter table public.servicos
  add column if not exists preco_promocional numeric;

alter table public.servicos
  drop constraint if exists servicos_preco_promocional_valido;

alter table public.servicos
  add constraint servicos_preco_promocional_valido
  check (
    preco_promocional is null
    or (
      preco_promocional > 0
      and preco_estimado is not null
      and preco_promocional < preco_estimado
    )
  );
