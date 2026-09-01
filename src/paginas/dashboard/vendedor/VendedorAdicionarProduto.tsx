/**
 * Vendedor — Formulário para adicionar produto
 * ✔ Mantém design original
 * ✔ Upload real de imagem
 * ✔ Integração com Supabase
 * ✔ Mantém categorias e subcategorias antigas no formulário
 * ✔ Converte categoria antiga para UUID real antes de gravar na BD
 * ✔ Bloqueia publicação para vendedores ainda não aprovados
 */

import { useCallback, useEffect, useState } from 'react';
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import { CircleDollarSign, ImagePlus, MapPin, Package2, PlusCircle, Truck } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

import {
  CATEGORIAS,
  UNIDADES,
  TIPOS_VENDA,
} from '@/dados/constantes';

import { SUBCATEGORIAS } from '@/dados/subcategorias';
import { useToast } from '@/hooks/use-toast';

import {
  criarProduto,
  uploadImagemProduto,
  fetchCategorias,
  fetchProdutoParaEdicao,
  updateProduto,
  deleteImagemProdutoPorUrl,
} from "@/services/api";

import { useAuth } from '@/contextos/AuthContexto';
import { useFiltroTerritorialAngola } from '@/hooks/useFiltroTerritorialAngola';
import { resolverSelecaoTerritorialExistente } from '@/services/territorioAngola';
import {
  normalizarAtributosLogisticosProduto,
  opcaoTriStateParaValor,
  type OpcaoTriState,
} from '@/dominio/logisticaProduto';
import {
  definirInventarioProdutoVendedor,
  erroUnidadeProdutoComReservas,
  mensagemErroInventario,
  obterInventarioProdutoVendedor,
  quantidadeDecimalPositiva,
  validarQuantidadeInventario,
  type InventarioProdutoVendedor,
} from '@/services/inventarioProduto';

