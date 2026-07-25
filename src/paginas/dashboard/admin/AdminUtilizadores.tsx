/**
 * Admin — Gestão de Utilizadores
 * Lista utilizadores reais: clientes, vendedores e admin fixo.
 * Permite eliminar clientes e vendedores com confirmação.
 */

import { useEffect, useState } from 'react';
import { Trash2, User, ShieldCheck, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="font-titulo text-2xl font-bold">
          Gestão de Utilizadores
        </h1>

        <div className="flex items-center gap-2">
          <span className="font-corpo text-xs text-muted-foreground">
            Filtrar:
          </span>

          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="font-corpo text-xs border-2 border-border bg-background px-2 py-1.5 focus:outline-none focus:border-primary"
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
      </div>

      <div className="space-y-3">
        {filtrados.length === 0 ? (
          <p className="font-corpo text-sm text-muted-foreground py-8 text-center">
            Nenhum utilizador encontrado.
          </p>
        ) : (
          filtrados.map(u => (
            <div key={`${u.tipo_conta}-${u.id}`} className="border-2 border-border p-4 space-y-2">
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

              <div className="flex gap-2 pt-1">
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
