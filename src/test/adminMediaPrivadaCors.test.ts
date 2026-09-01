import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

const funcao = fs.readFileSync('supabase/functions/admin-media-privada/index.ts', 'utf8');

describe('CORS da Media Privada Admin', () => {
  it('trata OPTIONS antes de JWT, base de dados e Storage', () => {
    expect(funcao.indexOf("if (pedido.method === 'OPTIONS')")).toBeLessThan(funcao.indexOf("const jwt ="));
  });
  it('aceita exatamente localhost:8080 através de ALLOWED_ORIGINS e devolve headers necessários', () => {
    expect(funcao).toContain("split(',').map");
    expect(funcao).toContain("origens.includes(origem ?? '')");
    expect(funcao).toContain("'Access-Control-Allow-Methods': 'POST, OPTIONS'");
    expect(funcao).toContain('authorization, apikey, content-type, x-client-info');
  });
  it('não cria resposta 204 com corpo e mantém POST protegido', () => {
    expect(funcao).toContain('status === 204 ? null : JSON.stringify(corpo)');
    expect(funcao).toContain("if (!jwt) return resposta(401");
    expect(funcao).toContain("if (!administrador) return resposta(403");
    expect(funcao).not.toContain("'Access-Control-Allow-Origin': '*'");
  });
  it('abre documentos por versão, sem devolver paths privados', () => {
    expect(funcao).toContain("'foto_veiculo_entregador'");
    expect(funcao).toContain(".from('veiculos_entrega')");
    expect(funcao).toContain(".select('foto_veiculo_path')");
    expect(funcao).toContain("'documento_entregador_frente'");
    expect(funcao).toContain("'documento_entregador_verso'");
    expect(funcao).toContain(".from('versoes_documento_parceiro_entrega')");
    expect(funcao).toContain(".eq('id', corpo.entidade_id)");
    expect(funcao).not.toContain('{ url: caminho');
    expect(funcao).not.toContain('{ caminho:');
  });
  it('normaliza paths relativos e URLs legadas sem aceitar outro bucket', () => {
    expect(funcao).toContain('function normalizarCaminhoDocumento');
    expect(funcao).toContain('url.pathname.match(/\\/object\\/');
    expect(funcao).toContain('documentos-parceiros');
    expect(funcao).toContain("codigo: 'CAMINHO_INVALIDO'");
    expect(funcao).toContain("codigo: 'ASSINATURA_INDISPONIVEL'");
    expect(funcao).toContain("etapa: 'criar_signed_url'");
  });
});
