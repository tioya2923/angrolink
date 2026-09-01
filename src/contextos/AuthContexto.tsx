/**
 * ========================================
 * CONTEXTO AUTH — Supabase + fallback controlado
 * ========================================
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

import { Utilizador, TipoComprador, Vendedor } from '@/tipos';
import { supabase } from '@/services/supabase';
import {
  gerarEmailInterno,
  normalizarIdentificadorLogin,
} from '@/lib/verificacoesConta';
import { verificarAdminNoServidor } from '@/lib/autorizacaoAdmin';
import { fetchMeuVendedor } from '@/services/api';

const STORAGE_KEY = 'angrolink_auth_user';
const STORAGE_TIPO_COMPRADOR = 'angrolink_tipo_comprador';
const STORAGE_MENSAGEM_REJEICAO = 'angrolink_mensagem_rejeicao';



interface DadosCadastro {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  indicativo?: string;
  provincia?: string;
  municipio?: string;
  tipo_comprador?: TipoComprador;
  fotoPerfil?: File | null;
}

interface AuthContextoTipo {
  utilizador: Utilizador | null;
  login: (email: string, senha: string) => Promise<boolean>;
  cadastro: (dados: DadosCadastro) => Promise<boolean>;
  logout: () => Promise<void>;
  autenticado: boolean;
  pronto: boolean;
  tipoComprador: TipoComprador;
  atualizarTipoComprador: (tipo: TipoComprador) => void;
  recarregarPerfil: () => Promise<boolean>;
}

const AuthContexto = createContext<AuthContextoTipo | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(null);
  const [tipoComprador, setTipoComprador] = useState<TipoComprador>('casa');
  const [pronto, setPronto] = useState(false);

  const guardarUtilizador = (user: Utilizador) => {
    setUtilizador(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

    if (
      user.tipo_comprador === 'casa' ||
      user.tipo_comprador === 'negocio'
    ) {
      setTipoComprador(user.tipo_comprador);
      localStorage.setItem(STORAGE_TIPO_COMPRADOR, user.tipo_comprador);
    }
  };

  const montarUtilizadorCliente = (cliente: any, authUser: any): Utilizador => ({
    id: authUser.id,
    nome: cliente?.nome || authUser.user_metadata?.nome || '',
    email: cliente?.email || authUser.email || '',
    telefone: cliente?.telefone || authUser.user_metadata?.telefone || '',
    provincia: cliente?.provincia || authUser.user_metadata?.provincia || '',
    municipio: cliente?.municipio || authUser.user_metadata?.municipio || '',
    papel: 'cliente',
    tipo_comprador:
      cliente?.tipo_comprador ||
      authUser.user_metadata?.tipo_comprador ||
      tipoComprador ||
      'casa',
    foto_perfil: cliente?.foto_perfil || null,
    conta_ativa: cliente?.conta_ativa !== false,
  });

  const montarUtilizadorVendedor = (vendedor: any, authUser: any): Utilizador => ({
    id: authUser.id,
    nome:
      vendedor?.nome_responsavel ||
      vendedor?.nome_comercial ||
      authUser.user_metadata?.nome ||
      '',
    email: vendedor?.email || authUser.email || '',
    telefone:
      vendedor?.telefone_whatsapp ||
      vendedor?.whatsapp ||
      authUser.user_metadata?.telefone ||
      '',
    provincia: vendedor?.provincia || authUser.user_metadata?.provincia || '',
    municipio: vendedor?.municipio || authUser.user_metadata?.municipio || '',
    papel: 'vendedor',
    vendedor_id: vendedor?.id,
    foto_perfil: vendedor?.foto_perfil || null,

    status_aprovacao: vendedor?.status_aprovacao || 'pendente',
    motivo_rejeicao: vendedor?.motivo_rejeicao || null,
    verificado: vendedor?.verificado || false,
    pode_destacar: vendedor?.pode_destacar || false,
    conta_ativa: vendedor?.conta_ativa !== false,
    plano: vendedor?.plano || 'gratuito',
  });

  const montarUtilizadorParceiroEntrega = (parceiro: any, authUser: any): Utilizador => ({
    id: authUser.id,
    nome: parceiro.nome_completo || authUser.user_metadata?.nome || '',
    email: parceiro.email || authUser.email || '',
    telefone: parceiro.telefone || authUser.user_metadata?.telefone || '',
    provincia: parceiro.provincia || '',
    municipio: parceiro.municipio || '',
    bairro: parceiro.bairro || '',
    foto_perfil: parceiro.foto_perfil_url || null,
    papel: 'parceiro_entrega',
    parceiro_entrega_id: parceiro.id,
    estado_parceiro_entrega: parceiro.estado,
    motivo_suspensao: parceiro.motivo_suspensao || null,
    conta_ativa: parceiro.estado !== 'suspenso' && parceiro.estado !== 'rejeitado',
  });

  const carregarPerfilSupabase = async (authUser: any): Promise<boolean> => {
    if (!authUser?.id) {
      console.error('Auth user sem ID.');
      return false;
    }

    const ehAdmin = await verificarAdminNoServidor(async () => {
      const { data, error } = await supabase.rpc('eh_admin');
      if (error) console.error('Erro ao validar papel administrativo:', error);
      return { data, error };
    });

    if (ehAdmin) {
      const adminUser: Utilizador = {
        id: authUser.id,
        nome: authUser.user_metadata?.nome || 'Administrador',
        email: authUser.email || '',
        telefone: authUser.user_metadata?.telefone || '',
        provincia: '',
        municipio: '',
        papel: 'admin',
      };

      guardarUtilizador(adminUser);
      return true;
    }

    const vendedor = await fetchMeuVendedor() as (Vendedor & { conta_ativa: boolean | null }) | null;

    if (!vendedor && authUser.user_metadata?.papel === 'vendedor') {
      console.warn('Perfil do vendedor ainda não foi criado.');
    }

    if (vendedor === undefined) {
      console.error('Erro ao carregar vendedor.');
      return false;
    }

    if (vendedor) {
      // Rejeição e suspensão restringem funções comerciais, mas não são um
      // bloqueio de autenticação: o vendedor precisa entrar para consultar e
      // corrigir a candidatura/documentação.
      if (vendedor.conta_ativa === false) {
        await supabase.auth.signOut();

        setUtilizador(null);
        localStorage.removeItem(STORAGE_KEY);

        console.warn('Conta de vendedor desativada.');
        return false;
      }

      const userFinal: Utilizador = montarUtilizadorVendedor(vendedor, authUser);

      guardarUtilizador(userFinal);
      return true;
    }

    const { data: parceiro, error: parceiroError } = await supabase
      .from('parceiros_entrega')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (parceiroError) {
      console.error('Erro ao carregar parceiro de entregas:', parceiroError);
      return false;
    }

    if (parceiro) {
      if (parceiro.estado === 'rejeitado') {
        localStorage.setItem(STORAGE_MENSAGEM_REJEICAO, parceiro.motivo_rejeicao || 'O seu pedido de parceiro de entregas foi rejeitado. Contacte a equipa ANGROLINK.');
        await supabase.auth.signOut();
        setUtilizador(null);
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
      guardarUtilizador(montarUtilizadorParceiroEntrega(parceiro, authUser));
      return true;
    }

    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (clienteError) {
      console.error('Erro ao carregar cliente:', clienteError);
      return false;
    }

    if (cliente) {
      if (cliente.conta_ativa === false) {
        await supabase.auth.signOut();

        setUtilizador(null);
        localStorage.removeItem(STORAGE_KEY);

        console.warn('Conta de cliente desativada.');
        return false;
      }

      const userFinal = montarUtilizadorCliente(cliente, authUser);
      guardarUtilizador(userFinal);
      return true;
    }

    const papelMetadata = authUser.user_metadata?.papel;

    if (papelMetadata === 'vendedor') {

      for (let i = 0; i < 10; i++) {

        await new Promise(resolve =>
          setTimeout(resolve, 500)
        );

        const vendedorNovo = await fetchMeuVendedor();

        if (vendedorNovo) {

          const userFinal =
            montarUtilizadorVendedor(
              vendedorNovo,
              authUser
            );

          guardarUtilizador(userFinal);

          return true;
        }
      }

      console.warn(
        'Perfil do vendedor ainda não foi criado.'
      );

      return false;
    }

    if (papelMetadata === 'parceiro_entrega') {
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: parceiroNovo } = await supabase
          .from('parceiros_entrega')
          .select('*')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (parceiroNovo) {
          const userFinal = montarUtilizadorParceiroEntrega(
            parceiroNovo,
            authUser
          );

          guardarUtilizador(userFinal);
          return true;
        }
      }

      console.warn('Perfil do parceiro de entregas ainda não foi criado.');
      return false;
    }

    console.warn('Cliente não encontrado. A criar perfil cliente automaticamente.');


    const novoCliente = {
      id: authUser.id,
      nome: authUser.user_metadata?.nome || authUser.email?.split('@')[0] || '',
      email: authUser.email || '',
      telefone: authUser.user_metadata?.telefone || '',
      provincia: authUser.user_metadata?.provincia || '',
      municipio: authUser.user_metadata?.municipio || '',
      tipo_comprador:
        authUser.user_metadata?.tipo_comprador || tipoComprador || 'casa',
      atualizado_em: new Date().toISOString(),
    };

    const { data: clienteCriado, error: erroCriar } = await supabase
      .from('clientes')
      .upsert(novoCliente)
      .select()
      .single();

    if (erroCriar) {
      console.error('Erro ao criar cliente automaticamente:', erroCriar);
      return false;
    }

    const userFinal = montarUtilizadorCliente(clienteCriado, authUser);
    guardarUtilizador(userFinal);

    return true;
  };

  const atualizarTipoComprador = (tipo: TipoComprador) => {
    setTipoComprador(tipo);
    localStorage.setItem(STORAGE_TIPO_COMPRADOR, tipo);

    if (utilizador) {
      const atualizado = {
        ...utilizador,
        tipo_comprador: tipo,
      };

      guardarUtilizador(atualizado);

      if (!utilizador.id.startsWith('u-') && utilizador.papel === 'cliente') {
        supabase
          .from('clientes')
          .update({
            tipo_comprador: tipo,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', utilizador.id)
          .then(({ error }) => {
            if (error) console.error('Erro ao atualizar tipo comprador:', error);
          });
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const iniciarAuth = async () => {
      try {
        const tipoGuardado = localStorage.getItem(STORAGE_TIPO_COMPRADOR);

        if (tipoGuardado === 'casa' || tipoGuardado === 'negocio') {
          setTipoComprador(tipoGuardado);
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) console.error('Erro ao obter sessão:', error);

        if (session?.user) {
          await carregarPerfilSupabase(session.user);
        }
      } catch (error) {
        console.error('Erro ao iniciar auth:', error);
      } finally {
        if (mounted) setPronto(true);
      }
    };

    iniciarAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AUTH EVENT:', event);

      if (!mounted) return;

      if (session?.user) {
        setTimeout(() => {
          if (!mounted) return;

          carregarPerfilSupabase(session.user).then(resultado => {
            console.log('AUTH EVENT carregarPerfilSupabase:', resultado);
          });
        }, 0);

        return;
      }

      setUtilizador(null);
      localStorage.removeItem(STORAGE_KEY);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Mantém o estado administrativo (aprovação, suspensão e plano) atualizado
  // enquanto o vendedor tem o painel aberto. Realtime atualiza de imediato;
  // a verificação periódica é uma salvaguarda caso Realtime não esteja ativo.
  useEffect(() => {
    if (utilizador?.papel !== 'vendedor' || !utilizador.id) return;

    let ativo = true;
    const sincronizarPerfil = async () => {
      const { data } = await supabase.auth.getUser();
      if (ativo && data.user) await carregarPerfilSupabase(data.user);
    };

    const canal = supabase
      .channel(`perfil-vendedor-${utilizador.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'vendedores', filter: `user_id=eq.${utilizador.id}` },
        sincronizarPerfil
      )
      .subscribe();

    const intervalo = window.setInterval(sincronizarPerfil, 30000);
    window.addEventListener('focus', sincronizarPerfil);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.removeEventListener('focus', sincronizarPerfil);
      supabase.removeChannel(canal);
    };
  }, [utilizador?.id, utilizador?.papel]);

  useEffect(() => {
    if (!pronto) return;

    if (utilizador) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(utilizador));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [utilizador, pronto]);

  const login = async (
    identificador: string,
    senha: string
  ): Promise<boolean> => {

    let emailLogin =
    normalizarIdentificadorLogin(
      identificador
    );

    // 1. Login pelo número
    const apenasNumeros = emailLogin.replace(/\D/g, '');

    // Aceita o número nacional de 9 dígitos (Angola) ou um número
    // internacional completo. O limite de 15 segue o formato E.164.
    if (/^\d{9,15}$/.test(emailLogin)) {
      emailLogin = gerarEmailInterno(apenasNumeros);
    }

    // O email introduzido é enviado diretamente para Auth. Não consultamos
    // perfis de cliente ou vendedor antes da sessão: esses campos são privados
    // e não devem servir como mecanismo público de descoberta de contas.
    let lastSignInError: any = null;

    const attemptSignIn = async (email: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: senha,
      });

      lastSignInError = error;

      if (!error && data.user) {
        const perfilCarregado = await carregarPerfilSupabase(data.user);
        if (!perfilCarregado) {
          console.error('Login autenticou, mas não carregou perfil.');
          return false;
        }
        return true;
      }

      return false;
    };

    if (await attemptSignIn(emailLogin)) {
      return true;
    }

    if (!emailLogin.endsWith('@telefone.angrolink')) {
      const { data: parceiro } = await supabase
        .from('parceiros_entrega')
        .select('telefone')
        .eq('email', emailLogin)
        .maybeSingle();

      if (parceiro?.telefone) {
        const emailInterno = gerarEmailInterno(parceiro.telefone.replace(/\D/g, ''));
        if (await attemptSignIn(emailInterno)) {
          return true;
        }
      }
    }

    console.warn('Login Supabase falhou:', lastSignInError?.message);
    return false;
  };

  const cadastro = async (dados: DadosCadastro): Promise<boolean> => {
    const tipoFinal =
      dados.tipo_comprador || tipoComprador || 'casa';

    const emailOpcional =
      dados.email?.trim()
        ? dados.email.trim().toLowerCase()
        : null;

    const emailLogin =
      gerarEmailInterno(dados.telefone || '', dados.indicativo);

    const { data, error } = await supabase.auth.signUp({
      email: emailLogin,
      password: dados.senha,
      options: {
        data: {
          nome: dados.nome,
          telefone: dados.telefone || '',
          provincia: dados.provincia || '',
          municipio: dados.municipio || '',
          tipo_comprador: tipoFinal,
          papel: 'cliente',
        },
      },
    });
    if (error || !data.user) {
      if (error?.message === 'User already registered') {
        throw new Error('EMAIL_JA_REGISTADO');
      }

      console.error('Erro cadastro:', error);
      return false;
    }

    let fotoPerfilUrl: string | null = null;

    if (dados.fotoPerfil) {

      const extensao =
        dados.fotoPerfil.name.split('.').pop();

      const nomeFicheiro =
        `${data.user.id}/foto.${extensao}`;

      const { error: erroUpload } =
        await supabase.storage
          .from('clientes')
          .upload(
            nomeFicheiro,
            dados.fotoPerfil,
            {
              upsert: true,
            }
          );

      if (erroUpload) {
        console.error(
          'Erro ao enviar foto:',
          erroUpload
        );
      } else {

        const { data: urlPublica } =
          supabase.storage
            .from('clientes')
            .getPublicUrl(nomeFicheiro);

        fotoPerfilUrl =
          urlPublica.publicUrl;
      }
    }

    const novoCliente = {
      id: data.user.id,
      nome: dados.nome,
      email: emailOpcional,
      email_login: emailLogin,
      telefone: dados.telefone || '',
      provincia: dados.provincia || '',
      municipio: dados.municipio || '',
      tipo_comprador: tipoFinal,
      foto_perfil: fotoPerfilUrl,

      atualizado_em: new Date().toISOString(),
    };

    const { error: erroCliente } = await supabase
      .from('clientes')
      .upsert(novoCliente);

    if (erroCliente) {
      console.error(
        'Erro ao criar perfil cliente:',
        erroCliente
      );
      return false;
    }

    localStorage.setItem(
      STORAGE_TIPO_COMPRADOR,
      tipoFinal
    );

    setTipoComprador(tipoFinal);

    await carregarPerfilSupabase(data.user);

    return true;

    
  };
  

  const logout = async () => {
    await supabase.auth.signOut();

    setUtilizador(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Atualiza o papel quando a mesma conta passa a ter outro perfil na
  // plataforma, sem obrigar o utilizador a terminar e reiniciar a sessão.
  const recarregarPerfil = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return false;
    return carregarPerfilSupabase(data.user);
  };

  return (
    <AuthContexto.Provider
      value={{
        utilizador,
        login,
        cadastro,
        logout,
        autenticado: !!utilizador,
        pronto,
        tipoComprador,
        atualizarTipoComprador,
        recarregarPerfil,
      }}
    >
      {children}
    </AuthContexto.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContexto);

  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }

  return ctx;
}
