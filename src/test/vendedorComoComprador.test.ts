import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260823010000_permitir_vendedor_como_comprador.sql'), 'utf8');
const checkout = readFileSync(resolve(process.cwd(), 'src/paginas/PaginaCheckoutPendente.tsx'), 'utf8');
const acoes = readFileSync(resolve(process.cwd(), 'src/componentes/carrinho/AcoesCompraProduto.tsx'), 'utf8');
const rotas = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard/DashboardRouter.tsx'), 'utf8');
const menu = readFileSync(resolve(process.cwd(), 'src/paginas/dashboard/DashboardLayout.tsx'), 'utf8');

describe('vendedor como comprador V1', () => {
  it('garante perfil comprador no servidor sem alterar o papel principal', () => {
    expect(migration).toContain('create or replace function public.garantir_perfil_comprador()');
    expect(migration).toContain('where user_id = auth.uid()');
    expect(migration).toContain('insert into public.clientes');
    expect(migration).toContain('tipo_comprador\n  ) values');
  });

  it('protege levantamento e entrega contra compra da própria loja', () => {
    expect(migration).toContain('validar_compra_produto_alheio');
    expect(migration).toContain('Não podes comprar produtos da tua própria loja.');
    expect(migration).toContain('criar_encomenda_levantamento_base_v1');
    expect(migration).toContain('criar_encomenda_entrega_base_v1');
  });

  it('aceita vendedor no checkout e esconde compra ativa no produto próprio', () => {
    expect(checkout).toContain("utilizador?.papel !== 'cliente' && utilizador?.papel !== 'vendedor'");
    expect(acoes).toContain("utilizador?.papel === 'cliente' || utilizador?.papel === 'vendedor'");
    expect(acoes).toContain('Este produto pertence à tua loja');
  });

  it('separa compras do vendedor das encomendas recebidas', () => {
    expect(menu).toContain("rotulo: 'Minhas compras'");
    expect(rotas).toContain('path="compras"');
    expect(rotas).toContain('path="compras/:id"');
    expect(rotas).toContain('rotaDetalhe="/dashboard/compras"');
  });
});
