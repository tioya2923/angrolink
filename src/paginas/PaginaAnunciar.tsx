/**
 * ========================================
 * PÁGINA "CRIAR CONTA" — Sistema completo de registo
 * ========================================
 * Fluxo multi-etapa adaptado ao mercado agrícola angolano.
 * Registo simples e rápido, perfil completável depois.
 *
 * Etapas:
 * 1. Escolha: Comprar ou Vender
 * 2a. Formulário de comprador (campos obrigatórios + opcionais)
 * 2b. Seleção do tipo de vendedor
 * 3. Formulário de vendedor (Etapa 1: conta)
 * 4. Perfil comercial (Etapa 2: negócio + campos por tipo)
 * 5. Confirmação
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';
import { supabase } from '@/services/supabase';
import {
  ArrowLeft, ShoppingBag, Megaphone, Send, Eye, EyeOff,
  CheckSquare, Camera, ChevronDown, ChevronUp,  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PROVINCIAS, MUNICIPIOS, TIPOS_VENDEDOR } from '@/dados/constantes';
import { TipoVendedor, TipoComprador } from '@/tipos';
import { toast } from 'sonner';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

import {
  verificarDuplicados,
  telefoneCompleto,
  gerarEmailInterno,
  normalizarEmail,
} from '@/lib/verificacoesConta';

import {
  validarSenha,
  validarTelefone,
  validarDuplicados,
} from '@/lib/validacoesConta';

type Etapa = 'escolha' | 'form-comprador' | 'tipo-vendedor' | 'form-vendedor' | 'perfil-comercial' | 'confirmacao';

// --- Classe reutilizável para selects ---
const selectClass = 'w-full h-10 border-2 border-border bg-background text-foreground font-corpo text-sm px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-ring';
const selectDisabled = selectClass + ' disabled:opacity-50';

function senhaValida(senha: string) {
  const regex =
    /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  return regex.test(senha);
}

function telefoneValido(
  telefone: string
) {
  // Apenas números
  if (!/^\d{9}$/.test(telefone)) {
    return false;
  }

  // Em Angola os móveis começam por 9
  if (!telefone.startsWith('9')) {
    return false;
  }

  // Não permitir números repetidos
  if (/^(\d)\1{8}$/.test(telefone)) {
    return false;
  }

  // Não permitir sequências comuns
  const proibidos = [
    '123456789',
    '987654321',
    '123123123',
    '111222333',
  ];

  if (proibidos.includes(telefone)) {
    return false;
  }

  return true;
}

export default function PaginaAnunciar() {

  const navigate = useNavigate();
  const { cadastro } = useAuth();
  const [etapa, setEtapa] = useState<Etapa>('escolha');
  const [tipoVendedorSelecionado, setTipoVendedorSelecionado] = useState<TipoVendedor | ''>('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [mostrarOpcionais, setMostrarOpcionais] = useState(false);
  const [fotoPerfil, setFotoPerfil] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState('');

  const DIAS_SEMANA = [
    'Segunda-feira',
    'Terça-feira',
    'Quarta-feira',
    'Quinta-feira',
    'Sexta-feira',
    'Sábado',
    'Domingo',
  ];

  const ANOS_ATIVIDADE = Array.from(
    { length: 60 },
    (_, i) => String(
      new Date().getFullYear() - i
    )
  );

  const tipoVendedorInfo = TIPOS_VENDEDOR.find(
    tipo => tipo.valor === tipoVendedorSelecionado
  );

  const tituloContaProfissional =
    tipoVendedorSelecionado === 'prestador_servico'
      ? 'Criar conta de prestador de serviços'
      : tipoVendedorInfo
        ? `Criar conta de ${tipoVendedorInfo.rotulo.toLowerCase()}`
        : 'Criar conta de vendedor';

  // ===== FORM COMPRADOR =====
  const [formComprador, setFormComprador] = useState({
    nome: '', telefone: '', email: '', senha: '', confirmarSenha: '',
    provincia: '', municipio: '', termos: false,
    // Opcionais
    bairro: '', endereco: '', whatsapp: '',
    tipo_comprador: 'casa' as TipoComprador,
  });

  // ===== FORM VENDEDOR (Etapa 1: Conta) =====
  const [formVendedor, setFormVendedor] = useState({
    nome_responsavel: '', telefone: '', email: '', senha: '', confirmarSenha: '',
    provincia: '', municipio: '', termos: false,
  });

  // ===== FORM PERFIL COMERCIAL (Etapa 2) =====
  const [formPerfil, setFormPerfil] = useState({
    nome_comercial: '', descricao: '', provincia_atividade: '', ano_inicio: '',
    municipio_atividade: '', email: '',
    // Opcionais
    bairro: '', endereco: '', whatsapp: '', horario: '',
    entrega_disponivel: false,
    // Campos por tipo
    tipo_producao: '', area_cultivada: '', principais_culturas: '', producao_mensal: '',
    venda_grosso: false, venda_retalho: false,
    tipos_produtos: '', compra_produtores: false,
    volume_minimo: '', entrega_outras_provincias: false,
    tipo_loja: '', mercado_localizado: '', venda_presencial: false,
    dia_abertura: '',
    dia_fecho: '',
    hora_abertura: '',
    hora_fecho: '',
  });

  const municipiosComprador = formComprador.provincia
    ? MUNICIPIOS.filter(m => m.provincia_id === formComprador.provincia) : [];
  const municipiosVendedor = formVendedor.provincia
    ? MUNICIPIOS.filter(m => m.provincia_id === formVendedor.provincia) : [];
  const municipiosAtividade = formPerfil.provincia_atividade
    ? MUNICIPIOS.filter(m => m.provincia_id === formPerfil.provincia_atividade) : [];

  // --- Navegação ---
  const voltarEtapa = () => {
    if (etapa === 'form-comprador') setEtapa('escolha');
    else if (etapa === 'tipo-vendedor') setEtapa('escolha');
    else if (etapa === 'form-vendedor') setEtapa('tipo-vendedor');
    else if (etapa === 'perfil-comercial') setEtapa('form-vendedor');
  };

  // --- Submit comprador ---
  const handleSubmitComprador = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('FORM COMPRADOR SUBMITOU');
    console.log('DADOS COMPRADOR:', formComprador);

    const erroTelefone = validarTelefone(
      formComprador.telefone
    );

    if (erroTelefone) {
      toast.error(erroTelefone);
      return;
    }

    const erroDuplicados =
      await validarDuplicados(
        formComprador.telefone,
        formComprador.email
      );

    if (erroDuplicados) {
      toast.error(erroDuplicados);
      return;
    }

    const telefoneUtilizador =
      telefoneCompleto(formComprador.telefone);

    const erroSenha = validarSenha(
      formComprador.senha,
      formComprador.confirmarSenha
    );

    if (erroSenha) {
      toast.error(erroSenha);
      return;
    }

    if (!formComprador.termos) {
      toast.error(
        'Deve aceitar os termos da plataforma.'
      );
      return;
    }

    if (
      formComprador.telefone.length !== 9
    ) {
      toast.error(
        'Número de telefone inválido.'
      );
      return;
    }

    try {
      setCarregando(true);

      const provinciaNome =
        PROVINCIAS.find(
          p => p.id === formComprador.provincia
        )?.nome || '';

      const municipioNome =
        MUNICIPIOS.find(
          m => m.id === formComprador.municipio
        )?.nome || '';

      const sucesso = await cadastro({
        nome: formComprador.nome,

        email:
          formComprador.email?.trim() || '',

        senha: formComprador.senha,

        telefone: telefoneUtilizador,

        provincia: provinciaNome,

        municipio: municipioNome,

        tipo_comprador:
          formComprador.tipo_comprador,

        fotoPerfil,
        
      });

      if (!sucesso) {
        toast.error('Não foi possível criar a conta. Tente novamente dentro de instantes.');
        return;
      }

      toast.success('Conta criada com sucesso!');

      setEtapa('confirmacao');

      setTimeout(() => {
        navigate('/dashboard/cliente/definicoes');
      }, 1800);

    } catch (error) {
      console.error(error);

      if (error instanceof Error && error.message === 'EMAIL_JA_REGISTADO') {
        toast.error('Este email já está registado. Faz login em vez de criar uma nova conta.');
      } else {
        toast.error('Não foi possível criar a conta.');
      }
    } finally {
      setCarregando(false);
    }
  };

  // --- Submit vendedor Etapa 1 ---
  const handleSubmitVendedorConta = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const erroTelefone = validarTelefone(
      formVendedor.telefone
    );

    if (erroTelefone) {
      toast.error(erroTelefone);
      return;
    }

    const erroSenha = validarSenha(
      formVendedor.senha,
      formVendedor.confirmarSenha
    );

    if (erroSenha) {
      toast.error(erroSenha);
      return;
    }

    if (!formVendedor.termos) {
      toast.error(
        'Deve aceitar os termos da plataforma.'
      );
      return;
    }

    const erroDuplicados =
      await validarDuplicados(
        formVendedor.telefone,
        formVendedor.email
      );

    if (erroDuplicados) {
      toast.error(erroDuplicados);
      return;
    }

    setEtapa('perfil-comercial');
  };

  // --- Submit vendedor Etapa 2 (perfil comercial) ---
  const handleSubmitPerfilComercial = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !formPerfil.nome_comercial ||
      !formPerfil.provincia_atividade ||
      !formPerfil.municipio_atividade
    ) {
      toast.error('Preencha todos os campos obrigatórios do perfil comercial.');
      return;
    }

    if (!tipoVendedorSelecionado) {
      toast.error('Selecione o tipo de vendedor.');
      return;
    }

    const provinciaAtividadeNome =
      PROVINCIAS.find(
        p => p.id === formPerfil.provincia_atividade
      )?.nome || '';

    const municipioAtividadeNome =
      MUNICIPIOS.find(
        m => m.id === formPerfil.municipio_atividade
      )?.nome || '';

    const nomeNormalizado =
      formPerfil.nome_comercial
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const {
      data: negociosExistentes,
      error: erroNegocios,
    } = await supabase
      .from('vendedores')
      .select(
        'id, nome_comercial'
      )
      .eq(
        'provincia',
        provinciaAtividadeNome
      )
      .eq(
        'municipio',
        municipioAtividadeNome
      );

    if (erroNegocios) {
      console.error(
        erroNegocios
      );
    }

    const negocioDuplicado =
      negociosExistentes?.some(
        negocio =>
          negocio.nome_comercial
            ?.trim()
            .replace(/\s+/g, ' ')
            .toLowerCase() ===
          nomeNormalizado
      );

    if (negocioDuplicado) {
      toast.error(
        `Já existe um negócio chamado "${formPerfil.nome_comercial}" neste município. Verifique se já possui uma conta ou escolha outro nome comercial.`
      );
      return;
    }

    const {
      data: negocioExistente,
    } = await supabase
      .from('vendedores')
      .select('id')
      .eq(
        'nome_comercial',
        formPerfil.nome_comercial.trim()
      )
      .eq(
        'provincia',
        formPerfil.provincia_atividade
      )
      .eq(
        'municipio',
        formPerfil.municipio_atividade
      )
      .maybeSingle();

    if (negocioExistente) {
      toast.error(
        'Já existe um negócio com este nome nesta localização.'
      );
      return;
    }

    const erroSenha = validarSenha(
      formVendedor.senha,
      formVendedor.confirmarSenha
    );

    if (erroSenha) {
      toast.error(erroSenha);
      return;
    }

    if (!formVendedor.termos) {
      toast.error(
        'Deve aceitar os termos da plataforma.'
      );
      return;
    }

    try {
      setCarregando(true);

      const telefone =
        telefoneCompleto(formVendedor.telefone);

      const emailLogin =
        gerarEmailInterno(formVendedor.telefone);

      const emailOpcional =
        normalizarEmail(formPerfil.email);

      const provinciaContaNome =
        PROVINCIAS.find(
          p => p.id === formVendedor.provincia
        )?.nome || '';

      const municipioContaNome =
        MUNICIPIOS.find(
          m => m.id === formVendedor.municipio
        )?.nome || '';

      // =============================
      // VERIFICAR TELEFONE DUPLICADO
      // =============================

      const erroDuplicados =
        await validarDuplicados(
          formVendedor.telefone,
          formPerfil.email
        );

      if (erroDuplicados) {
        toast.error(erroDuplicados);
        return;
      }

      const provinciaAtividadeNome =
        PROVINCIAS.find(p => p.id === formPerfil.provincia_atividade)?.nome ||
        provinciaContaNome;

      const municipioAtividadeNome =
        MUNICIPIOS.find(
          m =>
            m.id ===
            formPerfil.municipio_atividade
        )?.nome ||
        municipioContaNome;  

      //const email =
        //formPerfil.email?.trim().toLowerCase();

      // 1. Criar utilizador no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailLogin,
        password: formVendedor.senha,
        options: {
          data: {
            nome: formVendedor.nome_responsavel,
            telefone: formVendedor.telefone,
            provincia: provinciaContaNome,
            municipio: municipioAtividadeNome,
            papel: 'vendedor',
            tipo_vendedor: tipoVendedorSelecionado,
          },
        },
      });

      console.log(authData);
      console.log(authData.session);
      console.log(authData.user);

      if (authError || !authData.user) {
        console.error('Erro ao criar auth vendedor:', authError);

        if (authError?.message === 'User already registered') {
          toast.error('Este email já está registado. Faz login em vez de criar nova conta.');
        } else {
          toast.error('Erro ao criar conta de vendedor.');
        }

        return;
      }

      // 2. Criar perfil profissional na tabela vendedores
      let fotoPerfilUrl: string | null = null;

      if (fotoPerfil) {
        const extensao = fotoPerfil.name.split('.').pop();

        const nomeFicheiro =
          `${crypto.randomUUID()}.${extensao}`;

        const { error: erroUpload } =
          await supabase.storage
            .from('vendedores')
            .upload(nomeFicheiro, fotoPerfil);

        if (erroUpload) {
          throw erroUpload;
        }

        const { data } = supabase.storage
          .from('vendedores')
          .getPublicUrl(nomeFicheiro);

        fotoPerfilUrl = data.publicUrl;
      }

      console.log(
        'TIPO VENDEDOR:',
        tipoVendedorSelecionado
      );

      const novoVendedor = {
        user_id: authData.user.id,

        foto_perfil: fotoPerfilUrl,

        nome_responsavel: formVendedor.nome_responsavel,

        email: emailOpcional,
        email_login: emailLogin,

        nome_comercial: formPerfil.nome_comercial,
        descricao: formPerfil.descricao,

        telefone_whatsapp: telefone,
        whatsapp: telefone,


        provincia: provinciaAtividadeNome,
        municipio: municipioAtividadeNome,

        bairro: formPerfil.bairro || null,
        mercado_bairro: formPerfil.bairro || null,
        endereco_detalhado: formPerfil.endereco || null,

        tipo_vendedor: tipoVendedorSelecionado,

        plano: 'gratuito',
        verificado: false,
        status_aprovacao: 'pendente',
        pode_destacar: false,

        horario_atendimento:
          formPerfil.dia_abertura &&
          formPerfil.dia_fecho &&
          formPerfil.hora_abertura &&
          formPerfil.hora_fecho
            ? `${formPerfil.dia_abertura} a ${formPerfil.dia_fecho} | ${formPerfil.hora_abertura} às ${formPerfil.hora_fecho}`
            : null,
        data_inicio_atividade:
          formPerfil.ano_inicio
            ? `${formPerfil.ano_inicio}-01-01`
            : null,
        entrega_disponivel: formPerfil.entrega_disponivel,

        tipo_producao: formPerfil.tipo_producao || null,
        area_cultivada: formPerfil.area_cultivada
          ? Number(formPerfil.area_cultivada)
          : null,
        principais_culturas: formPerfil.principais_culturas || null,
        producao_mensal: formPerfil.producao_mensal || null,

        venda_grosso: formPerfil.venda_grosso,
        venda_retalho: formPerfil.venda_retalho,

        tipos_produtos: formPerfil.tipos_produtos || null,
        compra_produtores: formPerfil.compra_produtores,

        volume_minimo: formPerfil.volume_minimo || null,
        entrega_outras_provincias: formPerfil.entrega_outras_provincias,

        tipo_loja: formPerfil.tipo_loja || null,
        mercado_localizado: formPerfil.mercado_localizado || null,
        venda_presencial: formPerfil.venda_presencial,

        atualizado_em: new Date().toISOString(),
      };

      console.log('NOVO VENDEDOR:', novoVendedor);

      console.log(
      'ANTES DO INSERT DO VENDEDOR'
      );

      console.log(novoVendedor);

      const { data, error: vendedorError } = await supabase
        .from('vendedores')
        .insert(novoVendedor)
        .select();

        console.log(data);
        console.log(vendedorError);

        console.log(
        'DEPOIS DO INSERT'
        );

        console.log(vendedorError);

      if (vendedorError) {

        console.error('ERRO:', vendedorError);

        console.log('message:', vendedorError?.message);
        console.log('details:', vendedorError?.details);
        console.log('hint:', vendedorError?.hint);
        console.log('code:', vendedorError?.code);

        alert(JSON.stringify(vendedorError, null, 2));

        toast.error(
          'Conta criada, mas houve erro ao criar perfil.'
        );

        return;
      }

      const {
        data: loginData,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: emailLogin,
        password: formVendedor.senha,
      });

      console.log('LOGIN DATA:', loginData);
      console.log('LOGIN ERROR:', loginError);

      if (loginError) {
        console.error(loginError);

        toast.error(
          'Conta criada, mas não foi possível iniciar sessão automaticamente.'
        );

        return;
      }

      toast.success(
        'Conta criada com sucesso!'
      );

      setEtapa('confirmacao');

      setTimeout(() => {
        navigate('/dashboard/vendedor');
      }, 1500);

      } catch (error) {
        console.error(error);
        toast.error('Não foi possível enviar o pedido de vendedor.');
      } finally {
        setCarregando(false);
      }
  };

  const selecionarTipoVendedor = (tipo: TipoVendedor) => {
    setTipoVendedorSelecionado(tipo);
    setEtapa('form-vendedor');
  };

  // --- Barra de progresso ---
  const etapaNumero = etapa === 'escolha' ? 1
    : etapa === 'form-comprador' ? 2
    : etapa === 'tipo-vendedor' ? 2
    : etapa === 'form-vendedor' ? 3
    : etapa === 'perfil-comercial' ? 4 : 5;
  const totalEtapas = etapa === 'form-comprador' ? 3 : 5;

  // ===== CONFIRMAÇÃO =====
  if (etapa === 'confirmacao') {
    const isVendedor = !!tipoVendedorSelecionado;
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />
        <main className="flex-1 flex items-center justify-center py-12">
          <div className="container max-w-lg text-center space-y-4">
            <div className="w-16 h-16 bg-primary mx-auto flex items-center justify-center rounded-md">
              <Send size={28} className="text-primary-foreground" />
            </div>
            <h1 className="font-titulo text-2xl">
              {isVendedor ? 'Pedido Enviado!' : 'Conta Criada!'}
            </h1>
            <p className="font-corpo text-sm text-muted-foreground leading-relaxed">
              {isVendedor
                ? 'A sua conta foi criada com o estado pendente. A equipa Angrolink irá analisar o seu perfil antes de aprovar. Entraremos em contacto pelo WhatsApp informado dentro de 24 a 48 horas.'
                : 'A sua conta de comprador foi criada com sucesso. Já pode explorar produtos e contactar vendedores.'}
            </p>
            {isVendedor && (
              <div className="border-2 border-border bg-muted/30 p-4 rounded-md text-left">
                <p className="font-corpo text-xs text-muted-foreground">
                  <strong>Próximos passos:</strong>
                </p>
                <ul className="font-corpo text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Aguarde a aprovação da sua conta</li>
                  <li>Após aprovação, poderá publicar produtos</li>
                  <li>Complete o seu perfil no dashboard para mais visibilidade</li>
                </ul>
              </div>
            )}
            <Link to="/" className="inline-block mt-4">
              <Button className="font-corpo">Ir para a página inicial</Button>
            </Link>
          </div>
        </main>
        <Rodape />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1 py-8">
        <div className="container max-w-2xl">

          {/* Barra de progresso */}
          {etapa !== 'escolha' && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={voltarEtapa}
                  className="flex items-center gap-2 font-corpo text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>
                <span className="font-corpo text-xs text-muted-foreground">
                  Etapa {etapaNumero} de {totalEtapas}
                </span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-300"
                  style={{ width: `${(etapaNumero / totalEtapas) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* ===== ETAPA 1: ESCOLHA ===== */}
          {etapa === 'escolha' && (
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="font-titulo text-2xl md:text-3xl">
                  Quero usar a plataforma para:
                </h1>
                <p className="font-corpo text-sm text-muted-foreground mt-2">
                  Escolha o tipo de conta que melhor se adequa a si.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setEtapa('form-comprador')}
                  className="border-2 border-border bg-card p-6 text-left hover:border-green-700 transition-colors group rounded-md"
                >
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-md mb-4 group-hover:bg-primary/20 transition-colors">
                    <ShoppingBag className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="font-titulo text-lg mb-2">Comprar</h2>
                  <p className="font-corpo text-sm text-muted-foreground leading-relaxed">
                    Encontre produtos e contacte vendedores diretamente via WhatsApp.
                  </p>
                  <span className="inline-block mt-4 font-corpo text-sm font-semibold text-green-700">
                    Criar conta de comprador →
                  </span>
                </button>

                <button
                  onClick={() => setEtapa('tipo-vendedor')}
                  className="border-2 border-border bg-card p-6 text-left hover:border-green-700 transition-colors group rounded-md"
                >
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-md mb-4 group-hover:bg-primary/20 transition-colors">
                    <Megaphone className="w-6 h-6 text-primary" />
                  </div>

                  <h2 className="font-titulo text-lg mb-2">Vender Produtos</h2>

                  <p className="font-corpo text-sm text-muted-foreground leading-relaxed">
                    Crie conta como vendedor e publique produtos no marketplace.
                  </p>

                  <span className="inline-block mt-4 font-corpo text-sm font-semibold text-green-700">
                    Criar conta de vendedor →
                  </span>
                </button>

                <button
                  onClick={() => selecionarTipoVendedor('prestador_servico')}
                  className="border-2 border-border bg-card p-6 text-left hover:border-green-700 transition-colors group rounded-md"
                >
                  <div className="w-12 h-12 bg-primary/10 flex items-center justify-center rounded-md mb-4 group-hover:bg-primary/20 transition-colors">
                    <Wrench className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="font-titulo text-lg mb-2">Anunciar Serviço</h2>

                <p className="font-corpo text-sm text-muted-foreground leading-relaxed">
                  Crie uma conta profissional para anunciar serviços no marketplace.
                </p>

                <span className="inline-block mt-4 font-corpo text-sm font-semibold text-green-700">
                  Criar conta de prestador →
                </span>
                </button>
              </div>

              

              <p className="text-center font-corpo text-sm text-muted-foreground">
                Já tem conta?{' '}
                <Link to="/login" className="text-green-700 hover:underline font-medium">
                  Entrar aqui
                </Link>
              </p>
            </div>
          )}

          {/* ===== ETAPA 2a: FORMULÁRIO COMPRADOR ===== */}
          {etapa === 'form-comprador' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-titulo text-2xl md:text-3xl">Criar conta de comprador</h1>
                <p className="font-corpo text-sm text-muted-foreground mt-1">
                  Preencha os dados abaixo para começar a explorar produtos.
                </p>
              </div>

              <form onSubmit={handleSubmitComprador} className="border-2 border-border bg-card p-6 rounded-md space-y-4">
                {/* Campos obrigatórios */}
                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">Nome completo *</Label>
                  <Input value={formComprador.nome} onChange={e => setFormComprador(p => ({ ...p, nome: e.target.value }))}
                    placeholder="O seu nome completo" required className="border-2 border-border" maxLength={100} />
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">
                    Número de telefone *
                  </Label>

                  <div className="flex">
                    <div className="flex items-center px-3 border-2 border-r-0 border-border rounded-l-md bg-muted text-sm text-muted-foreground">
                      +244
                    </div>

                    <Input
                      type="tel"
                      value={formComprador.telefone}
                      onChange={e => {
                        const valor = e.target.value.replace(
                          /\D/g,
                          ''
                        );

                        setFormComprador(p => ({
                          ...p,
                          telefone: valor,
                        }));
                      }}
                      placeholder="923456789"
                      className="rounded-l-none border-2 border-border"
                      maxLength={9}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">Senha *</Label>
                  <div className="relative">
                    <Input type={mostrarSenha ? 'text' : 'password'} value={formComprador.senha}
                      onChange={e => setFormComprador(p => ({ ...p, senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres" required className="border-2 border-border pr-10" maxLength={128} />
                    <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">
                    Confirmar senha *
                  </Label>

                  <Input
                    type="password"
                    value={formComprador.confirmarSenha}
                    onChange={e =>
                      setFormComprador(p => ({
                        ...p,
                        confirmarSenha: e.target.value,
                      }))
                    }
                    placeholder="Repita a sua senha"
                    required
                    className="border-2 border-border"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-corpo text-sm font-medium">Província *</Label>
                    <select value={formComprador.provincia}
                      onChange={e => setFormComprador(p => ({ ...p, provincia: e.target.value, municipio: '' }))}
                      className={selectClass} required>
                      <option value="">Selecione</option>
                      {PROVINCIAS.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-corpo text-sm font-medium">Município *</Label>
                    <select value={formComprador.municipio}
                      onChange={e => setFormComprador(p => ({ ...p, municipio: e.target.value }))}
                      disabled={!formComprador.provincia}
                      className={selectDisabled} required>
                      <option value="">Selecione</option>
                      {municipiosComprador.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </div>
                </div>

                {/* Termos */}
                <label className="flex items-start gap-3 cursor-pointer py-2">
                  <input type="checkbox" checked={formComprador.termos}
                    onChange={e => setFormComprador(p => ({ ...p, termos: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-primary" />
                  <span className="font-corpo text-xs text-muted-foreground leading-relaxed">
                    Aceito os <Link to="/termos" className="text-primary underline">termos e condições</Link> e a{' '}
                    <Link to="/privacidade" className="text-primary underline">política de privacidade</Link> da plataforma Angrolink. *
                  </span>
                </label>

                {/* Campos opcionais (colapsáveis) */}
                <button
                  type="button"
                  onClick={() => setMostrarOpcionais(!mostrarOpcionais)}
                  className="flex items-center gap-2 font-corpo text-xs text-primary hover:underline"
                >
                  {mostrarOpcionais ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {mostrarOpcionais ? 'Ocultar campos opcionais' : 'Mostrar campos opcionais'}
                </button>

                {mostrarOpcionais && (
                  <div className="space-y-4 border-t border-border pt-4">
                    <p className="font-corpo text-xs text-muted-foreground italic">
                      Pode preencher depois no seu perfil.
                    </p>

                    <div className="space-y-2">
                      <Label className="font-corpo text-sm font-medium">
                        Email (opcional)
                      </Label>

                      <Input
                        type="email"
                        value={formComprador.email}
                        onChange={e =>
                          setFormComprador(p => ({
                            ...p,
                            email: e.target.value,
                          }))
                        }
                        placeholder="exemplo@email.com"
                        className="border-2 border-border"
                        maxLength={255}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-corpo text-sm font-medium">Bairro</Label>
                        <Input value={formComprador.bairro}
                          onChange={e => setFormComprador(p => ({ ...p, bairro: e.target.value }))}
                          placeholder="Ex: Morro Bento" className="border-2 border-border" maxLength={100} />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-corpo text-sm font-medium">Endereço detalhado</Label>
                        <Input value={formComprador.endereco}
                          onChange={e => setFormComprador(p => ({ ...p, endereco: e.target.value }))}
                          placeholder="Rua, número..." className="border-2 border-border" maxLength={200} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-corpo text-sm font-medium">Preferência de compra</Label>
                      <div className="flex gap-3">
                        {(['casa', 'negocio'] as TipoComprador[]).map(tipo => (
                          <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name="tipo_comprador" value={tipo}
                              checked={formComprador.tipo_comprador === tipo}
                              onChange={() => setFormComprador(p => ({ ...p, tipo_comprador: tipo }))}
                              className="accent-primary" />
                            <span className="font-corpo text-sm">
                              {tipo === 'casa' ? 'Para casa' : 'Para negócio'}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="font-corpo text-xs text-muted-foreground">
                        Define o tipo de produtos que verá na plataforma.
                      </p>
                    </div>

                    {/* Upload foto — placeholder */}
                    <div className="space-y-3">
                      <Label className="font-corpo text-sm font-medium">
                        Foto de perfil ou logótipo
                      </Label>

                      {previewFoto && (
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={previewFoto}
                            alt="Preview"
                            className="w-28 h-28 rounded-full object-cover border"
                          />

                          <button
                            type="button"
                            onClick={() => {
                              setFotoPerfil(null);
                              setPreviewFoto('');
                            }}
                            className="text-red-600 text-sm hover:underline"
                          >
                            Remover foto
                          </button>
                        </div>
                      )}

                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const ficheiro = e.target.files?.[0];

                          if (!ficheiro) return;

                          if (
                            !ficheiro.type.startsWith('image/')
                          ) {
                            toast.error(
                              'Escolha uma imagem.'
                            );
                            return;
                          }

                          if (
                            ficheiro.size >
                            5 * 1024 * 1024
                          ) {
                            toast.error(
                              'A imagem deve ter menos de 5MB.'
                            );
                            return;
                          }

                          if (!ficheiro) return;

                          setFotoPerfil(ficheiro);
                          setPreviewFoto(
                            URL.createObjectURL(ficheiro)
                          );
                        }}
                        className="block w-full text-sm"
                      />
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={carregando} className="w-full font-corpo font-semibold mt-2">
                  {carregando ? 'A criar...' : 'Criar conta de comprador'}
                </Button>
              </form>
            </div>
          )}

          {/* ===== ETAPA 2b: TIPO DE VENDEDOR ===== */}
          {etapa === 'tipo-vendedor' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-titulo text-2xl md:text-3xl">Que tipo de vendedor é você?</h1>
                <p className="font-corpo text-sm text-muted-foreground mt-1">
                  Selecione o tipo que melhor descreve o seu negócio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {TIPOS_VENDEDOR.map(tipo => (
                  <button
                    key={tipo.valor}
                    onClick={() => selecionarTipoVendedor(tipo.valor)}
                    className="border-2 border-border bg-card p-5 text-left hover:border-primary transition-colors rounded-md group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{tipo.icone}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-titulo text-sm font-semibold">{tipo.rotulo}</h3>
                        <p className="font-corpo text-xs text-muted-foreground mt-1 leading-relaxed">
                          {tipo.descricao}
                        </p>
                        <p className="font-corpo text-xs text-muted-foreground/70 mt-1 italic">
                          Ex: {tipo.exemplos}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== ETAPA 3: CONTA DE VENDEDOR ===== */}
          {etapa === 'form-vendedor' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-titulo text-2xl md:text-3xl">{tituloContaProfissional}</h1>
                <div className="flex items-center gap-2 mt-2">
                  {tipoVendedorSelecionado && (() => {
                    const t = TIPOS_VENDEDOR.find(tv => tv.valor === tipoVendedorSelecionado);
                    return t ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary font-corpo text-xs font-medium rounded-md">
                        {t.icone} {t.rotulo}
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="font-corpo text-sm text-muted-foreground mt-2">
                  {tipoVendedorSelecionado === 'prestador_servico'
                    ? 'Etapa 1: Crie a sua conta. Na etapa seguinte irá completar o perfil profissional do seu serviço.'
                    : 'Etapa 1: Crie a sua conta. Na etapa seguinte irá completar o perfil do seu negócio.'}
                </p>
              </div>

              <form onSubmit={handleSubmitVendedorConta} className="border-2 border-border bg-card p-6 rounded-md space-y-4">
                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">Nome do responsável *</Label>
                  <Input value={formVendedor.nome_responsavel}
                    onChange={e => setFormVendedor(p => ({ ...p, nome_responsavel: e.target.value }))}
                    placeholder="Nome completo" required className="border-2 border-border" maxLength={100} />
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">
                    Número de telefone *
                  </Label>

                  <div className="flex">
                    <div className="flex items-center px-3 border-2 border-r-0 border-border rounded-l-md bg-muted text-sm text-muted-foreground">
                      +244
                    </div>

                    <Input
                      type="tel"
                      value={formVendedor.telefone}
                      onChange={e => {
                        const valor = e.target.value.replace(/\D/g, '');

                        setFormVendedor(p => ({
                          ...p,
                          telefone: valor,
                        }));
                      }}
                      placeholder="923456789"
                      className="rounded-l-none border-2 border-border"
                      maxLength={9}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">Senha *</Label>
                  <div className="relative">
                    <Input type={mostrarSenha ? 'text' : 'password'} value={formVendedor.senha}
                      onChange={e => setFormVendedor(p => ({ ...p, senha: e.target.value }))}
                      placeholder="Mínimo 6 caracteres" required className="border-2 border-border pr-10" maxLength={128} />
                    <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">
                    Confirmar senha *
                  </Label>

                  <Input
                    type="password"
                    value={formVendedor.confirmarSenha}
                    onChange={e =>
                      setFormVendedor(p => ({
                        ...p,
                        confirmarSenha: e.target.value,
                      }))
                    }
                    placeholder="Repita a sua senha"
                    required
                    className="border-2 border-border"
                  />
                </div>

                {/* Termos */}
                <label className="flex items-start gap-3 cursor-pointer py-2">
                  <input type="checkbox" checked={formVendedor.termos}
                    onChange={e => setFormVendedor(p => ({ ...p, termos: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-primary" />
                  <span className="font-corpo text-xs text-muted-foreground leading-relaxed">
                    Aceito os <Link to="/termos" className="text-primary underline">termos e condições</Link> e a{' '}
                    <Link to="/privacidade" className="text-primary underline">política de privacidade</Link> da plataforma Angrolink. *
                  </span>
                </label>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full font-corpo font-semibold mt-2"
                >
                  {tipoVendedorSelecionado === 'prestador_servico'
                    ? 'Continuar para o perfil profissional →'
                    : 'Continuar para o perfil do negócio →'}
                </Button>
              </form>
            </div>
          )}

          {/* ===== ETAPA 4: PERFIL COMERCIAL ===== */}
          {etapa === 'perfil-comercial' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-titulo text-2xl md:text-3xl">
                  {tipoVendedorSelecionado ===
                  'prestador_servico'
                    ? 'Perfil profissional'
                    : 'Perfil do negócio'}
                </h1>
                <p>
                  {tipoVendedorSelecionado ===
                  'prestador_servico'
                    ? 'Etapa 2: Complete o perfil do seu serviço.'
                    : 'Etapa 2: Complete os dados do seu negócio para poder publicar produtos.'}
                </p>
              </div>

              <form onSubmit={handleSubmitPerfilComercial} className="border-2 border-border bg-card p-6 rounded-md space-y-5">
                {/* Campos obrigatórios do perfil comercial */}
                <div className="space-y-4">
                  <h3 className="font-titulo text-sm font-semibold flex items-center gap-2">
                    <CheckSquare size={16} className="text-primary" />
                    Informação obrigatória
                  </h3>

                  <div className="space-y-2">
                    <Label className="font-corpo text-sm font-medium">Nome do negócio *</Label>
                    <Input value={formPerfil.nome_comercial}
                      onChange={e => setFormPerfil(p => ({ ...p, nome_comercial: e.target.value }))}
                      placeholder="Ex: Horta da Dona Maria" required className="border-2 border-border" maxLength={100} />
                  </div>

                  <div className="space-y-2">
                    <Label className="font-corpo text-sm font-medium">Descrição curta do negócio *</Label>
                    <textarea value={formPerfil.descricao}
                      onChange={e => setFormPerfil(p => ({ ...p, descricao: e.target.value }))}
                      placeholder="Descreva brevemente o que vende e como funciona o seu negócio..."
                      rows={3} maxLength={500} required
                      className="w-full border-2 border-border bg-background text-foreground font-corpo text-sm px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="space-y-2">
                      <Label className="font-corpo text-sm font-medium">
                        Província de atividade *
                      </Label>

                      <select
                        value={formPerfil.provincia_atividade}
                        onChange={e =>
                          setFormPerfil(p => ({
                            ...p,
                            provincia_atividade: e.target.value,
                            municipio_atividade: '',
                          }))
                        }
                        className={selectClass}
                        required
                      >
                        <option value="">Selecione</option>

                        {PROVINCIAS.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-corpo text-sm font-medium">
                        Município de atividade *
                      </Label>

                      <select
                        value={formPerfil.municipio_atividade}
                        onChange={e =>
                          setFormPerfil(p => ({
                            ...p,
                            municipio_atividade: e.target.value,
                          }))
                        }
                        disabled={!formPerfil.provincia_atividade}
                        className={selectDisabled}
                        required
                      >
                        <option value="">Selecione</option>

                        {municipiosAtividade.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>

                {/* Campos opcionais gerais */}
                <div className="border-t border-border pt-4 space-y-4">
                  <button
                    type="button"
                    onClick={() => setMostrarOpcionais(!mostrarOpcionais)}
                    className="flex items-center gap-2 font-corpo text-xs text-primary hover:underline"
                  >
                    {mostrarOpcionais ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {mostrarOpcionais ? 'Ocultar campos opcionais' : 'Campos opcionais (pode preencher depois)'}
                  </button>

                  {mostrarOpcionais && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-corpo text-sm font-medium">
                            Email (opcional)
                          </Label>

                          <Input
                            type="email"
                            value={formPerfil.email}
                            onChange={e =>
                              setFormPerfil(p => ({
                                ...p,
                                email: e.target.value,
                              }))
                            }
                            placeholder="exemplo@email.com"
                            className="border-2 border-border"
                            maxLength={255}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-corpo text-sm font-medium">
                            Ano de início da atividade
                          </Label>

                          <select
                            value={formPerfil.ano_inicio}
                            onChange={e =>
                              setFormPerfil(p => ({
                                ...p,
                                ano_inicio: e.target.value,
                              }))
                            }
                            className={selectClass}
                          >
                            <option value="">
                              Selecione
                            </option>

                            {ANOS_ATIVIDADE.map(ano => (
                              <option
                                key={ano}
                                value={ano}
                              >
                                {ano}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-corpo text-sm font-medium">Bairro</Label>
                          <Input value={formPerfil.bairro}
                            onChange={e => setFormPerfil(p => ({ ...p, bairro: e.target.value }))}
                            placeholder="Ex: Kikolo" className="border-2 border-border" maxLength={100} />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-corpo text-sm font-medium">Endereço detalhado</Label>
                          <Input value={formPerfil.endereco}
                            onChange={e => setFormPerfil(p => ({ ...p, endereco: e.target.value }))}
                            placeholder="Rua, número..." className="border-2 border-border" maxLength={200} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <Label className="font-corpo text-sm font-medium">
                          Horário de atendimento
                        </Label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                          <div className="space-y-2">
                            <Label className="text-xs">
                              De
                            </Label>

                            <select
                              value={formPerfil.dia_abertura}
                              onChange={e =>
                                setFormPerfil(p => ({
                                  ...p,
                                  dia_abertura: e.target.value,
                                }))
                              }
                              className={selectClass}
                            >
                              <option value="">
                                Selecione
                              </option>

                              {DIAS_SEMANA.map(dia => (
                                <option
                                  key={dia}
                                  value={dia}
                                >
                                  {dia}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">
                              Até
                            </Label>

                            <select
                              value={formPerfil.dia_fecho}
                              onChange={e =>
                                setFormPerfil(p => ({
                                  ...p,
                                  dia_fecho: e.target.value,
                                }))
                              }
                              className={selectClass}
                            >
                              <option value="">
                                Selecione
                              </option>

                              {DIAS_SEMANA.map(dia => (
                                <option
                                  key={dia}
                                  value={dia}
                                >
                                  {dia}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">
                              Abre às
                            </Label>

                            <Input
                              type="time"
                              value={formPerfil.hora_abertura}
                              onChange={e =>
                                setFormPerfil(p => ({
                                  ...p,
                                  hora_abertura:
                                    e.target.value,
                                }))
                              }
                              className="border-2 border-border"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs">
                              Fecha às
                            </Label>

                            <Input
                              type="time"
                              value={formPerfil.hora_fecho}
                              onChange={e =>
                                setFormPerfil(p => ({
                                  ...p,
                                  hora_fecho:
                                    e.target.value,
                                }))
                              }
                              className="border-2 border-border"
                            />
                          </div>

                        </div>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" checked={formPerfil.entrega_disponivel}
                          onChange={e => setFormPerfil(p => ({ ...p, entrega_disponivel: e.target.checked }))}
                          className="w-4 h-4 accent-primary" />
                        <span className="font-corpo text-sm">Entrega disponível</span>
                      </label>

                      {/* Upload fotos — placeholder */}
                      <div className="space-y-3">
                        <Label className="font-corpo text-sm font-medium">
                          Foto de perfil ou logótipo
                        </Label>

                        {previewFoto && (
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={previewFoto}
                              alt="Preview"
                              className="w-28 h-28 rounded-full object-cover border"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                setFotoPerfil(null);
                                setPreviewFoto('');
                              }}
                              className="text-red-600 text-sm hover:underline"
                            >
                              Remover foto
                            </button>
                          </div>
                        )}

                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const ficheiro = e.target.files?.[0];

                            if (!ficheiro) return;

                            if (
                              !ficheiro.type.startsWith('image/')
                            ) {
                              toast.error(
                                'Escolha uma imagem.'
                              );
                              return;
                            }

                            if (
                              ficheiro.size >
                              5 * 1024 * 1024
                            ) {
                              toast.error(
                                'A imagem deve ter menos de 5MB.'
                              );
                              return;
                            }

                            if (!ficheiro) return;

                            setFotoPerfil(ficheiro);
                            setPreviewFoto(
                              URL.createObjectURL(ficheiro)
                            );
                          }}
                          className="block w-full text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Campos específicos por tipo de vendedor */}
                {/*<CamposPorTipo tipo={tipoVendedorSelecionado as TipoVendedor} form={formPerfil} setForm={setFormPerfil} />*/}

                <Button type="submit" disabled={carregando} className="w-full font-corpo font-semibold mt-2">
                  <Send className="w-4 h-4 mr-2" />
                  {carregando ? 'A enviar...' : 'Enviar para aprovação'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>

      <Rodape />
    </div>
  );
}

// ===== COMPONENTE: Campos específicos por tipo de vendedor =====
function CamposPorTipo({
  tipo, form, setForm,
}: {
  tipo: TipoVendedor;
  form: Record<string, any>;
  setForm: React.Dispatch<React.SetStateAction<any>>;
}) {
  const tipoInfo = TIPOS_VENDEDOR.find(t => t.valor === tipo);
  if (!tipoInfo) return null;

  const isProdutor = tipo === 'produtor';
  const isRevendedor = tipo === 'revendedor';
  const isDistribuidor = tipo === 'grossista';
  const isLoja = tipo === 'loja';

  return (
    <div className="border-t border-border pt-4 space-y-4">
      <h3 className="font-titulo text-sm font-semibold flex items-center gap-2">
        <span>{tipoInfo.icone}</span>
        Informação específica — {tipoInfo.rotulo}
      </h3>
      <p className="font-corpo text-xs text-muted-foreground italic">
        Campos opcionais. Pode preencher depois no dashboard.
      </p>

      {/* Produtor */}
      {isProdutor && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-corpo text-sm font-medium">Tipo de produção</Label>
            <Input value={form.tipo_producao}
              onChange={e => setForm((p: any) => ({ ...p, tipo_producao: e.target.value }))}
              placeholder="Ex: Horticultura, Pecuária, Mista" className="border-2 border-border" maxLength={100} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-corpo text-sm font-medium">Área cultivada (hectares)</Label>
              <Input type="number" value={form.area_cultivada}
                onChange={e => setForm((p: any) => ({ ...p, area_cultivada: e.target.value }))}
                placeholder="Ex: 5" className="border-2 border-border" min={0} />
            </div>
            <div className="space-y-2">
              <Label className="font-corpo text-sm font-medium">Produção estimada mensal</Label>
              <Input value={form.producao_mensal}
                onChange={e => setForm((p: any) => ({ ...p, producao_mensal: e.target.value }))}
                placeholder="Ex: 500 kg de tomate" className="border-2 border-border" maxLength={200} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-corpo text-sm font-medium">Principais culturas</Label>
            <Input value={form.principais_culturas}
              onChange={e => setForm((p: any) => ({ ...p, principais_culturas: e.target.value }))}
              placeholder="Ex: Milho, Feijão, Tomate" className="border-2 border-border" maxLength={200} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.venda_grosso}
                onChange={e => setForm((p: any) => ({ ...p, venda_grosso: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="font-corpo text-sm">Venda a grosso</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.venda_retalho}
                onChange={e => setForm((p: any) => ({ ...p, venda_retalho: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="font-corpo text-sm">Venda a retalho</span>
            </label>
          </div>
        </div>
      )}

      {/* Revendedor */}
      {isRevendedor && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-corpo text-sm font-medium">Tipos de produtos vendidos</Label>
            <Input value={form.tipos_produtos}
              onChange={e => setForm((p: any) => ({ ...p, tipos_produtos: e.target.value }))}
              placeholder="Ex: Frutas, Hortaliças, Cereais" className="border-2 border-border" maxLength={200} />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.compra_produtores}
                onChange={e => setForm((p: any) => ({ ...p, compra_produtores: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="font-corpo text-sm">Compra diretamente de produtores</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.venda_retalho}
                onChange={e => setForm((p: any) => ({ ...p, venda_retalho: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="font-corpo text-sm">Venda a retalho</span>
            </label>
          </div>
        </div>
      )}

      {/* Distribuidor / Venda por grosso */}
      {isDistribuidor && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-corpo text-sm font-medium">Tipos de produtos</Label>
            <Input value={form.tipos_produtos}
              onChange={e => setForm((p: any) => ({ ...p, tipos_produtos: e.target.value }))}
              placeholder="Ex: Bebidas, Cereais, Conservas" className="border-2 border-border" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label className="font-corpo text-sm font-medium">Volume mínimo de venda</Label>
            <Input value={form.volume_minimo}
              onChange={e => setForm((p: any) => ({ ...p, volume_minimo: e.target.value }))}
              placeholder="Ex: 10 sacos, 1 palete" className="border-2 border-border" maxLength={100} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.entrega_outras_provincias}
              onChange={e => setForm((p: any) => ({ ...p, entrega_outras_provincias: e.target.checked }))}
              className="w-4 h-4 accent-primary" />
            <span className="font-corpo text-sm">Entrega para outras províncias</span>
          </label>
        </div>
      )}

      {/* Loja / Mercado */}
      {isLoja && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-corpo text-sm font-medium">Tipo de loja</Label>
              <select value={form.tipo_loja}
                onChange={e => setForm((p: any) => ({ ...p, tipo_loja: e.target.value }))}
                className={selectClass}>
                <option value="">Selecione</option>
                <option value="mercearia">Mercearia</option>
                <option value="mini-mercado">Mini-mercado</option>
                <option value="loja-bairro">Loja de bairro</option>
                <option value="supermercado">Supermercado</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="font-corpo text-sm font-medium">Mercado onde está localizado</Label>
              <Input value={form.mercado_localizado}
                onChange={e => setForm((p: any) => ({ ...p, mercado_localizado: e.target.value }))}
                placeholder="Ex: Mercado do Kikolo" className="border-2 border-border" maxLength={100} />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.venda_presencial}
                onChange={e => setForm((p: any) => ({ ...p, venda_presencial: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="font-corpo text-sm">Venda presencial</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.entrega_disponivel}
                onChange={e => setForm((p: any) => ({ ...p, entrega_disponivel: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="font-corpo text-sm">Entrega disponível</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
