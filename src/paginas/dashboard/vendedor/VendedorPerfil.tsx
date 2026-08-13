/**
 * Vendedor — Perfil da empresa
 * Carrega e atualiza dados reais do vendedor no Supabase.
 */

import { useEffect, useState } from 'react';
import {
  Save,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Lock,
  Trash2,
  Loader2,
} from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SeletorTelefone from '@/componentes/SeletorTelefone';
import { separarIndicativo } from '@/dados/paises';
import { telefoneCompleto } from '@/lib/verificacoesConta';
import PerfilResumoCard from "@/componentes/perfil/PerfilResumoCard";
import CardInformacaoPrincipal from "@/componentes/perfil/CardInformacaoPrincipal";
import { Textarea } from "@/components/ui/textarea";
import CardLocalizacao from "@/componentes/perfil/CardLocalizacao";
import CardFuncionamento from "@/componentes/perfil/CardFuncionamento";
import CardDadosTipo from "@/componentes/perfil/CardDadosTipo";
import CardSeguranca from "@/componentes/perfil/CardSeguranca";
import CardZonaPerigo from "@/componentes/perfil/CardZonaPerigo";

import { TIPOS_VENDEDOR, PROVINCIAS, MUNICIPIOS } from '@/dados/constantes';
import { useToast } from '@/hooks/use-toast';

import {
  fetchVendedorPorId,
  updateVendedor,
  uploadImagemVendedor,
} from '@/services/api';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from '@/services/supabase';

import { Vendedor, TipoVendedor } from '@/tipos';
import RequisitosDocumentos from '@/componentes/RequisitosDocumentos';

