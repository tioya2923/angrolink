import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  normalizarEmailContacto,
  tipoVendedorExigeEmailContacto,
  validarEmailContactoVendedor,
} from '@/lib/emailContactoVendedor';

const cadastro = readFileSync(resolve(process.cwd(), 'src/paginas/PaginaAnunciar.tsx'), 'utf8');
const perfil = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard/vendedor/VendedorPerfil.tsx'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20261020010000_exigir_email_contacto_vendedor_por_tipo.sql'),
  'utf8',
);

describe('política de email de contacto por tipo de vendedor', () => {
  it.each(['supermercado', 'hipermercado', 'grossista'])(
    '%s exige email de contacto',
    (tipo) => expect(tipoVendedorExigeEmailContacto(tipo)).toBe(true),
  );

  it.each(['ambulante', 'quitandeira', 'produtor', 'mini_mercado', 'revendedor', 'prestador_servico'])(
    '%s mantém email opcional',
    (tipo) => expect(tipoVendedorExigeEmailContacto(tipo)).toBe(false),
  );

  it('normaliza email de contacto e rejeita valores inválidos ou internos', () => {
    expect(normalizarEmailContacto('  CONTACTO@EXEMPLO.AO ')).toBe('contacto@exemplo.ao');
    expect(validarEmailContactoVendedor('supermercado', '')).toMatch(/email de contacto/i);
    expect(validarEmailContactoVendedor('ambulante', '')).toBeNull();
    expect(validarEmailContactoVendedor('produtor', 'invalido')).toMatch(/válido/i);
    expect(validarEmailContactoVendedor('grossista', '244900000000@TELEFONE.ANGROLINK')).toMatch(/interno/i);
    expect(validarEmailContactoVendedor('hipermercado', ' contacto@empresa.ao ')).toBeNull();
  });

  it('reutiliza a regra no cadastro e mantém a correção do perfil histórico possível', () => {
    expect(cadastro).toContain('validarEmailContactoVendedor(');
    expect(cadastro).toContain('emailContactoObrigatorio &&');
    expect(cadastro).toContain('Email de contacto *');
    expect(perfil).toContain('const emailFoiAlterado = emailNormalizado !== emailOriginal;');
    expect(perfil).toContain('...(emailFoiAlterado ? { email: emailNormalizado } : {}),');
  });

  it('mantém a autoridade server-side sem alterar Auth ou email_login', () => {
    expect(migration).toContain('create or replace function public.validar_email_contacto_vendedor_por_tipo()');
    expect(migration).toMatch(/validar_email_contacto_vendedor_por_tipo\(\)[\s\S]*security definer/);
    expect(migration).toContain('before insert or update of email, tipo_vendedor on public.vendedores');
    expect(migration).toContain('before insert or update of estado, frente_path, verso_path on public.documentos_vendedor');
    expect(migration).toContain("p_estado = 'aprovado'");
    expect(migration).toContain("'supermercado', 'hipermercado', 'grossista'");
    expect(migration).not.toContain('email_login =');
    expect(migration).not.toContain('auth.users');
  });
});
