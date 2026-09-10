import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const inicial = ler('src/paginas/PaginaInicial.tsx');
const listaComprador = ler('src/paginas/dashboard/cliente/ClienteEncomendas.tsx');
const detalheComprador = ler('src/paginas/dashboard/cliente/ClienteEncomendaDetalhe.tsx');
const listaAdmin = ler('src/paginas/dashboard/admin/AdminEncomendas.tsx');

describe('piloto Huambo — recuperação operacional mínima', () => {
  it('mantém a entrada pública exclusivamente em produtos durante a Fase 1', () => {
    expect(inicial).not.toContain('useServicosQuery');
    expect(inicial).not.toContain('servicosDestaque');
    expect(inicial).not.toContain('tipo: "servico"');
    expect(inicial).toContain('produtosQuery.refetch()');
  });

  it('oferece retry seguro nas leituras críticas do comprador', () => {
    expect(listaComprador).toContain('onClick={() => void carregar()}');
    expect(detalheComprador).toContain('erroCarregamento');
    expect(detalheComprador).toContain('if (!id) { setErroCarregamento(true); setLoading(false); return; }');
  });

  it('permite ao Admin filtrar encomendas em todos os marcos operacionais da entrega', () => {
    for (const estado of ['atribuida', 'aceite', 'chegou_origem', 'recolhida', 'chegou_destino', 'recusada', 'cancelada']) {
      expect(listaAdmin).toContain(`value="${estado}"`);
    }
    expect(listaAdmin).toContain('onClick={() => void carregar()}');
  });
});