export default function VendedorPerfil() {
  const { utilizador, logout } = useAuth();
  const { toast } = useToast();

  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  const [apagandoConta, setApagandoConta] = useState(false);

  // Campos principais
  const [nomeComercial, setNomeComercial] = useState('');
  const [nomeResponsavel, setNomeResponsavel] = useState('');
  const [email, setEmail] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipoVendedor, setTipoVendedor] = useState('');
  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [mercado, setMercado] = useState('');

  // Campos opcionais gerais
  const [bairro, setBairro] = useState('');
  const [enderecoDetalhado, setEnderecoDetalhado] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [indicativoWhatsapp, setIndicativoWhatsapp] = useState('244');
  const [dataInicioAtividade, setDataInicioAtividade] = useState('');
  const [entregaDisponivel, setEntregaDisponivel] = useState(false);

  // Horário de atendimento
  const [diasAtendimento, setDiasAtendimento] = useState('Segunda a Sábado');
  const [horaAbertura, setHoraAbertura] = useState('08:00');
  const [horaFecho, setHoraFecho] = useState('17:00');

  // Produtor / Fazenda
  const [tipoProducao, setTipoProducao] = useState('');
  const [areaCultivada, setAreaCultivada] = useState('');
  const [principaisCulturas, setPrincipaisCulturas] = useState('');
  const [producaoMensal, setProducaoMensal] = useState('');
  const [vendaGrosso, setVendaGrosso] = useState(false);
  const [vendaRetalho, setVendaRetalho] = useState(false);

  // Revendedor / Grossista / Loja
  const [tiposProdutos, setTiposProdutos] = useState('');
  const [compraProdutores, setCompraProdutores] = useState(false);
  const [volumeMinimo, setVolumeMinimo] = useState('');
  const [entregaOutrasProvincias, setEntregaOutrasProvincias] = useState(false);
  const [tipoLoja, setTipoLoja] = useState('');
  const [mercadoLocalizado, setMercadoLocalizado] = useState('');
  const [vendaPresencial, setVendaPresencial] = useState(false);

  // Foto
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [removerFoto, setRemoverFoto] = useState(false);

  const municipiosFiltrados = MUNICIPIOS.filter(
    m => m.provincia_id === PROVINCIAS.find(p => p.nome === provincia)?.id
  );

  const statusAprovacao = (vendedor as any)?.status_aprovacao || 'pendente';
  const contaPendente = statusAprovacao === 'pendente';
  const contaRejeitada = statusAprovacao === 'rejeitado';
  const contaSuspensa = statusAprovacao === 'suspenso';

  const isProdutor = tipoVendedor === 'produtor';
  const isRevendedor = tipoVendedor === 'ambulante' || tipoVendedor === 'quitandeira';
  const isDistribuidor = tipoVendedor === 'grossista';
  const isLoja =
    tipoVendedor === 'mini_mercado' ||
    tipoVendedor === 'supermercado' ||
    tipoVendedor === 'hipermercado';
  const isPrestadorServico =
    tipoVendedor === 'prestador_servico';

  useEffect(() => {
    async function carregarVendedor() {
      if (!utilizador?.vendedor_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const data = await fetchVendedorPorId(utilizador.vendedor_id);

        if (!data) {
          toast({
            title: 'Vendedor não encontrado',
            variant: 'destructive',
          });
          return;
        }

        setVendedor(data);

        setNomeComercial(data.nome_comercial || '');
        setNomeResponsavel(data.nome_responsavel || '');
        setEmail(data.email || '');
        setDescricao(data.descricao || '');
        setTipoVendedor(data.tipo_vendedor || '');
        setProvincia(data.provincia || '');
        setMunicipio(data.municipio || '');
        setMercado(data.mercado_bairro || '');

        setBairro(data.bairro || '');
        setEnderecoDetalhado(data.endereco_detalhado || '');

        const { indicativo: indicativoCarregado, numero: whatsappLimpo } = separarIndicativo(
          String(data.telefone_whatsapp || data.whatsapp || '')
        );

        setIndicativoWhatsapp(indicativoCarregado);
        setWhatsapp(whatsappLimpo);

        setDataInicioAtividade((data as any).data_inicio_atividade || '');
        setEntregaDisponivel(Boolean((data as any).entrega_disponivel));

        if (data.horario_atendimento) {
          const partes = data.horario_atendimento.split(',');
          const dias = partes[0]?.trim();

          const horas = partes[1]?.split('-');
          const abertura = horas?.[0]?.trim();
          const fecho = horas?.[1]?.trim();

          if (dias) setDiasAtendimento(dias);
          if (abertura) setHoraAbertura(abertura);
          if (fecho) setHoraFecho(fecho);
        }

        setTipoProducao(data.tipo_producao || '');
        setAreaCultivada(data.area_cultivada ? String(data.area_cultivada) : '');
        setPrincipaisCulturas(data.principais_culturas || '');
        setProducaoMensal(data.producao_mensal || '');

        setTiposProdutos(data.tipos_produtos || '');
        setCompraProdutores(Boolean(data.compra_produtores));
        setVolumeMinimo(data.volume_minimo || '');
        setEntregaOutrasProvincias(Boolean(data.entrega_outras_provincias));

        setTipoLoja(data.tipo_loja || '');
        setMercadoLocalizado(data.mercado_localizado || '');
        setVendaPresencial(Boolean(data.venda_presencial));

        setVendaGrosso(Boolean((data as any).venda_grosso));
        setVendaRetalho(Boolean((data as any).venda_retalho));

        setFotoPreview(data.foto_perfil || null);
      } catch (err: any) {
        console.error('ERRO AO CARREGAR PERFIL COMPLETO:', err);

        toast({
          title: 'Erro ao carregar perfil',
          description:
            err?.message ||
            err?.details ||
            'Não foi possível carregar os dados do vendedor.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    carregarVendedor();
  }, [utilizador?.vendedor_id, toast]);

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: 'Imagem demasiado grande',
        description: 'Tamanho máximo: 3MB',
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

    setRemoverFoto(false);
    setFotoFile(file);

    const reader = new FileReader();
    reader.onload = () => setFotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoverFoto = () => {
    setFotoPreview(null);
    setFotoFile(null);
    setRemoverFoto(true);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!utilizador?.vendedor_id) {
      toast({
        title: 'Vendedor inválido',
        description: 'Não foi possível identificar o vendedor ativo.',
        variant: 'destructive',
      });
      return;
    }

    if (!nomeComercial.trim()) {
      toast({
        title: 'Nome do negócio obrigatório',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGuardando(true);

      let foto_perfil = vendedor?.foto_perfil || null;

      if (removerFoto) {
        foto_perfil = null;
      }

      if (!removerFoto && fotoFile) {
        foto_perfil = await uploadImagemVendedor(fotoFile);
      }

      const horarioAtendimento = `${diasAtendimento}, ${horaAbertura} - ${horaFecho}`;

      const telefoneWhatsappFinal = whatsapp
        ? telefoneCompleto(whatsapp, indicativoWhatsapp)
        : '';

      const dadosAtualizados = {
        // Campos permitidos para o vendedor editar
        nome_comercial: nomeComercial,
        nome_responsavel: nomeResponsavel.trim() || null,
        email: email.trim() || null,
        descricao,
        provincia,
        municipio,
        mercado_bairro: mercado,
        foto_perfil,

        bairro,
        endereco_detalhado: enderecoDetalhado,

        telefone_whatsapp: telefoneWhatsappFinal,
        whatsapp: telefoneWhatsappFinal,

        horario_atendimento: horarioAtendimento,
        data_inicio_atividade: dataInicioAtividade || null,
        entrega_disponivel: entregaDisponivel,

        tipo_producao: tipoProducao || null,
        area_cultivada: areaCultivada ? Number(areaCultivada) : null,
        principais_culturas: principaisCulturas || null,
        producao_mensal: producaoMensal || null,
        venda_grosso: vendaGrosso,
        venda_retalho: vendaRetalho,

        tipos_produtos: tiposProdutos || null,
        compra_produtores: compraProdutores,

        volume_minimo: volumeMinimo || null,
        entrega_outras_provincias: entregaOutrasProvincias,

        tipo_loja: tipoLoja || null,
        mercado_localizado: mercadoLocalizado || null,
        venda_presencial: vendaPresencial,

        atualizado_em: new Date().toISOString(),
      };

      const atualizado = await updateVendedor(
        utilizador.vendedor_id,
        dadosAtualizados
      );

      setVendedor(atualizado);
      setFotoFile(null);
      setRemoverFoto(false);
      setFotoPreview(atualizado.foto_perfil || null);

      toast({
        title: 'Perfil atualizado!',
        description: contaPendente
          ? 'As alterações foram guardadas. A conta continua em análise pela equipa ANGROLINK.'
          : 'As alterações foram guardadas com sucesso.',
      });
    } catch (err: any) {
      console.error('ERRO PERFIL COMPLETO:', err);

      toast({
        title: 'Erro ao guardar perfil',
        description:
          err?.message ||
          err?.details ||
          err?.hint ||
          'Erro ao atualizar. Verifica permissões, RLS ou campos da tabela.',
        variant: 'destructive',
      });
    } finally {
      setGuardando(false);
    }
  };

  async function handleAlterarPassword() {
    if (!utilizador?.email) {
      toast({
        title: 'Erro',
        description: 'Email do utilizador não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    if (!senhaAtual) {
      toast({
        title: 'Palavra-passe atual obrigatória',
        description: 'Insere a tua palavra-passe atual para confirmar a alteração.',
        variant: 'destructive',
      });
      return;
    }

    if (!novaSenha || novaSenha.length < 6) {
      toast({
        title: 'Nova palavra-passe inválida',
        description: 'A nova palavra-passe deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (novaSenha !== confirmarSenha) {
      toast({
        title: 'Passwords diferentes',
        description: 'A confirmação não corresponde à nova palavra-passe.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setAlterandoSenha(true);

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: utilizador.email,
        password: senhaAtual,
      });

      if (loginError) {
        toast({
          title: 'Palavra-passe atual incorreta',
          description: 'Confirma a tua palavra-passe atual e tenta novamente.',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: novaSenha,
      });

      if (error) throw error;

      toast({
        title: 'Palavra-passe alterada!',
        description: 'A tua palavra-passe foi atualizada com sucesso.',
      });

      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (error) {
      console.error('Erro ao alterar password:', error);

      toast({
        title: 'Erro ao alterar palavra-passe',
        description: 'Não foi possível alterar a palavra-passe.',
        variant: 'destructive',
      });
    } finally {
      setAlterandoSenha(false);
    }
  }

  async function handleDesativarConta() {
    const confirmado = window.confirm(
      'Tens a certeza que queres apagar a tua conta? Esta ação é irreversível.'
    );

    if (!confirmado) return;

    try {
      setApagandoConta(true);

      const { error } = await supabase.rpc('desativar_minha_conta');

      if (error) throw error;

      toast({
        title: 'Conta desativada',
        description: 'A tua conta foi removida da plataforma.',
      });

      await logout();
    } catch (error) {
      console.error('Erro ao desativar conta:', error);

      toast({
        title: 'Erro ao apagar conta',
        description: 'Não foi possível apagar a conta.',
        variant: 'destructive',
      });
    } finally {
      setApagandoConta(false);
    }
  }

  if (loading) {
    return (
      <p className="font-corpo text-sm text-muted-foreground">
        A carregar perfil...
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
    <div className="space-y-6 max-w-6xl">
      <div className="painel-dashboard-cabecalho flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <h1 className="relative z-10 font-titulo text-3xl font-bold tracking-tight text-primary-foreground">
            {isPrestadorServico
              ? "Perfil do Prestador"
              : "Perfil do Negócio"}
          </h1>

          <p className="relative z-10 mt-1 text-sm text-primary-foreground/80">
            Atualize as informações que serão apresentadas aos clientes da ANGROLINK.
          </p>
        </div>

        <Button
          type="submit"
          form="form-perfil-vendedor"
          disabled={guardando}
          className="relative z-10 bg-secondary text-secondary-foreground hover:bg-secondary/90"
        >
          <Save className="mr-2 h-4 w-4" />

          {guardando ? "A guardar..." : "Guardar Perfil"}
        </Button>

      </div>

      {/* Aviso de aprovação */}
      {contaPendente && (
        <div className="border-2 border-yellow-500 bg-yellow-50 p-4 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-corpo text-sm font-semibold text-yellow-800">
              Conta em análise
            </p>
            <p className="font-corpo text-xs text-yellow-800 mt-1 leading-relaxed">
              Pode completar e atualizar o seu perfil, mas só poderá publicar produtos ou serviços depois da aprovação da equipa ANGROLINK.
            </p>
          </div>
        </div>
      )}

      {contaRejeitada && (
        <div className="border-2 border-destructive bg-destructive/10 p-4 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-corpo text-sm font-semibold text-destructive">
              Conta rejeitada
            </p>
            <p className="font-corpo text-xs text-destructive mt-1 leading-relaxed">
              O seu perfil não foi aprovado. Contacte a equipa ANGROLINK para saber o motivo e solicitar nova análise.
            </p>
          </div>
        </div>
      )}

      {contaSuspensa && (
        <div className="border-2 border-destructive bg-destructive/10 p-4 rounded-md flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-corpo text-sm font-semibold text-destructive">
              Conta suspensa
            </p>
            <p className="font-corpo text-xs text-destructive mt-1 leading-relaxed">
              A sua conta foi suspensa. Algumas funcionalidades podem estar bloqueadas.
            </p>
          </div>
        </div>
      )}

      {/* Foto de perfil */}
      <PerfilResumoCard
        onRemoverFoto={handleRemoverFoto}
        fotoPreview={fotoPreview}
        nomeComercial={nomeComercial}
        nomeResponsavel={nomeResponsavel}
        email={email}
        whatsapp={whatsapp ? `+${indicativoWhatsapp} ${whatsapp}` : ""}
        plano={vendedor?.plano}
        verificado={vendedor?.verificado}
        statusAprovacao={statusAprovacao}
        onSelecionarFoto={handleFotoChange}
      />

      <form
        id="form-perfil-vendedor"
        onSubmit={handleGuardar}
        className="space-y-6"
      >
        {/* Dados principais */}
        <CardInformacaoPrincipal>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">
              {isPrestadorServico ? 'Nome profissional / marca' : 'Nome do negócio'}
            </Label>
            <Input
              value={nomeComercial}
              onChange={e => setNomeComercial(e.target.value)}
              className="border-2 border-border"
              placeholder={
                isPrestadorServico
                  ? 'Ex: Transporte Rápido Viana'
                  : 'Ex: Horta da Dona Maria'
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-corpo text-sm">
                  Nome do responsável
                </Label>

                <Input
                  value={nomeResponsavel}
                  onChange={e => setNomeResponsavel(e.target.value)}
                  className="border-2 border-border"
                  placeholder="Ex: João Manuel"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-corpo text-sm">
                  Email profissional
                </Label>

                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="border-2 border-border"
                  placeholder="empresa@email.com"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">
              {isPrestadorServico ? 'Descrição do serviço' : 'Descrição do negócio'}
            </Label>
            <Textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              placeholder={
                isPrestadorServico
                  ? "Descreva o serviço que presta, a sua experiência e a área de atuação."
                  : "Descreva o seu negócio, os produtos que comercializa e aquilo que o diferencia."
              }
              className="resize-none border-2 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Tipo de conta profissional</Label>

            <Select
              value={tipoVendedor}
              disabled
            >
              <SelectTrigger className="border-2 border-border bg-muted opacity-70">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>

              <SelectContent>
                {TIPOS_VENDEDOR.map(t => (
                  <SelectItem
                    key={t.valor}
                    value={t.valor}
                  >
                    {t.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="font-corpo text-xs text-muted-foreground">
              Para alterar o tipo de conta, contacte a equipa Angrolink.
            </p>
          </div>

          <RequisitosDocumentos tipo={tipoVendedor as TipoVendedor | ''} />
        </CardInformacaoPrincipal>

        {/* Localização */}
        <CardLocalizacao>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-corpo text-sm">Província</Label>
              <select
                value={provincia}
                onChange={e => {
                  setProvincia(e.target.value);
                  setMunicipio('');
                }}
                className="w-full border-2 border-border bg-background font-corpo text-sm px-3 py-2"
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
              <Label className="font-corpo text-sm">Município</Label>
              <select
                value={municipio}
                onChange={e => setMunicipio(e.target.value)}
                disabled={!provincia}
                className="w-full border-2 border-border bg-background font-corpo text-sm px-3 py-2 disabled:opacity-50"
              >
                <option value="">
                  {provincia ? 'Selecionar município' : 'Escolha primeiro a província'}
                </option>
                {municipiosFiltrados.map(m => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Mercado / Zona comercial</Label>
            <Input
              value={mercado}
              onChange={e => setMercado(e.target.value)}
              className="border-2 border-border"
              placeholder="Ex: Mercado do Km 30, Praça do Kikolo, Zona Industrial"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Bairro</Label>
            <Input
              value={bairro}
              onChange={e => setBairro(e.target.value)}
              className="border-2 border-border"
              placeholder="Ex: Estalagem, Morro Bento, Benfica"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Endereço detalhado / referência</Label>
            <Input
              value={enderecoDetalhado}
              onChange={e => setEnderecoDetalhado(e.target.value)}
              className="border-2 border-border"
              placeholder="Ex: Rua principal, próximo da escola, armazém azul"
            />
          </div>
        </CardLocalizacao>

        {/* Informação adicional */}
        <CardFuncionamento>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">WhatsApp</Label>
            <SeletorTelefone
              indicativo={indicativoWhatsapp}
              onIndicativoChange={setIndicativoWhatsapp}
              valor={whatsapp}
              onValorChange={setWhatsapp}
              placeholder="923000000"
              maxLength={indicativoWhatsapp === '244' ? 9 : 14}
            />
            <p className="font-corpo text-xs text-muted-foreground">
              {indicativoWhatsapp === '244'
                ? 'Coloque apenas os 9 dígitos do número angolano.'
                : 'Coloque o número local, sem o indicativo do país.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Data de início da atividade</Label>
            <Input
              type="date"
              value={dataInicioAtividade}
              onChange={e => setDataInicioAtividade(e.target.value)}
              className="border-2 border-border"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-corpo text-sm">Dias de atendimento</Label>
            <select
              value={diasAtendimento}
              onChange={e => setDiasAtendimento(e.target.value)}
              className="w-full border-2 border-border bg-background font-corpo text-sm px-3 py-2"
            >
              <option value="Segunda a Sexta">Segunda a Sexta</option>
              <option value="Segunda a Sábado">Segunda a Sábado</option>
              <option value="Todos os dias">Todos os dias</option>
              <option value="Fim de semana">Fim de semana</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="font-corpo text-sm">Hora de abertura</Label>
              <Input
                type="time"
                value={horaAbertura}
                onChange={e => setHoraAbertura(e.target.value)}
                className="border-2 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label className="font-corpo text-sm">Hora de fecho</Label>
              <Input
                type="time"
                value={horaFecho}
                onChange={e => setHoraFecho(e.target.value)}
                className="border-2 border-border"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 font-corpo text-sm">
            <input
              type="checkbox"
              checked={entregaDisponivel}
              onChange={e => setEntregaDisponivel(e.target.checked)}
              className="accent-green-700 w-4 h-4"
            />
            Faz entregas
          </label>
        </CardFuncionamento>

        {/* Campos por tipo de vendedor */}
        {isProdutor && (
          <CardDadosTipo
            titulo="Dados de produção"
            descricao="Informações sobre a produção agrícola."
          >
            <Input
              value={tipoProducao}
              onChange={e => setTipoProducao(e.target.value)}
              placeholder="Tipo de produção. Ex: Horticultura, pecuária, produção mista"
            />

            <Input
              value={areaCultivada}
              onChange={e => setAreaCultivada(e.target.value)}
              type="number"
              placeholder="Área cultivada em hectares. Ex: 5"
            />

            <Input
              value={principaisCulturas}
              onChange={e => setPrincipaisCulturas(e.target.value)}
              placeholder="Principais culturas. Ex: Milho, feijão, tomate"
            />

            <Input
              value={producaoMensal}
              onChange={e => setProducaoMensal(e.target.value)}
              placeholder="Produção mensal estimada. Ex: 500 kg de tomate"
            />

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={vendaGrosso}
                onChange={e => setVendaGrosso(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Venda a grosso
            </label>

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={vendaRetalho}
                onChange={e => setVendaRetalho(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Venda a retalho
            </label>
          </CardDadosTipo>
        )}

        {isRevendedor && (
          <CardDadosTipo
            titulo="Dados de revenda"
            descricao="Informações sobre a atividade de revenda."
          >
            <Input
              value={tiposProdutos}
              onChange={e => setTiposProdutos(e.target.value)}
              placeholder="Tipos de produtos vendidos. Ex: Frutas, hortícolas, cereais"
            />

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={compraProdutores}
                onChange={e => setCompraProdutores(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Compra diretamente de produtores
            </label>

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={vendaRetalho}
                onChange={e => setVendaRetalho(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Venda a retalho
            </label>
          </CardDadosTipo>
        )}

        {isDistribuidor && (
          <CardDadosTipo
            titulo="Dados de distribuição"
            descricao="Informações sobre a distribuição dos produtos."
          >
            <Input
              value={tiposProdutos}
              onChange={e => setTiposProdutos(e.target.value)}
              placeholder="Tipos de produtos distribuídos. Ex: Bebidas, cereais, conservas"
            />

            <Input
              value={volumeMinimo}
              onChange={e => setVolumeMinimo(e.target.value)}
              placeholder="Volume mínimo de venda. Ex: 10 sacos, 1 palete"
            />

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={entregaOutrasProvincias}
                onChange={e => setEntregaOutrasProvincias(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Entrega para outras províncias
            </label>
          </CardDadosTipo>
        )}

        {isLoja && (
          <CardDadosTipo
            titulo="Dados da loja"
            descricao="Informações sobre o estabelecimento."
          >
            <Input
              value={tipoLoja}
              onChange={e => setTipoLoja(e.target.value)}
              placeholder="Tipo de loja. Ex: Mercearia, mini-mercado, loja de bairro"
            />

            <Input
              value={mercadoLocalizado}
              onChange={e => setMercadoLocalizado(e.target.value)}
              placeholder="Mercado onde está localizada. Ex: Mercado do Kikolo"
            />

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={vendaPresencial}
                onChange={e => setVendaPresencial(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Venda presencial
            </label>

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={entregaDisponivel}
                onChange={e => setEntregaDisponivel(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Faz entregas
            </label>
          </CardDadosTipo>
        )}

        {isPrestadorServico && (
          <CardDadosTipo
            titulo="Prestação de serviços"
            descricao="Informações sobre os serviços prestados."
          >
            <Input
              value={tiposProdutos}
              onChange={e => setTiposProdutos(e.target.value)}
              placeholder="Serviços prestados. Ex: Transporte, entregas, reparação, mão de obra agrícola"
            />

            <Input
              value={volumeMinimo}
              onChange={e => setVolumeMinimo(e.target.value)}
              placeholder="Condição mínima. Ex: Serviço mínimo 5.000 Kz, apenas por marcação"
            />

            <label className="flex items-center gap-2 font-corpo text-sm">
              <input
                type="checkbox"
                checked={entregaOutrasProvincias}
                onChange={e => setEntregaOutrasProvincias(e.target.checked)}
                className="accent-green-700 w-4 h-4"
              />
              Atua em outras províncias
            </label>
          </CardDadosTipo>
        )}

        <div className="border-t-2 border-border pt-6 space-y-6">
        <CardSeguranca>

          <Input
            type="password"
            placeholder="Palavra-passe atual"
            value={senhaAtual}
            onChange={e => setSenhaAtual(e.target.value)}
            className="border-2 border-border"
          />

          <Input
            type="password"
            placeholder="Nova palavra-passe"
            value={novaSenha}
            onChange={e => setNovaSenha(e.target.value)}
            className="border-2 border-border"
          />

          <Input
            type="password"
            placeholder="Confirmar nova palavra-passe"
            value={confirmarSenha}
            onChange={e => setConfirmarSenha(e.target.value)}
            className="border-2 border-border"
          />

          <Button
            type="button"
            onClick={handleAlterarPassword}
            disabled={alterandoSenha}
            variant="outline"
            className="font-corpo bg-green-700 text-white border-2 border-green-700 hover:bg-green-900 hover:text-white"
          >
            {alterandoSenha ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                A alterar...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Alterar palavra-passe
              </>
            )}
          </Button>
        </CardSeguranca>


          <CardZonaPerigo>

            <p className="font-corpo text-sm text-muted-foreground">
              Esta ação é irreversível. A tua conta será desativada e deixará de poder aceder à plataforma.
            </p>

            <Button
              type="button"
              onClick={handleDesativarConta}
              disabled={apagandoConta}
              variant="destructive"
              className="font-corpo"
            >
              {apagandoConta ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  A apagar...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Apagar Conta
                </>
              )}
            </Button>
          </CardZonaPerigo>

          <Button
          type="submit"
          disabled={guardando}
          className="font-corpo font-semibold bg-green-700 text-white border-2 border-green-700 hover:bg-green-900 hover:text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {guardando ? 'A guardar...' : 'Guardar Perfil'}
        </Button>
        </div>


      </form>
    </div>
  );
}
