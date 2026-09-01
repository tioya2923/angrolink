import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const manifesto = ler('supabase/tests/manifesto_reset_logico_dados_teste.sql');
const elegibilidadeVendedor = ler('supabase/migrations/20260813142502_reforcar_elegibilidade_transacional_vendedor.sql');
const elegibilidadeParceiro = ler('supabase/migrations/20260814210000_criar_elegibilidade_logistica_entregadores.sql');
const api = ler('src/services/api.ts');

describe('preparação do reset lógico de dados de teste', () => {
  it('mantém um manifesto local explicitamente read-only e preserva o administrador por autoridade', () => {
    expect(manifesto).toContain('MANIFESTO LOCAL READ-ONLY');
    expect(manifesto).toContain('administradores_preservados');
    expect(manifesto).toContain('profiles_incerto_sem_acao_automatica');
    expect(manifesto).not.toMatch(/\b(update|delete|insert|truncate|drop|alter)\b/i);
  });

  it('confirma que vendedor suspenso ou com conta inativa não recebe novas encomendas', () => {
    expect(elegibilidadeVendedor).toContain("v.status_aprovacao = 'aprovado'");
    expect(elegibilidadeVendedor).toContain('coalesce(v.conta_ativa, false) = true');
  });

  it('confirma que parceiro suspenso não permanece elegível para entregas', () => {
    expect(elegibilidadeParceiro).toContain("v_parceiro.estado <> 'aprovado'");
    expect(elegibilidadeParceiro).toContain('v_parceiro.disponibilidade');
  });

  it('mantém produtos e serviços não publicados ou indisponíveis fora do catálogo público', () => {
    expect(api).toContain('.eq("disponivel", true)');
    expect(api).toContain('.eq("publicado", true)');
  });
});
