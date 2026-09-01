import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  booleanParaRespostaEquipamento,
  normalizarDadosOperacionaisVeiculo,
  respostaEquipamentoParaBoolean,
} from '@/dominio/dadosOperacionaisVeiculo';

const cadastro = readFileSync(
  resolve(process.cwd(), 'src/paginas/PaginaCadastroParceiroEntrega.tsx'),
  'utf8',
);
const resumo = readFileSync(
  resolve(process.cwd(), 'src/paginas/dashboard/parceiro/ParceiroResumo.tsx'),
  'utf8',
);
const api = readFileSync(resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
const rls = readFileSync(
  resolve(process.cwd(), 'supabase/20260803_parceiros_entrega_fundacao.sql'),
  'utf8',
);
const matching = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260821153000_criar_compatibilidade_logistica_veiculo_encomenda.sql',
  ),
  'utf8',
);
const migracaoPermissoes = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260824110000_restringir_edicao_operacional_veiculo.sql',
  ),
  'utf8',
);

const entradaValida = {
  capacidadeKg: '125.5',
  volume: '1.8',
  refrigeracao: 'sim' as const,
  caixa: 'nao' as const,
  paletes: 'sim' as const,
};

describe('dados operacionais do veículo V1', () => {
  it('exige respostas explícitas, sem transformar ausência em false', () => {
    expect(respostaEquipamentoParaBoolean('')).toBeNull();
    expect(normalizarDadosOperacionaisVeiculo({ ...entradaValida, refrigeracao: '' }))
      .toEqual(expect.objectContaining({ valido: false }));
    expect(cadastro).toContain('caixa: "" as RespostaEquipamentoVeiculo');
    expect(cadastro).toContain('paletes: "" as RespostaEquipamentoVeiculo');
    expect(cadastro).toContain('refrigeracao: "" as RespostaEquipamentoVeiculo');
  });

  it('mapeia Sim e Não de forma declarada', () => {
    expect(respostaEquipamentoParaBoolean('sim')).toBe(true);
    expect(respostaEquipamentoParaBoolean('nao')).toBe(false);
    expect(booleanParaRespostaEquipamento(true)).toBe('sim');
    expect(booleanParaRespostaEquipamento(false)).toBe('nao');
  });

  it('normaliza o payload de cadastro com capacidade, volume e equipamentos', () => {
    const resultado = normalizarDadosOperacionaisVeiculo(entradaValida);
    expect(resultado).toEqual({
      valido: true,
      dados: {
        capacidade_kg: 125.5,
        capacidade_volume_m3: 1.8,
        possui_refrigeracao: true,
        possui_caixa_carga: false,
        aceita_paletes: true,
      },
    });
  });

  it('preserva volume desconhecido como null e rejeita capacidade ou volume inválidos', () => {
    expect(normalizarDadosOperacionaisVeiculo({ ...entradaValida, volume: '' }))
      .toEqual(expect.objectContaining({ valido: true, dados: expect.objectContaining({ capacidade_volume_m3: null }) }));
    expect(normalizarDadosOperacionaisVeiculo({ ...entradaValida, capacidadeKg: '0' }))
      .toEqual(expect.objectContaining({ valido: false }));
    expect(normalizarDadosOperacionaisVeiculo({ ...entradaValida, volume: '-1' }))
      .toEqual(expect.objectContaining({ valido: false }));
    expect(normalizarDadosOperacionaisVeiculo({ ...entradaValida, volume: 'texto' }))
      .toEqual(expect.objectContaining({ valido: false }));
    expect(normalizarDadosOperacionaisVeiculo({ ...entradaValida, capacidadeKg: 'NaN' }))
      .toEqual(expect.objectContaining({ valido: false }));
  });

  it('aceita vírgula decimal sem enviar string ao serviço', () => {
    expect(normalizarDadosOperacionaisVeiculo({
      ...entradaValida,
      capacidadeKg: '50',
      volume: '0,5',
    })).toEqual({
      valido: true,
      dados: expect.objectContaining({
        capacidade_kg: 50,
        capacidade_volume_m3: 0.5,
      }),
    });
  });

  it('mostra perguntas de equipamento no cadastro e envia apenas o payload normalizado', () => {
    expect(cadastro).toContain('Capacidade e equipamento do veículo');
    expect(cadastro).toContain('O veículo possui refrigeração?');
    expect(cadastro).toContain('O veículo possui caixa de carga?');
    expect(cadastro).toContain('O veículo consegue transportar carga em paletes?');
    expect(cadastro).toContain('...dadosOperacionais.dados');
  });

  it('carrega true, false e volume null na edição sem inventar valores', () => {
    expect(resumo).toContain('booleanParaRespostaEquipamento(veiculo.possui_refrigeracao)');
    expect(resumo).toContain('booleanParaRespostaEquipamento(veiculo.possui_caixa_carga)');
    expect(resumo).toContain('booleanParaRespostaEquipamento(veiculo.aceita_paletes)');
    expect(resumo).toContain('veiculo.capacidade_volume_m3 === null');
    expect(resumo).toContain('Confirme se estas informações continuam corretas');
  });

  it('restringe a edição aos cinco atributos declarativos', () => {
    expect(api).toContain('export interface DadosOperacionaisVeiculoAtualizaveis');
    expect(api).toContain('const dadosPermitidos: VeiculoEntregaUpdate');
    for (const campo of [
      'capacidade_kg',
      'capacidade_volume_m3',
      'possui_refrigeracao',
      'possui_caixa_carga',
      'aceita_paletes',
    ]) expect(api).toContain(`${campo}: dados.${campo}`);
    expect(resumo).toContain('atualizarVeiculoEntrega(veiculo.id, dados)');
    expect(api).not.toContain('estado_verificacao: dados.estado_verificacao');
    expect(api).not.toContain('motivo_rejeicao: dados.motivo_rejeicao');
  });

  it('confirma a escrita por nova leitura antes de o painel usar os dados', () => {
    expect(api).toContain(".update(dadosPermitidos)");
    expect(api).toContain("const { data, error: erroLeitura }");
    expect(api).toContain(".eq('id', atualizado.id)");
    expect(resumo).toContain('item.id === atualizado.id ? { ...item, ...atualizado } : item');
    expect(resumo).toContain('veiculo.capacidade_volume_m3 !== null');
  });

  it('não fecha o formulário nem mostra sucesso quando o backend falha', () => {
    expect(resumo).toContain('await atualizar(resultado.dados);');
    expect(resumo).toContain('setAEditar(false);');
    expect(resumo).toContain('O estado do formulário é preservado para nova tentativa.');
    expect(resumo).toContain('disabled={aGuardar}');
  });

  it('liga a ação de guardar da secção Veículo ao callback de persistência', () => {
    const secaoVeiculo = resumo.slice(
      resumo.indexOf('{secao === "veiculo"'),
      resumo.indexOf('{secao === "areas"'),
    );
    expect(secaoVeiculo).toContain(
      'atualizarDadosOperacionaisVeiculo={atualizarDadosOperacionaisVeiculo}',
    );
  });

  it('mantém a titularidade no servidor e não retira aprovação ao editar atributos declarativos', () => {
    expect(rls).toContain('create policy veiculos_entrega_dono_ou_admin');
    expect(rls).toContain('p.id = parceiro_id and p.user_id = auth.uid()');
    expect(rls).toContain('new.estado_verificacao is distinct from old.estado_verificacao');
    expect(matching).toContain('v_veiculo.possui_refrigeracao');
    expect(matching).toContain('v_veiculo.possui_caixa_carga');
    expect(matching).toContain('v_veiculo.aceita_paletes');
  });

  it('restringe no PostgreSQL a edição direta às cinco colunas operacionais', () => {
    expect(migracaoPermissoes).toContain('revoke update on table public.veiculos_entrega from public, anon, authenticated');
    for (const campo of [
      'capacidade_kg',
      'capacidade_volume_m3',
      'possui_refrigeracao',
      'possui_caixa_carga',
      'aceita_paletes',
    ]) expect(migracaoPermissoes).toContain(campo);
    expect(migracaoPermissoes).not.toContain('estado_verificacao');
    expect(migracaoPermissoes).not.toContain('parceiro_id');
    expect(migracaoPermissoes).not.toContain('matricula');
  });
});
