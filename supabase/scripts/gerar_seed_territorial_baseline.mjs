import { readFileSync, writeFileSync } from 'node:fs';

const source = readFileSync('supabase/migrations/20260820120000_criar_taxonomia_territorial_angola.sql', 'utf8');
const targetPath = 'supabase/baseline/current/05_reference_data.sql';
const target = readFileSync(targetPath, 'utf8');
const provincias = source.match(/with dados\(codigo_oficial, numero_oficial, nome, ordem\) as \([\s\S]*?on conflict \(codigo_oficial\) do nothing;/)?.[0];
const municipios = source.match(/with dados\(codigo_provincia, numero_municipio, nome\) as \([\s\S]*?on conflict \(codigo_oficial\) do nothing;/)?.[0];
const gate = target.indexOf('-- BLOQUEIO DELIBERADO:');

if (!provincias || !municipios || gate < 0) throw new Error('Fonte territorial ou gate não localizado.');

const seedProvincias = provincias.replace(
  'on conflict (codigo_oficial) do nothing;',
  'on conflict (codigo_oficial) do update set numero_oficial=excluded.numero_oficial, nome=excluded.nome, ordem=excluded.ordem, ativo=true;',
);
const seedMunicipios = municipios.replace(
  'on conflict (codigo_oficial) do nothing;',
  'on conflict (codigo_oficial) do update set provincia_id=excluded.provincia_id, numero_oficial=excluded.numero_oficial, nome=excluded.nome, ativo=true;',
);
const assertions = `-- Taxonomia territorial canónica; UUIDs são próprios do staging e a FK é resolvida pela chave natural.\n\n${seedProvincias}\n\n${seedMunicipios}\n\ndo $$\ndeclare total_provincias integer; total_municipios integer;\nbegin\n  select count(*) into total_provincias from public.provincias_angola;\n  select count(*) into total_municipios from public.municipios_angola;\n  if total_provincias <> 21 or total_municipios <> 326 then\n    raise exception 'Seed territorial inválido: esperadas 21 províncias e 326 municípios; obtidos % e %', total_provincias, total_municipios;\n  end if;\n  if exists (select 1 from public.municipios_angola where provincia_id is null or btrim(codigo_oficial) = '' or btrim(nome) = '')\n     or exists (select codigo_oficial from public.municipios_angola group by codigo_oficial having count(*) <> 1)\n     or exists (select p.codigo_oficial from public.provincias_angola p left join public.municipios_angola m on m.provincia_id=p.id group by p.codigo_oficial having count(m.id)=0)\n     or not exists (select 1 from public.municipios_angola m join public.provincias_angola p on p.id=m.provincia_id where p.nome='Luanda' and m.nome='Ingombota') then\n    raise exception 'Seed territorial contém referências, chaves ou Ingombota inválidos.';\n  end if;\nend;\n$$;\n`;

writeFileSync(targetPath, target.slice(0, gate) + assertions, 'utf8');
console.log(JSON.stringify({ provincias: (seedProvincias.match(/^  \('/gm) ?? []).length, municipios: (seedMunicipios.match(/^  \('/gm) ?? []).length }));
