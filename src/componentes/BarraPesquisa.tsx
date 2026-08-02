import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useSugestoesPesquisaQuery } from '@/hooks/useCatalogoQuery';
import type { SugestaoPesquisa } from '@/services/api';

interface BarraPesquisaProps {
  grande?: boolean;
}

export default function BarraPesquisa({ grande = false }: BarraPesquisaProps) {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = window.setTimeout(() => setTermoDebounced(termo.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [termo]);

  const { data: sugestoes = [], isFetching: loading } = useSugestoesPesquisaQuery(
    termoDebounced,
    Boolean(termoDebounced),
  );

  const limparSugestoes = () => setTermoDebounced('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!termo.trim()) return;
    navigate(`/pesquisa?q=${encodeURIComponent(termo.trim())}`);
    limparSugestoes();
  };

  const handleSelect = (sugestao: SugestaoPesquisa) => {
    navigate(`/${sugestao.tipo}/${sugestao.id}`);
    setTermo('');
    limparSugestoes();
  };

  return (
    <div className={`relative ${grande ? 'max-w-2xl mx-auto' : ''}`}>
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={termo}
          onChange={event => setTermo(event.target.value)}
          placeholder="Pesquisar produtos ou serviços..."
          className={`w-full bg-background text-foreground font-corpo focus:outline-none transition-colors ${
            grande
              ? 'rounded-full border-2 border-transparent text-sm px-5 py-2.5 focus:border-secondary'
              : 'border-2 border-border text-sm px-4 py-3 pr-12 focus:border-green-700'
          }`}
        />
        <button
          type="submit"
          aria-label="Pesquisar"
          className={grande
            ? '-ml-11 my-0.5 mr-0.5 flex items-center justify-center w-9 rounded-full bg-green-700 text-white hover:bg-green-800 transition-colors'
            : 'absolute right-0 top-0 h-full px-4 text-foreground hover:text-green-700 transition-colors'}
        >
          <Search size={grande ? 16 : 20} />
        </button>
      </form>

      {sugestoes.length > 0 && (
        <div className="absolute z-50 w-full bg-background border-2 border-border mt-1 shadow-lg rounded-md overflow-hidden">
          {sugestoes.map(sugestao => (
            <button
              key={`${sugestao.tipo}-${sugestao.id}`}
              onClick={() => handleSelect(sugestao)}
              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-green-50 transition-colors flex items-center justify-between gap-2"
            >
              <span className="truncate">{sugestao.nome}</span>
              <span className="text-[10px] uppercase border border-green-700 text-green-700 px-2 py-0.5">
                {sugestao.tipo === 'produto' ? 'Produto' : 'Serviço'}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute right-16 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">...</div>
      )}
    </div>
  );
}