export default function VendedorAdicionarProduto() {
  const navigate = useNavigate();

  const { id } = useParams();

  const { toast } = useToast();

  const { utilizador } = useAuth();

  const [produtoEditando, setProdutoEditando] = useState<any>(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(!!id);


  const isEdit = !!id;

  const vendedorAprovado =
    utilizador?.papel === 'vendedor' &&
    utilizador?.status_aprovacao === 'aprovado';
  const contaSuspensa = utilizador?.status_aprovacao === 'suspenso';

  const vendedorIdValido =
    utilizador?.papel === 'vendedor' &&
    !!utilizador?.vendedor_id;

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('');
  const [subcategoria, setSubcategoria] = useState('');
  const [categoriasDb, setCategoriasDb] = useState<any[]>([]);

  const [preco, setPreco] = useState('');
  const [precoPromocional, setPrecoPromocional] = useState('');
  const [unidade, setUnidade] = useState('kg');

  const [tipoVenda, setTipoVenda] =
    useState<'retalho' | 'grosso' | 'ambos'>('retalho');

  const [quantidadeMinima, setQuantidadeMinima] = useState('1');
  const [descricao, setDescricao] = useState('');
  const [disponivel, setDisponivel] = useState(true);
  const [pesoPorUnidade, setPesoPorUnidade] = useState('');
  const [volumePorUnidade, setVolumePorUnidade] = useState('');
  const [refrigeracao, setRefrigeracao] = useState<OpcaoTriState>('indefinido');
  const [caixaCarga, setCaixaCarga] = useState<OpcaoTriState>('indefinido');
  const [paletes, setPaletes] = useState<OpcaoTriState>('indefinido');

  const filtroTerritorial = useFiltroTerritorialAngola();
  const { definirSelecao } = filtroTerritorial;
  const [provinciaOriginal, setProvinciaOriginal] = useState<string | null>(null);
  const [municipioOriginal, setMunicipioOriginal] = useState<string | null>(null);
  const [territorioAlterado, setTerritorioAlterado] = useState(false);
  const [removerImagem, setRemoverImagem] = useState(false);
  const [inventario, setInventario] = useState<InventarioProdutoVendedor | null>(null);
  const [aCarregarInventario, setACarregarInventario] = useState(false);
  const [erroInventario, setErroInventario] = useState<string | null>(null);
  const [controloStockAtivo, setControloStockAtivo] = useState(false);
  const [quantidadeFisicaStock, setQuantidadeFisicaStock] = useState('');
  const [aGuardarInventario, setAGuardarInventario] = useState(false);

  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);

  const normalizarTexto = (texto: string) =>
    texto
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const inicializarTerritorio = useCallback(async (provinciaTexto: string | null, municipioTexto: string | null) => {
    setProvinciaOriginal(provinciaTexto);
    setMunicipioOriginal(municipioTexto);
    setTerritorioAlterado(false);

    try {
      const resultado = await resolverSelecaoTerritorialExistente(provinciaTexto, municipioTexto);
      definirSelecao(resultado.provincia?.id ?? '', resultado.municipio?.id ?? '');
    } catch {
      definirSelecao('', '');
    }
  }, [definirSelecao]);

  useEffect(() => {
    if (!id || !utilizador?.vendedor_id) {
      setCarregandoEdicao(false);
      return;
    }

    async function carregarProduto() {
      console.log("ID DA URL:", id);

      const produto = await fetchProdutoParaEdicao(id, utilizador.vendedor_id);

      console.log("PRODUTO ENCONTRADO:", produto);

      if (!produto) {
        toast({
          title: "Produto não encontrado",
          description: "Não foi possível carregar este produto.",
          variant: "destructive",
        });

        navigate("/dashboard/produtos");
        setCarregandoEdicao(false);
        return;
      }

      setProdutoEditando(produto);
      setProvinciaOriginal(produto.provincia ?? null);
      setMunicipioOriginal(produto.municipio ?? null);
      setCarregandoEdicao(false);
    }

    carregarProduto();
  }, [id, navigate, toast, utilizador?.vendedor_id]);

  useEffect(() => {
    async function carregarCategorias() {
      const data = await fetchCategorias();
      setCategoriasDb(data || []);

      if (produtoEditando && data) {
        setNome(produtoEditando.nome_produto || '');
        setDescricao(produtoEditando.descricao || '');
        setPreco(String(produtoEditando.preco_aproximado || ''));
        setPrecoPromocional(
          produtoEditando.preco_promocional
            ? String(produtoEditando.preco_promocional)
            : ''
        );
        const unidadeDoProduto = produtoEditando.unidade || 'kg';
        setUnidade(unidadeDoProduto);
        setPesoPorUnidade(
          unidadeDoProduto === 'kg' || produtoEditando.peso_por_unidade_comercial_kg == null
            ? ''
            : String(produtoEditando.peso_por_unidade_comercial_kg),
        );
        setVolumePorUnidade(
          produtoEditando.volume_por_unidade_comercial_m3 == null
            ? ''
            : String(produtoEditando.volume_por_unidade_comercial_m3),
        );
        setRefrigeracao(opcaoTriStateParaValor(produtoEditando.requer_refrigeracao));
        setCaixaCarga(opcaoTriStateParaValor(produtoEditando.requer_caixa_carga));
        setPaletes(opcaoTriStateParaValor(produtoEditando.requer_paletes));
        setTipoVenda(produtoEditando.tipo_venda || 'retalho');
        setQuantidadeMinima(String(produtoEditando.quantidade_minima || 1));
        void inicializarTerritorio(produtoEditando.provincia, produtoEditando.municipio);
        setDisponivel(produtoEditando.disponivel ?? true);

        const categoriaDb = data.find(
          (c: any) => c.id === produtoEditando.categoria_id
        );

        if (categoriaDb) {
          const categoriaMock = CATEGORIAS.find(
            c =>
              normalizarTexto(c.nome_categoria) ===
              normalizarTexto(categoriaDb.nome)
          );

          if (categoriaMock) {
            setCategoria(categoriaMock.id);
          }
        }

        if (produtoEditando.imagem_url) {
          setImagemPreview(produtoEditando.imagem_url);
        }
      }
    }

    carregarCategorias();
  }, [inicializarTerritorio, produtoEditando]);

  useEffect(() => {
    if (!produtoEditando) return;
    if (!categoria) return;

    setSubcategoria(produtoEditando.subcategoria || '');
  }, [produtoEditando, categoria]);

  const carregarInventario = useCallback(async () => {
    if (!isEdit || !produtoEditando?.id) return;

    setACarregarInventario(true);
    setErroInventario(null);
    try {
      const dados = await obterInventarioProdutoVendedor(produtoEditando.id);
      setInventario(dados);
      setControloStockAtivo(dados.controloAtivo);
      setQuantidadeFisicaStock(dados.quantidadeFisica === null ? '' : String(dados.quantidadeFisica));
    } catch (erro) {
      setErroInventario(mensagemErroInventario(erro));
    } finally {
      setACarregarInventario(false);
    }
  }, [isEdit, produtoEditando?.id]);

  useEffect(() => {
    void carregarInventario();
  }, [carregarInventario]);

  const subcategoriasFiltradas = categoria
    ? SUBCATEGORIAS[categoria] || []
    : [];

  const handleCategoriaChange = (val: string) => {
    setCategoria(val);
    setSubcategoria('');
  };

  const handleUnidadeChange = (novaUnidade: string) => {
    setUnidade(novaUnidade);
    if (novaUnidade === 'kg') setPesoPorUnidade('');
  };

  const guardarInventario = async () => {
    if (!produtoEditando?.id || aGuardarInventario) return;

    const quantidade = validarQuantidadeInventario(quantidadeFisicaStock);
    if (quantidade === null) {
      setErroInventario('Indique uma quantidade física válida, não negativa e com no máximo três casas decimais.');
      return;
    }

    setAGuardarInventario(true);
    setErroInventario(null);
    try {
      const atualizado = await definirInventarioProdutoVendedor({
        produtoId: produtoEditando.id,
        controloAtivo: controloStockAtivo,
        quantidadeFisica: quantidade,
      });
      const comUnidade = { ...atualizado, unidade: atualizado.unidade || inventario?.unidade || unidade || 'unidade' };
      setInventario(comUnidade);
      setControloStockAtivo(comUnidade.controloAtivo);
      setQuantidadeFisicaStock(comUnidade.quantidadeFisica === null ? '' : String(comUnidade.quantidadeFisica));
      toast({ title: 'Inventário atualizado', description: 'O controlo de stock foi guardado com sucesso.' });
    } catch (erro) {
      setErroInventario(mensagemErroInventario(erro));
    } finally {
      setAGuardarInventario(false);
    }
  };

  const obterCategoriaDbId = () => {
    const categoriaMock = CATEGORIAS.find(c => c.id === categoria);

    if (!categoriaMock) return null;

    const nomeCategoriaMock = normalizarTexto(categoriaMock.nome_categoria);

    const categoriaDb = categoriasDb.find(c =>
      normalizarTexto(c.nome || '') === nomeCategoriaMock
    );

    return categoriaDb?.id || null;
  };

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: 'Imagem demasiado grande',
        description: 'Máximo 3MB',
        variant: 'destructive',
      });
      return;
    }

    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];

    if (!tiposPermitidos.includes(file.type)) {
      toast({
        title: 'Formato inválido',
        description: 'Use JPG, PNG ou WEBP.',
        variant: 'destructive',
      });
      return;
    }

    setImagemFile(file);
    setRemoverImagem(false);

    const reader = new FileReader();

    reader.onload = () => {
      setImagemPreview(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 🔒 BLOQUEIO — vendedor não aprovado não cria nem edita produtos
    if (
      utilizador?.papel === 'vendedor' &&
      utilizador?.status_aprovacao !== 'aprovado'
    ) {
      toast({
        title: contaSuspensa ? 'Conta suspensa' : 'Conta em análise',
        description: contaSuspensa
          ? 'A sua conta está suspensa. Não é possível publicar nem editar produtos até à reativação.'
          : 'A sua conta de vendedor ainda está em revisão. Só poderá publicar ou editar produtos quando for aprovada pela equipa ANGROLINK.',
        variant: 'destructive',
      });
      return;
    }

    // 🔒 BLOQUEIO 2 — segurança (evita produto órfão)
    if (utilizador?.papel === 'vendedor' && !vendedorIdValido) {
      toast({
        title: 'Erro de conta',
        description:
          'Não foi possível identificar o vendedor. Faça login novamente.',
        variant: 'destructive',
      });
      return;
    }

    if (!nome.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' });
      return;
    }

    if (!categoria) {
      toast({ title: 'Seleciona categoria', variant: 'destructive' });
      return;
    }

    if (!subcategoria) {
      toast({
        title: 'Seleciona subcategoria',
        variant: 'destructive',
      });
      return;
    }

    const categoriaDbId = obterCategoriaDbId();

    if (!categoriaDbId) {
      toast({
        title: 'Categoria inválida',
        description: 'Esta categoria ainda não existe no Supabase.',
        variant: 'destructive',
      });
      return;
    }

    if (!quantidadeMinima || Number(quantidadeMinima) < 1) {
      toast({
        title: 'Quantidade mínima inválida',
        description: 'Deve ser pelo menos 1',
        variant: 'destructive',
      });
      return;
    }

    if (!preco || Number(preco) <= 0) {
      toast({
        title: 'Preço inválido',
        variant: 'destructive',
      });
      return;
    }

    if (
      precoPromocional &&
      (Number(precoPromocional) <= 0 || Number(precoPromocional) >= Number(preco))
    ) {
      toast({
        title: 'Preço promocional inválido',
        description: 'Deve ser positivo e inferior ao preço normal',
        variant: 'destructive',
      });
      return;
    }

    if (!utilizador?.vendedor_id) {
      toast({
        title: 'Vendedor inválido',
        description: 'Não foi possível identificar o vendedor ativo.',
        variant: 'destructive',
      });
      return;
    }

    const atributosLogisticos = normalizarAtributosLogisticosProduto({
      unidade,
      pesoPorUnidade,
      volumePorUnidade,
      refrigeracao,
      caixaCarga,
      paletes,
    });
    if (atributosLogisticos.valido === false) {
      toast({ title: 'Informações para entrega inválidas', description: atributosLogisticos.mensagem, variant: 'destructive' });
      return;
    }

    const provinciaSelecionada = filtroTerritorial.provinciaSelecionada;
    const municipioSelecionado = filtroTerritorial.municipioSelecionado;
    const usarNomeCanonico = !isEdit || territorioAlterado;
    if (usarNomeCanonico && (!provinciaSelecionada || !municipioSelecionado)) {
      toast({ title: 'Selecione uma província e um município válidos.', variant: 'destructive' });
      return;
    }

    try {
      // 🔥 CORREÇÃO — não perder imagem existente
      let imagem_url = produtoEditando?.imagem_url || '';

      if (imagemFile) {
        imagem_url = await uploadImagemProduto(imagemFile);
      }

      const dadosProduto = {
        vendedor_id: utilizador?.vendedor_id,
        nome_produto: nome,
        descricao,
        categoria_id: categoriaDbId,
        subcategoria,
        preco_aproximado: Number(preco),
        preco_promocional: precoPromocional ? Number(precoPromocional) : null,
        unidade,
        tipo_venda: tipoVenda,
        municipio: usarNomeCanonico ? municipioSelecionado?.nome ?? null : municipioOriginal,
        provincia: usarNomeCanonico ? provinciaSelecionada?.nome ?? null : provinciaOriginal,
        imagem_url: removerImagem
          ? null
          : imagem_url || null,
        quantidade_minima: Number(quantidadeMinima),
        disponivel,
        ...atributosLogisticos.atributos,
      };

      if (isEdit) {
        if (removerImagem && produtoEditando?.imagem_url) {
          await deleteImagemProdutoPorUrl(produtoEditando.imagem_url);
        }

        await updateProduto(produtoEditando.id, dadosProduto);

        toast({
          title: 'Produto atualizado!',
          description: 'As alterações foram guardadas com sucesso.',
        });
      } else {
        await criarProduto(dadosProduto);

        toast({
          title: 'Produto publicado!',
          description: 'Já está no marketplace 🔥',
        });
      }

      navigate('/dashboard/produtos');
    } catch (err) {
      console.error(err);

      const unidadeBloqueada = isEdit && erroUnidadeProdutoComReservas(err);

      toast({
        title: unidadeBloqueada ? 'Unidade bloqueada por reservas' : isEdit ? 'Erro ao atualizar produto' : 'Erro ao criar produto',
        description:
          unidadeBloqueada
            ? 'Não é possível alterar a unidade enquanto existirem quantidades reservadas. Aguarde a libertação das reservas antes de tentar novamente.'
            : utilizador?.status_aprovacao !== 'aprovado'
            ? 'A tua conta ainda não foi aprovada.'
            : 'Verifica os dados e tenta novamente.',
        variant: 'destructive',
      });
    }
  };

  if (isEdit && carregandoEdicao) {
    return <div className="painel-dashboard-form font-corpo text-sm text-muted-foreground">A carregar dados do produto...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">{isEdit ? 'Editar produto' : 'Adicionar produto'}</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">{isEdit ? 'Atualiza os dados do anúncio e guarda as alterações.' : 'Preenche os dados para publicar um novo produto.'}</p>
      </header>

      {!isEdit && utilizador?.papel === 'vendedor' && !vendedorAprovado && (
        <div className={`border-2 p-4 rounded-md ${contaSuspensa ? 'border-red-300 bg-red-50' : 'border-yellow-500/40 bg-yellow-500/10'}`}>
          <p className="font-corpo text-sm font-semibold">
            {contaSuspensa ? 'Conta suspensa' : 'Conta em análise'}
          </p>
          <p className="font-corpo text-xs text-muted-foreground mt-1">
            {contaSuspensa
              ? 'Não é possível publicar nem editar produtos até a conta ser reativada.'
              : 'Pode completar o seu perfil, mas só poderá publicar produtos quando a sua conta for aprovada pela equipa ANGROLINK.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="painel-dashboard-form formulario-publicacao">
        <div className="formulario-publicacao-titulo">
          <span className="formulario-publicacao-icone"><Package2 className="size-5" /></span>
          <div>
            <h2 className="font-titulo text-base font-bold">Informações do produto</h2>
            <p className="font-corpo text-xs text-muted-foreground">Começa pelos detalhes que ajudam o cliente a encontrar o teu anúncio.</p>
          </div>
          <span className="ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold">Passo 1 de 3</span>
        </div>
        <div className="space-y-2">
          <Label className="font-corpo text-sm">Nome do produto *</Label>

          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            required
            className="border-2 border-border"
            placeholder="Ex: Tomate Cereja Fresco"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="font-corpo text-sm">Categoria *</Label>

            <select
              value={categoria}
              onChange={e => handleCategoriaChange(e.target.value)}
              required
              className="w-full border-2 border-border px-3 py-2"
            >
              <option value="">Selecionar</option>

              {CATEGORIAS.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome_categoria}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Subcategoria *</Label>

            <select
              value={subcategoria}
              required
              onChange={e => setSubcategoria(e.target.value)}
              disabled={!categoria}
              className="w-full border-2 border-border px-3 py-2"
            >
              <option value="">
                {categoria ? 'Selecionar' : 'Escolha categoria primeiro'}
              </option>

              {subcategoriasFiltradas.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="formulario-publicacao-titulo pt-2">
          <span className="formulario-publicacao-icone"><CircleDollarSign className="size-5" /></span>
          <div><h2 className="font-titulo text-base font-bold">Venda e apresentação</h2><p className="font-corpo text-xs text-muted-foreground">Define o preço, a quantidade e adiciona uma imagem atrativa.</p></div>
          <span className="ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold">Passo 2 de 3</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Preço (Kz) *</Label>

            <Input
              type="number"
              min="1"
              step="1"
              value={preco}
              onChange={e => setPreco(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Preço promocional (Kz)</Label>

            <Input
              type="number"
              min="1"
              step="1"
              value={precoPromocional}
              onChange={e => setPrecoPromocional(e.target.value)}
              placeholder="Opcional — inferior ao preço normal"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Unidade *</Label>

            <select
              value={unidade}
              onChange={e => handleUnidadeChange(e.target.value)}
              className="w-full border-2 px-3 py-2"
            >
              {UNIDADES.map(u => (
                <option key={u.valor} value={u.valor}>
                  {u.rotulo}
                </option>
              ))}
            </select>
            {isEdit
              && produtoEditando?.unidade !== unidade
              && quantidadeDecimalPositiva(inventario?.quantidadeReservada) && (
                <p className="text-xs text-amber-700">
                  Existem quantidades reservadas. A alteração da unidade será bloqueada até essas reservas serem libertadas.
                </p>
              )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Tipo de venda *</Label>

            <select
              value={tipoVenda}
              onChange={e =>
                setTipoVenda(e.target.value as 'retalho' | 'grosso' | 'ambos')
              }
              className="w-full border-2 px-3 py-2"
            >
              {TIPOS_VENDA.map(t => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Quantidade mínima *</Label>

            <Input
              type="number"
              min="1"
              step="1"
              value={quantidadeMinima}
              onChange={e => setQuantidadeMinima(e.target.value)}
            />
          </div>
        </div>

        <section className="space-y-4 rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Truck className="size-5" /></span>
            <div>
              <h2 className="font-titulo text-base font-bold">Informações para entrega</h2>
              <p className="font-corpo text-xs text-muted-foreground">Opcional: estes dados ajudam a organizar futuras entregas. Se ainda não souber, pode deixar como “Não definido”.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="peso-por-unidade">{unidade === 'kg' ? 'Peso do produto' : `Peso aproximado por ${unidade}`}</Label>
              {unidade === 'kg' ? (
                <p id="peso-por-unidade" className="rounded-md border border-dashed border-primary/30 bg-background/70 px-3 py-2 text-sm text-muted-foreground">O peso será calculado automaticamente pela quantidade em kg.</p>
              ) : (
                <Input id="peso-por-unidade" type="number" min="0.001" step="0.001" inputMode="decimal" value={pesoPorUnidade} onChange={e => setPesoPorUnidade(e.target.value)} placeholder="Ex.: 2,5 kg" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="volume-por-unidade">Volume aproximado por {unidade} (m³)</Label>
              <Input id="volume-por-unidade" type="number" min="0.000001" step="0.000001" inputMode="decimal" value={volumePorUnidade} onChange={e => setVolumePorUnidade(e.target.value)} placeholder="Opcional · Ex.: 0,03" />
              <p className="text-xs text-muted-foreground">Se não souber o volume, deixe vazio.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="refrigeracao">Precisa de transporte refrigerado?</Label>
              <select id="refrigeracao" value={refrigeracao} onChange={e => setRefrigeracao(e.target.value as OpcaoTriState)} className="w-full border-2 border-border bg-background px-3 py-2">
                <option value="indefinido">Não sei / ainda não definido</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="caixa-carga">Precisa de veículo com caixa de carga?</Label>
              <select id="caixa-carga" value={caixaCarga} onChange={e => setCaixaCarga(e.target.value as OpcaoTriState)} className="w-full border-2 border-border bg-background px-3 py-2">
                <option value="indefinido">Não sei / ainda não definido</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paletes">Precisa de transporte compatível com paletes?</Label>
              <select id="paletes" value={paletes} onChange={e => setPaletes(e.target.value as OpcaoTriState)} className="w-full border-2 border-border bg-background px-3 py-2">
                <option value="indefinido">Não sei / ainda não definido</option><option value="sim">Sim</option><option value="nao">Não</option>
              </select>
            </div>
          </div>
        </section>

        <div className="space-y-2">
          <Label>Descrição</Label>

          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="w-full border-2 px-3 py-2"
          />
        </div>

        <div className="space-y-2">
          <Label>Imagem principal</Label>

          <div className="area-imagem-publicacao">
            {imagemPreview ? (
              <>
                <img
                  src={imagemPreview}
                  alt="Pré-visualização do produto"
                  className="w-32 mx-auto"
                />

                <button
                  type="button"
                  onClick={() => {
                    setImagemPreview(null);
                    setImagemFile(null);
                    setRemoverImagem(true);
                  }}
                  className="mt-2 text-sm text-destructive hover:underline"
                >
                  Remover
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><ImagePlus className="size-5" /></span>
                <input
                  id="imagem-produto"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImagemChange}
                  className="sr-only"
                />
                <label
                  htmlFor="imagem-produto"
                  className="cursor-pointer rounded-md border-2 border-primary bg-primary px-4 py-2 font-corpo text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Escolher imagem
                </label>
                <p className="font-corpo text-xs text-muted-foreground">
                  Nenhuma imagem selecionada · JPG, PNG ou WEBP (máximo 3 MB)
                </p>
              </div>
            )}
          </div>
        </div>

        {isEdit ? (
          <section aria-labelledby="inventario-titulo" className="space-y-4 rounded-xl border-2 border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="inventario-titulo" className="font-titulo text-lg font-bold">Inventário</h2>
                <p className="font-corpo text-sm text-muted-foreground">
                  Controle a quantidade física sem expor reservas individuais.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 font-corpo text-xs font-semibold ${controloStockAtivo ? 'bg-primary/15 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                {controloStockAtivo ? 'Controlo ativo' : 'Modo legado'}
              </span>
            </div>

            {aCarregarInventario ? (
              <p className="font-corpo text-sm text-muted-foreground">A carregar inventário...</p>
            ) : erroInventario && !inventario ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-corpo text-sm text-destructive">
                <span>{erroInventario}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void carregarInventario()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 font-corpo text-sm">
                  <input
                    type="checkbox"
                    checked={controloStockAtivo}
                    disabled={aGuardarInventario}
                    onChange={e => {
                      setControloStockAtivo(e.target.checked);
                      if (e.target.checked && !quantidadeFisicaStock) setQuantidadeFisicaStock('0');
                    }}
                    className="mt-0.5 size-4 accent-green-700"
                  />
                  <span>
                    <strong className="block">Ativar controlo quantitativo de stock</strong>
                    <span className="text-muted-foreground">
                      {controloStockAtivo
                        ? 'A disponibilidade é calculada a partir do stock físico menos a quantidade reservada.'
                        : 'Este produto mantém o modo legado e não controla disponibilidade quantitativa automaticamente.'}
                    </span>
                  </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="quantidade-fisica-stock">Stock físico ({inventario?.unidade || unidade})</Label>
                    <Input
                      id="quantidade-fisica-stock"
                      type="text"
                      inputMode="decimal"
                      value={quantidadeFisicaStock}
                      disabled={!controloStockAtivo || aGuardarInventario}
                      onChange={e => setQuantidadeFisicaStock(e.target.value)}
                      placeholder="0"
                      aria-describedby="ajuda-quantidade-stock"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2 font-corpo text-sm">
                    <span className="block text-xs text-muted-foreground">Reservado</span>
                    <strong>{inventario?.quantidadeReservada === null || inventario?.quantidadeReservada === undefined ? '—' : `${inventario.quantidadeReservada} ${inventario.unidade}`}</strong>
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2 font-corpo text-sm">
                    <span className="block text-xs text-muted-foreground">Disponível</span>
                    <strong>{inventario?.quantidadeDisponivel === null || inventario?.quantidadeDisponivel === undefined ? '—' : `${inventario.quantidadeDisponivel} ${inventario.unidade}`}</strong>
                  </div>
                </div>
                <p id="ajuda-quantidade-stock" className="font-corpo text-xs text-muted-foreground">
                  Use valores não negativos, com no máximo três casas decimais. A quantidade reservada e a disponível são apenas para consulta.
                </p>
                {erroInventario && <p role="alert" className="font-corpo text-sm text-destructive">{erroInventario}</p>}
                <Button type="button" onClick={() => void guardarInventario()} disabled={aGuardarInventario} variant="outline">
                  {aGuardarInventario ? 'A guardar inventário...' : 'Guardar inventário'}
                </Button>
              </>
            )}
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-border bg-muted/20 p-4 font-corpo text-sm text-muted-foreground">
            <strong className="block text-foreground">Inventário quantitativo</strong>
            Depois de criar o produto, poderá configurar o stock físico e a disponibilidade quantitativa na edição.
          </section>
        )}

        <div className="formulario-publicacao-titulo pt-2">
          <span className="formulario-publicacao-icone"><MapPin className="size-5" /></span>
          <div><h2 className="font-titulo text-base font-bold">Localização e publicação</h2><p className="font-corpo text-xs text-muted-foreground">Indica onde o produto está disponível.</p></div>
          <span className="ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold">Passo 3 de 3</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={filtroTerritorial.provinciaId}
            disabled={filtroTerritorial.aCarregarProvincias}
            onChange={e => {
              setTerritorioAlterado(true);
              filtroTerritorial.selecionarProvincia(e.target.value);
            }}
            className="w-full border-2 px-3 py-2"
          >
            <option value="">{filtroTerritorial.aCarregarProvincias ? 'A carregar províncias...' : 'Selecione a província'}</option>

            {filtroTerritorial.provincias.map(p => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>

          <select
            value={filtroTerritorial.municipioId}
            onChange={e => { setTerritorioAlterado(true); filtroTerritorial.selecionarMunicipio(e.target.value); }}
            disabled={!filtroTerritorial.provinciaId || filtroTerritorial.aCarregarMunicipios || Boolean(filtroTerritorial.erroMunicipios)}
            className="w-full border-2 px-3 py-2"
          >
            <option value="">
              {!filtroTerritorial.provinciaId ? 'Selecione primeiro a província' : filtroTerritorial.aCarregarMunicipios ? 'A carregar municípios...' : 'Selecione o município'}
            </option>

            {filtroTerritorial.municipios.map(m => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        {filtroTerritorial.erroProvincias && <p className="text-xs text-destructive">{filtroTerritorial.erroProvincias} <button type="button" onClick={() => void filtroTerritorial.carregarProvincias()} className="font-semibold underline">Tentar novamente</button></p>}
        {filtroTerritorial.erroMunicipios && <p className="text-xs text-destructive">{filtroTerritorial.erroMunicipios} <button type="button" onClick={filtroTerritorial.recarregarMunicipios} className="font-semibold underline">Tentar novamente</button></p>}

        <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3 font-corpo text-sm font-medium">
          <input
            type="checkbox"
            checked={disponivel}
            onChange={e => setDisponivel(e.target.checked)}
            className="accent-green-700 w-4 h-4"
          />
          Disponível
        </label>

        <Button type="submit" className="w-full rounded-lg bg-green-700 py-6 text-white shadow-sm hover:bg-green-800">
          <PlusCircle className="mr-2" />

          {isEdit
            ? 'Guardar Alterações'
            : utilizador?.papel === 'vendedor' && !vendedorAprovado
              ? 'Aguardar aprovação para publicar'
              : 'Publicar Produto'}
        </Button>
      </form>
    </div>
  );
}
