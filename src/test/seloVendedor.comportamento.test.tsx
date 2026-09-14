import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SeloVendedor from '@/componentes/SeloVendedor';

describe('SeloVendedor', () => {
  it('mostra apenas identidade verificada quando o backend devolve true', () => {
    render(<SeloVendedor vendedor={{ verificado: true }} />);
    expect(screen.getByLabelText('Identidade do vendedor verificada pela ANGROLINK')).toHaveTextContent('Identidade verificada');
    expect(screen.getByText('A ANGROLINK confirmou a identidade e os dados cadastrais deste vendedor.')).toBeInTheDocument();
    expect(screen.getByText('A verificação não representa garantia sobre produtos, entregas ou transações.')).toBeInTheDocument();
  });

  it.each([false, null, undefined])('não mostra selo para verificado=%s', (verificado) => {
    render(<SeloVendedor vendedor={{ verificado }} />);
    expect(screen.queryByLabelText('Identidade do vendedor verificada pela ANGROLINK')).not.toBeInTheDocument();
  });

  it('mantém o selo compacto associado ao vendedor nos cards', () => {
    render(<SeloVendedor vendedor={{ verificado: true }} compacto />);
    expect(screen.getByLabelText('Identidade do vendedor verificada pela ANGROLINK')).toHaveTextContent('Verificado');
  });

  it('não infere aprovação, não usa any e não consulta Supabase', () => {
    const componente = readFileSync('src/componentes/SeloVendedor.tsx', 'utf8');
    expect(componente).toContain('vendedor?.verificado !== true');
    expect(componente).not.toContain('status_aprovacao');
    expect(componente).not.toMatch(/\bany\b/);
    expect(componente).not.toContain('supabase');
  });
});
