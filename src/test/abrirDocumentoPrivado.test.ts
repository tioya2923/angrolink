import { describe, expect, it, vi } from 'vitest';
import { abrirDocumentoPrivado } from '@/lib/abrirDocumentoPrivado';

describe('abertura privada de documentos', () => {
  it('reserva a aba e navega-a para a signed URL sem a fechar', async () => {
    const janela = { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window;
    const abrir = vi.spyOn(window, 'open').mockReturnValue(janela);
    const resultado = await abrirDocumentoPrivado(async () => 'https://assinada.test/frente');
    expect(resultado).toBe('aberta');
    expect(abrir).toHaveBeenCalledWith('about:blank', '_blank');
    expect(janela.location.href).toBe('https://assinada.test/frente');
    expect(janela.close).not.toHaveBeenCalled();
    abrir.mockRestore();
  });

  it('fecha a aba reservada quando a obtenção da URL falha', async () => {
    const janela = { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window;
    const abrir = vi.spyOn(window, 'open').mockReturnValue(janela);
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await abrirDocumentoPrivado(async () => { throw new Error('falhou'); })).toBe('documento_indisponivel');
    expect(janela.close).toHaveBeenCalledOnce();
    erro.mockRestore();
    abrir.mockRestore();
  });

  it('trata URL ausente como falha controlada', async () => {
    const janela = { closed: false, close: vi.fn(), location: { href: '' } } as unknown as Window;
    const abrir = vi.spyOn(window, 'open').mockReturnValue(janela);
    expect(await abrirDocumentoPrivado(async () => '' as string)).toBe('documento_indisponivel');
    expect(janela.close).toHaveBeenCalledOnce();
    abrir.mockRestore();
  });
});
