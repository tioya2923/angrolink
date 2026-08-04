import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, Car, ChevronLeft, PackageCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import SeletorTelefone from '@/componentes/SeletorTelefone';
import { MUNICIPIOS, PROVINCIAS } from '@/dados/constantes';
import { supabase } from '@/services/supabase';
import { telefoneCompleto } from '@/lib/verificacoesConta';
import { validarSenha, validarTelefone } from '@/lib/validacoesConta';
import { toast } from 'sonner';
import { TipoVeiculoEntrega } from '@/tipos';

const tiposDocumentoBase = ['bi', 'carta_conducao', 'livrete_veiculo', 'seguro_automovel'];
const rotulosDocumento: Record<string, string> = { bi: 'Bilhete de Identidade', carta_conducao: 'Carta de condução', livrete_veiculo: 'Livrete / título do veículo', seguro_automovel: 'Seguro automóvel', inspecao_tecnica: 'Inspeção técnica', licenca_transporte_mercadorias: 'Licença de transporte de mercadorias' };

export default function PaginaCadastroParceiroEntrega() {
  const [aGuardar, setAGuardar] = useState(false);
  const [form, setForm] = useState({ nome: '', telefone: '', indicativo: '244', email: '', senha: '', confirmarSenha: '', provincia: '', municipio: '', bairro: '', emergencia: '', tipo: 'mota' as TipoVeiculoEntrega, marca: '', modelo: '', cor: '', ano: '', matricula: '', carroceria: '', capacidadeKg: '', volume: '', caixa: false, paletes: false, refrigeracao: false, termos: false });
  const [fotos, setFotos] = useState<Record<string, { frente?: File; verso?: File }>>({});
  const municipios = useMemo(() => MUNICIPIOS.filter(m => m.provincia_id === form.provincia), [form.provincia]);
  const documentos = useMemo(() => form.tipo === 'mota' ? tiposDocumentoBase : [...tiposDocumentoBase, 'inspecao_tecnica', 'licenca_transporte_mercadorias'], [form.tipo]);
  const set = (campo: string, valor: any) => setForm(atual => ({ ...atual, [campo]: valor }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const erroTelefone = validarTelefone(form.telefone, form.indicativo);
    if (erroTelefone) return toast.error(erroTelefone);
    const erroSenha = validarSenha(form.senha, form.confirmarSenha);
    if (erroSenha) return toast.error(erroSenha);
    if (!form.termos) return toast.error('Deve aceitar os termos de parceiro da ANGROLINK.');
    if (!form.capacidadeKg || Number(form.capacidadeKg) <= 0) return toast.error('Indique uma capacidade de carga válida.');
    const emFalta = documentos.filter(d => !fotos[d]?.frente || !fotos[d]?.verso);
    if (emFalta.length) return toast.error(`Envie frente e verso de: ${emFalta.map(d => rotulosDocumento[d]).join(', ')}.`);
    const todosFicheiros = Object.values(fotos).flatMap(f => [f.frente, f.verso]).filter(Boolean) as File[];
    if (todosFicheiros.some(f => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 3 * 1024 * 1024)) return toast.error('Use imagens JPG, PNG ou WEBP até 3 MB.');
    setAGuardar(true);
    try {
      const telefone = telefoneCompleto(form.telefone, form.indicativo);
      const emailLogin = `${form.indicativo}${form.telefone}@telefone.angrolink`;
      const db: any = supabase;
      let authUser: { id: string; email?: string | null } | null = null;

      // Uma conta de comprador pode tornar-se também parceira. Primeiro usamos
      // a sessão atual ou a palavra-passe informada; só criamos Auth novo se
      // o número ainda não pertencer a nenhuma conta.
      const { data: sessao } = await supabase.auth.getSession();
      if (sessao.session?.user.email === emailLogin) {
        authUser = sessao.session.user;
      } else {
        const { data: loginExistente } = await supabase.auth.signInWithPassword({
          email: emailLogin,
          password: form.senha,
        });

        if (loginExistente.user) {
          authUser = loginExistente.user;
        } else {
          // O trigger de auth.users cria o perfil técnico com o papel próprio
          // de parceiro; a migração de profiles permite este valor.
          const { data: auth, error: erroAuth } = await supabase.auth.signUp({
            email: emailLogin,
            password: form.senha,
            options: { data: { nome: form.nome, telefone, papel: 'parceiro_entrega' } },
          });

          if (erroAuth || !auth.user) {
            throw erroAuth || new Error('Não foi possível criar a conta.');
          }

          // Por segurança, o Supabase não denuncia diretamente se o e-mail
          // já existe. Neste caso devolve um utilizador sem identidade nova.
          if (auth.user.identities && auth.user.identities.length === 0) {
            throw new Error('Já existe uma conta com este número. Introduza a palavra-passe dessa conta para pedir parceria de entregas.');
          }

          authUser = auth.user;
        }
      }

      if (!authUser) throw new Error('Não foi possível validar a conta.');

      const { data: parceiroExistente, error: erroConsultaParceiro } = await db
        .from('parceiros_entrega')
        .select('id, estado')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (erroConsultaParceiro) throw erroConsultaParceiro;
      if (parceiroExistente) {
        if (['rascunho', 'documentos_pendentes'].includes(parceiroExistente.estado)) {
          // Tentativas interrompidas antes do envio final não podem ficar a
          // bloquear um novo pedido. A relação em cascata remove os veículos
          // e documentos parciais desse rascunho.
          const { error: erroRemoverRascunho } = await db
            .from('parceiros_entrega')
            .delete()
            .eq('id', parceiroExistente.id);
          if (erroRemoverRascunho) throw erroRemoverRascunho;
        } else {
          throw new Error('Esta conta já tem um pedido de parceria de entregas. Consulte o painel de entregador para acompanhar o estado.');
        }
      }

      const { data: parceiro, error: erroParceiro } = await db.from('parceiros_entrega').insert({ user_id: authUser.id, nome_completo: form.nome, email: form.email || null, telefone, provincia: PROVINCIAS.find(p => p.id === form.provincia)?.nome, municipio: MUNICIPIOS.find(m => m.id === form.municipio)?.nome, bairro: form.bairro || null, zona_base: form.bairro || null, contacto_emergencia: form.emergencia, termos_aceites_em: new Date().toISOString() }).select('id').single();
      if (erroParceiro) throw erroParceiro;
      const { data: veiculo, error: erroVeiculo } = await db.from('veiculos_entrega').insert({ parceiro_id: parceiro.id, tipo_veiculo: form.tipo, marca: form.marca, modelo: form.modelo, cor: form.cor, ano: form.ano ? Number(form.ano) : null, matricula: form.matricula.toUpperCase(), tipo_carrocaria: form.carroceria || null, capacidade_kg: Number(form.capacidadeKg), capacidade_volume_m3: form.volume ? Number(form.volume) : null, possui_caixa_carga: form.caixa, aceita_paletes: form.paletes, possui_refrigeracao: form.refrigeracao }).select('id').single();
      if (erroVeiculo) throw erroVeiculo;
      await db.from('areas_cobertura_entrega').insert({ parceiro_id: parceiro.id, provincia: PROVINCIAS.find(p => p.id === form.provincia)?.nome, municipio: MUNICIPIOS.find(m => m.id === form.municipio)?.nome, bairro: form.bairro || null });
      for (const tipo of documentos) {
        const guardar = async (lado: 'frente' | 'verso') => {
          const ficheiro = fotos[tipo][lado]!;
          const ext = ficheiro.name.split('.').pop() || 'jpg';
          const path = `${authUser.id}/${tipo}-${lado}-${crypto.randomUUID()}.${ext}`;
          const { error } = await supabase.storage.from('documentos-parceiros').upload(path, ficheiro, { contentType: ficheiro.type });
          if (error) throw error;
          return path;
        };
        const frente_path = await guardar('frente'); const verso_path = await guardar('verso');
        const { error } = await db.from('documentos_parceiro_entrega').insert({ parceiro_id: parceiro.id, veiculo_id: tipo === 'bi' || tipo === 'carta_conducao' ? null : veiculo.id, tipo_documento: tipo, frente_path, verso_path });
        if (error) throw error;
      }
      const { error: erroSubmissao } = await db.rpc(
        'submeter_pedido_parceiro_entrega',
        { p_parceiro_id: parceiro.id },
      );
      if (erroSubmissao) throw erroSubmissao;

      toast.success('Pedido enviado para análise. Será avisado após a validação.');
      // O parceiro entra logo no seu painel, mas permanece indisponível:
      // a base força disponibilidade=false até ao parecer do administrador.
      window.location.assign('/dashboard');
    } catch (erro: any) { console.error(erro); toast.error(erro.message || 'Não foi possível enviar o pedido.'); }
    finally { setAGuardar(false); }
  }

  return <div className="min-h-screen flex flex-col"><Cabecalho /><main className="container flex-1 py-8"><Link to="/anunciar" className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"><ChevronLeft size={16}/>Voltar</Link><div className="mx-auto max-w-3xl"><header className="painel-dashboard-cabecalho"><h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Ser Parceiro de Entregas</h1><p className="relative z-10 mt-1 text-sm text-primary-foreground/80">Entregue mercadorias com mota, carro, carrinha ou camião.</p></header><form onSubmit={enviar} className="painel-dashboard-form mt-6 space-y-6"><section className="space-y-4"><h2 className="font-titulo font-bold">1. Identidade e contacto</h2><div className="grid gap-4 sm:grid-cols-2"><Campo label="Nome completo *"><Input required value={form.nome} onChange={e=>set('nome',e.target.value)}/></Campo><Campo label="Contacto de emergência *"><Input required value={form.emergencia} onChange={e=>set('emergencia',e.target.value)} placeholder="923 000 000"/></Campo></div><Campo label="Telefone/WhatsApp *"><SeletorTelefone indicativo={form.indicativo} onIndicativoChange={v=>set('indicativo',v)} valor={form.telefone} onValorChange={v=>set('telefone',v)} required placeholder="923456789"/></Campo><div className="grid gap-4 sm:grid-cols-2"><Campo label="Palavra-passe *"><Input type="password" required value={form.senha} onChange={e=>set('senha',e.target.value)}/></Campo><Campo label="Confirmar palavra-passe *"><Input type="password" required value={form.confirmarSenha} onChange={e=>set('confirmarSenha',e.target.value)}/></Campo></div></section><section className="space-y-4 border-t pt-5"><h2 className="font-titulo font-bold">2. Veículo e área de serviço</h2><div className="grid gap-3 sm:grid-cols-3">{([['mota','Mota',Bike],['carro','Carro',Car],['carrinha','Carrinha / camião',Truck]] as const).map(([v,r,I])=><button key={v} type="button" onClick={()=>set('tipo',v === 'carrinha' ? 'carrinha' : v)} className={`rounded-lg border-2 p-3 text-left ${form.tipo===v || (v==='carrinha' && form.tipo==='camiao')?'border-primary bg-primary/5':'border-border'}`}><I className="mb-1 size-5 text-primary"/><span className="text-sm font-semibold">{r}</span></button>)}</div><div className="grid gap-4 sm:grid-cols-2"><Campo label="Marca *"><Input required value={form.marca} onChange={e=>set('marca',e.target.value)}/></Campo><Campo label="Modelo *"><Input required value={form.modelo} onChange={e=>set('modelo',e.target.value)}/></Campo><Campo label="Cor *"><Input required value={form.cor} onChange={e=>set('cor',e.target.value)}/></Campo><Campo label="Matrícula *"><Input required value={form.matricula} onChange={e=>set('matricula',e.target.value)}/></Campo><Campo label="Capacidade de carga (kg) *"><Input type="number" min="1" required value={form.capacidadeKg} onChange={e=>set('capacidadeKg',e.target.value)}/></Campo><Campo label="Volume de carga (m³)"><Input type="number" min="0" step="0.1" value={form.volume} onChange={e=>set('volume',e.target.value)}/></Campo></div><div className="grid gap-4 sm:grid-cols-2"><Campo label="Província base *"><select required className="w-full border-2 border-border px-3 py-2" value={form.provincia} onChange={e=>{set('provincia',e.target.value);set('municipio','')}}><option value="">Selecionar</option>{PROVINCIAS.map(p=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></Campo><Campo label="Município base *"><select required disabled={!form.provincia} className="w-full border-2 border-border px-3 py-2" value={form.municipio} onChange={e=>set('municipio',e.target.value)}><option value="">Selecionar</option>{municipios.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></Campo></div><Campo label="Bairro ou zona base"><Input value={form.bairro} onChange={e=>set('bairro',e.target.value)}/></Campo></section><section className="space-y-4 border-t pt-5"><h2 className="font-titulo font-bold">3. Documentos para análise</h2><p className="text-xs text-muted-foreground">Envie imagens nítidas da frente e do verso. JPG, PNG ou WEBP até 3 MB.</p>{documentos.map(d=><div key={d} className="rounded-lg border border-border p-3"><p className="mb-2 text-sm font-semibold">{rotulosDocumento[d]} *</p><div className="grid gap-3 sm:grid-cols-2">{(['frente','verso'] as const).map(l=><Campo key={l} label={`Foto da ${l} *`}><Input type="file" required accept="image/jpeg,image/png,image/webp" onChange={e=>setFotos(a=>({...a,[d]:{...a[d],[l]:e.target.files?.[0]}}))}/></Campo>)}</div></div>)}</section><label className="flex gap-2 text-xs"><input required type="checkbox" checked={form.termos} onChange={e=>set('termos',e.target.checked)}/>Confirmo que os dados são verdadeiros e aceito os <Link to="/termos#termos-parceiros" className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80">termos de parceiro ANGROLINK</Link>.</label><Button disabled={aGuardar} className="w-full"> <PackageCheck className="mr-2"/>{aGuardar?'A enviar...':'Enviar pedido para análise'}</Button></form></div></main><Rodape /></div>;
}
function Campo({label,children}:{label:string;children:React.ReactNode}) { return <div className="space-y-1"><Label className="text-sm">{label}</Label>{children}</div>; }
