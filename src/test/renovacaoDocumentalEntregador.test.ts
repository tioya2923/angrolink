import { describe, expect, it } from 'vitest';
import { mensagemErroReenvioDocumento, validarNovaValidadeDocumento } from '@/dominio/documentosParceiro';
import fs from 'node:fs';

const pagina = fs.readFileSync('src/paginas/dashboard/parceiro/ParceiroResumo.tsx', 'utf8');
const servico = fs.readFileSync('src/services/api.ts', 'utf8');

describe('renovação documental de entregadores', () => {
  it('mantém reenvio para rejeitado e apresenta renovação para expirado', () => {
    expect(pagina).toMatch(/const rejeitado\s*=\s*documento\.estado\s*===\s*["']rejeitado["']/);
    expect(pagina).toMatch(/const expirado\s*=\s*documento\.estado\s*===\s*["']expirado["']/);
    expect(pagina).toMatch(/expirado\s*\?\s*["']Renovar documento["']\s*:\s*["']Reenviar documento["']/);
  });

  it('exige validade civil futura e posterior à anterior', () => {
    expect(validarNovaValidadeDocumento('', '2026-01-01', '2026-08-14')).toContain('Indique');
    expect(validarNovaValidadeDocumento('2026-01-01', '2026-01-01', '2026-08-14')).toContain('hoje');
    expect(validarNovaValidadeDocumento('2026-08-14', '2026-01-01', '2026-08-14')).toContain('hoje');
    expect(validarNovaValidadeDocumento('2026-09-01', '2026-10-01', '2026-08-14')).toContain('anterior');
    expect(validarNovaValidadeDocumento('2027-08-14', '2026-01-01', '2026-08-14')).toBeNull();
  });

  it('só permite submeter com frente, verso e validade válida no fluxo expirado', () => {
    expect(pagina).toMatch(/const podeEnviar\s*=\s*Boolean\(\s*frente\s*&&\s*verso/);
    expect(pagina).toMatch(/\(!expirado\s*\|\|\s*!erroValidade\)/);
    expect(pagina).toContain('Nova foto da frente *');
    expect(pagina).toContain('Nova foto do verso *');
    expect(pagina).toContain('Nova validade *');
  });

  it('usa as assinaturas tipadas corretas e não expõe paths na interface', () => {
    expect(servico).toContain('renovacao?: DadosRenovacaoDocumentoParceiro');
    expect(servico).toContain('p_numero_documento: renovacao.numeroDocumento?.trim() || \'\'');
    expect(servico).toContain('p_validade: renovacao.validade');
    expect(servico).toContain("p_verso_path: versoPath,");
    expect(pagina).not.toContain('frente_path}</');
    expect(pagina).not.toContain('verso_path}</');
  });

  it('bloqueia duplo envio, limpa uploads novos em erro e refaz os dados no sucesso', () => {
    expect(pagina).toContain('const [aSubmeter, setASubmeter] = useState(false)');
    expect(pagina).toContain('await carregarParceiro()');
    expect(servico).toContain(".remove(novosCaminhos)");
  });

  it('transforma erros do servidor em mensagens amigáveis', () => {
    expect(mensagemErroReenvioDocumento('Indique a nova validade para renovar este documento expirado.')).toContain('Indique');
    expect(mensagemErroReenvioDocumento('A nova validade deve ser posterior à validade expirada e a hoje.')).toContain('Escolha');
    expect(mensagemErroReenvioDocumento('Documento rejeitado ou expirado não encontrado.')).toContain('já não está disponível');
  });
});
