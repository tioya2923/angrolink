import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound, Leaf } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  limparRecuperacaoSenha,
  marcarRecuperacaoSenha,
  obterRecuperacaoSenha,
} from '@/lib/recuperacaoSenha';
import {
  normalizarEmailAcessoParaRecuperacao,
  verificarCodigoRecuperacaoSenha,
} from '@/services/auth';
import { supabase } from '@/services/supabase';

type EstadoRecuperacao = 'a_validar' | 'pronto' | 'invalido';

export default function PaginaResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [estado, setEstado] = useState<EstadoRecuperacao>('a_validar');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [emailCodigo, setEmailCodigo] = useState('');
  const [codigo, setCodigo] = useState('');
  const [verificandoCodigo, setVerificandoCodigo] = useState(false);
  const userIdRecuperacaoRef = useRef<string | null>(null);
  const submissaoEmCursoRef = useRef(false);
  const verificacaoCodigoEmCursoRef = useRef(false);
  const contextoConsumidoRef = useRef(false);

  const invalidarRecuperacao = useCallback(() => {
    limparRecuperacaoSenha();
    userIdRecuperacaoRef.current = null;
    contextoConsumidoRef.current = true;
    setEstado('invalido');
  }, []);

  const validarSessaoRecuperacao = useCallback(async (userIdEsperado: string) => {
    const contexto = obterRecuperacaoSenha();
    if (contexto?.userId !== userIdEsperado || contextoConsumidoRef.current) {
      invalidarRecuperacao();
      return false;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user || data.user.id !== userIdEsperado) {
      invalidarRecuperacao();
      return false;
    }

    userIdRecuperacaoRef.current = userIdEsperado;
    setEstado('pronto');
    return true;
  }, [invalidarRecuperacao]);

  useEffect(() => {
    const contextoExistente = obterRecuperacaoSenha();
    if (contextoExistente) {
      void validarSessaoRecuperacao(contextoExistente.userId);
    } else {
      invalidarRecuperacao();
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'PASSWORD_RECOVERY' && sessao?.user) {
        contextoConsumidoRef.current = false;
        marcarRecuperacaoSenha(sessao.user.id);
        void validarSessaoRecuperacao(sessao.user.id);
        return;
      }

      const contexto = obterRecuperacaoSenha();
      if (
        evento === 'TOKEN_REFRESHED' &&
        sessao?.user?.id === userIdRecuperacaoRef.current &&
        contexto?.userId === sessao.user.id &&
        !contextoConsumidoRef.current
      ) {
        void validarSessaoRecuperacao(sessao.user.id);
        return;
      }

      invalidarRecuperacao();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [invalidarRecuperacao, validarSessaoRecuperacao]);

  const handleVerificarCodigo = async (event: FormEvent) => {
    event.preventDefault();

    const email = normalizarEmailAcessoParaRecuperacao(emailCodigo);
    const codigoNormalizado = codigo.replace(/\s+/g, '');

    if (!email || !/^\d{6,10}$/.test(codigoNormalizado)) {
      toast({
        title: 'Dados de recuperacao invalidos',
        description: 'Insere um email de acesso valido e o codigo numerico recebido.',
        variant: 'destructive',
      });
      return;
    }

    if (verificacaoCodigoEmCursoRef.current) return;

    try {
      verificacaoCodigoEmCursoRef.current = true;
      setVerificandoCodigo(true);
      setCodigo('');

      const userId = await verificarCodigoRecuperacaoSenha(email, codigoNormalizado);
      contextoConsumidoRef.current = false;
      marcarRecuperacaoSenha(userId);

      const sessaoValida = await validarSessaoRecuperacao(userId);
      if (!sessaoValida) {
        throw new Error('RECUPERACAO_OTP_SESSAO_TROCADA');
      }
    } catch {
      invalidarRecuperacao();
      toast({
        title: 'Codigo de recuperacao invalido ou expirado',
        description: 'Pede um novo codigo e tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      verificacaoCodigoEmCursoRef.current = false;
      setVerificandoCodigo(false);
    }
  };

  const handleSubmeter = async (event: FormEvent) => {
    event.preventDefault();

    if (submissaoEmCursoRef.current || contextoConsumidoRef.current || estado !== 'pronto' || !userIdRecuperacaoRef.current) {
      toast({
        title: 'Link de recuperação inválido ou expirado',
        description: 'Pede um novo link de recuperação para continuar.',
        variant: 'destructive',
      });
      return;
    }

    if (novaSenha.length < 6) {
      toast({
        title: 'Nova palavra-passe inválida',
        description: 'A nova palavra-passe deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    if (novaSenha !== confirmacao) {
      toast({
        title: 'Palavras-passe diferentes',
        description: 'A confirmação não corresponde à nova palavra-passe.',
        variant: 'destructive',
      });
      return;
    }

    try {
      submissaoEmCursoRef.current = true;
      setGuardando(true);

      // Não confiamos na validação feita no carregamento: a sessão pode ter
      // mudado enquanto a página permaneceu aberta.
      const { data: dadosSessao, error: erroSessao } = await supabase.auth.getUser();
      if (erroSessao || dadosSessao.user?.id !== userIdRecuperacaoRef.current) {
        limparRecuperacaoSenha();
        userIdRecuperacaoRef.current = null;
        contextoConsumidoRef.current = true;
        setEstado('invalido');
        throw new Error('RECUPERACAO_SESSAO_TROCADA');
      }

      const { data, error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error || data.user?.id !== userIdRecuperacaoRef.current) {
        throw error || new Error('RECUPERACAO_SESSAO_INVALIDA');
      }

      limparRecuperacaoSenha();
      userIdRecuperacaoRef.current = null;
      contextoConsumidoRef.current = true;
      await supabase.auth.signOut();

      toast({
        title: 'Palavra-passe atualizada',
        description: 'Entra novamente com a tua nova palavra-passe.',
      });
      navigate('/login', { replace: true });
    } catch {
      toast({
        title: 'Não foi possível atualizar a palavra-passe',
        description: 'O link pode ter expirado. Pede um novo link e tenta novamente.',
        variant: 'destructive',
      });
    } finally {
      submissaoEmCursoRef.current = false;
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b-2 border-border bg-green-800 sticky top-0 z-50">
        <div className="w-full px-4 md:px-8 flex items-center justify-between h-14 md:h-16">
          <Link to="/" className="flex items-center gap-2 font-titulo text-xl md:text-2xl font-bold tracking-tight text-white">
            <Leaf className="w-7 h-7 text-white fill-green-600" strokeWidth={3} />
            ANGROLINK
          </Link>
          <Link to="/login" className="flex items-center gap-2 font-corpo text-sm font-medium text-white hover:text-green-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao login
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md border-2 border-border bg-card p-6 md:p-8 rounded-md">
          <div className="text-center mb-8">
            <KeyRound className="w-8 h-8 mx-auto text-primary" aria-hidden="true" />
            <h1 className="font-titulo text-2xl md:text-3xl font-bold text-foreground mt-3">Definir nova palavra-passe</h1>
          </div>

          {estado === 'a_validar' && (
            <p className="font-corpo text-sm text-muted-foreground text-center" role="status">
              A validar o link de recuperação…
            </p>
          )}

          {estado === 'invalido' && (
            <div className="space-y-5">
              <p className="font-corpo text-sm text-muted-foreground">
                Este link de recuperação é inválido, expirou ou já foi utilizado.
              </p>
              <form onSubmit={handleVerificarCodigo} className="space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="email-codigo-recuperacao">Email de acesso</Label>
                  <Input
                    id="email-codigo-recuperacao"
                    type="email"
                    autoComplete="email"
                    value={emailCodigo}
                    onChange={(event) => setEmailCodigo(event.target.value)}
                    disabled={verificandoCodigo}
                    required
                    className="border-2 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo-recuperacao">Codigo de recuperacao</Label>
                  <Input
                    id="codigo-recuperacao"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    disabled={verificandoCodigo}
                    required
                    className="border-2 border-border"
                  />
                </div>
                <p className="font-corpo text-xs text-muted-foreground">
                  Introduz o codigo recebido no email de acesso. O email de contacto do perfil nao e usado para recuperar a palavra-passe.
                </p>
                <Button type="submit" disabled={verificandoCodigo} className="w-full font-corpo font-semibold">
                  {verificandoCodigo ? 'A verificar…' : 'Verificar codigo'}
                </Button>
              </form>
              <Button asChild variant="outline" className="w-full font-corpo font-semibold">
                <Link to="/login">Voltar ao login</Link>
              </Button>
            </div>
          )}

          {estado === 'pronto' && (
            <form onSubmit={handleSubmeter} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="nova-password-recuperacao">Nova palavra-passe</Label>
                <Input id="nova-password-recuperacao" type="password" autoComplete="new-password" value={novaSenha} onChange={(event) => setNovaSenha(event.target.value)} required className="border-2 border-border" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmar-password-recuperacao">Confirmar nova palavra-passe</Label>
                <Input id="confirmar-password-recuperacao" type="password" autoComplete="new-password" value={confirmacao} onChange={(event) => setConfirmacao(event.target.value)} required className="border-2 border-border" />
              </div>
              <Button type="submit" disabled={guardando} className="w-full font-corpo font-semibold">
                {guardando ? 'A atualizar…' : 'Atualizar palavra-passe'}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
