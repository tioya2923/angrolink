/**
 * ========================================
 * BARRA DE PESQUISA COM SUGESTÕES
 * ========================================
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { supabase } from '@/services/supabase';

type SugestaoPesquisa = {
  id: string;
  nome: string;
  tipo: 'produto' | 'servico';
};

interface BarraPesquisaProps {
  grande?: boolean;
}

export default function BarraPesquisa({ grande = false }: BarraPesquisaProps) {
  const [termo, setTermo] = useState('');
  const [sugestoes, setSugestoes] = useState<SugestaoPesquisa[]>([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (!termo.trim()) {
        setSugestoes([]);
        return;
      }

      try {
        setLoading(true);

        const termoLimpo = termo.trim();

        const [produtosRes, servicosRes] = await Promise.all([
          supabase
            .from('produtos')
            .select(`
              id,
              nome_produto,
              vendedor:vendedores!inner(status_aprovacao)
            `)
            .ilike('nome_produto', `%${termoLimpo}%`)
            .eq('disponivel', true)
            .eq('publicado', true)
            .eq('vendedor.status_aprovacao', 'aprovado')
            .limit(5),

          supabase
            .from('servicos')
            .select(`
              id,
              nome_servico,
              vendedor:vendedores!inner(status_aprovacao)
            `)
            .ilike('nome_servico', `%${termoLimpo}%`)
            .eq('disponivel', true)
            .eq('publicado', true)
            .eq('vendedor.status_aprovacao', 'aprovado')
            .limit(5),
        ]);

        if (produtosRes.error) {
          console.error('Erro ao buscar sugestões de produtos:', produtosRes.error);
        }

        if (servicosRes.error) {
          console.error('Erro ao buscar sugestões de serviços:', servicosRes.error);
        }

        const sugestoesProdutos: SugestaoPesquisa[] = (produtosRes.data || []).map(
          (p: any) => ({
            id: p.id,
            nome: p.nome_produto,
            tipo: 'produto',
          })
        );

        const sugestoesServicos: SugestaoPesquisa[] = (servicosRes.data || []).map(
          (s: any) => ({
            id: s.id,
            nome: s.nome_servico,
            tipo: 'servico',
          })
        );

        setSugestoes([...sugestoesProdutos, ...sugestoesServicos].slice(0, 8));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [termo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (termo.trim()) {
      navigate(`/pesquisa?q=${encodeURIComponent(termo.trim())}`);
      setSugestoes([]);
    }
  };

  const handleSelect = (sugestao: SugestaoPesquisa) => {
    if (sugestao.tipo === 'produto') {
      navigate(`/produto/${sugestao.id}`);
    } else {
      navigate(`/servico/${sugestao.id}`);
    }

    setSugestoes([]);
    setTermo('');
  };

  return (
    <div className={`relative ${grande ? 'max-w-2xl mx-auto' : ''}`}>
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={termo}
          onChange={e => setTermo(e.target.value)}
          placeholder="Pesquisar produtos ou serviços..."
          className={`w-full bg-background text-foreground font-corpo focus:outline-none transition-colors ${
            grande
              ? 'rounded-full border-2 border-transparent text-sm px-5 py-2.5 focus:border-secondary'
              : 'border-2 border-border text-sm px-4 py-3 pr-12 focus:border-green-700'
          }`}
        />

        <button
          type="submit"
          className={
            grande
              ? '-ml-11 my-0.5 mr-0.5 flex items-center justify-center w-9 rounded-full bg-green-700 text-white hover:bg-green-800 transition-colors'
              : 'absolute right-0 top-0 h-full px-4 text-foreground hover:text-green-700 transition-colors'
          }
        >
          <Search size={grande ? 16 : 20} />
        </button>
      </form>

      {sugestoes.length > 0 && (
        <div className="absolute z-50 w-full bg-background border-2 border-border mt-1 shadow-lg rounded-md overflow-hidden">
          {sugestoes.map(s => (
            <button
              key={`${s.tipo}-${s.id}`}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2 text-sm text-black hover:bg-green-50 transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate">{s.nome}</span>

              <span className="text-[10px] uppercase border border-green-700 text-green-700 px-2 py-0.5">
                {s.tipo === 'produto' ? 'Produto' : 'Serviço'}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute right-16 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          ...
        </div>
      )}
    </div>
  );
}