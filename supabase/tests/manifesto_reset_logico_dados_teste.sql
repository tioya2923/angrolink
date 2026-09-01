-- MANIFESTO LOCAL READ-ONLY — NÃO ALTERA DADOS
-- Fonte: restore point lógico de 2026-08-30 pré-identidade/Storage.
-- Revalidar contra o remoto antes de qualquer operação administrativa futura.
-- Não contém emails, telefones, nomes ou caminhos de Storage.

with
administradores_preservados(user_id) as (
  values
    ('fe74f586-c98e-452b-bba9-0da5ca5bd0f3'::uuid)
),
auth_nao_admin_candidatos(user_id) as (
  values
    ('d2aa1fe3-0230-4220-bccd-2c5125aba7ac'::uuid),
    ('e40283fa-888e-4f90-9c91-d9ebb5f473c0'::uuid),
    ('547c4609-066c-4290-baf2-5851dcfac0a8'::uuid),
    ('8cadaa6c-9ea1-4c82-8a8c-c90395ee9de3'::uuid),
    ('46938001-1520-47dd-a847-3adc5382fb44'::uuid),
    ('9daacedf-0b90-4a75-b1a1-6725e49160e2'::uuid),
    ('4a733dbd-0c17-4390-ba01-8802e8b957fd'::uuid),
    ('38e87357-a983-4809-a817-f0b8a1880f5b'::uuid),
    ('e59c0a93-e0f6-4fb3-bb6b-4ac888e235bd'::uuid),
    ('a991d06d-5028-4243-828f-67c6a433962f'::uuid),
    ('1bb08a3d-5794-4c11-98d4-ffdd0ab48b64'::uuid),
    ('fcba4132-8327-4f8f-8187-365b527532c7'::uuid),
    ('b9b93cbc-111f-4dfb-ae2e-52310669fe94'::uuid),
    ('499d601c-04cb-42ef-8b5a-fe70b9fb20d0'::uuid),
    ('ecf81189-788c-40db-90ca-025298d01a9a'::uuid),
    ('0cb7779f-fb6f-4d89-a58e-25a6deb54e9b'::uuid),
    ('4b72b4bf-2fc3-4c3d-8225-e74f14b485ae'::uuid),
    ('cbcdd28a-85b9-481c-a7e6-5c44b6ddaa75'::uuid),
    ('ac450728-db68-4fbb-b208-2dcb8391ab67'::uuid),
    ('678a9a74-ff8f-467a-8d73-d236194ddf46'::uuid),
    ('e9311d7f-dac8-48ab-84c4-066498ef94b6'::uuid),
    ('070d2035-4635-4272-9899-e325f28b0505'::uuid),
    ('41b4ef9e-5668-4fcd-9921-46876ef8b18d'::uuid),
    ('77335ac8-317f-401e-a740-647bc64d04db'::uuid),
    ('32d1ccc0-df00-41f1-9047-0a252dea2bb8'::uuid),
    ('c66d5357-eeb5-442c-a5d7-7164d3cb82de'::uuid),
    ('1146e43b-5525-45df-951f-df5036a3c578'::uuid)
),
clientes_candidatos(id) as (
  values
    ('fcba4132-8327-4f8f-8187-365b527532c7'::uuid),
    ('547c4609-066c-4290-baf2-5851dcfac0a8'::uuid),
    ('d2aa1fe3-0230-4220-bccd-2c5125aba7ac'::uuid),
    ('46938001-1520-47dd-a847-3adc5382fb44'::uuid),
    ('4a733dbd-0c17-4390-ba01-8802e8b957fd'::uuid),
    ('0cb7779f-fb6f-4d89-a58e-25a6deb54e9b'::uuid),
    ('4b72b4bf-2fc3-4c3d-8225-e74f14b485ae'::uuid)
),
vendedores_candidatos(id) as (
  values
    ('7d72f480-b993-449e-bf42-fe180cc89f0f'::uuid), ('12704efb-0300-480b-a3de-52bc14f2f19e'::uuid),
    ('c976b170-2ee3-4834-adda-f7bacf87bb7c'::uuid), ('4200a217-a84d-4efe-8fb3-30be373791ce'::uuid),
    ('108bd8d5-daf0-4d74-b157-7619f7f69638'::uuid), ('4a0bf7bf-4472-4278-85c1-b5b2fbe44321'::uuid),
    ('bba940c6-aa77-4e17-9fec-88ad54be7f5d'::uuid), ('3ac32ea4-66ca-455a-a7f6-efedfb19b171'::uuid),
    ('05e960a3-054f-4b4e-bd77-309f376648bb'::uuid), ('11e0bee2-50e6-4707-8b58-f41aa22ada4a'::uuid),
    ('f694c306-4825-4b78-8572-4dee2b3a0d61'::uuid), ('be260fa6-5bf5-4c11-892a-85c44dd0796f'::uuid),
    ('e72f3125-cf95-4f4f-b3f2-aa4f43de275f'::uuid), ('beeaec46-264e-4ad2-8dec-8bca3dbc4400'::uuid),
    ('ab9254dc-a06a-455a-9ff4-44dfaee824d8'::uuid), ('c835c9e8-3b89-4db4-85a2-be352b74c6d4'::uuid),
    ('50c2ac9b-e23a-4f25-81eb-57aaf0c87ac6'::uuid), ('d4cd8eb4-90c9-4eaa-ac4f-1196997e3dd7'::uuid),
    ('585ab67e-5732-43cd-958c-20de925f7dc8'::uuid), ('59aa4c8c-ad4c-4c29-90a3-30b73e74d681'::uuid),
    ('15d45208-4008-490c-b5d7-4b2143bca6fa'::uuid), ('4067a770-3161-4013-9e6f-5797713c2327'::uuid),
    ('18cb5d0b-500f-4ca9-a828-fa30bf86a7c6'::uuid), ('25cd6816-d6e9-40ef-8939-4be078d02414'::uuid)
),
vendedores_legados_sem_user_id(id) as (
  values
    ('7d72f480-b993-449e-bf42-fe180cc89f0f'::uuid), ('12704efb-0300-480b-a3de-52bc14f2f19e'::uuid),
    ('c976b170-2ee3-4834-adda-f7bacf87bb7c'::uuid), ('4200a217-a84d-4efe-8fb3-30be373791ce'::uuid),
    ('4a0bf7bf-4472-4278-85c1-b5b2fbe44321'::uuid), ('e72f3125-cf95-4f4f-b3f2-aa4f43de275f'::uuid),
    ('ab9254dc-a06a-455a-9ff4-44dfaee824d8'::uuid), ('c835c9e8-3b89-4db4-85a2-be352b74c6d4'::uuid),
    ('585ab67e-5732-43cd-958c-20de925f7dc8'::uuid), ('59aa4c8c-ad4c-4c29-90a3-30b73e74d681'::uuid),
    ('15d45208-4008-490c-b5d7-4b2143bca6fa'::uuid), ('4067a770-3161-4013-9e6f-5797713c2327'::uuid),
    ('18cb5d0b-500f-4ca9-a828-fa30bf86a7c6'::uuid)
),
parceiros_candidatos(id) as (
  values
    ('899b43ac-aed0-4ad9-a54f-ca536d915beb'::uuid), ('349d74d4-e506-4d7a-8c08-2dc5bede6d52'::uuid),
    ('03c0e358-0042-4209-9595-9a71db66980b'::uuid), ('9eff31d5-6aef-4e1e-90c4-77dc589747ad'::uuid),
    ('6faec026-6286-4e41-89da-12152dcaa6ba'::uuid)
),
profiles_incerto(id) as (
  values
    ('e59c0a93-e0f6-4fb3-bb6b-4ac888e235bd'::uuid), ('ecf81189-788c-40db-90ca-025298d01a9a'::uuid),
    ('cbcdd28a-85b9-481c-a7e6-5c44b6ddaa75'::uuid), ('ac450728-db68-4fbb-b208-2dcb8391ab67'::uuid)
),
resumo as (
  select 'administradores_preservados'::text as grupo, count(*)::bigint as total from administradores_preservados
  union all select 'auth_nao_admin_candidatos', count(*) from auth_nao_admin_candidatos
  union all select 'clientes_candidatos', count(*) from clientes_candidatos
  union all select 'vendedores_candidatos', count(*) from vendedores_candidatos
  union all select 'vendedores_legados_sem_user_id', count(*) from vendedores_legados_sem_user_id
  union all select 'parceiros_candidatos', count(*) from parceiros_candidatos
  union all select 'profiles_incerto_sem_acao_automatica', count(*) from profiles_incerto
  union all select 'produtos_de_vendedores_candidatos', count(*) from public.produtos p join vendedores_candidatos v on v.id = p.vendedor_id
  union all select 'servicos_de_vendedores_candidatos', count(*) from public.servicos s join vendedores_candidatos v on v.id = s.vendedor_id
)
select grupo, total
from resumo
order by grupo;
