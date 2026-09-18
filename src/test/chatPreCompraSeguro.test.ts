import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260915010000_criar_chat_pre_compra_seguro.sql'), 'utf8');

describe('chat pré-compra seguro — invariantes SQL', () => {
  it('permite uma única conversa aberta sem impedir compras repetidas históricas', () => {
    expect(migration).not.toContain('unique (solicitante_user_id, vendedor_id, produto_id)');
    expect(migration).toContain('create unique index conversas_pre_compra_aberta_unica_idx');
    expect(migration).toContain("where estado = 'aberta'");
    expect(migration).toContain("and c.estado = 'aberta'");
  });

  it('qualifica produto_id no abridor e bloqueia Admin até nas policies RLS', () => {
    expect(migration).toContain('where c.solicitante_user_id = auth.uid()');
    expect(migration).toContain('and c.produto_id = p_produto_id');
    expect(migration).toContain('c.criado_em >= now()');
    expect(migration).toContain('conversas_pre_compra_solicitante_criado_idx');
    expect(migration).toContain('and not public.eh_admin()');
    expect(migration).toContain('conversas_pre_compra_participantes_leem');
    expect(migration).toContain('public.utilizador_participa_conversa_pre_compra(id)');
    expect(migration).toContain('grant execute on function public.utilizador_participa_conversa_pre_compra(uuid) to authenticated');
  });

  it('preserva mensagens imutáveis, idempotência e limites por remetente e conversa', () => {
    expect(migration).toContain('char_length(btrim(corpo)) between 1 and 1000');
    expect(migration).toContain('unique (conversa_id, remetente_user_id, chave_idempotencia)');
    expect(migration).toContain('mensagens_pre_compra_limite_remetente_conversa_idx');
    expect(migration).toContain('m.remetente_user_id=auth.uid() and m.conversa_id=p_conversa_id');
    expect(migration).toContain("interval '1 minute'");
    expect(migration).toContain("interval '24 hours'");
    expect(migration).toContain('pg_advisory_xact_lock');
  });

  it('oferece caixa de entrada segura com cursor composto e sem N+1 obrigatório', () => {
    expect(migration).toContain('produto_nome text,contraparte_nome text,ultima_mensagem_em timestamptz,ultima_mensagem_previa text,mensagens_nao_lidas bigint');
    expect(migration).toContain('p.nome_produto');
    expect(migration).toContain('left join public.clientes cl on cl.id=c.solicitante_user_id');
    expect(migration).not.toContain('p.nome,');
    expect(migration).not.toContain('cl.user_id');
    expect(migration).toContain('left join lateral');
    expect(migration).toContain('left(m.corpo,160) as previa');
    expect(migration).toContain('(c.atualizado_em,c.id)<(p_antes_de,p_antes_id)');
  });

  it('faz vínculo idempotente, sem grant de browser, depois do checkout autorizado', () => {
    expect(migration).toContain('vincular_conversa_pre_compra_encomenda');
    expect(migration).toContain('v_conversa.encomenda_id is not null and v_conversa.encomenda_id is distinct from p_encomenda_id');
    expect(migration).toContain("v_conversa.estado='somente_leitura' and v_conversa.encomenda_id=p_encomenda_id then return");
    expect(migration).toContain('Sem grant ao browser: Bloco B chama isto dentro do checkout transacional autorizado.');
    expect(migration).toContain('i.produto_id=v_conversa.produto_id');
    expect(migration).toContain('c.id=v_encomenda.cliente_id and c.id=auth.uid()');
  });

  it('usa allowlist explícita para telefone e audita sem guardar o número', () => {
    expect(migration).toContain("'confirmada','em_preparacao','pronta_para_levantamento','levantada','recolhida','chegou_destino','concluida'");
    expect(migration).toContain("v_encomenda.estado='concluida' and (v_encomenda.concluido_em is null or v_encomenda.concluido_em < now()-interval '7 days')");
    expect(migration).toContain("coalesce(nullif(btrim(v.telefone_whatsapp),''),nullif(btrim(v.whatsapp),''))");
    expect(migration).toContain('select c.telefone into v_telefone from public.clientes c');
    expect(migration).toContain('select c.id, true into v_cliente_user,v_cliente_existe');
    expect(migration).not.toContain('select c.user_id');
    expect(migration).toContain("'^[+]?[0-9]{7,15}$'");
    expect(migration).toContain("regexp_replace(btrim(coalesce(v_telefone,'')), '[^0-9+]', '', 'g')");
    expect(migration).toContain('acessos_telefone_encomenda(solicitante_user_id,encomenda_id,contraparte_user_id)');
  });

  it('isola Realtime/notificação do chat operacional e não concede execução a anon', () => {
    expect(migration).toContain('add table public.mensagens_pre_compra');
    expect(migration).not.toContain('add table public.mensagens_encomenda');
    expect(migration).not.toContain('alter table public.mensagens_encomenda');
    expect(migration).toContain("'mensagem-pre-compra:'");
    expect(migration).toContain('from public,anon');
    expect(migration).toContain('grant execute on function');
  });
});
