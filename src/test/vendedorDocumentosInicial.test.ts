import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pagina = readFileSync('src/paginas/dashboard/vendedor/VendedorDocumentos.tsx', 'utf8');
const requisitos = readFileSync('src/dados/documentosVendedor.ts', 'utf8');
const documentos = readFileSync('src/services/documentosVendedor.ts', 'utf8');


describe('envio inicial de documentos ausentes do vendedor', () => {
  it('obtém requisitos pelo tipo e calcula ausentes contra as linhas existentes', () => {
    expect(pagina).toContain('fetchMeuVendedor({ lancarErro: true })');
    expect(pagina).toContain('obterRequisitosDocumentos(tipoVendedor)');
    expect(pagina).toContain('documentos.map(documento => documento.tipo_documento)');
    expect(pagina).toContain('!tiposExistentes.has(tipo as DocumentoVendedor[\'tipo_documento\'])');
    expect(pagina).toContain('.filter(tipo => CATALOGO_DOCUMENTOS[tipo])');
    expect(requisitos).toContain('obrigatorios:');
  });

  it('mantém estados existentes fora do envio inicial e preserva o reenvio de rejeitados', () => {
    expect(pagina).toContain('documentosObrigatoriosAusentes');
    expect(pagina).toContain('documentoVendedorPodeSerReenviado(documento.estado)');
    expect(pagina).toContain('reenviarDocumentoVendedor(');
    expect(pagina).toContain('documentos.length === 0 && documentosObrigatoriosAusentes.length === 0');
  });

  it('usa o vendedor autenticado, catálogo e helper de submissão, recarregando depois do sucesso', () => {
    expect(pagina).toContain('submeterDocumentosVendedor(utilizador.vendedor_id, lote)');
    expect(pagina).toContain('await carregar();');
    expect(pagina).toContain('setValoresAusentes({});');
    expect(pagina).toContain('setFicheirosAusentes({});');
    expect(pagina).toContain('CATALOGO_DOCUMENTOS[tipoDocumento]');
    expect(documentos).toContain('criarCaminhoDocumentoVendedor(');
  });

  it('não altera o helper documental nem introduz acesso direto a vendedores', () => {
    expect(pagina).not.toContain(".from('vendedores')");
    expect(pagina).not.toContain('.from("vendedores")');
    expect(pagina).not.toContain('vendedor_id:');
  });
});
