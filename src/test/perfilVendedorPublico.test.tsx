import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PerfilVendedorHero from '@/componentes/PerfilVendedorHero';

vi.mock('@/componentes/SeloVendedor', () => ({ default: () => <span>Selo</span> }));

describe('perfil público do vendedor', () => {
  it('substitui o CTA genérico de WhatsApp por um atalho interno para os produtos', () => {
    render(<PerfilVendedorHero vendedor={{
      id: 'vendedor-1', nome_comercial: 'Loja de teste', provincia: 'Huambo', municipio: 'Huambo',
      tipo_vendedor: 'produtor', verificado: false, plano: 'gratuito', telefone_whatsapp: '+244900000000',
    }} produtos={[]} />);

    expect(screen.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', '#produtos');
    expect(screen.queryByRole('link', { name: /WhatsApp/i })).toBeNull();
    expect(screen.queryByText('Contactos')).toBeNull();
    expect(screen.getByText('Produtos')).toBeInTheDocument();
    expect(screen.getByText('Visualizações')).toBeInTheDocument();
  });
});
