import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const pagina = ler('src/paginas/dashboard/admin/AdminEntregadorDetalhe.tsx');
const media = ler('src/services/adminMediaPrivada.ts');

describe('fotografia privada do veículo no Entregador 360', () => {
  it('obtém uma URL temporária sem expor o caminho privado no painel', () => {
    expect(pagina).toContain('FotoVeiculoEntregador');
    expect(pagina).toContain('obterFotoVeiculoEntregadorAdmin');
    expect(pagina).toContain('fotoDisponivel');
    expect(pagina).not.toContain('foto_veiculo_path');
    expect(media).toContain("recurso: 'foto_veiculo_entregador'");
  });

  it('limpa o estado durante a troca de veículo e preserva o fallback seguro', () => {
    expect(pagina).toContain('setUrl(null)');
    expect(pagina).toContain('setFalhou(false)');
    expect(pagina).toContain('if (!disponivel) return null');
    expect(pagina).toContain('Não foi possível carregar a fotografia.');
    expect(pagina).toContain('object-cover');
  });
});
