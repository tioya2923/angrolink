import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, ArrowLeft, Leaf } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contextos/AuthContexto';
import {
  enviarRecuperacaoSenha,
  normalizarEmailAcessoParaRecuperacao,
} from '@/services/auth';

export default function PaginaLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const { login, autenticado } = useAuth();

  const [modo, setModo] = useState<'login' | 'recuperar'>('login');

  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // ----------------------------------
  // Redirecionar se já autenticado
  // ----------------------------------

  useEffect(() => {
    if (autenticado) {
      const destino = (location.state as { destino?: string } | null)?.destino;
      navigate(destino || '/dashboard');
    }
  }, [autenticado, location.state, navigate]);

  // ----------------------------------
  // LOGIN
  // ----------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setCarregando(true);

      const entrada = identificador.trim();

      const sucesso =
      await login(
        entrada,
        senha
      );

      if (sucesso) {
        toast({
          title: 'Login efetuado com sucesso!',
        });

        // ❗ NÃO redireciona aqui — deixa o useEffect tratar
      } else {
        const mensagemRejeicao = localStorage.getItem('angrolink_mensagem_rejeicao');
        if (mensagemRejeicao) {
          localStorage.removeItem('angrolink_mensagem_rejeicao');
          toast({
            title: 'Pedido de cadastro rejeitado',
            description: mensagemRejeicao.replace(/\n/g, ' '),
            variant: 'destructive',
          });
          return;
        }
        toast({
          title: 'Email ou senha inválidos ou perfil não encontrado.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Erro ao entrar',
        description: 'Tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  // ----------------------------------
  // RECUPERAÇÃO DE SENHA
  // ----------------------------------

  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailAcesso = normalizarEmailAcessoParaRecuperacao(identificador);

    if (!emailAcesso) {
      toast({
        title: 'Insere um email de acesso válido.',
        description: 'A recuperação automática ainda não está disponível para contas que usam apenas telefone.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCarregando(true);

      await enviarRecuperacaoSenha(
        emailAcesso,
        `${window.location.origin}/reset-password`,
      );

      toast({
        title: 'Pedido de recuperação registado',
        description: 'Se o email de acesso estiver associado a uma conta e o envio estiver disponível, receberás instruções.',
      });

      setModo('login');
    } catch {
      toast({
        title: 'Não foi possível processar o pedido',
        description: 'Tenta novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* HEADER */}
      <header className="border-b-2 border-border bg-green-800 sticky top-0 z-50">
        <div className="w-full px-4 md:px-8 flex items-center justify-between h-14 md:h-16">
          <Link
            to="/"
            className="flex items-center gap-2 group transition-opacity hover:opacity-90 font-titulo text-xl md:text-2xl font-bold tracking-tight"
          >
            <Leaf
              className="w-7 h-7 text-white fill-green-600"
              strokeWidth={3}
            />

            <span className="font-titulo text-xl md:text-2xl font-bold tracking-tight text-white">
              ANGROLINK
            </span>
          </Link>

          <Link
            to="/"
            className="flex items-center gap-2 font-corpo text-sm font-medium text-white hover:text-green-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* TÍTULO */}
          <div className="text-center mb-8">
            <h1 className="font-titulo text-2xl md:text-3xl font-bold text-foreground">
              {modo === 'login'
                ? 'Entrar na conta'
                : 'Recuperar senha'}
            </h1>

            <p className="font-corpo text-sm text-muted-foreground mt-2">
              {modo === 'login'
                ? 'Acede à tua conta ANGROLINK'
                : 'Usa o email de acesso para pedir a recuperação'}
            </p>

            
          </div>

          {/* CARD */}
          <div className="border-2 border-border bg-card p-6 md:p-8 rounded-md">

            {/* LOGIN */}
            {modo === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">

                <div className="space-y-2">
                  <Label htmlFor="identificador-login" className="font-corpo text-sm font-medium">
                    Email ou Telefone
                  </Label>

                  <Input
                    id="identificador-login"
                    aria-describedby="identificador-login-ajuda"
                    type="text"
                    placeholder="exemplo@email.com ou 923456789"
                    value={identificador}
                    onChange={e => setIdentificador(e.target.value)}
                    required
                    className="border-2 border-border"
                  />
                  <p id="identificador-login-ajuda" className="font-corpo text-xs text-muted-foreground">
                    Angola: 9 dígitos sem indicativo são interpretados com +244 (ex.: 923456789).
                  </p>
                  <details className="space-y-2 font-corpo text-xs text-muted-foreground">
                    <summary className="cursor-pointer rounded-sm py-1 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Como entrar com email ou telefone</summary>
                    <p>Para outros países, inclui o indicativo internacional (ex.: +351912345678). Usa apenas dígitos, com ou sem + inicial.</p>
                    <p>Se a conta foi criada com email como identificador de acesso, usa esse email. Se foi criada apenas com telefone, usa o número original de acesso à conta, não um contacto alterado no perfil. Alterar contactos do perfil não modifica o login; o email de contacto não permite automaticamente iniciar sessão.</p>
                  </details>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="senha-login" className="font-corpo text-sm font-medium">
                    Senha
                  </Label>

                  <div className="relative">
                    <Input
                      id="senha-login"
                      type={mostrarSenha ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={senha}
                      onChange={e => setSenha(e.target.value)}
                      required
                      className="border-2 border-border pr-10"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setMostrarSenha(!mostrarSenha)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {mostrarSenha
                        ? <EyeOff className="w-4 h-4" />
                        : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setModo('recuperar')}
                    className="font-corpo text-xs text-primary hover:underline"
                  >
                    Esqueceste a senha?
                  </button>
                </div>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full font-corpo font-semibold"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  {carregando ? 'A entrar...' : 'Entrar'}
                </Button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t-2 border-border" />
                  </div>

                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground font-corpo">
                      ou
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/anunciar')}
                  className="w-full font-corpo border-2"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Criar conta
                </Button>

              </form>
            )}

            {/* RECUPERAR */}
            {modo === 'recuperar' && (
              <form onSubmit={handleRecuperar} className="space-y-5">

                <div className="space-y-2">
                  <Label htmlFor="email-recuperacao" className="font-corpo text-sm font-medium">
                    Email de acesso
                  </Label>

                  <Input
                    id="email-recuperacao"
                    type="text"
                    inputMode="email"
                    placeholder="exemplo@email.com"
                    value={identificador}
                    onChange={e => setIdentificador(e.target.value)}
                    required
                    className="border-2 border-border"
                  />
                  <p className="font-corpo text-xs text-muted-foreground">
                    O email de contacto do perfil não habilita recuperação por si só. Se criou a conta apenas com telefone, a recuperação automática ainda não está disponível nesta fase.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={carregando}
                  className="w-full font-corpo font-semibold"
                >
                  {carregando
                    ? 'A enviar...'
                    : 'Enviar link de recuperação'}
                </Button>

                <button
                  type="button"
                  onClick={() => setModo('login')}
                  className="w-full text-center font-corpo text-sm text-primary hover:underline mt-2"
                >
                  Voltar ao login
                </button>

              </form>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
