/**
 * Vendedor — Lista dos seus serviços
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  Trash2,
  Star,
  Share2,
  Edit,
  Eye,
  MessageSquare,
} from 'lucide-react';

import { Servico } from '@/tipos';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contextos/AuthContexto';

import {
  fetchServicosPorVendedor,
  deleteServico,
  updateServico,
  destacarServicoGratis,
  removerDestaqueServico,
} from '@/services/api';

export default function VendedorServicos() {
  const { toast } = useToast();
  const { utilizador } = useAuth();
  const navigate = useNavigate();

  const vendedorPendente =
    utilizador?.papel === 'vendedor' &&
    utilizador?.status_aprovacao !== 'aprovado';

  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [atualizandoId, setAtualizandoId] = useState<string | null>(null);

  async function carregarServicos() {
    if (!utilizador?.vendedor_id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const data = await fetchServicosPorVendedor(utilizador.vendedor_id);
      setServicos(data || []);
    } catch (err) {
      console.error('Erro ao carregar serviços:', err);

      toast({
        title: 'Erro ao carregar serviços',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarServicos();
  }, [utilizador?.vendedor_id]);

  const irAdicionarServico = () => {
    if (vendedorPendente) {
      toast({
        title: 'Conta em análise',
        description:
          'Só poderá publicar serviços quando a sua conta for aprovada pela equipa ANGROLINK.',
        variant: 'destructive',
      });
      return;
    }

    navigate('/dashboard/adicionar-servico');
  };

  const removerServico = async (id: string) => {
    const confirmar = window.confirm(
      'Tens a certeza que queres remover este serviço?'
    );

    if (!confirmar) return;

    try {
      setRemovendoId(id);

      await deleteServico(id);

      setServicos(prev => prev.filter(s => s.id !== id));

      toast({
        title: 'Serviço removido',
        description: 'O serviço foi eliminado com sucesso.',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao remover serviço',
        variant: 'destructive',
      });
    } finally {
      setRemovendoId(null);
    }
  };

  const toggleDestaque = async (servico: Servico) => {
  if (vendedorPendente) {
    toast({
      title: 'Destaque indisponível',
      description:
        'Só poderá destacar serviços quando a sua conta for aprovada pela equipa ANGROLINK.',
      variant: 'destructive',
    });
    return;
  }

  try {
    setAtualizandoId(servico.id);

    if (servico.destaque) {
      await removerDestaqueServico(servico.id);

      toast({
        title: 'Destaque removido',
        description: 'O serviço voltou ao estado normal.',
      });
    } else {
      await destacarServicoGratis(servico.id);

      toast({
        title: 'Serviço destacado',
        description:
          'Este serviço ficará em destaque durante 7 dias. Se já tinhas outro serviço destacado, ele foi substituído.',
      });
    }

    await carregarServicos();
  } catch (err: any) {
    console.error(err);

    toast({
      title: 'Erro ao atualizar destaque',
      description:
        err?.message || 'Não foi possível atualizar o destaque deste serviço.',
      variant: 'destructive',
    });
  } finally {
    setAtualizandoId(null);
  }
};

  const toggleDisponibilidade = async (servico: Servico) => {
    if (vendedorPendente) {
      toast({
        title: 'Conta em análise',
        description:
          'Só poderá ativar ou pausar serviços depois da aprovação da sua conta.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAtualizandoId(servico.id);

      const novoValor = !servico.disponivel;

      await updateServico(servico.id, {
        disponivel: novoValor,
      });

      setServicos(prev =>
        prev.map(s =>
          s.id === servico.id
            ? { ...s, disponivel: novoValor }
            : s
        )
      );

      toast({
        title: novoValor ? 'Serviço ativado' : 'Serviço pausado',
      });
    } catch (err) {
      console.error(err);

      toast({
        title: 'Erro ao atualizar disponibilidade',
        variant: 'destructive',
      });
    } finally {
      setAtualizandoId(null);
    }
  };

  const partilharServico = async (servico: Servico) => {
    if (vendedorPendente) {
      toast({
        title: 'Serviço ainda não publicado',
        description:
          'Só poderá partilhar serviços quando a sua conta for aprovada e o serviço estiver público.',
        variant: 'destructive',
      });
      return;
    }

    const url = `${window.location.origin}/servico/${servico.id}`;

    try {
      await navigator.clipboard.writeText(url);

      toast({
        title: 'Link copiado!',
        description: 'Partilha este serviço com potenciais clientes.',
      });
    } catch {
      toast({
        title: 'Não foi possível copiar o link',
        description: url,
        variant: 'destructive',
      });
    }
  };

  const editarServico = (servico: Servico) => {
    navigate('/dashboard/adicionar-servico', {
      state: { servico },
    });
  };

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar serviços...
      </p>
    );
  }

  if (!utilizador?.vendedor_id) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        Esta conta ainda não está ligada a um vendedor.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-titulo text-2xl font-bold">
            Meus Serviços
          </h1>

          <p className="font-corpo text-sm text-muted-foreground mt-1">
            Gere os teus serviços, disponibilidade, destaques e desempenho.
          </p>
        </div>

        <button
          onClick={irAdicionarServico}
          className="flex items-center gap-2 font-corpo text-sm bg-green-700 text-white px-4 py-2 border-2 border-green-700 hover:bg-green-800 transition-colors shrink-0 rounded-md"
        >
          <PlusCircle size={16} />
          {vendedorPendente ? 'Aguardar aprovação' : 'Adicionar Serviço'}
        </button>
      </div>

      {vendedorPendente && (
        <div className="border-2 border-yellow-500/40 bg-yellow-500/10 p-4 rounded-md">
          <p className="font-corpo text-sm font-semibold">
            Conta em análise
          </p>
          <p className="font-corpo text-xs text-muted-foreground mt-1">
            Pode completar o seu perfil, mas só poderá publicar serviços quando
            a sua conta for aprovada pela equipa ANGROLINK.
          </p>
        </div>
      )}

      {servicos.length === 0 ? (
        <div className="border-2 border-dashed border-border p-6 text-center space-y-3">
          <p className="font-corpo text-sm text-muted-foreground">
            {vendedorPendente
              ? 'A sua conta ainda está em análise. Assim que for aprovada, poderá publicar serviços no marketplace.'
              : 'Ainda não publicaste nenhum serviço.'}
          </p>

          <button
            onClick={irAdicionarServico}
            className="inline-flex items-center gap-2 font-corpo text-sm bg-green-700 text-white px-4 py-2 border-2 border-green-700 hover:bg-green-800 transition-colors rounded-md"
          >
            <PlusCircle size={16} />
            {vendedorPendente ? 'Aguardar aprovação' : 'Publicar primeiro serviço'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servicos.map(servico => {
            const visualizacoes = Number((servico as any).visualizacoes || 0);
            const cliquesWhatsapp = Number((servico as any).cliques_whatsapp || 0);

            return (
              <div
                key={servico.id}
                className="border-2 border-border p-3 flex flex-col sm:flex-row gap-3"
              >
                <div className="w-full sm:w-24 h-20 bg-muted shrink-0">
                  <img
                    src={servico.imagem_url || '/placeholder.png'}
                    alt={servico.nome_servico}
                    className="w-full h-full object-cover"
                    onError={e => {
                      e.currentTarget.src = '/placeholder.png';
                    }}
                  />
                </div>

                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-titulo text-sm">
                      {servico.nome_servico}
                    </span>

                    {servico.destaque && (
                      <Star
                        size={14}
                        className="text-secondary fill-secondary"
                      />
                    )}

                    <span
                      className={`text-[10px] px-2 py-0.5 border ${
                        servico.disponivel
                          ? 'border-green-700 text-green-700 bg-green-50'
                          : 'border-destructive text-destructive bg-destructive/5'
                      }`}
                    >
                      {servico.disponivel ? 'Disponível' : 'Pausado'}
                    </span>

                    {vendedorPendente && (
                      <span className="text-[10px] px-2 py-0.5 border border-yellow-500 text-yellow-700">
                        Aguardando aprovação
                      </span>
                    )}
                  </div>

                  <p className="font-corpo text-xs text-muted-foreground">
                    {servico.tipo_servico || 'Sem tipo'}
                    {' · '}
                    {servico.municipio || 'Sem município'}
                    {' · '}
                    {servico.preco_estimado
                      ? `${Number(servico.preco_estimado).toLocaleString()} Kz`
                      : 'Preço sob consulta'}
                  </p>

                  <div className="flex flex-wrap gap-4 font-corpo text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {visualizacoes} visualizações
                    </span>

                    <span className="flex items-center gap-1">
                      <MessageSquare size={12} />
                      {cliquesWhatsapp} cliques WhatsApp
                    </span>
                  </div>
                </div>

                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => editarServico(servico)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Edit size={12} className="inline mr-1" />
                    Editar
                  </button>

                  <button
                    disabled={atualizandoId === servico.id}
                    onClick={() => toggleDisponibilidade(servico)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                  >
                    {atualizandoId === servico.id
                      ? 'A atualizar...'
                      : servico.disponivel
                        ? 'Pausar'
                        : 'Ativar'}
                  </button>

                  <button
                    disabled={atualizandoId === servico.id}
                    onClick={() => toggleDestaque(servico)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-secondary hover:text-secondary transition-colors disabled:opacity-50"
                  >
                    <Star size={12} className="inline mr-1" />
                    {atualizandoId === servico.id
                      ? 'A atualizar...'
                      : servico.destaque
                        ? 'Remover'
                        : 'Destacar'}
                  </button>

                  <button
                    onClick={() => partilharServico(servico)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-green-700 hover:text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <Share2 size={12} className="inline mr-1" />
                    Partilhar
                  </button>

                  <button
                    disabled={removendoId === servico.id}
                    onClick={() => removerServico(servico.id)}
                    className="font-corpo text-xs border-2 border-border px-3 py-1.5 hover:border-destructive hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={12} className="inline mr-1" />
                    {removendoId === servico.id ? 'A remover...' : 'Remover'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}