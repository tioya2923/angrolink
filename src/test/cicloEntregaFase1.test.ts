import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260824120000_visibilidade_segura_entrega_fase_1.sql');
const detalhe = ler('src/componentes/encomendas/EncomendaDetalheConteudo.tsx');
const tarefa = ler('src/paginas/dashboard/parceiro/ParceiroTarefaDetalhe.tsx');

describe('Ciclo de entrega — fase 1', () => {
  it('cria uma projeção segura do entregador para os participantes comerciais', () => {
    expect(migration).toContain('obter_entrega_encomenda_participante');
    expect(migration).toContain("v_atribuicao.estado = 'aceite'");
    expect(migration).not.toContain("'foto_perfil_url'");
    expect(migration).not.toContain("'frente_path'");
    expect(migration).not.toContain("'verso_path'");
  });

  it('oculta contacto e morada do destinatário antes do aceite no servidor e na interface', () => {
    expect(migration).toContain("case when a.estado = 'aceite' then d.destinatario_nome else null end");
    expect(migration).toContain("case when a.estado = 'aceite' then d.destinatario_telefone else null end");
    expect(migration).toContain("case when a.estado = 'aceite' then d.endereco_detalhado else null end");
    expect(tarefa).toContain("['aceite', 'chegou_origem', 'recolhida', 'concluida']");
    expect(tarefa).toContain('Dados protegidos até ao aceite');
  });

  it('mostra o parceiro apenas depois do aceite e não renderiza documentos', () => {
    expect(detalhe).toContain("estado === 'aceite'");
    expect(detalhe).toContain('Matrícula:');
    expect(detalhe).not.toContain('frente_path');
    expect(detalhe).not.toContain('verso_path');
    expect(detalhe).not.toContain('foto_perfil_url');
  });

  it('notifica comprador, vendedor e parceiro de forma idempotente', () => {
    for (const evento of ['entregador_atribuido', 'entregador_aceitou', 'entregador_recusou']) expect(migration).toContain(`'${evento}'`);
    for (const chave of ["'encomenda:' || new.id || ':cliente'", "'encomenda:' || new.id || ':vendedor'", "'encomenda:' || new.id || ':entregador'"]) expect(migration).toContain(chave);
  });

  it('distingue o texto de entrega do levantamento', () => {
    expect(migration).toContain('pronta para recolha pelo entregador');
    expect(migration).toContain('pronta para levantamento');
  });
});
