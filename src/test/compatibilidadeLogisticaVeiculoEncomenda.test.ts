import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260821153000_criar_compatibilidade_logistica_veiculo_encomenda.sql',
  ),
  'utf8',
);

describe('compatibilidade logística veículo × encomenda V1', () => {
  it('centraliza os três estados de avaliação e faz o booleano derivar da avaliação', () => {
    expect(migration).toContain("'compativel'::text");
    expect(migration).toContain("'incompativel'::text");
    expect(migration).toContain("'dados_incompletos'::text");
    expect(migration).toContain('public.avaliar_compatibilidade_veiculo_encomenda');
    expect(migration).toContain("select a.estado = 'compativel'");
  });

  it('rejeita modalidade, destino e requisitos desconhecidos sem os converter em zero', () => {
    for (const motivo of [
      'modalidade_nao_e_entrega',
      'destino_ausente',
      'peso_carga_desconhecido',
      'volume_carga_desconhecido',
      'requisitos_especiais_desconhecidos',
    ]) {
      expect(migration).toContain(`'${motivo}'`);
    }
  });

  it('dá precedência à incompatibilidade definitiva sobre dados em falta', () => {
    const indiceIncompativel = migration.indexOf("'capacidade_peso_insuficiente'");
    const indiceDadosIncompletos = migration.indexOf("'peso_carga_desconhecido'");
    expect(indiceIncompativel).toBeGreaterThan(-1);
    expect(indiceDadosIncompletos).toBeGreaterThan(-1);
    expect(migration).toContain("return query select 'incompativel'::text, v_motivos;");
  });

  it('usa as autoridades existentes para parceiro e veículo, sem duplicar elegibilidade', () => {
    expect(migration).toContain('public.entregador_pode_receber_entregas(v_veiculo.parceiro_id)');
    expect(migration).toContain('public.veiculo_operacional_para_entregas(v_veiculo.id)');
  });

  it('cobre peso, volume, requisitos especiais e área com motivos estruturados', () => {
    for (const motivo of [
      'capacidade_peso_veiculo_desconhecida',
      'capacidade_peso_insuficiente',
      'capacidade_volume_veiculo_desconhecida',
      'capacidade_volume_insuficiente',
      'refrigeracao_indisponivel',
      'caixa_carga_indisponivel',
      'paletes_nao_suportadas',
      'fora_area_cobertura',
    ]) {
      expect(migration).toContain(`'${motivo}'`);
    }
  });

  it('trata bairro vazio como cobertura municipal e não usa correspondência parcial', () => {
    expect(migration).toContain("nullif(btrim(a.bairro), '') is null");
    expect(migration).toContain('public.normalizar_texto_territorial(a.municipio)');
    expect(migration).not.toMatch(/\bilike\b|\blike\b|substring|unaccent/i);
  });

  it('mantém as funções internas, seguras e sem ranking', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = public');
    expect(migration).toContain('revoke all on function public.listar_veiculos_compativeis_encomenda(uuid) from public, anon, authenticated;');
    expect(migration).toContain('order by v.parceiro_id, v.id');
    expect(migration).not.toContain('rank()');
    expect(migration).not.toContain('row_number()');
  });
});
