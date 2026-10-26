import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SeletorTelefone from '@/componentes/SeletorTelefone';

afterEach(cleanup);

describe('clareza do contacto do perfil', () => {
  it('encaminha a descrição acessível para o input real sem alterar o valor', () => {
    const alterar = vi.fn();
    render(<>
      <label htmlFor="contacto">Telefone de contacto</label>
      <SeletorTelefone id="contacto" aria-describedby="ajuda" indicativo="244"
        onIndicativoChange={vi.fn()} valor="923456789" onValorChange={alterar} required />
      <p id="ajuda">Alterar este campo não muda o número ou email usado para iniciar sessão.</p>
    </>);
    const campo = screen.getByLabelText('Telefone de contacto');
    expect(campo).toHaveAccessibleDescription('Alterar este campo não muda o número ou email usado para iniciar sessão.');
    expect(campo).toHaveValue('923456789');
    expect(campo).toHaveAttribute('type', 'tel');
    expect(campo).toBeRequired();
    expect(alterar).not.toHaveBeenCalled();
  });

  it.each([
    ['cliente/ClienteDefinicoes.tsx', 'cliente', 'Telefone de contacto', 'checkout e futuras encomendas'],
    ['vendedor/VendedorPerfil.tsx', 'vendedor', 'WhatsApp de contacto', 'contacto por WhatsApp'],
    ['parceiro/ParceiroResumo.tsx', 'parceiro', 'Telefone de contacto', 'perfil e nas entregas'],
  ])('associa rótulo e ajuda contextual no formulário %s', (ficheiro, papel, rotulo, finalidade) => {
    const fonte = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard', ficheiro), 'utf8');
    expect(fonte).toContain(`htmlFor="${papel}-telefone-contacto"`);
    expect(fonte).toContain(`>${rotulo}</Label>`);
    expect(fonte).toContain(`id="${papel}-telefone-contacto"`);
    expect(fonte).toContain(`aria-describedby="${papel}-telefone-ajuda"`);
    expect(fonte).toContain(`id="${papel}-telefone-ajuda"`);
    expect(fonte).toContain(finalidade);
    expect(fonte).toContain('Alterar este campo não muda o número ou email usado para iniciar sessão.');
  });

  it('não apresenta o email do perfil do comprador como identificador Auth', () => {
    const fonte = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard/cliente/ClienteDefinicoes.tsx'), 'utf8');
    expect(fonte).toContain('htmlFor="cliente-email-contacto"');
    expect(fonte).toContain('aria-describedby="cliente-email-ajuda"');
    expect(fonte).toContain('Não é necessariamente o email de acesso da conta.');
    expect(fonte).not.toContain('O email deve ser alterado através da autenticação da conta.');
  });
});
