import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gerarUuidV4 } from '@/lib/uuid';
import { obterChaveIdempotenciaCheckout, type IntencaoCheckoutGrupo } from '@/services/idempotenciaCheckout';
import { criarCaminhoDocumentoVendedor } from '@/services/documentosVendedor';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cryptoOriginal = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

const checkout: IntencaoCheckoutGrupo = {
  modalidade: 'levantamento',
  vendedorId: 'vendedor-a',
  itens: [{ produto_id: 'produto-a', quantidade: 1 }],
  nomeDestinatario: 'Ana',
  telefoneDestinatario: '900000000',
};

function definirCryptoSemRandomUuid() {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID: undefined,
      getRandomValues: (bytes: Uint8Array) => {
        bytes.forEach((_, indice) => { bytes[indice] = indice + 1; });
        return bytes;
      },
    },
  });
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
  if (cryptoOriginal) Object.defineProperty(globalThis, 'crypto', cryptoOriginal);
});

describe('UUID compatível no browser', () => {
  it('prioriza randomUUID quando o browser o disponibiliza', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001');
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID } });
    expect(gerarUuidV4()).toBe('00000000-0000-4000-8000-000000000001');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('mantém UUID v4 para documentos e checkout sem randomUUID, usando getRandomValues', () => {
    definirCryptoSemRandomUuid();
    const uuid = gerarUuidV4();
    const caminho = criarCaminhoDocumentoVendedor('utilizador', 'vendedor', 'bi', 'frente', 'jpg');
    const chaveCheckout = obterChaveIdempotenciaCheckout('utilizador', checkout);

    expect(uuid).toMatch(UUID_V4);
    expect(caminho).toMatch(/bi-frente-[0-9a-f-]+\.jpg$/i);
    expect(caminho.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i)?.[0]).toMatch(UUID_V4);
    expect(chaveCheckout).toMatch(UUID_V4);
  });

  it('impede acesso direto a randomUUID fora do helper em todo runtime browser', () => {
    const listarRuntime = (diretorio: string): string[] => readdirSync(diretorio, { withFileTypes: true })
      .flatMap(entrada => {
        const caminho = `${diretorio}/${entrada.name}`;
        if (entrada.isDirectory()) return entrada.name === 'test' ? [] : listarRuntime(caminho);
        return /\.(ts|tsx)$/.test(entrada.name) && !/\.test\.(ts|tsx)$/.test(entrada.name)
          ? [caminho]
          : [];
      });

    const superficies = listarRuntime(resolve(process.cwd(), 'src'))
      .filter(ficheiro => ficheiro.replace(/\\/g, '/').endsWith('/src/lib/uuid.ts') === false);

    for (const ficheiro of superficies) {
      const conteudo = readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
      expect(conteudo).not.toMatch(/(?:globalThis\.)?crypto\.randomUUID/);
    }
  });
});
