-- Executar apenas após aplicar a migration territorial, numa sessão sem dados reais de teste.
begin;

do $$
declare
  v_provincias integer;
  v_municipios integer;
  v_kilamba uuid;
  v_kilamba_kiaxi uuid;
  v_inativo uuid;
begin
  select count(*) into v_provincias from public.provincias_angola where ativo;
  select count(*) into v_municipios from public.municipios_angola where ativo;
  if v_provincias <> 21 or v_municipios <> 326 then
    raise exception 'Seed territorial não contém 21/326';
  end if;

  if (select count(*) from public.provincias_angola) <> (select count(distinct codigo_oficial) from public.provincias_angola)
     or (select count(*) from public.municipios_angola) <> (select count(distinct codigo_oficial) from public.municipios_angola) then
    raise exception 'Código oficial territorial duplicado';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.municipios_angola'::regclass and contype = 'f'
  ) then
    raise exception 'FK município → província ausente';
  end if;

  if not public.territorio_angola_valido('Cabinda', 'Cabinda')
     or not public.territorio_angola_valido('Benguela', 'Catumbela')
     or not public.territorio_angola_valido('Bengo', 'Úcua')
     or not public.territorio_angola_valido('Cunene', 'Cuanhama')
     or not public.territorio_angola_valido('Lunda Norte', 'Camaxilo')
     or not public.territorio_angola_valido('Luanda', 'Kilamba')
     or not public.territorio_angola_valido('Luanda', 'Kilamba Kiaxi') then
    raise exception 'Resolução de território canónico falhou';
  end if;

  select municipio_id into v_kilamba from public.resolver_territorio_angola('Luanda', 'Kilamba');
  select municipio_id into v_kilamba_kiaxi from public.resolver_territorio_angola('Luanda', 'Kilamba Kiaxi');
  if v_kilamba is null or v_kilamba_kiaxi is null or v_kilamba = v_kilamba_kiaxi then
    raise exception 'Kilamba e Kilamba Kiaxi não são distintos';
  end if;

  if public.territorio_angola_valido('Benguela', 'Catumbela') is not true
     or public.territorio_angola_valido('Luanda', 'Catumbela') is not false
     or public.territorio_angola_valido('Inexistente', 'Catumbela') is not false
     or public.territorio_angola_valido('Luanda', 'Inexistente') is not false then
    raise exception 'Validação territorial não respeita a província';
  end if;

  if not public.territorio_angola_valido('  luanda  ', '  kILAMBA kIAXI  ')
     or public.territorio_angola_valido('Luanda', 'Kilamba-Kiaxi') then
    raise exception 'Normalização territorial é insegura ou aplica fuzzy matching';
  end if;

  if public.territorio_angola_valido('Luanda', 'Luanda')
     or public.territorio_angola_valido('Bié', 'Calucing')
     or public.territorio_angola_valido('Lunda Norte', 'Cafunfu')
     or public.territorio_angola_valido('Lunda Norte', 'Cam axilo')
     or public.territorio_angola_valido('Cunene', 'iCuanhama')
     or public.territorio_angola_valido('Namibe', 'Tômbua')
     or not public.territorio_angola_valido('Bié', 'Calucinga')
     or not public.territorio_angola_valido('Lunda Norte', 'Cafunfo')
     or not public.territorio_angola_valido('Namibe', 'Tômbwa') then
    raise exception 'Divergências conhecidas não foram preservadas';
  end if;

  select m.id into v_inativo
  from public.municipios_angola m join public.provincias_angola p on p.id = m.provincia_id
  where p.nome = 'Luanda' and m.nome = 'Kilamba Kiaxi';
  update public.municipios_angola set ativo = false where id = v_inativo;
  if public.territorio_angola_valido('Luanda', 'Kilamba Kiaxi') then
    raise exception 'Município inativo continua válido';
  end if;
  update public.municipios_angola set ativo = true where id = v_inativo;
end;
$$;

do $$
declare
  v_luanda uuid;
begin
  select id into v_luanda from public.provincias_angola where codigo_oficial = 'LDA';
  if (select count(*) from public.listar_provincias_angola()) <> 21
     or (select count(*) from public.listar_municipios_angola(v_luanda)) <> 16 then
    raise exception 'RPCs públicas não devolvem a taxonomia ativa';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.provincias_angola'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.municipios_angola'::regclass) then
    raise exception 'RLS territorial não está ativo';
  end if;

  if has_table_privilege('anon', 'public.provincias_angola', 'insert, update, delete')
     or has_table_privilege('authenticated', 'public.municipios_angola', 'insert, update, delete')
     or has_table_privilege('anon', 'public.provincias_angola', 'select')
     or has_table_privilege('authenticated', 'public.municipios_angola', 'select') then
    raise exception 'Tabela territorial concede privilégio direto indevido';
  end if;

  if not has_function_privilege('anon', 'public.listar_provincias_angola()', 'execute')
     or not has_function_privilege('anon', 'public.listar_municipios_angola(uuid)', 'execute')
     or has_function_privilege('anon', 'public.normalizar_texto_territorial(text)', 'execute')
     or has_function_privilege('authenticated', 'public.territorio_angola_valido(text,text)', 'execute') then
    raise exception 'Privilégios de função territorial incorretos';
  end if;
end;
$$;

rollback;
