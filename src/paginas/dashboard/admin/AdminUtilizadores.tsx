/**
 * Admin — Gestão de Utilizadores
 * Lista utilizadores reais: clientes, vendedores e admin fixo.
 * Permite eliminar clientes e vendedores com confirmação.
 */

import { useEffect, useState } from 'react';
import { CalendarDays, Mail, MapPin, Phone, Trash2, User, ShieldCheck, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { obterRotuloCompletoVendedor } from '@/dados/constantes';

import {
  fetchUtilizadoresAdmin,
  eliminarClienteAdmin,
  eliminarVendedorAdmin,
} from '@/services/api';

interface UtilizadorAdmin {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  tipo_conta: 'admin' | 'cliente' | 'comprador' | 'vendedor';
  tipo_vendedor?: string;
  tipo_comprador?: string;
  foto_perfil?: string | null;
  provincia?: string;
  municipio?: string;
  bairro?: string;
  plano?: string;
  verificado?: boolean;
  data_registo: string;
  estado: 'ativo' | 'pendente' | 'suspenso' | 'rejeitado';
}

const ADMIN_FIXO: UtilizadorAdmin = {
  id: 'admin-local',
  nome: 'Administrador',
  email: 'admin@angrolink.ao',
  telefone: '244900000000',
  tipo_conta: 'admin',
  data_registo: 'Conta do sistema',
  estado: 'ativo',
  foto_perfil: null,
  provincia: 'ANGROLINK',
  municipio: 'Sistema',
};

export default function AdminUtilizadores() {
  const { toast } = useToast();

  const [utilizadores, setUtilizadores] = useState<UtilizadorAdmin[]>([]);
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [loading, setLoading] = useState(true);

  async function carregarUtilizadores() {
    try {
      setLoading(true);

      const { clientes, vendedores } = await fetchUtilizadoresAdmin();

      const clientesNormalizados: UtilizadorAdmin[] = clientes.map((c: any) => ({
        id: c.id,
        nome: c.nome || 'Comprador sem nome',
        email: c.email || '',
        telefone: c.telefone || '',
        tipo_conta: 'cliente',
        tipo_comprador: c.tipo_comprador || 'casa',
        foto_perfil: c.foto_perfil || null,
        provincia: c.provincia || '',
        municipio: c.municipio || '',
        bairro: c.bairro || '',
        data_registo: c.criado_em || '',
        estado: 'ativo',
      }));

      const vendedoresNormalizados: UtilizadorAdmin[] = vendedores.map((v: any) => ({
        id: v.id,
        nome: v.nome_responsavel || v.nome_comercial || 'Vendedor sem nome',
        email: v.email || '',
        telefone: v.telefone_whatsapp || v.whatsapp || '',
        tipo_conta: 'vendedor',
        tipo_vendedor: v.tipo_vendedor || '',
        foto_perfil: v.foto_perfil || null,
        provincia: v.provincia || '',
        municipio: v.municipio || '',
        bairro: v.mercado_bairro || v.bairro || '',
        plano: v.plano || 'gratuito',
        verificado: v.verificado === true,
        data_registo: v.criado_em || '',
        estado:
          v.status_aprovacao === 'aprovado'
            ? 'ativo'
            : v.status_aprovacao || 'pendente',
      }));

      setUtilizadores([
        ADMIN_FIXO,
        ...clientesNormalizados,
        ...vendedoresNormalizados,
      ]);
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao carregar utilizadores',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarUtilizadores();
  }, []);

  useAtualizacaoTempoReal(['clientes', 'vendedores', 'parceiros_entrega'], carregarUtilizadores);

  const normalizarTipoConta = (tipo: string) => {
    if (tipo === 'comprador') return 'cliente';
    return tipo;
  };

  const labelTipoConta = (tipo: string) => {
    const tipoNormalizado = normalizarTipoConta(tipo);

    if (tipoNormalizado === 'cliente') return 'comprador';

    return tipoNormalizado;
  };

  const totalClientes = utilizadores.filter(
    u => normalizarTipoConta(u.tipo_conta) === 'cliente'
  ).length;

  const totalVendedores = utilizadores.filter(
    u => normalizarTipoConta(u.tipo_conta) === 'vendedor'
  ).length;

  const totalAdmins = utilizadores.filter(
    u => normalizarTipoConta(u.tipo_conta) === 'admin'
  ).length;

  const filtrados =
    filtroTipo === 'todos'
      ? utilizadores
      : utilizadores.filter(
          u => normalizarTipoConta(u.tipo_conta) === filtroTipo
        );

  const eliminarConta = async (u: UtilizadorAdmin) => {
    try {
      if (normalizarTipoConta(u.tipo_conta) === 'admin') return;

      if (normalizarTipoConta(u.tipo_conta) === 'cliente') {
        await eliminarClienteAdmin(u.id);
      }

      if (normalizarTipoConta(u.tipo_conta) === 'vendedor') {
        await eliminarVendedorAdmin(u.id);
      }

      setUtilizadores(prev => prev.filter(item => item.id !== u.id));
      setConfirmarEliminar(null);

      toast({
        title: 'Conta removida',
        description:
          'O registo foi removido das tabelas públicas. A conta de autenticação pode continuar no Supabase Auth.',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao eliminar conta',
        variant: 'destructive',
      });
    }
  };

  const obterIconeTipo = (tipo: string) => {
    switch (normalizarTipoConta(tipo)) {
      case 'admin':
        return <ShieldCheck size={14} className="text-primary" />;
      case 'vendedor':
        return <Store size={14} className="text-primary" />;
      default:
        return <User size={14} className="text-muted-foreground" />;
    }
  };

  const estadoCor = (estado: string) => {
    switch (estado) {
      case 'ativo':
        return 'border-primary text-primary';
      case 'pendente':
        return 'border-yellow-500 text-yellow-600';
      case 'suspenso':
        return 'border-destructive text-destructive';
      case 'rejeitado':
        return 'border-destructive text-destructive';
      default:
        return 'border-border text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar utilizadores...
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="painel-dashboard-cabecalho flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Gestão de Utilizadores</h1>
          <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Consulta e administra compradores, vendedores e administradores.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="relative z-10 font-corpo text-xs text-primary-foreground/80">
            Filtrar:
          </span>

          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="relative z-10 rounded-md border-2 border-primary-foreground/30 bg-primary-foreground px-2 py-1.5 font-corpo text-xs text-foreground focus:outline-none"
          >
            <option value="todos">
              Todos ({utilizadores.length})
            </option>

            <option value="cliente">
              Compradores ({totalClientes})
            </option>

            <option value="vendedor">
              Vendedores ({totalVendedores})
            </option>

            <option value="admin">
              Admins ({totalAdmins})
            </option>
          </select>
        </div>
      </header>

      <div className="space-y-3">
        {filtrados.length === 0 ? (
          <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
            Nenhum utilizador encontrado.
          </p>
        ) : (
          filtrados.map(u => (
            <div key={`${u.tipo_conta}-${u.id}`} className="painel-dashboard-item p-4 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {u.foto_perfil ? (
                  <img src={u.foto_perfil} alt={`Foto de ${u.nome}`} className="size-14 shrink-0 rounded-full border-2 border-primary/20 object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-titulo font-bold text-primary-foreground">
                    {u.nome.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}

                <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {obterIconeTipo(u.tipo_conta)}

                <span className="font-titulo text-sm font-medium">
                  {u.nome}
                </span>

                <span className={`font-corpo text-xs px-2 py-0.5 border ${estadoCor(u.estado)}`}>
                  {u.estado}
                </span>

                <span className="font-corpo text-xs px-2 py-0.5 border border-border text-muted-foreground capitalize">
                  {labelTipoConta(u.tipo_conta)}
                </span>
              </div>

              <div className="font-corpo text-xs text-muted-foreground space-y-0.5">
                <p>
                  {u.email || 'Sem email'} · {u.telefone || 'Sem telefone'}
                </p>

                <p>
                  Registado:{' '}
                  {u.data_registo === 'Conta do sistema'
                    ? u.data_registo
                    : u.data_registo
                      ? new Date(u.data_registo).toLocaleDateString()
                      : 'Sem data'}
                </p>

                {normalizarTipoConta(u.tipo_conta) === 'vendedor' && u.tipo_vendedor && (
                  <p>Tipo: {obterRotuloCompletoVendedor(u.tipo_vendedor)}</p>
                )}
              </div>

                  <div className="mt-3 grid gap-x-5 gap-y-2 border-t border-border pt-3 font-corpo text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                    <span className="flex items-center gap-1.5"><Mail size={13} className="text-primary" />{u.email || 'Sem e-mail'}</span>
                    <span className="flex items-center gap-1.5"><Phone size={13} className="text-primary" />{u.telefone || 'Sem telefone'}</span>
                    <span className="flex items-center gap-1.5"><MapPin size={13} className="text-primary" />{[u.municipio, u.provincia].filter(Boolean).join(', ') || 'Localização não indicada'}</span>
                    <span className="flex items-center gap-1.5"><CalendarDays size={13} className="text-primary" />{u.data_registo === 'Conta do sistema' ? u.data_registo : u.data_registo ? `Registado em ${new Date(u.data_registo).toLocaleDateString('pt-AO')}` : 'Data não indicada'}</span>
                    {u.bairro && <span>Zona: {u.bairro}</span>}
                    {normalizarTipoConta(u.tipo_conta) === 'cliente' && <span>Perfil: {u.tipo_comprador === 'negocio' ? 'Negócio' : 'Casa'}</span>}
                    {normalizarTipoConta(u.tipo_conta) === 'vendedor' && u.tipo_vendedor && <span>Atividade: {obterRotuloCompletoVendedor(u.tipo_vendedor)}</span>}
                    {normalizarTipoConta(u.tipo_conta) === 'vendedor' && <span>Plano: {(u.plano || 'gratuito').replace(/^./, letra => letra.toUpperCase())}</span>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 border-t border-border pt-3">
                {normalizarTipoConta(u.tipo_conta) !== 'admin' && (
                  <>
                    {confirmarEliminar === u.id ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-corpo text-xs text-destructive">
                          Tem a certeza? Esta ação remove o perfil público, mas não elimina necessariamente o Auth user.
                        </span>

                        <button
                          onClick={() => eliminarConta(u)}
                          className="font-corpo text-xs border-2 border-destructive text-destructive px-3 py-1.5 hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        >
                          Confirmar
                        </button>

                        <button
                          onClick={() => setConfirmarEliminar(null)}
                          className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-foreground transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmarEliminar(u.id)}
                        className="flex items-center gap-1 font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-destructive hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
