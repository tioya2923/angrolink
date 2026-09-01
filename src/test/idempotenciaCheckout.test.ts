import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  concluirChaveIdempotenciaCheckout,
  criarFingerprintCheckout,
  mensagemErroCheckout,
  obterChaveIdempotenciaCheckout,
  type IntencaoCheckoutGrupo,
} from '@/services/idempotenciaCheckout';

const base: IntencaoCheckoutGrupo = {
  modalidade: 'levantamento', vendedorId: 'vendedor-a',
  itens: [{ produto_id: 'produto-b', quantidade: 1 }, { produto_id: 'produto-a', quantidade: 2 }],
  nomeDestinatario: ' Ana  Silva ', telefoneDestinatario: ' 900000000 ', observacoesCliente: ' Separar  ',
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('idempotência do checkout por grupo', () => {
  it('reutiliza a UUID para a mesma intenção, inclusive após reload simulado', () => {
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    expect(obterChaveIdempotenciaCheckout('user-a', base)).toBe('00000000-0000-4000-8000-000000000001');
    expect(obterChaveIdempotenciaCheckout('user-a', { ...base, itens: [...base.itens].reverse() })).toBe('00000000-0000-4000-8000-000000000001');
    expect(uuid).toHaveBeenCalledTimes(1);
  });

  it('preserva a UUID em falha de rede ou resposta perdida', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000002');
    const chave = obterChaveIdempotenciaCheckout('user-a', base);
    expect(obterChaveIdempotenciaCheckout('user-a', base)).toBe(chave);
  });

  it('substitui a UUID somente para o grupo cuja intenção mudou', () => {
    const uuid = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000003')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000004');
    const anterior = obterChaveIdempotenciaCheckout('user-a', base);
    const alterada = obterChaveIdempotenciaCheckout('user-a', { ...base, itens: [{ produto_id: 'produto-a', quantidade: 3 }] });
    expect(anterior).not.toBe(alterada);
    expect(uuid).toHaveBeenCalledTimes(2);
  });

  it('distingue vendedor, modalidade e utilizador autenticado', () => {
    const uuid = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000005')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000006')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000007');
    const a = obterChaveIdempotenciaCheckout('user-a', base);
    const b = obterChaveIdempotenciaCheckout('user-a', { ...base, vendedorId: 'vendedor-b' });
    const c = obterChaveIdempotenciaCheckout('user-b', base);
    expect(new Set([a, b, c]).size).toBe(3);
    expect(uuid).toHaveBeenCalledTimes(3);
  });

  it('inclui destino apenas em entrega e altera apenas essa intenção', () => {
    const entrega: IntencaoCheckoutGrupo = { ...base, modalidade: 'entrega', provincia: 'Luanda', municipio: 'Kilamba Kiaxi', bairro: 'Talatona', enderecoDetalhado: 'Rua A' };
    const uuid = vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000008')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000009');
    const primeira = obterChaveIdempotenciaCheckout('user-a', entrega);
    const segunda = obterChaveIdempotenciaCheckout('user-a', { ...entrega, enderecoDetalhado: 'Rua B' });
    expect(primeira).not.toBe(segunda);
    expect(uuid).toHaveBeenCalledTimes(2);
  });

  it('remove apenas a chave processada localmente com sucesso', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000010')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000011')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000012');
    const chaveA = obterChaveIdempotenciaCheckout('user-a', base);
    const outra = { ...base, vendedorId: 'vendedor-b' };
    const chaveB = obterChaveIdempotenciaCheckout('user-a', outra);
    concluirChaveIdempotenciaCheckout('user-a', base, chaveA);
    expect(obterChaveIdempotenciaCheckout('user-a', outra)).toBe(chaveB);
    expect(obterChaveIdempotenciaCheckout('user-a', base)).toBe('00000000-0000-4000-8000-000000000012');
  });

  it('não inclui preço browser no fingerprint e normaliza ordem e quantidade', () => {
    const comPrecoForjado = { ...base, itens: [{ produto_id: 'produto-a', quantidade: 2.0, preco: 1 }, { produto_id: 'produto-b', quantidade: 1.0, preco: 999 }] };
    expect(criarFingerprintCheckout(base)).toBe(criarFingerprintCheckout(comPrecoForjado));
  });

  it('não expõe erros PostgreSQL e trata conflito de intenção de forma controlada', () => {
    expect(mensagemErroCheckout({ message: 'relation reservas_stock_encomenda violates constraint xyz' })).toBe('Não foi possível confirmar a encomenda. Verifique a ligação e tente novamente.');
    expect(mensagemErroCheckout({ message: 'Chave de idempotência reutilizada com payload diferente.' })).toBe('Os dados desta tentativa foram alterados. Reveja o grupo e tente novamente.');
  });
});
