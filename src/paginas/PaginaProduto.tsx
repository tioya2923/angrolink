import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MessageCircle, ArrowLeft } from 'lucide-react';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import ListaProdutos from '@/componentes/ListaProdutos';


import SeloVendedor from '@/componentes/SeloVendedor';
import { gerarLinkWhatsApp } from '@/lib/whatsapp';
import { obterPromocao } from '@/lib/precos';

import {
  fetchProdutoPorId,
  fetchProdutosRelacionados,
  incrementarVisualizacaoProduto,
  incrementarCliqueWhatsappProduto,
  guardarHistoricoContacto,
  guardarVisualizacaoProduto,
} from '@/services/api';



import { Produto } from '@/tipos';
import { useAuth } from '@/contextos/AuthContexto';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';
import { AcoesCompraProduto } from '@/componentes/carrinho/AcoesCompraProduto';

export default function PaginaProduto() {
  const { id } = useParams<{ id: string }>();
  const { utilizador } = useAuth();

  const [produto, setProduto] = useState<Produto | null>(null);
  const [relacionados, setRelacionados] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [versaoTempoReal, setVersaoTempoReal] = useState(0);

  useAtualizacaoTempoReal(['produtos', 'vendedores', 'categorias'], () => setVersaoTempoReal(v => v + 1));

  useEffect(() => {
    async function carregarProduto() {
      console.log('ID do produto recebido:', id);

      if (!id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      let data: Produto | null = null;

      try {
        data = await fetchProdutoPorId(id);
      } catch (e) {
        console.warn('Erro ao buscar no Supabase:', e);
      }

      if (!data) {
        console.warn('Produto não encontrado:', id);
        setProduto(null);
        setRelacionados([]);
        setLoading(false);
        return;
      }

      setProduto(data);

      // =============================
      // 🔥 BLOQUEIO DE AUTO-TRACKING
      // =============================
      const vendedorDono =
        utilizador?.papel === 'vendedor' &&
        utilizador?.vendedor_id === data.vendedor_id;

      const admin = utilizador?.papel === 'admin';

      console.log("UTILIZADOR:", utilizador);
      console.log("VENDEDOR DONO:", vendedorDono);
      console.log("ADMIN:", admin);
      console.log("ID PRODUTO:", data.id);

      if (data.id.includes('-') && !vendedorDono && !admin) {
        incrementarVisualizacaoProduto(data.id);

        if (utilizador?.id && utilizador?.papel === 'cliente') {
          guardarVisualizacaoProduto({
            cliente_id: utilizador.id,
            produto: data,
          });
        }
      }

      let relacionadosData: Produto[] = [];

      try {
        const categoriaId =
          (data as any).categoria_id ||
          (data as any).categoria?.id;

        if (categoriaId && data.id.includes('-')) {
          relacionadosData = await fetchProdutosRelacionados(
            categoriaId,
            data.id
          );
        }
      } catch (e) {
        console.warn('Erro ao buscar relacionados:', e);
      }

      setRelacionados(relacionadosData);
      setLoading(false);
    }

    carregarProduto();
  }, [id, utilizador?.id, utilizador?.papel, utilizador?.vendedor_id, versaoTempoReal]);
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">
            A carregar produto...
          </p>
        </main>
        <Rodape />
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">
            Produto não encontrado.
          </p>
        </main>
        <Rodape />
      </div>
    );
  }

  const vendedor = (produto as any).vendedor || null;

  const imagem =
    produto.imagem_url ||
    produto.imagem_principal ||
    '/placeholder.png';

  const precoFormatado = new Intl.NumberFormat('pt-AO').format(
    produto.preco_aproximado || 0
  );
  const promocao = obterPromocao(produto.preco_aproximado, produto.preco_promocional);

  // =============================
  // 🔥 CLICK WHATSAPP (CORRIGIDO)
  // =============================
  const handleCliqueWhatsapp = async () => {
    const vendedorDono =
      utilizador?.papel === 'vendedor' &&
      utilizador?.vendedor_id === produto.vendedor_id;
    
    console.log("Clique WhatsApp Produto");

  const admin = utilizador?.papel === 'admin';

  // ❌ NÃO CONTAR INTERAÇÕES DO PRÓPRIO VENDEDOR NEM DO ADMIN
  if (vendedorDono || admin) return;

    // Analytics
    if (produto.id.includes('-')) {
      await incrementarCliqueWhatsappProduto(produto.id);
    }

    // =============================
    // USER LOGADO → BD
    // =============================
    if (utilizador?.id && utilizador?.papel === 'cliente') {
      guardarHistoricoContacto({
        cliente_id: utilizador.id,
        produto,
      });
    }

    // =============================
    // USER NÃO LOGADO → LOCAL
    // =============================
    else if (vendedor) {
      const historicoLocal = JSON.parse(
        localStorage.getItem('historico') || '[]'
      );

      historicoLocal.push({
        produto_id: produto.id,
        nome_produto: produto.nome_produto,
        nome_vendedor: vendedor.nome_comercial,
        telefone: vendedor.telefone_whatsapp,
        data: new Date().toISOString(),
      });

      localStorage.setItem(
        'historico',
        JSON.stringify(historicoLocal)
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1">
        <div className="container py-4">

          <Link
            to="/pesquisa"
            className="inline-flex items-center gap-1 font-corpo text-sm text-muted-foreground hover:text-primary mb-4"
          >
            <ArrowLeft size={16} />
            Voltar aos resultados
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <div className="border-2 border-border overflow-hidden aspect-square">
                <img
                  src={imagem}
                  alt={produto.nome_produto}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.png';
                  }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="font-titulo text-2xl md:text-3xl">
                {produto.nome_produto}
              </h1>

              {promocao ? (
                <div>
                  <span className="inline-block rounded-full bg-destructive px-2 py-1 text-xs font-bold text-destructive-foreground">-{promocao.percentagem}%</span>
                  <p className="mt-2 font-titulo text-3xl text-destructive">{promocao.precoPromocional.toLocaleString('pt-AO')} Kz <span className="ml-2 text-base font-corpo text-muted-foreground">/ {produto.unidade || '-'}</span></p>
                  <p className="font-corpo text-base text-muted-foreground line-through">{promocao.precoOriginal.toLocaleString('pt-AO')} Kz</p>
                </div>
              ) : (
                <p className="font-titulo text-3xl text-primary">{precoFormatado} Kz<span className="text-base font-corpo text-muted-foreground ml-2">/ {produto.unidade || '-'}</span></p>
              )}

              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 ${
                    produto.disponivel ? 'bg-primary' : 'bg-destructive'
                  }`}
                />
                <span className="font-corpo text-sm">
                  {produto.disponivel ? 'Disponível' : 'Indisponível'}
                </span>
              </div>

              <p className="font-corpo text-sm text-muted-foreground">
                {produto.descricao || 'Sem descrição'}
              </p>

              <p className="font-corpo text-sm text-muted-foreground">
                📍 {produto.municipio}, {produto.provincia}
              </p>

              {vendedor && (
                <div className="border-2 border-border p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/vendedor/${vendedor.id}`}
                      className="font-titulo text-sm hover:text-primary"
                    >
                      {vendedor.nome_comercial}
                    </Link>

                    <SeloVendedor vendedor={vendedor} />
                  </div>
                </div>
              )}

              {vendedor && (
                <AcoesCompraProduto produto={produto} vendedorNome={vendedor.nome_comercial} />
              )}

              {vendedor && (
                <a
                  href={gerarLinkWhatsApp(
                    vendedor.telefone_whatsapp,
                    produto.nome_produto
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleCliqueWhatsapp}
                  className="btn-whatsapp w-full flex items-center justify-center gap-2 text-lg border-2 border-foreground"
                >
                  <MessageCircle size={22} />
                  Contactar no WhatsApp
                </a>
              )}
            </div>
          </div>

          {relacionados.length > 0 && (
            <section className="mt-10 pt-6 border-t-2 border-border">
              <ListaProdutos
                produtos={relacionados}
                titulo="Produtos Relacionados"
              />
            </section>
          )}

        </div>
      </main>

      <Rodape />
    </div>
  );
}
