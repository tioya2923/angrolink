import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, ArrowLeft, Leaf } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contextos/AuthContexto';
import { supabase } from '@/services/supabase';

export default function PaginaLogin() {
  const navigate = useNavigate();
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
      navigate('/dashboard');
    }
  }, [autenticado, navigate]);

  // ----------------------------------
  // LOGIN
  // ----------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setCarregando(true);

      const entrada = identificador.trim();

      console.log('LOGIN:', entrada);

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
        toast({
          title: 'Email ou senha inválidos ou perfil não encontrado.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error(error);

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

    if (!identificador) {
      toast({
        title: 'Insere um email ou telefone válido.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setCarregando(true);

      const { error } =
        await supabase.auth.resetPasswordForEmail(identificador.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });

      if (error) throw error;

      toast({
        title: 'Email enviado!',
        description: 'Verifica a tua caixa de entrada.',
      });

      setModo('login');
    } catch (error) {
      console.error(error);

      toast({
        title: 'Erro ao enviar recuperação',
        description: 'Não foi possível enviar o email.',
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
                ? 'Acede à tua conta de vendedor ou comprador'
                : 'Insere o teu email para receber o link de recuperação'}
            </p>

            
          </div>

          {/* CARD */}
          <div className="border-2 border-border bg-card p-6 md:p-8 rounded-md">

            {/* LOGIN */}
            {modo === 'login' && (
              <form onSubmit={handleLogin} className="space-y-5">

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">
                    Email ou Telefone
                  </Label>

                  <Input
                    type="text"
                    placeholder="exemplo@email.com ou 923456789"
                    value={identificador}
                    onChange={e => setIdentificador(e.target.value)}
                    required
                    className="border-2 border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-corpo text-sm font-medium">
                    Senha
                  </Label>

                  <div className="relative">
                    <Input
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
                  <Label className="font-corpo text-sm font-medium">
                    Email ou Telefone
                  </Label>

                  <Input
                    type="text"
                    placeholder="923456789 ou exemplo@email.com"
                    value={identificador}
                    onChange={e => setIdentificador(e.target.value)}
                    required
                    className="border-2 border-border"
                  />
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