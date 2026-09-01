-- Teste pós-migration. Não simula auth.uid(): a titularidade continua a ser
-- imposta pela policy RLS veiculos_entrega_dono_ou_admin em sessões reais.
begin;

do $$
declare
  v_coluna text;
begin
  foreach v_coluna in array array[
    'capacidade_kg',
    'capacidade_volume_m3',
    'possui_refrigeracao',
    'possui_caixa_carga',
    'aceita_paletes'
  ] loop
    if not has_column_privilege(
      'authenticated',
      'public.veiculos_entrega',
      v_coluna,
      'update'
    ) then
      raise exception 'Campo operacional sem privilégio de atualização: %', v_coluna;
    end if;
  end loop;

  foreach v_coluna in array array[
    'parceiro_id',
    'matricula',
    'estado_verificacao',
    'motivo_rejeicao',
    'foto_veiculo_path'
  ] loop
    if has_column_privilege(
      'authenticated',
      'public.veiculos_entrega',
      v_coluna,
      'update'
    ) then
      raise exception 'Campo não operacional com atualização direta: %', v_coluna;
    end if;
  end loop;
end;
$$;

rollback;
