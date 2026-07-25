import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import ListaProdutos from '@/componentes/ListaProdutos';
import SeletorMunicipio from '@/componentes/SeletorMunicipio';
import SeletorTipoComprador from '@/componentes/SeletorTipoComprador';

import { useAuth } from '@/contextos/AuthContexto';
import { useMunicipio } from '@/contextos/MunicipioContexto';

import {
  fetchProdutos,
  fetchCategorias,
  guardarHistoricoPesquisa,
} from '@/services/api';
import { Produto } from '@/tipos';
import { TIPOS_VENDEDOR } from '@/dados/constantes';

type Ordenacao = 'recentes' | 'destaque';

export default function PaginaPesquisa() {
  const [searchParams] = useSearchParams();

  const { municipioNome } = useMunicipio();
  const { tipoComprador } = useAuth();

  const termoPesquisa = searchParams.get('q') || '';

  const [categoriaId, setCategoriaId] = useState('');
  const [tipoVendedor, setTipoVendedor] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('recentes');

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // =============================
  // CATEGORIAS
  // =============================
  useEffect(() => {
    async function carregarCategorias() {
      const data = await fetchCategorias();
      setCategorias(data || []);
    }

    carregarCategorias();
  }, []);

  // =============================
  // SINCRONIZAR URL
  // =============================
  useEffect(() => {
    const cat = searchParams.get('categoria');
    if (cat) setCategoriaId(cat);
  }, [searchParams]);

  // =============================
  // FETCH PRODUTOS
  // =============================
  useEffect(() => {
    async function carregarProdutos() {
      try {
        setLoading(true);
        setErro(null);

        const data = await fetchProdutos({
          categoria: categoriaId || undefined,
          tipoComprador,
          pesquisa: termoPesquisa || undefined,
          municipio: municipioNome || undefined,
        });

        setProdutos(Array.isArray(data) ? data : []);

        await guardarHistoricoPesquisa({
          cliente_id: undefined,
          termo: termoPesquisa || null,
          categoria_id: categoriaId || null,
          provincia: null,
          municipio: municipioNome || null,
          tipo_comprador: tipoComprador || null,
        });
      } catch (e) {
        console.error(e);
        setErro('Erro ao carregar produtos');
        setProdutos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarProdutos();
  }, [categoriaId, tipoComprador, termoPesquisa, municipioNome]);

  // =============================
  // FILTROS + ORDENAÇÃO
  // =============================
  const produtosFiltrados = useMemo(() => {
  let resultado = [...produtos];

  const toBool = (v: any) =>
    v === true || v === 'true' || v === 1;

  // =============================
  // FILTRO: TIPO VENDEDOR
  // =============================
  if (tipoVendedor) {
    resultado = resultado.filter(
      p => p.vendedor?.tipo_vendedor === tipoVendedor
    );
  }

  // =============================
  // 🔥 FILTRO REAL DE DESTAQUE
  // =============================
  if (ordenacao === 'destaque') {
    resultado = resultado.filter(p => toBool(p.destaque));
  }

  // =============================
  // ORDENAÇÃO
  // =============================
  resultado = [...resultado].sort((a, b) => {

    // Disponíveis primeiro
    if (a.disponivel !== b.disponivel) {
      return a.disponivel ? -1 : 1;
    }

    // Mais recentes
    return (
      new Date(b.criado_em || 0).getTime() -
      new Date(a.criado_em || 0).getTime()
    );
  });

  console.log("DEBUG FINAL:", resultado.map(p => ({
    nome: p.nome_produto,
    destaque: p.destaque
  })));

  return resultado;

}, [produtos, tipoVendedor, ordenacao]);

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1">

        {/* FILTROS */}
        <section className="border-b-2 py-4">
          <div className="container space-y-3">

            {termoPesquisa && (
              <p>Resultados para: "{termoPesquisa}"</p>
            )}

            <SeletorMunicipio />

            <SeletorTipoComprador />

            <div className="flex flex-wrap gap-3">

              {/* CATEGORIA */}
              <select
                value={categoriaId}
                onChange={e => setCategoriaId(e.target.value)}
                className="border-2 px-3 py-2"
              >
                <option value="">Todas as categorias</option>

                {categorias
                .filter(cat => cat.nome?.toLowerCase().trim() !== 'serviços')
                .map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>

              {/* TIPO VENDEDOR */}
              <select
                value={tipoVendedor}
                onChange={e => setTipoVendedor(e.target.value)}
                className="border-2 px-3 py-2"
              >
                <option value="">Todos os tipos</option>
                {TIPOS_VENDEDOR.map(tipo => (
                  <option key={tipo.valor} value={tipo.valor}>
                    {tipo.rotulo}
                  </option>
                ))}
              </select>

              {/* ORDENAÇÃO */}
              <select
                value={ordenacao}
                onChange={e => setOrdenacao(e.target.value as Ordenacao)}
                className="border-2 px-3 py-2"
              >
                <option value="recentes">Mais recentes</option>
                <option value="destaque">Destaque</option>
              </select>

            </div>

          </div>
        </section>

        {/* RESULTADOS */}
        <section className="py-6">
          <div className="container">

            {loading && <p>A carregar...</p>}
            {erro && <p>{erro}</p>}

            {!loading && !erro && (
              <>
                <p>{produtosFiltrados.length} produtos</p>

                {produtosFiltrados.length === 0 ? (
                  <p>Nenhum produto encontrado</p>
                ) : (
                  <ListaProdutos produtos={produtosFiltrados} />
                )}
              </>
            )}

          </div>
        </section>

      </main>

      <Rodape />
    </div>
  );
}