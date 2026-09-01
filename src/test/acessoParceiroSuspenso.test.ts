import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parceiroEstaSuspenso,
  parceiroPodeAcederAreaOperacional,
} from '@/lib/acessoParceiroEntrega';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const router = ler('src/paginas/dashboard/DashboardRouter.tsx');
const layout = ler('src/paginas/dashboard/DashboardLayout.tsx');
const contexto = ler('src/contextos/AuthContexto.tsx');

describe('acesso frontend do parceiro de entrega suspenso', () => {
  it('mantém o parceiro aprovado com acesso operacional normal', () => {
    expect(parceiroEstaSuspenso('aprovado')).toBe(false);
    expect(parceiroPodeAcederAreaOperacional('aprovado')).toBe(true);
  });

  it('restringe exclusivamente o parceiro suspenso', () => {
    expect(parceiroEstaSuspenso('suspenso')).toBe(true);
    expect(parceiroPodeAcederAreaOperacional('suspenso')).toBe(false);
    expect(parceiroPodeAcederAreaOperacional('em_analise')).toBe(true);
  });

  it('redireciona URLs operacionais para a página segura', () => {
    for (const rota of ['path="tarefas"', 'path="tarefas/:id"', 'path="veiculo"', 'path="areas"']) {
      expect(router).toContain(rota);
    }
    expect(router).toContain('protegerRotaOperacionalParceiro');
    expect(router).toContain('<ParceiroContaSuspensa />');
  });

  it('remove ações operacionais do menu, preservando estado e logout no layout', () => {
    expect(layout).toContain('parceiroSuspenso');
    expect(layout).toContain("item.caminho === '/dashboard'");
    expect(layout).toContain('handleLogout');
  });

  it('mantém o motivo de suspensão disponível apenas na sessão do parceiro', () => {
    expect(contexto).toContain('motivo_suspensao: parceiro.motivo_suspensao || null');
  });
});
