import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useState } from 'react';
import type { MouseEventHandler, ReactElement, ReactNode } from 'react';
import { formatarCentimosAoa } from '@/dominio/encomendas';
import type { ItemCarrinho } from '@/dominio/carrinho';

const mocks = vi.hoisted(() => ({
  utilizador: null as { papel: string } | null,
  atualizarQuantidade: vi.fn(),
  removerItem: vi.fn(),
  drawer: { open: false, onOpenChange: (_open: boolean) => {}, onAnimationEnd: (_open: boolean) => {}, contentOnAnimationEnd: () => {} },
  carrinho: null as unknown as { itens: ItemCarrinho[]; quantidadeItens: number; subtotalEstimadoCentimos: number; atualizarQuantidade: ReturnType<typeof vi.fn>; removerItem: ReturnType<typeof vi.fn> },
}));

vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: mocks.utilizador }) }));
vi.mock('@/hooks/useCarrinho', () => ({ useCarrinho: () => mocks.carrinho }));
vi.mock('@/components/ui/drawer', async () => {
  const React = await import('react');
  return {
    Drawer: ({ open, onOpenChange, onAnimationEnd, children }: { open: boolean; onOpenChange: (open: boolean) => void; onAnimationEnd?: (open: boolean) => void; children: ReactNode }) => {
      mocks.drawer = { ...mocks.drawer, open, onOpenChange, onAnimationEnd: onAnimationEnd ?? (() => {}) };
      return <>{children}</>;
    },
    DrawerTrigger: ({ children }: { children: ReactElement }) => React.cloneElement(children, { onClick: () => mocks.drawer.onOpenChange(true) }),
    DrawerContent: ({ children, className, onAnimationEnd }: { children: ReactNode; className?: string; onAnimationEnd?: () => void }) => {
      mocks.drawer.contentOnAnimationEnd = onAnimationEnd ?? (() => {});
      return mocks.drawer.open ? <div role="dialog" className={className} onKeyDown={(event) => { if (event.key === 'Escape') mocks.drawer.onOpenChange(false); }}>{children}</div> : null;
    },
    DrawerClose: ({ children }: { children: ReactElement<{ onClick?: MouseEventHandler<HTMLButtonElement> }> }) => {
      const onClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        children.props.onClick?.(event);
        mocks.drawer.onOpenChange(false);
      };
      return React.cloneElement(children, { onClick });
    },
    DrawerHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DrawerTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DrawerDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DrawerFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  };
});

import { BarraCarrinhoMovel } from '@/componentes/carrinho/BarraCarrinhoMovel';

const conversaId = '11111111-1111-4111-8111-111111111111';
const item = (parcial: Partial<ItemCarrinho> = {}): ItemCarrinho => ({
  produto_id: 'produto-a', vendedor_id: 'vendedor-a', vendedor_nome: 'Vendedor A', nome: 'Produto A', imagem: null,
  unidade: 'kg', quantidade: 1.5, preco_retalho_centimos: 10000, preco_grosso_centimos: null,
  tipo_venda: 'retalho', quantidade_minima: 0.5, quantidade_minima_grosso: null, disponivel: true,
  atualizado_em: '2026-09-19T00:00:00Z', conversa_pre_compra_id: conversaId, ...parcial,
});

function Localizacao() {
  return <output data-testid="rota">{useLocation().pathname}</output>;
}

function DestinoCarrinhoInterativo() {
  const { pathname } = useLocation();
  const [interagiu, setInteragiu] = useState(false);
  if (pathname !== '/carrinho') return null;
  return <button type="button" onClick={() => setInteragiu(true)}>{interagiu ? 'Destino interativo' : 'Interagir no carrinho'}</button>;
}

function PaginaPublicaInterativa() {
  const { pathname } = useLocation();
  const [interagiu, setInteragiu] = useState(false);
  if (pathname !== '/') return null;
  return <button type="button" onClick={() => setInteragiu(true)}>{interagiu ? 'Página pública interativa' : 'Interagir na página pública'}</button>;
}

function ConteudoTeste() {
  return <><BarraCarrinhoMovel /><Localizacao /><DestinoCarrinhoInterativo /><PaginaPublicaInterativa /></>;
}

function renderBarra(rota = '/', itens = [item()]) {
  mocks.carrinho = {
    itens,
    quantidadeItens: itens.length,
    subtotalEstimadoCentimos: itens.reduce((total, atual) => total + atual.preco_retalho_centimos * atual.quantidade, 0),
    atualizarQuantidade: mocks.atualizarQuantidade,
    removerItem: mocks.removerItem,
  };
  return render(<MemoryRouter initialEntries={[rota]}><ConteudoTeste /></MemoryRouter>);
}

