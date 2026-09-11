import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260911030000_expandir_mensagens_operacionais_entrega.sql');
const service = ler('src/services/mensagensEncomenda.ts');
const hook = ler('src/hooks/useMensagensEncomenda.ts');
const cliente = ler('src/paginas/dashboard/cliente/ClienteEncomendaDetalhe.tsx');
const vendedor = ler('src/paginas/dashboard/vendedor/VendedorEncomendaDetalhe.tsx');
const parceiro = ler('src/paginas/dashboard/parceiro/ParceiroTarefaDetalhe.tsx');

describe('Mensagens operacionais por atribuição — Bloco 4C', () => {
  it('faz backfill do histórico 4B sem apagar mensagens nem leituras', () => {
    expect(migration).toContain("update public.mensagens_encomenda set canal = 'comprador_vendedor' where canal is null");
    expect(migration).toContain("update public.leituras_mensagens_encomenda set canal = 'comprador_vendedor' where canal is null");
    expect(migration).toContain('alter column canal set not null');
    expect(migration).not.toMatch(/delete\s+from\s+public\.(mensagens|leituras)_mensagens_encomenda/i);
  });

  it('liga a atribuição à encomenda pela FK composta e isola os três canais', () => {
    expect(migration).toContain('unique (id, encomenda_id)');
    expect(migration).toContain('foreign key (atribuicao_entrega_id, encomenda_id) references public.atribuicoes_entrega_encomenda(id, encomenda_id) on delete restrict');
    expect(migration).toContain("comprador_vendedor','vendedor_entregador','comprador_entregador");
    expect(migration).toContain("canal = 'comprador_vendedor' and atribuicao_entrega_id is null");
    expect(migration).toContain("canal in ('vendedor_entregador','comprador_entregador') and atribuicao_entrega_id is not null");
  });

  it('mantém RPCs antigas compatíveis e usa UPSERT compatível com ambos os índices parciais', () => {
    expect(migration).toContain("p_canal text default 'comprador_vendedor'");
    expect(migration).toContain('p_atribuicao_entrega_id uuid default null');
    expect(migration).toContain('on conflict (encomenda_id,canal,utilizador_id) where atribuicao_entrega_id is null');
    expect(migration).toContain('on conflict (encomenda_id,canal,atribuicao_entrega_id,utilizador_id) where atribuicao_entrega_id is not null');
    expect(service).toContain("canal ?? 'comprador_vendedor'");
  });

  it('autoriza cada canal por comparações explícitas fail-closed, sem bypass de Admin', () => {
    expect(migration).not.toContain('p_utilizador_id in (e.cliente_id,vendedor_user)');
    expect(migration).not.toContain('p_utilizador_id not in (vendedor_user,parceiro_user)');
    expect(migration).not.toContain('p_utilizador_id not in (e.cliente_id,parceiro_user)');
    expect(migration).toContain('(vendedor_user is not null and p_utilizador_id=vendedor_user)');
    expect(migration).toContain('(parceiro_user is not null and p_utilizador_id=parceiro_user)');
    expect(migration).toContain('(e.cliente_id is not null and p_utilizador_id=e.cliente_id)');
    expect(migration).toContain('return coalesce(');
    expect(migration).toContain("estado_atribuicao in ('aceite','chegou_origem','recolhida','chegou_destino')");
    expect(migration).toContain("estado_atribuicao in ('recolhida','chegou_destino')");
    expect(migration).toContain("estado_atribuicao='cancelada' and aceite_atribuicao_em is not null");
    expect(migration).toContain("estado_atribuicao='cancelada' and recolhida_atribuicao_em is not null");
    expect(migration).not.toContain('eh_admin()');
  });

  it('envia notificação somente à contraparte e usa o id concreto da tarefa', () => {
    expect(migration).toContain("'/dashboard/tarefas/'||new.atribuicao_entrega_id");
    expect(migration).toContain("'mensagem:'||new.id||':'||destino");
    expect(migration).toContain("when destino=parceiro_user then 'entrega'");
  });

  it('troca cursor, filtro e carga de Realtime ao mudar canal ou atribuição', () => {
    expect(hook).toContain('cursorRef.current = null');
    expect(hook).toContain('atribuicao_entrega_id=eq.${atribuicaoEntregaId}');
    expect(hook).toContain('nova.canal !== canalMensagem');
    expect(hook).toContain('supabase.removeChannel(canalRealtime)');
  });

  it('mostra os tabs apenas nos marcos operacionais corretos', () => {
    expect(vendedor).toContain("['aceite', 'chegou_origem', 'recolhida', 'chegou_destino', 'concluida']");
    expect(vendedor).toContain("entrega.estado === 'cancelada' && Boolean(entrega.aceite_em)");
    expect(cliente).toContain("['recolhida', 'chegou_destino', 'concluida']");
    expect(cliente).toContain("encomenda.entrega_participante.estado === 'cancelada' && Boolean(encomenda.entrega_participante.recolhida_em)");
    expect(parceiro).toContain("'vendedor_entregador'");
    expect(parceiro).toContain("'comprador_entregador'");
  });
});
