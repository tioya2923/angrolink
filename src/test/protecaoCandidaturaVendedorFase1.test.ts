import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ficheiroMigration =
  'supabase/migrations/20260910010000_proteger_candidatura_vendedor_huambo_documentos.sql';

const caminhoMigration = resolve(process.cwd(), ficheiroMigration);
const descreverMigration = existsSync(caminhoMigration) ? describe : describe.skip;

/**
 * Contrato preparado para a migration manual. Fica explicitamente skipped até
 * o ficheiro existir, evitando uma suite vermelha durante esta preparação.
 */
descreverMigration(
  'proteção server-side da candidatura de vendedor — Fase 1',
  () => {
    const migration = existsSync(caminhoMigration)
      ? readFileSync(caminhoMigration, 'utf8')
      : '';

    const semEspacos = migration.replace(/\s+/g, ' ');

    it('mantém uma matriz server-side igual aos requisitos documentais vigentes', () => {
      expect(semEspacos).toMatch(
        /when p_tipo_vendedor in \( ?'ambulante', 'quitandeira', 'produtor', 'mini_mercado', 'revendedor', 'prestador_servico' ?\) then array\['bi'\]::text\[\]/,
      );

      expect(semEspacos).toMatch(
        /when p_tipo_vendedor in \( ?'supermercado', 'grossista' ?\) then array\['bi', 'nif', 'alvara'\]::text\[\]/,
      );

      expect(semEspacos).toMatch(
        /when p_tipo_vendedor = 'hipermercado' then array\['bi', 'nif', 'alvara', 'registo_comercial'\]::text\[\]/,
      );

      expect(migration).not.toMatch(
        /^\s*obrigatorio_para_aprovacao\s*=/m,
      );
    });

    it('protege apenas novas candidaturas pelo resolvedor territorial canónico HBO', () => {
      expect(migration).toContain(
        'create or replace function public.validar_candidatura_vendedor_huambo()',
      );

      expect(migration).toContain(
        'public.resolver_territorio_angola(new.provincia, new.municipio)',
      );

      expect(migration).toContain(
        'select territorio.provincia_codigo',
      );

      expect(migration).toContain(
        "if v_provincia_codigo is distinct from 'HBO' then",
      );

      expect(migration).toContain(
        'before insert on public.vendedores',
      );

      expect(migration).not.toContain(
        'before insert or update on public.vendedores',
      );

      expect(migration).not.toMatch(
        /delete\s+from\s+public\.vendedores/i,
      );

      expect(migration).not.toMatch(
        /update\s+public\.vendedores[\s\S]*where[\s\S]*provincia/i,
      );
    });

    it('preserva a assinatura, autorização administrativa e erro de vendedor inexistente', () => {
      expect(semEspacos).toContain(
        'public.atualizar_estado_vendedor_admin( p_vendedor_id uuid, p_estado text, p_motivo_rejeicao text default null )',
      );

      expect(migration).toContain(
        'if not public.eh_admin() then',
      );

      expect(migration).toContain(
        "raise exception 'Vendedor não encontrado.';",
      );

      expect(migration).toContain(
        'security definer',
      );

      expect(migration).toContain(
        'set search_path = pg_catalog, public',
      );

      expect(semEspacos).toContain(
        'revoke all on function public.atualizar_estado_vendedor_admin(uuid, text, text) from public, anon;',
      );

      expect(semEspacos).toContain(
        'grant execute on function public.atualizar_estado_vendedor_admin(uuid, text, text) to authenticated;',
      );
    });

    it('só aprova vendedores HBO com cada documento obrigatório completo e aprovado', () => {
      expect(migration).toContain(
        "if v_provincia_codigo is distinct from 'HBO' then",
      );

      expect(migration).toContain(
        "if p_estado = 'aprovado' then",
      );

      expect(migration).toContain(
        'from unnest(v_documentos_obrigatorios) requisito(tipo_documento)',
      );

      expect(migration).toContain(
        'd.vendedor_id = p_vendedor_id',
      );

      expect(migration).toContain(
        'd.tipo_documento = requisito.tipo_documento',
      );

      expect(migration).toContain(
        "d.estado = 'aprovado'",
      );

      expect(migration).toContain(
        "nullif(btrim(d.frente_path), '') is not null",
      );

      expect(migration).toContain(
        "nullif(btrim(d.verso_path), '') is not null",
      );

      expect(migration).toContain(
        'documentos obrigatórios pendentes ou em falta',
      );

      for (const estadoInvalido of [
        'pendente',
        'em_analise',
        'rejeitado',
        'expirado',
      ]) {
        expect(migration).not.toContain(
          `d.estado = '${estadoInvalido}'`,
        );
      }
    });

    it('não abre escopo para checkout, catálogo, pagamento, matching, stock ou serviços', () => {
      for (const termo of [
        'produtos',
        'checkout',
        'encomendas',
        'otp',
        'pagamentos',
        'matching',
        'stock',
        'servicos',
      ]) {
        expect(migration.toLowerCase()).not.toContain(termo);
      }
    });
  },
);

describe(
  'estado de preparação da migration de proteção de candidatura',
  () => {
    const itPendente = existsSync(caminhoMigration) ? it.skip : it;

    itPendente(
      'mantém o ficheiro futuro explicitamente pendente até à criação manual autorizada',
      () => {
        expect(existsSync(caminhoMigration)).toBe(false);
      },
    );
  },
);