describe('BarraCarrinhoMovel', () => {
  beforeEach(() => {
    mocks.utilizador = null;
    mocks.atualizarQuantidade.mockReset();
    mocks.removerItem.mockReset();
    mocks.drawer = { open: false, onOpenChange: () => {}, onAnimationEnd: () => {}, contentOnAnimationEnd: () => {} };
  });

  it('não mostra carrinho vazio', () => {
    renderBarra('/', []);
    expect(screen.queryByRole('button', { name: /ver carrinho/i })).toBeNull();
  });

  it.each(['/', '/pesquisa', '/produto/produto-a', '/vendedor/vendedor-a'])('mostra apenas na rota pública de produtos %s', (rota) => {
    renderBarra(rota);
    expect(screen.getByRole('button', { name: /ver carrinho/i })).toHaveClass('md:hidden');
  });

  it.each(['/carrinho', '/checkout', '/login', '/como-funciona', '/servicos', '/dashboard', '/dashboard/recomendacoes', '/anunciar'])('oculta na rota fora do catálogo %s', (rota) => {
    renderBarra(rota);
    expect(screen.queryByRole('button', { name: /ver carrinho/i })).toBeNull();
  });

  it.each(['admin', 'parceiro_entrega'])('oculta para o papel %s sem limpar o carrinho', (papel) => {
    mocks.utilizador = { papel };
    renderBarra('/');
    expect(screen.queryByRole('button', { name: /ver carrinho/i })).toBeNull();
    expect(mocks.carrinho.itens).toHaveLength(1);
  });

  it.each(['cliente', 'vendedor'])('permite o papel comprador %s', (papel) => {
    mocks.utilizador = { papel };
    renderBarra('/');
    expect(screen.getByRole('button', { name: /ver carrinho/i })).toBeTruthy();
  });

  it('usa o número de linhas, singular/plural, subtotal e safe area', () => {
    renderBarra('/', [item(), item({ produto_id: 'produto-b', quantidade: 2 })]);
    const botao = screen.getByRole('button', { name: /ver carrinho/i });
    expect(botao).toHaveTextContent('2 produtos');
    expect(botao.textContent?.replace(/\u00a0/g, ' ')).toContain(formatarCentimosAoa(35000).replace(/\u00a0/g, ' '));
    expect(botao).toHaveClass('pb-[calc(0.75rem+env(safe-area-inset-bottom))]');
    expect(document.querySelector('[aria-hidden="true"]')?.className).toContain('env(safe-area-inset-bottom)');
  });

  it('abre e fecha o drawer por Escape, preservando o trigger acessível', () => {
    renderBarra();
    const trigger = screen.getByRole('button', { name: /ver carrinho/i });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toHaveTextContent('O seu carrinho');
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('fecha o drawer pelo botão explícito de fechar', () => {
    renderBarra();
    fireEvent.click(screen.getByRole('button', { name: /ver carrinho/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar carrinho' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fecha quando o drawer comunica o fecho por gesto', () => {
    renderBarra();
    fireEvent.click(screen.getByRole('button', { name: /ver carrinho/i }));
    act(() => mocks.drawer.onOpenChange(false));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('fecha pelo ciclo do drawer ao remover o último item e mantém a página interativa', async () => {
    const resultado = renderBarra();
    fireEvent.click(screen.getByRole('button', { name: /ver carrinho/i }));

    mocks.carrinho = { ...mocks.carrinho, itens: [], quantidadeItens: 0, subtotalEstimadoCentimos: 0 };
    resultado.rerender(<MemoryRouter initialEntries={['/']}><ConteudoTeste /></MemoryRouter>);

    await waitFor(() => expect(mocks.drawer.open).toBe(false));
    expect(screen.queryByRole('button', { name: /ver carrinho/i })).toBeNull();
    act(() => mocks.drawer.contentOnAnimationEnd());
    fireEvent.click(screen.getByRole('button', { name: 'Interagir na página pública' }));
    expect(screen.getByRole('button', { name: 'Página pública interativa' })).toBeTruthy();
  });

  it('agrupa vendedores e partilha preço, quantidade fracionada, mínimo e remoção', () => {
    renderBarra('/', [item({ tipo_venda: 'ambos', preco_grosso_centimos: 8000, quantidade_minima_grosso: 2, quantidade: 2 }), item({ produto_id: 'produto-b', nome: 'Produto B', vendedor_id: 'vendedor-b', vendedor_nome: 'Vendedor B' })]);
    fireEvent.click(screen.getByRole('button', { name: /ver carrinho/i }));
    expect(screen.getByText('Vendedor A')).toBeTruthy();
    expect(screen.getByText('Vendedor B')).toBeTruthy();
    expect(screen.getByText((_, elemento) => elemento?.textContent === `${formatarCentimosAoa(8000)} / kg`)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Diminuir quantidade de Produto A' })[0]);
    expect(mocks.atualizarQuantidade).toHaveBeenCalledWith('produto-a', 1.5);
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade de Produto B' }));
    expect(mocks.atualizarQuantidade).toHaveBeenCalledWith('produto-b', 2);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Produto A' }));
    expect(mocks.removerItem).toHaveBeenCalledWith('produto-a');
  });

  it('preserva conversa, não cria checkout e navega ao carrinho apenas pelo CTA', () => {
    renderBarra('/', [item(), item({ produto_id: 'produto-b', vendedor_id: 'vendedor-b', conversa_pre_compra_id: '22222222-2222-4222-8222-222222222222' })]);
    fireEvent.click(screen.getByRole('button', { name: /ver carrinho/i }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Aumentar quantidade de Produto A' })[0]);
    expect(mocks.carrinho.itens[0].conversa_pre_compra_id).toBe(conversaId);
    expect(mocks.carrinho.itens[1].conversa_pre_compra_id).toBe('22222222-2222-4222-8222-222222222222');
    fireEvent.click(screen.getByRole('button', { name: 'Ver carrinho e continuar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('rota')).toHaveTextContent('/');
    act(() => mocks.drawer.onAnimationEnd(false));
    expect(screen.getByTestId('rota')).toHaveTextContent('/carrinho');
    fireEvent.click(screen.getByRole('button', { name: 'Interagir no carrinho' }));
    expect(screen.getByRole('button', { name: 'Destino interativo' })).toBeTruthy();
  });
});
