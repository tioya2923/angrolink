import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const servico = ler('src/services/adminEntregador360.ts');
const pagina = ler('src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx');

describe('elegibilidade logística do Entregador 360', () => {
  it('consome a projeção calculada no servidor, sem recalcular a regra no React', () => {
    for (const trecho of [
      'elegibilidade_logistica',
      'podeReceberEntregas',
      'motivos',
      'Apto para receber entregas',
      'Validação calculada no servidor',
    ]) expect(`${servico}\n${pagina}`).toContain(trecho);

    expect(pagina).not.toContain(".from('veiculos_entrega')");
    expect(pagina).not.toContain(".from('documentos_parceiro_entrega')");
  });
});
