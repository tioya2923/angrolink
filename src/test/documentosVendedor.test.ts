import { describe, expect, it } from 'vitest';
import {
  criarCaminhoDocumentoVendedor,
  documentoVendedorPodeSerAnalisado,
  documentoVendedorPodeSerReenviado,
  separarValoresDocumentoVendedor,
  validarRejeicaoCandidaturaVendedor,
  validarImagemDocumentoVendedor,
} from '@/services/documentosVendedor';

describe('documentos de vendedor', () => {
  it('separa os campos indexáveis dos dados complementares', () => {
    expect(separarValoresDocumentoVendedor({
      numero: ' 007654321LA042 ',
      validade: '2030-12-31',
      categoria: 'B',
      observacao: '',
    })).toEqual({
      numero_documento: '007654321LA042',
      validade: '2030-12-31',
      dados_adicionais: { categoria: 'B' },
    });
  });

  it('aceita apenas imagens até 3 MB', () => {
    expect(() => validarImagemDocumentoVendedor({ type: 'image/png', size: 3 * 1024 * 1024 })).not.toThrow();
    expect(() => validarImagemDocumentoVendedor({ type: 'application/pdf', size: 100 })).toThrow('JPG, PNG ou WEBP');
    expect(() => validarImagemDocumentoVendedor({ type: 'image/jpeg', size: 3 * 1024 * 1024 + 1 })).toThrow('3 MB');
  });

  it('usa caminhos novos em cada reenvio e não sobrescreve o original', () => {
    const primeiro = criarCaminhoDocumentoVendedor('utilizador-1', 'vendedor-1', 'bi', 'frente', 'jpg', 'versao-1');
    const reenvio = criarCaminhoDocumentoVendedor('utilizador-1', 'vendedor-1', 'bi', 'frente', 'jpg', 'versao-2');

    expect(primeiro).toBe('utilizador-1/vendedor-1/bi-frente-versao-1.jpg');
    expect(reenvio).toBe('utilizador-1/vendedor-1/bi-frente-versao-2.jpg');
    expect(reenvio).not.toBe(primeiro);
  });

  it('exige documento explicitamente rejeitado antes de rejeição documental da candidatura', () => {
    expect(validarRejeicaoCandidaturaVendedor('documental', 'BI ilegível', [
      { estado: 'pendente' },
      { estado: 'aprovado' },
    ])).toBe('Indique primeiro quais documentos precisam de correção.');

    expect(validarRejeicaoCandidaturaVendedor('documental', 'BI ilegível', [
      { estado: 'rejeitado' },
      { estado: 'aprovado' },
    ])).toBeNull();
  });

  it('mantém documentos inalterados numa rejeição não documental', () => {
    expect(validarRejeicaoCandidaturaVendedor('nao_documental', 'Atividade não permitida', [
      { estado: 'aprovado' },
      { estado: 'pendente' },
    ])).toBeNull();
  });

  it.each(['pendente', 'em_analise', 'aprovado', 'expirado'] as const)(
    'não permite reenvio na interface quando o documento está %s',
    estado => {
      expect(documentoVendedorPodeSerReenviado(estado)).toBe(false);
    },
  );

  it('permite reenvio apenas de documento rejeitado', () => {
    expect(documentoVendedorPodeSerReenviado('rejeitado')).toBe(true);
  });

  it.each(['pendente', 'em_analise'] as const)(
    'permite ações de análise apenas no estado %s',
    estado => expect(documentoVendedorPodeSerAnalisado(estado)).toBe(true),
  );

  it.each(['aprovado', 'rejeitado', 'expirado'] as const)(
    'não apresenta ações de aprovar ou rejeitar novamente para documento %s',
    estado => expect(documentoVendedorPodeSerAnalisado(estado)).toBe(false),
  );
});
