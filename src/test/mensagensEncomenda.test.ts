import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ler = (ficheiro: string) => readFileSync(resolve(process.cwd(), ficheiro), 'utf8');
const migration = ler('supabase/migrations/20260911020000_criar_mensagens_internas_encomenda.sql');
const service = ler('src/services/mensagensEncomenda.ts');
const hook = ler('src/hooks/useMensagensEncomenda.ts');
const componente = ler('src/componentes/encomendas/MensagensEncomenda.tsx');
const cliente = ler('src/paginas/dashboard/cliente/ClienteEncomendaDetalhe.tsx');
const vendedor = ler('src/paginas/dashboard/vendedor/VendedorEncomendaDetalhe.tsx');

describe('Mensagens internas por encomenda', () => {
  it('cria apenas a thread por encomenda, mensagens imutáveis e leitura agregada', () => {
    expect(migration).toContain('create table public.mensagens_encomenda');
    expect(migration).toContain('create table public.leituras_mensagens_encomenda');
    expect(migration).toContain('primary key (encomenda_id, utilizador_id)');
    expect(migration).toContain('check (char_length(btrim(corpo)) between 1 and 1000)');
    expect(migration).toContain('(encomenda_id, criado_em desc, id desc)');
    for (const proibido of ['conversas_encomenda', 'atualizado_em', 'apagado_em', 'reply_to', 'reactions']) expect(migration).not.toContain(proibido);
  });

  it('autoriza apenas comprador ou vendedor real e mantém Admin e entregador fora do chat', () => {
    expect(migration).toContain('e.cliente_id = p_utilizador_id or v.user_id = p_utilizador_id');
    expect(migration).toContain('p_utilizador_id is distinct from auth.uid()');
    expect(migration).toContain('security definer');
    expect(migration).toContain('set search_path = pg_catalog, public');
    expect(migration).not.toContain('eh_admin()');
    expect(migration).not.toContain('parceiros_entrega');
  });

  it('mantém todas as escritas atrás de RPCs e bloqueia vazios, excesso e estados terminais', () => {
    for (const rpc of ['listar_mensagens_encomenda', 'enviar_mensagem_encomenda', 'marcar_mensagens_encomenda_como_lidas', 'obter_resumo_mensagens_encomenda']) expect(migration).toContain(`public.${rpc}`);
    expect(migration).toContain("v_encomenda.estado in ('concluida', 'cancelada', 'recusada')");
    expect(migration).toContain("v_corpo text := btrim(coalesce(p_corpo, ''))");
    expect(migration).toContain('char_length(v_corpo) > 1000');
    expect(migration).toContain('on conflict (encomenda_id, utilizador_id) do update');
    expect(migration).toContain('revoke all on table public.mensagens_encomenda, public.leituras_mensagens_encomenda from public, anon, authenticated');
    expect(migration).not.toContain('for insert to authenticated');
    expect(migration).not.toContain('for update to authenticated');
  });

  it('pagina com cursor composto, conta apenas mensagens do outro e publica somente mensagens', () => {
    expect(migration).toContain('p_antes_id uuid default null');
    expect(migration).toContain('(m.criado_em, m.id) < (p_antes_de, p_antes_id)');
    expect(migration).toContain('m.remetente_user_id <> auth.uid()');
    expect(migration).toContain('alter publication supabase_realtime add table public.mensagens_encomenda');
    expect(migration).not.toContain('add table public.leituras_mensagens_encomenda');
  });

  it('notifica apenas a contraparte e preserva a rota de vendedor-comprador', () => {
    expect(migration).not.toContain('into v_encomenda, v_vendedor_user_id');
    expect(migration).toContain('select e.* into v_encomenda');
    expect(migration).toContain('select v.user_id into v_vendedor_user_id');
    expect(migration).toContain("v_url := '/dashboard/compras/' || v_encomenda.id");
    expect(migration).toContain("v_url := '/dashboard/encomendas/' || v_encomenda.id");
    expect(migration).toContain("'mensagem:' || new.id || ':' || v_destinatario");
    expect(migration).toContain('v_destinatario <> new.remetente_user_id');
    expect(migration).toContain("'Nova mensagem numa encomenda.'");
  });

  it('isola o adapter temporário e usa Realtime filtrado pela encomenda concreta', () => {
    expect(service).not.toContain('rpcMensagens');
    expect(service).toContain("supabase.rpc('listar_mensagens_encomenda'");
    expect(service).toContain("'listar_mensagens_encomenda'");
    expect(hook).toContain("table: 'mensagens_encomenda'");
    expect(hook).toContain('atribuicaoEntregaId ? `atribuicao_entrega_id=eq.${atribuicaoEntregaId}` : `encomenda_id=eq.${encomendaId}`');
    expect(hook).toContain('supabase.removeChannel(canalRealtime)');
    expect(hook).not.toContain('await marcarMensagensEncomendaComoLidas(encomendaId);\n      if (geracao !== geracaoRef.current) return;');
    expect(hook).toContain('const marcarComoLidas = useCallback');
    expect(componente).toContain('typeof IntersectionObserver === \'undefined\'');
    expect(componente).toContain('intersectionRatio >= 0.25');
  });

  it('renderiza conteúdo como texto, bloqueia o composer em terminal e integra os dois detalhes', () => {
    expect(componente).toContain('whitespace-pre-wrap break-words');
    expect(componente).not.toContain('dangerouslySetInnerHTML');
    expect(componente).toContain('Esta encomenda está encerrada. O histórico de mensagens continua disponível.');
    expect(componente).toContain('disabled={aEnviar || !corpo.trim()}');
    expect(cliente).toContain('<MensagensOperacionaisEntrega encomendaId={encomenda.id} estadoEncomenda={encomenda.estado}');
    expect(vendedor).toContain('<MensagensOperacionaisEntrega encomendaId={encomenda.id} estadoEncomenda={encomenda.estado}');
  });
});
