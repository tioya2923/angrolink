-- O parceiro pode atualizar apenas atributos declarativos do seu próprio
-- veículo. A política RLS existente continua a validar a titularidade; os
-- privilégios por coluna impedem que o browser altere dados administrativos
-- ou de identificação através da API.
begin;

revoke update on table public.veiculos_entrega from public, anon, authenticated;

grant update (
  capacidade_kg,
  capacidade_volume_m3,
  possui_refrigeracao,
  possui_caixa_carga,
  aceita_paletes
) on table public.veiculos_entrega to authenticated;

commit;
