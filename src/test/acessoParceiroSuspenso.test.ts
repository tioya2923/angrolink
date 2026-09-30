import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parceiroEstaRestrito,
  parceiroEstaSuspenso,
  parceiroPodeAcederAreaOperacional,
} from '@/lib/acessoParceiroEntrega';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const router = ler('src/paginas/dashboard/DashboardRouter.tsx');
const layout = ler('src/paginas/dashboard/DashboardLayout.tsx');
const contexto = ler('src/contextos/AuthContexto.tsx');
const contaRestrita = ler('src/paginas/dashboard/parceiro/ParceiroContaSuspensa.tsx');

describe('acesso frontend do parceiro de entrega suspenso', () => {
  it('mantém o parceiro aprovado com acesso operacional normal', () => {
    expect(parceiroEstaSuspenso('aprovado')).toBe(false);
    expect(parceiroPodeAcederAreaOperacional('aprovado')).toBe(true);
  });

  it('restringe toda a candidatura que não esteja aprovada', () => {
    expect(parceiroEstaSuspenso('suspenso')).toBe(true);
    for (const estado of ['rascunho', 'documentos_pendentes', 'em_analise', 'rejeitado', 'suspenso', 'documentacao_expirada'] as const) {
      expect(parceiroEstaRestrito(estado)).toBe(true);
      expect(parceiroPodeAcederAreaOperacional(estado)).toBe(false);
    }
  });

  it('redireciona URLs operacionais para a página segura', () => {
    for (const rota of ['path="tarefas"', 'path="tarefas/:id"', 'path="veiculo"', 'path="areas"']) {
      expect(router).toContain(rota);
    }
    expect(router).toContain('protegerRotaOperacionalParceiro');
    expect(router).toContain('sincronizandoPerfilParceiro');
    expect(router).toContain('<ParceiroContaSuspensa />');
    expect(router).toContain('path="documentos" element={<ParceiroResumo secao="documentos" />}');
  });

  it('remove ações operacionais do menu, preservando estado e logout no layout', () => {
    expect(layout).toContain('parceiroRestrito');
    expect(layout).toContain("? 'Rejeitada'");
    expect(layout).toContain("'/dashboard/documentos'");
    expect(layout).toContain("'/dashboard',");
    expect(layout).toContain('handleLogout');
  });

  it('mantém o motivo de suspensão disponível apenas na sessão do parceiro', () => {
    expect(contexto).toContain('motivo_suspensao: parceiro.motivo_suspensao || null');
  });

  it('distingue pendências documentais e mantém uma ação segura para corrigir documentos', () => {
    expect(contaRestrita).toContain("'Documentos pendentes de correção'");
    expect(contaRestrita).toContain('to="/dashboard/documentos"');
    expect(contaRestrita).toContain('Ver documentos e corrigir pendências');
  });
});
