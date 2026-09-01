import fs from 'node:fs';
import { resolve } from 'node:path';
const ler = (f: string) => fs.readFileSync(resolve(process.cwd(), f), 'utf8');
describe('Tarefas do entregador V1', () => {
  const migration = ler('supabase/migrations/20260822190000_criar_tarefas_entregador_v1.sql');
  const servico = ler('src/services/tarefasEntregador.ts');
  const router = ler('src/paginas/dashboard/DashboardRouter.tsx');
  const lista = ler('src/paginas/dashboard/parceiro/ParceiroTarefas.tsx');
  const detalhe = ler('src/paginas/dashboard/parceiro/ParceiroTarefaDetalhe.tsx');
  it('mantém ações de entrega exclusivamente no servidor e por parceiro dono', () => { expect(migration).toContain('p.user_id=auth.uid()'); expect(migration).toContain("estado='atribuida'"); expect(migration).toContain('for update'); expect(migration).toContain('entregador_pode_receber_entregas'); });
  it('regista a decisão do entregador sem alterar estados de entrega', () => { expect(migration).toContain('entregador_aceitou'); expect(migration).toContain('entregador_recusou'); expect(migration).not.toContain("'em_transito'"); });
  it('expõe serviço tipado, rota, lista e detalhe', () => { for (const x of ['listarTarefasEntregador', 'obterTarefaEntregador', 'aceitarTarefaEntrega', 'recusarTarefaEntrega']) expect(servico).toContain(x); expect(router).toContain('path="tarefas"'); expect(router).toContain('path="tarefas/:id"'); expect(lista).toContain('Ver tarefa'); });
  it('oferece aceite, recusa com motivo e refetch', () => { for (const x of ['Aceitar tarefa', 'Recusar tarefa', 'motivo.trim().length < 3', 'await carregar()', 'Dialog']) expect(detalhe).toContain(x); });
  it('reconhece os estados terminais no serviço e na lista', () => {
    expect(servico).toContain("'cancelada'");
    expect(servico).toContain("'concluida'");
    expect(lista).toContain('cancelada:');
    expect(lista).toContain('concluida:');
  });
});
