import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

import {
  fetchCategorias,
  uploadImagemProduto,
  criarProduto
} from '@/services/api';

export default function PaginaCriarProduto() {
  const navigate = useNavigate();

  const { utilizador } = useAuth();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  type TipoVenda = 'retalho' | 'grosso' | 'ambos';
  const [form, setForm] = useState<{
    nome_produto: string;
    descricao: string;
    categoria_id: string;
    preco_aproximado: string;
    unidade: string;
    tipo_venda: TipoVenda;
    municipio: string;
    provincia: string;
    }>({
    nome_produto: '',
    descricao: '',
    categoria_id: '',
    preco_aproximado: '',
    unidade: '',
    tipo_venda: 'retalho',
    municipio: '',
    provincia: ''
  });

  const [imagem, setImagem] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // =============================
  // CARREGAR CATEGORIAS
  // =============================
  useEffect(() => {
    async function load() {
      const data = await fetchCategorias();
      setCategorias(data || []);
    }
    load();
  }, []);

  // =============================
  // PREVIEW IMAGEM
  // =============================
  useEffect(() => {
    if (!imagem) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(imagem);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [imagem]);

  // =============================
  // SUBMIT
  // =============================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 🔥 VALIDAÇÕES CRÍTICAS
    if (!form.nome_produto.trim()) {
      alert('Nome do produto é obrigatório');
      return;
    }

    if (!form.categoria_id) {
      alert('Seleciona uma categoria');
      return;
    }

    const preco = Number(form.preco_aproximado);

    if (!preco || preco <= 0) {
      alert('Preço inválido');
      return;
    }

    try {
      setLoading(true);

      let imagem_url = '';

      // 🔥 UPLOAD IMAGEM (SE EXISTIR)
      if (imagem) {
        try {
          imagem_url = await uploadImagemProduto(imagem);
        } catch (err) {
          console.warn('Erro no upload da imagem:', err);
        }
      }

      if (!utilizador?.vendedor_id) {
        alert('Vendedor não autenticado');
        return;
      }

      // 🔥 CRIAR PRODUTO
      const produto = await criarProduto({
        vendedor_id: utilizador.vendedor_id,
        nome_produto: form.nome_produto,
        descricao: form.descricao,
        categoria_id: form.categoria_id,
        preco_aproximado: preco,
        unidade: form.unidade,
        tipo_venda: form.tipo_venda,
        municipio: form.municipio,
        provincia: form.provincia,
        imagem_url
      });

      // 🔥 REDIRECIONAR
      navigate(`/produto/${produto.id}`);

    } catch (err) {
      console.error('Erro ao criar produto:', err);
      alert('Erro ao criar produto');
    } finally {
      setLoading(false);
    }
  }

  // =============================
  // UI
  // =============================
  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1 container py-6 max-w-xl">
        <h1 className="text-xl font-bold mb-4">
          Criar Produto
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* NOME */}
          <input
            className="w-full border-2 px-3 py-2"
            placeholder="Nome do produto"
            value={form.nome_produto}
            onChange={e =>
              setForm({ ...form, nome_produto: e.target.value })
            }
            required
          />

          {/* DESCRIÇÃO */}
          <textarea
            className="w-full border-2 px-3 py-2"
            placeholder="Descrição"
            value={form.descricao}
            onChange={e =>
              setForm({ ...form, descricao: e.target.value })
            }
          />

          {/* CATEGORIA */}
          <select
            className="w-full border-2 px-3 py-2"
            value={form.categoria_id}
            onChange={e =>
              setForm({ ...form, categoria_id: e.target.value })
            }
            required
          >
            <option value="">Selecionar categoria</option>

            {categorias.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          {/* PREÇO */}
          <input
            type="number"
            className="w-full border-2 px-3 py-2"
            placeholder="Preço"
            value={form.preco_aproximado}
            onChange={e =>
              setForm({ ...form, preco_aproximado: e.target.value })
            }
            required
          />

          {/* UNIDADE */}
          <input
            className="w-full border-2 px-3 py-2"
            placeholder="Unidade (kg, saco, etc)"
            value={form.unidade}
            onChange={e =>
              setForm({ ...form, unidade: e.target.value })
            }
            required
          />

          {/* TIPO VENDA */}
          <select
            className="w-full border-2 px-3 py-2"
            value={form.tipo_venda}
            onChange={e =>
              setForm({ ...form, tipo_venda: e.target.value as TipoVenda })
            }
          >
            <option value="retalho">Retalho</option>
            <option value="grosso">Grosso</option>
            <option value="ambos">Ambos</option>
          </select>

          {/* LOCALIZAÇÃO */}
          <input
            className="w-full border-2 px-3 py-2"
            placeholder="Município"
            value={form.municipio}
            onChange={e =>
              setForm({ ...form, municipio: e.target.value })
            }
          />

          <input
            className="w-full border-2 px-3 py-2"
            placeholder="Província"
            value={form.provincia}
            onChange={e =>
              setForm({ ...form, provincia: e.target.value })
            }
          />

          {/* IMAGEM */}
          <div className="space-y-2">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Escolher imagem
              <input
                type="file"
                accept="image/*"
                onChange={e =>
                  setImagem(e.target.files?.[0] || null)
                }
                className="sr-only"
              />
            </label>

            {preview && (
              <img
                src={preview}
                className="w-40 h-40 object-cover border"
              />
          )}

          {/* BOTÃO */}
          <button
            type="submit"
            disabled={loading}
            className="w-full border-2 py-2 font-medium"
          >
            {loading ? 'A criar...' : 'Criar Produto'}
          </button>

        </form>
      </main>

      <Rodape />
    </div>
  );
}