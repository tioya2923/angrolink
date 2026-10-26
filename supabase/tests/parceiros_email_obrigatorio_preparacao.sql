\set ON_ERROR_STOP on
\if :{?prova_db}
\else
  \echo 'ERRO: indique -v prova_db=nome_da_copia_local'
  \quit 3
\endif
select current_database() = :'prova_db'
  and current_database() like 'angrolink_parceiros_email_%' as destino_correto \gset
\if :destino_correto
\else
  \echo 'ERRO: destino nao autorizado para fixtures'
  \quit 3
\endif
-- Somente na cópia vazia, antes da primeira aplicação da candidata.
begin;
do $$ begin
  if exists(select 1 from auth.users) or exists(select 1 from public.parceiros_entrega)
     or to_regnamespace('parceiros_email_privado') is not null then
    raise exception 'A preparação exige uma cópia vazia anterior à política.';
  end if;
end $$;
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('72610000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','parceiro-prova-'||n||'@example.test','{}','{}',now()-interval '5 years',now()
from generate_series(1,8) n;
insert into public.parceiros_entrega(user_id,nome_completo,telefone,provincia,municipio,contacto_emergencia,email)
values ('72610000-0000-4000-8000-000000000001','Histórico sem email','+244923726101','Huambo','Huambo','+244923726199',null),
('72610000-0000-4000-8000-000000000002','Histórico fictício','+244923726102','Huambo','Huambo','+244923726199','email histórico inválido');
commit;
