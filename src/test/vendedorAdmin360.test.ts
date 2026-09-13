import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) => readFileSync(resolve(process.cwd(), caminho), 'utf8');
const servico = ler('src/services/adminVendedor360.ts');
const detalhe = ler('src/paginas/dashboard/admin/AdminVendedorDetalhe.tsx');
const lista = ler('src/paginas/dashboard/admin/AdminVendedores.tsx');
const router = ler('src/paginas/dashboard/DashboardRouter.tsx');

describe('Vendedor 360 V1', () => {
  it('usa somente as seis RPCs administrativas aprovadas', () => {
    for (const rpc of ['obter_vendedor_admin', 'listar_produtos_vendedor_admin', 'listar_servicos_vendedor_admin', 'listar_encomendas_vendedor_admin', 'listar_disputas_vendedor_admin', 'listar_historico_documental_vendedor_admin']) expect(servico).toContain(rpc);
    expect(servico).not.toContain(".from('documentos_vendedor')");
    expect(servico).not.toContain(".from('pagamentos')");
  });

  it('adiciona a rota protegida de detalhe e o acesso na gestão de vendedores', () => {
    expect(router).toContain('path="vendedores/:id"');
    expect(lista).toContain('Ver vendedor');
    expect(lista).toContain('/dashboard/vendedores/${v.id}');
  });

  it('mostra elegibilidade, motivo e campos comerciais sem enumerar nulos', () => {
    expect(detalhe).toContain('Pode receber encomendas');
    expect(detalhe).toContain('motivoInelegibilidade');
    expect(detalhe).toContain('filter(item=>item.valor)');
  });

  it('abre documentos privados somente através do helper de URL assinada', () => {
    expect(detalhe).toContain('abrirDocumentoPrivado');
    expect(detalhe).toContain('obterUrlAssinadaDocumentoVendedor');
    expect(detalhe).toContain('Ver frente');
    expect(detalhe).toContain('Ver verso');
    expect(detalhe).not.toContain('createSignedUrl');
  });

  it('carrega coleções sob demanda e mantém paginação independente por tab', () => {
    expect(detalhe).toContain('carregarAba');
    expect(detalhe).toContain("destino === 'produtos'");
    expect(detalhe).not.toContain("destino === 'servicos'");
    expect(detalhe).toContain("destino === 'encomendas'");
    expect(detalhe).toContain("destino === 'disputas'");
    expect(detalhe).toContain("destino === 'historico'");
    expect(detalhe).toContain('Paginacao');
  });

  it('separa preços configurados e apresenta o financeiro calculado no servidor', () => {
    expect(detalhe).toContain('precoBase');
    expect(detalhe).toContain('precoPromocional');
    expect(detalhe).toContain('precoGrosso');
    expect(detalhe).toContain('Volume bruto transacionado');
    expect(detalhe).toContain('Volume efetivo após reembolsos');
    expect(detalhe).not.toContain('Receita ANGROLINK');
  });

  it('não expõe OTP, tokens ou segredos no serviço e detalhe', () => {
    for (const conteudo of [servico, detalhe]) {
      expect(conteudo.toLowerCase()).not.toContain('access_token');
      expect(conteudo.toLowerCase()).not.toContain('refresh_token');
      expect(conteudo.toLowerCase()).not.toContain('service_role');
      expect(conteudo.toLowerCase()).not.toContain('codigo_hash');
    }
  });
});
