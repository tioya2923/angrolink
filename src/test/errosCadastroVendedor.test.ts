import { describe, expect, it, vi } from 'vitest';
import {
  detalhesTecnicosErroCadastroVendedor,
  mensagemErroCadastroVendedor,
  registarDiagnosticoSeguroCadastroVendedor,
} from '@/lib/errosCadastroVendedor';

describe('erros do cadastro de vendedor', () => {
  it('expõe apenas código e mensagem técnicos no diagnóstico local', () => {
    expect(detalhesTecnicosErroCadastroVendedor({ code: 'PGRST202', message: 'RPC indisponível', status: 404, hint: 'não expor' }))
      .toEqual({ codigo: 'PGRST202', mensagem: 'RPC indisponível', statusHttp: 404 });
  });

  it('indica uma ação possível quando a disponibilidade falha antes da criação da conta', () => {
    expect(mensagemErroCadastroVendedor('disponibilidade'))
      .toBe('Não foi possível verificar a disponibilidade dos dados. Confirma a ligação e tenta novamente.');
  });

  it('mantém fallback seguro para uma falha inesperada', () => {
    expect(mensagemErroCadastroVendedor('sessao'))
      .toBe('Não foi possível concluir o pedido agora. Confirma a ligação e tenta novamente.');
  });

  it('regista apenas etapa, operação, status e código', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    registarDiagnosticoSeguroCadastroVendedor(
      'conta',
      'auth-sign-up',
      { code: 'email_exists', status: 422, message: 'nunca deve aparecer no log seguro' },
    );

    expect(erro).toHaveBeenCalledWith(
      'Diagnóstico seguro do cadastro de vendedor:',
      {
        etapa: 'conta',
        operacao: 'auth-sign-up',
        statusHttp: 422,
        codigo: 'email_exists',
      },
    );
    erro.mockRestore();
  });
});
