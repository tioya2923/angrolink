import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SeletorTelefone from '@/componentes/SeletorTelefone';

import { PROVINCIAS, MUNICIPIOS } from '@/dados/constantes';
import { useToast } from '@/hooks/use-toast';
import { telefoneCompleto } from '@/lib/verificacoesConta';

import {
  criarServico,
  uploadImagemProduto,
} from '@/services/api';

const TIPOS_SERVICO = [
  'Transporte de mercadorias',
  'Entrega de mercadorias',
  'Moagem',
  'Limpeza',
  'Reparação',
  'Aluguer de Equipamento',
  'Mão de obra agrícola',
  'Consultoria',
  'Outros',
];

export default function PaginaAnunciarServico() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [nomeServico, setNomeServico] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [descricao, setDescricao] = useState('');
  const [precoEstimado, setPrecoEstimado] = useState('');

  const [nomePrestador, setNomePrestador] = useState('');
  const [telefoneWhatsapp, setTelefoneWhatsapp] = useState('');
  const [indicativoWhatsapp, setIndicativoWhatsapp] = useState('244');

  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [zonaAtuacao, setZonaAtuacao] = useState('');

  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const municipiosFiltrados = MUNICIPIOS.filter(
    m => m.provincia_id === PROVINCIAS.find(p => p.nome === provincia)?.id
  );

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

    setImagemFile(file);

    const reader = new FileReader();
    reader.onload = () => setImagemPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomeServico.trim()) {
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

    if (!nomePrestador.trim()) {
      toast({
        title: 'Nome do prestador obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!telefoneWhatsapp.trim()) {
      toast({
        title: 'WhatsApp obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      let imagem_url = '';

      if (imagemFile) {
        imagem_url = await uploadImagemProduto(imagemFile);
      }

      const servico = await criarServico({
        nome_servico: nomeServico,
        tipo_servico: tipoServico,
        descricao,
        preco_estimado: precoEstimado ? Number(precoEstimado) : undefined,
        provincia,
        municipio,
        zona_atuacao: zonaAtuacao,
        imagem_url,

        nome_prestador: nomePrestador,
        telefone_whatsapp: telefoneCompleto(telefoneWhatsapp, indicativoWhatsapp),

        // Serviço público não precisa estar ligado a vendedor.
        vendedor_id: undefined,
      });

      toast({
        title: 'Serviço anunciado!',
        description: 'O teu serviço já está disponível no marketplace.',
      });

      navigate(`/servico/${servico.id}`);
    } catch (err: any) {
      console.error(err);

      toast({
        title: 'Erro ao anunciar serviço',
        description: err.message || 'Erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1 container py-6 max-w-2xl">
        <h1 className="font-titulo text-2xl font-bold mb-2">
          Anunciar Serviço
        </h1>

        <p className="font-corpo text-sm text-muted-foreground mb-6">
          Anuncia serviços como transporte, entrega, reparação, mão de obra agrícola ou outros serviços locais.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* SERVIÇO */}
          <div className="space-y-2">
            <Label>Nome do serviço *</Label>
            <Input
              value={nomeServico}
              onChange={e => setNomeServico(e.target.value)}
              placeholder="Ex: Transporte de mercadoria"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de serviço *</Label>
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

          <div className="space-y-2">
            <Label>Descrição</Label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className="w-full border-2 px-3 py-2"
              rows={3}
              placeholder="Descreve o serviço oferecido..."
            />
          </div>

          <div className="space-y-2">
            <Label>Preço estimado (Kz)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              value={precoEstimado}
              onChange={e => setPrecoEstimado(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {/* PRESTADOR */}
          <div className="border-t-2 border-border pt-4 space-y-4">
            <h2 className="font-titulo text-lg font-semibold">
              Dados do prestador
            </h2>

            <div className="space-y-2">
              <Label>Nome do prestador *</Label>
              <Input
                value={nomePrestador}
                onChange={e => setNomePrestador(e.target.value)}
                placeholder="Ex: João Transportes"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <SeletorTelefone
                indicativo={indicativoWhatsapp}
                onIndicativoChange={setIndicativoWhatsapp}
                valor={telefoneWhatsapp}
                onValorChange={setTelefoneWhatsapp}
                placeholder="923000000"
                maxLength={indicativoWhatsapp === '244' ? 9 : 14}
                required
              />
            </div>
          </div>

          {/* IMAGEM */}
          <div className="space-y-2">
            <Label>Imagem do serviço</Label>

            <div className="border-2 border-dashed p-4 text-center">
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
                      setImagemPreview(null);
                      setImagemFile(null);
                    }}
                    className="font-corpo text-xs text-destructive hover:underline mt-2"
                  >
                    Remover
                  </button>
                </>
              ) : (
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImagemChange}
                />
              )}
            </div>
          </div>

          {/* LOCALIZAÇÃO */}
          <div className="grid grid-cols-2 gap-3">
            <select
              value={provincia}
              onChange={e => {
                setProvincia(e.target.value);
                setMunicipio('');
              }}
              className="w-full border-2 px-3 py-2"
            >
              <option value="">Selecionar província</option>

              {PROVINCIAS.map(p => (
                <option key={p.id} value={p.nome}>
                  {p.nome}
                </option>
              ))}
            </select>

            <select
              value={municipio}
              onChange={e => setMunicipio(e.target.value)}
              disabled={!provincia}
              className="w-full border-2 px-3 py-2"
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

          <div className="space-y-2">
            <Label>Zona de atuação</Label>
            <Input
              value={zonaAtuacao}
              onChange={e => setZonaAtuacao(e.target.value)}
              placeholder="Ex: Luanda, Viana, Cacuaco"
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            <PlusCircle className="mr-2" />
            {loading ? 'A anunciar...' : 'Anunciar Serviço'}
          </Button>
        </form>
      </main>

      <Rodape />
    </div>
  );
}
