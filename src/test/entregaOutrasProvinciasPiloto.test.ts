import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(caminho, 'utf8');
const cadastro = ler('src/paginas/PaginaAnunciar.tsx');
const perfil = ler('src/paginas/dashboard/vendedor/VendedorPerfil.tsx');
const pedidosAdmin = ler('src/paginas/dashboard/admin/AdminPedidosVendedores.tsx');
const detalheAdmin = ler('src/paginas/dashboard/admin/AdminVendedorDetalhe.tsx');

describe('declaração legada de entrega para outras províncias', () => {
  it('não mostra a opção no cadastro, mas mantém o valor inicial falso no payload', () => {
    expect(cadastro).not.toContain('Entrega para outras províncias');
    expect(cadastro).toContain('entrega_outras_provincias: false');
    expect(cadastro).toContain('entrega_outras_provincias: formPerfil.entrega_outras_provincias');
  });

  it('não mostra a opção no perfil e preserva tanto true como false carregados ao guardar', () => {
    expect(perfil).not.toContain('Entrega para outras províncias');
    expect(perfil).toContain('setEntregaOutrasProvincias(Boolean(data.entrega_outras_provincias));');
    expect(perfil).toContain('entrega_outras_provincias: entregaOutrasProvincias');
  });

  it('explica que a entrega ANGROLINK depende da cobertura operacional do Huambo', () => {
    const nota = 'Nesta fase, a entrega pela ANGROLINK está disponível apenas no Huambo e depende da cobertura operacional.';
    expect(cadastro).toContain(nota);
    expect(perfil).toContain(nota);
  });

  it('mantém a leitura Admin marcada como declaração legada e sem cobertura operacional', () => {
    expect(pedidosAdmin).toContain('Entrega para outras províncias — declaração legada');
    expect(pedidosAdmin).toContain('A declaração legada não define a cobertura operacional da ANGROLINK.');
    expect(detalheAdmin).toContain('Entrega para outras províncias — declaração legada');
  });
});
