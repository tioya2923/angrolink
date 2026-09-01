import { describe, expect, it, vi } from 'vitest';
import { abrirDocumentoPrivado } from '@/lib/abrirDocumentoPrivado';

describe('abertura privada de documentos', () => {
  it('abre a signed URL diretamente numa única aba protegida', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    const resultado = await abrirDocumentoPrivado(async () => 'https://assinada.test/frente');
    expect(resultado).toBe('aberta');
    expect(abrir).toHaveBeenCalledWith('https://assinada.test/frente', '_blank', 'noopener,noreferrer');
    expect(abrir).toHaveBeenCalledOnce();
    abrir.mockRestore();
  });
  it('funciona igualmente para verso e não persiste a URL', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    const obterVerso = vi.fn(async () => 'https://assinada.test/verso');
    expect(await abrirDocumentoPrivado(obterVerso)).toBe('aberta');
    expect(obterVerso).toHaveBeenCalledOnce();
    expect(abrir).toHaveBeenCalledWith('https://assinada.test/verso', '_blank', 'noopener,noreferrer');
    abrir.mockRestore();
  });
  it('não abre aba quando a media privada falha', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(await abrirDocumentoPrivado(async () => { throw new Error('falhou'); })).toBe('documento_indisponivel');
    expect(abrir).not.toHaveBeenCalled();
    abrir.mockRestore();
  });
});
