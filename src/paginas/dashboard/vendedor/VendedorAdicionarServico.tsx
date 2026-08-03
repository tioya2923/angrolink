/**
 * Vendedor — Formulário para adicionar/editar serviço
 * Separado de produtos porque serviços não usam unidade,
 * quantidade mínima nem tipo de venda.
 */

import { useEffect, useState } from 'react';
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import { BriefcaseBusiness, CircleDollarSign, ImagePlus, MapPin, PlusCircle } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

import { PROVINCIAS, MUNICIPIOS } from '@/dados/constantes';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contextos/AuthContexto';

import {
  criarServico,
  updateServico,
  fetchServicoParaEdicao,
  uploadImagemProduto,
  deleteImagemProdutoPorUrl,
} from '@/services/api';

const TIPOS_SERVICO = [
  'Transporte',
  'Entrega',
  'Moagem',
  'Limpeza',
  'Reparação',
  'Aluguer de Equipamento',
  'Mão de obra agrícola',
  'Consultoria',
  'Outros',
];

export default function VendedorAdicionarServico() {
  const navigate = useNavigate();

  const { id } = useParams();

  const { toast } = useToast();

  const { utilizador } = useAuth();

  const [servicoEditando, setServicoEditando] =
    useState<any>(null);
  const [carregandoEdicao, setCarregandoEdicao] = useState(!!id);

  const isEdit = !!id;

  const vendedorAprovado =
    utilizador?.papel === 'vendedor' &&
    utilizador?.status_aprovacao === 'aprovado';

  const vendedorBloqueado =
    utilizador?.papel === 'vendedor' && !vendedorAprovado;
  const contaSuspensa = utilizador?.status_aprovacao === 'suspenso';

  const [nome, setNome] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [descricao, setDescricao] = useState('');
  const [precoEstimado, setPrecoEstimado] = useState('');
  const [precoPromocional, setPrecoPromocional] = useState('');

  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [zonaAtuacao, setZonaAtuacao] = useState('');
  const [disponivel, setDisponivel] = useState(true);

  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [removerImagem, setRemoverImagem] = useState(false);

  useEffect(() => {
    if (!id || !utilizador?.vendedor_id) {
      setCarregandoEdicao(false);
      return;
    }

    async function carregarServico() {

      console.log("ID DO SERVIÇO:", id);

      const servico = await fetchServicoParaEdicao(id, utilizador.vendedor_id);

      console.log("SERVIÇO ENCONTRADO:", servico);

      if (!servico) {
        toast({
          title: "Serviço não encontrado",
          description: "Não foi possível carregar este serviço.",
          variant: "destructive",
        });

        navigate("/dashboard/servicos");
        setCarregandoEdicao(false);
        return;
      }

      setServicoEditando(servico);
      setCarregandoEdicao(false);
    }

    carregarServico();

  }, [id, navigate, toast, utilizador?.vendedor_id]);

  useEffect(() => {
    if (!servicoEditando) return;

    setNome(servicoEditando.nome_servico || '');
    setTipoServico(servicoEditando.tipo_servico || '');
    setDescricao(servicoEditando.descricao || '');
    setPrecoEstimado(
      servicoEditando.preco_estimado
        ? String(servicoEditando.preco_estimado)
        : ''
    );
    setPrecoPromocional(
      servicoEditando.preco_promocional
        ? String(servicoEditando.preco_promocional)
        : ''
    );

    setProvincia(servicoEditando.provincia || '');
    setMunicipio(servicoEditando.municipio || '');
    setZonaAtuacao(servicoEditando.zona_atuacao || '');
    setDisponivel(servicoEditando.disponivel ?? true);

    if (servicoEditando.imagem_url) {
      setImagemPreview(servicoEditando.imagem_url);
    }
  }, [servicoEditando]);

  const municipiosFiltrados = MUNICIPIOS.filter(
    m => m.provincia_id === PROVINCIAS.find(p => p.nome === provincia)?.id
  );

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (vendedorBloqueado) {
      toast({
        title: contaSuspensa ? 'Conta suspensa' : 'Conta em análise',
        description:
          contaSuspensa
            ? 'A sua conta está suspensa. Não pode alterar imagens até à reativação.'
            : 'Aguarde aprovação da equipa ANGROLINK para adicionar ou alterar imagens de serviços.',
        variant: 'destructive',
      });
      return;
    }

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
    reader.onload = () => setImagemPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (vendedorBloqueado) {
      toast({
        title: contaSuspensa ? 'Conta suspensa' : 'Conta em análise',
        description:
          contaSuspensa
            ? 'A sua conta está suspensa. Não é possível publicar ou editar serviços até à reativação.'
            : 'Pode completar o seu perfil, mas só poderá publicar ou editar serviços quando a sua conta for aprovada pela equipa ANGROLINK.',
        variant: 'destructive',
      });
      return;
    }

    if (!nome.trim()) {
      toast({
        title: 'Nome do serviço obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!tipoServico) {
      toast({
        title: 'Seleciona o tipo de serviço',
        variant: 'destructive',
      });
      return;
    }

    if (!precoEstimado || Number(precoEstimado) <= 0) {
      toast({
        title: 'Preço estimado obrigatório',
        description: 'Insere um preço estimado válido para o serviço.',
        variant: 'destructive',
      });
      return;
    }

    if (precoPromocional && (Number(precoPromocional) <= 0 || Number(precoPromocional) >= Number(precoEstimado))) {
      toast({
        title: 'Preço promocional inválido',
        description: 'O preço promocional deve ser inferior ao preço estimado.',
        variant: 'destructive',
      });
      return;
    }

    if (!provincia) {
      toast({
        title: 'Seleciona a província',
        variant: 'destructive',
      });
      return;
    }

    if (!municipio) {
      toast({
        title: 'Seleciona o município',
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

    try {
      let imagem_url = servicoEditando?.imagem_url || '';

      if (imagemFile) {
        imagem_url = await uploadImagemProduto(imagemFile);
      }

      const dadosServico = {
        vendedor_id: utilizador?.vendedor_id,
        nome_servico: nome,
        tipo_servico: tipoServico,
        descricao,
        preco_estimado: Number(precoEstimado),
        preco_promocional: precoPromocional ? Number(precoPromocional) : null,
        provincia,
        municipio,
        zona_atuacao: zonaAtuacao,
        imagem_url: removerImagem
          ? null
          : imagem_url || null,
        disponivel,
      };

      if (isEdit) {
        if (removerImagem && servicoEditando?.imagem_url) {
          await deleteImagemProdutoPorUrl(servicoEditando.imagem_url);
        }

        await updateServico(servicoEditando.id, dadosServico);

        toast({
          title: 'Serviço atualizado!',
          description: 'As alterações foram guardadas com sucesso.',
        });
      } else {
        await criarServico(dadosServico);

        toast({
          title: 'Serviço publicado!',
          description: 'O serviço já está disponível no marketplace.',
        });
      }

      navigate('/dashboard/servicos');
    } catch (err: any) {
      console.error(err);

      toast({
        title: isEdit ? 'Erro ao atualizar serviço' : 'Erro ao criar serviço',
        description:
          err.message ||
          'Verifica os dados e tenta novamente. Se o problema continuar, confirma se a tua conta está aprovada.',
        variant: 'destructive',
      });
    }
  };

  if (isEdit && carregandoEdicao) {
    return <div className="painel-dashboard-form font-corpo text-sm text-muted-foreground">A carregar dados do serviço...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">{isEdit ? 'Editar serviço' : 'Adicionar serviço'}</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">{isEdit ? 'Atualiza os dados do serviço e guarda as alterações.' : 'Apresenta o teu serviço aos clientes da ANGROLINK.'}</p>
      </header>

      {vendedorBloqueado && (
        <div className={`border-2 p-4 rounded-md ${contaSuspensa ? 'border-red-300 bg-red-50' : 'border-yellow-500/40 bg-yellow-500/10'}`}>
          <p className="font-corpo text-sm font-semibold">
            {contaSuspensa ? 'Conta suspensa' : 'Conta em análise'}
          </p>
          <p className="font-corpo text-xs text-muted-foreground mt-1">
            {contaSuspensa
              ? 'Não é possível publicar nem editar serviços até a conta ser reativada.'
              : 'Pode completar o seu perfil, mas só poderá publicar ou editar serviços quando a sua conta for aprovada pela equipa ANGROLINK.'}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="painel-dashboard-form formulario-publicacao">
        <div className="formulario-publicacao-titulo">
          <span className="formulario-publicacao-icone"><BriefcaseBusiness className="size-5" /></span>
          <div>
            <h2 className="font-titulo text-base font-bold">Informações do serviço</h2>
            <p className="font-corpo text-xs text-muted-foreground">Mostra aos clientes o que fazes e como podem encontrar-te.</p>
          </div>
          <span className="ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold">Passo 1 de 3</span>
        </div>
        {/* NOME */}
        <div className="space-y-2">
          <Label className="font-corpo text-sm">
            Nome do serviço *
          </Label>

          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            required
            className="border-2 border-border"
            placeholder="Ex: Transporte de mercadoria"
          />
        </div>

        {/* TIPO */}
        <div className="space-y-2">
          <Label className="font-corpo text-sm">
            Tipo de serviço *
          </Label>

          <select
            value={tipoServico}
            onChange={e => setTipoServico(e.target.value)}
            required
            className="w-full border-2 border-border px-3 py-2"
          >
            <option value="">Selecionar tipo de serviço</option>

            {TIPOS_SERVICO.map(tipo => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <div className="formulario-publicacao-titulo pt-2">
          <span className="formulario-publicacao-icone"><CircleDollarSign className="size-5" /></span>
          <div><h2 className="font-titulo text-base font-bold">Preço e apresentação</h2><p className="font-corpo text-xs text-muted-foreground">Define uma estimativa e adiciona uma imagem representativa.</p></div>
          <span className="ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold">Passo 2 de 3</span>
        </div>
        {/* PREÇO */}
        <div className="space-y-2">
          <Label>Preço estimado (Kz) *</Label>

          <Input
            type="number"
            min="1"
            step="1"
            value={precoEstimado}
            onChange={e => setPrecoEstimado(e.target.value)}
            placeholder="Ex: 5000"
            required
          />
        </div>

        {/* DESCRIÇÃO */}
        <div className="space-y-2">
          <Label>Descrição</Label>

          <textarea
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="w-full border-2 px-3 py-2"
            placeholder="Descreve o serviço oferecido..."
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
            placeholder="Opcional — inferior ao preço estimado"
          />
          <p className="font-corpo text-xs text-muted-foreground">Quando definido, o desconto e a percentagem aparecem automaticamente nos cartões.</p>
        </div>

        {/* IMAGEM */}
        <div className="space-y-2">
          <Label>Imagem do serviço</Label>

          <div className="area-imagem-publicacao">
            {imagemPreview ? (
              <>
                <img
                  src={imagemPreview}
                  alt="Pré-visualização do serviço"
                  className="w-32 mx-auto"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (vendedorBloqueado) {
                      toast({
                        title: contaSuspensa ? 'Conta suspensa' : 'Conta em análise',
                        description:
                          contaSuspensa
                            ? 'Não pode remover nem alterar imagens enquanto a conta estiver suspensa.'
                            : 'Aguarde aprovação para remover ou alterar imagens.',
                        variant: 'destructive',
                      });
                      return;
                    }

                    setImagemPreview(null);
                    setImagemFile(null);
                    setRemoverImagem(true);
                  }}
                  className="font-corpo text-xs text-destructive hover:underline mt-2"
                >
                  Remover imagem
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><ImagePlus className="size-5" /></span>
                <input
                  id="imagem-servico"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImagemChange}
                  className="sr-only"
                />
                <label
                  htmlFor="imagem-servico"
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

        <div className="formulario-publicacao-titulo pt-2">
          <span className="formulario-publicacao-icone"><MapPin className="size-5" /></span>
          <div><h2 className="font-titulo text-base font-bold">Área de atuação</h2><p className="font-corpo text-xs text-muted-foreground">Indica onde o serviço está disponível.</p></div>
          <span className="ml-auto rounded-full bg-secondary px-3 py-1 font-corpo text-xs font-semibold">Passo 3 de 3</span>
        </div>
        {/* LOCALIZAÇÃO */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Província *</Label>

            <select
              value={provincia}
              onChange={e => {
                setProvincia(e.target.value);
                setMunicipio('');
              }}
              className="w-full border-2 px-3 py-2"
              required
            >
              <option value="">Selecionar província</option>

              {PROVINCIAS.map(p => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Município *</Label>

            <select
              value={municipio}
              onChange={e => setMunicipio(e.target.value)}
              disabled={!provincia}
              className="w-full border-2 px-3 py-2 disabled:opacity-50"
              required
            >
              <option value="">
                {provincia ? 'Selecionar município' : 'Escolha província primeiro'}
              </option>

              {municipiosFiltrados.map(m => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ZONA */}
        <div className="space-y-2">
          <Label>Zona de atuação</Label>

          <Input
            value={zonaAtuacao}
            onChange={e => setZonaAtuacao(e.target.value)}
            className="border-2 border-border"
            placeholder="Ex: Luanda, Cacuaco, Viana"
          />
        </div>

        {/* DISPONÍVEL */}
        <label className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3 font-corpo text-sm font-medium">
          <input
            type="checkbox"
            checked={disponivel}
            onChange={e => setDisponivel(e.target.checked)}
            className="accent-green-700 w-4 h-4"
          />
          Serviço disponível
        </label>

        <Button
          type="submit"
          className="w-full rounded-lg bg-green-700 py-6 text-white shadow-sm hover:bg-green-800"
          disabled={vendedorBloqueado}
        >
          <PlusCircle className="mr-2" />

          {isEdit
            ? vendedorBloqueado
              ? 'Aguardar aprovação para editar'
              : 'Guardar Alterações'
            : vendedorBloqueado
              ? 'Aguardar aprovação para publicar'
              : 'Publicar Serviço'}
        </Button>
      </form>
    </div>
  );
}
