/**
 * Cliente — Definições da conta com Supabase real
 */

import { useEffect, useState } from 'react';
import { Save, Trash2, Lock, Camera, Loader2, X } from 'lucide-react';

import { useAuth } from '@/contextos/AuthContexto';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import SeletorTelefone from '@/componentes/SeletorTelefone';
import { PROVINCIAS, MUNICIPIOS } from '@/dados/constantes';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/services/supabase';
import { separarIndicativo } from '@/dados/paises';
import { telefoneCompleto } from '@/lib/verificacoesConta';

export default function ClienteDefinicoes() {
  const { utilizador, logout } = useAuth();
  const { toast } = useToast();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  const [apagandoConta, setApagandoConta] = useState(false);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [indicativo, setIndicativo] = useState('244');
  const [email, setEmail] = useState('');
  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [fotoPerfil, setFotoPerfil] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const municipiosFiltrados = MUNICIPIOS.filter(
    m => m.provincia_id === PROVINCIAS.find(p => p.nome === provincia)?.id
  );

  useEffect(() => {
    carregarCliente();
  }, [utilizador?.id]);

  async function carregarCliente() {
    if (!utilizador?.id) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', utilizador.id)
      .single();

    if (error) {
      console.error('Erro ao carregar cliente:', error);

      const { indicativo: ind, numero } = separarIndicativo(utilizador?.telefone || '');
      setNome(utilizador?.nome || '');
      setIndicativo(ind);
      setTelefone(numero);
      setEmail(utilizador?.email || '');
      setProvincia(utilizador?.provincia || '');
      setMunicipio(utilizador?.municipio || '');

      setLoading(false);
      return;
    }

    const { indicativo: indCarregado, numero } = separarIndicativo(data.telefone || '');
    setNome(data.nome || '');
    setIndicativo(indCarregado);
    setTelefone(numero);
    setEmail(data.email || utilizador.email || '');
    setProvincia(data.provincia || '');
    setMunicipio(data.municipio || '');
    setFotoPerfil(data.foto_perfil || null);

    setLoading(false);
  }

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
        description: 'Use JPG, PNG ou WEBP. No iPhone, escolha uma imagem em formato compatível.',
        variant: 'destructive',
      });
      return;
    }

    setFotoFile(file);
    setFotoPerfil(URL.createObjectURL(file));
  };

  async function uploadFotoPerfil() {
    if (!fotoFile || !utilizador?.id) return fotoPerfil;

    const extensao = fotoFile.name.split('.').pop();
    const caminho = `${utilizador.id}/perfil-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage
      .from('clientes')
      .upload(caminho, fotoFile, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('clientes')
      .getPublicUrl(caminho);

    return data.publicUrl;
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!utilizador?.id) {
      toast({
        title: 'Erro',
        description: 'Utilizador não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const fotoFinal = await uploadFotoPerfil();

      const { error } = await supabase
        .from('clientes')
        .upsert({
          id: utilizador.id,
          nome,
          telefone: telefone ? telefoneCompleto(telefone, indicativo) : '',
          email,
          provincia,
          municipio,
          foto_perfil: fotoFinal,
          atualizado_em: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: 'Definições guardadas!',
        description: 'Os teus dados foram atualizados com sucesso.',
      });

      setFotoFile(null);
    } catch (error) {
      console.error('Erro ao guardar definições:', error);

      toast({
        title: 'Erro ao guardar',
        description: 'Não foi possível atualizar as definições.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  async function removerFoto() {
    setFotoPerfil(null);
    setFotoFile(null);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 font-corpo text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        A carregar definições...
      </div>
    );
  }

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

  return (
    <div className="space-y-6 max-w-2xl">
      <header className="painel-dashboard-cabecalho">
        <h1 className="relative z-10 font-titulo text-2xl font-bold text-primary-foreground">Definições da conta</h1>
        <p className="relative z-10 mt-1 font-corpo text-sm text-primary-foreground/80">Atualiza os teus dados, fotografia e segurança da conta.</p>
      </header>

      <div className="painel-dashboard-form flex items-center gap-4">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-2 border-green-900/20 overflow-hidden bg-green-700 flex items-center justify-center">
            {fotoPerfil ? (
              <img
                src={fotoPerfil}
                alt="Foto de perfil"
                className="w-full h-full object-cover "
              />
            ) : (
              <Camera size={24} className="text-green-700" />
            )}
          </div>

          <label className="absolute bottom-0 right-0 flex items-center gap-1 rounded-full bg-green-700 px-3 py-1 text-white cursor-pointer hover:bg-green-900 transition-colors shadow-md">
            <Camera size={12} />
            <span className="text-xs font-medium">Alterar foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFotoChange}
              className="hidden"
            />
          </label>
        </div>

        <div className="space-y-1">
          <p className="font-corpo text-sm font-medium">Foto de perfil</p>
          <p className="font-corpo text-xs text-muted-foreground">
            Máximo 500KB · JPG, PNG ou WEBP
          </p>

          {fotoPerfil && (
            <button
              type="button"
              onClick={removerFoto}
              className="flex items-center gap-1 font-corpo text-xs text-destructive hover:underline"
            >
              <X size={12} />
              Remover foto
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleGuardar} className="painel-dashboard-form space-y-4">
        <div className="space-y-2">
          <Label className="font-corpo text-sm">Nome</Label>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            className="border-2 border-border"
          />
        </div>

        <div className="space-y-2">
          <Label className="font-corpo text-sm">Telefone</Label>

          <SeletorTelefone
            indicativo={indicativo}
            onIndicativoChange={setIndicativo}
            valor={telefone}
            onValorChange={setTelefone}
            placeholder="923000000"
            maxLength={indicativo === '244' ? 9 : 14}
          />

          <p className="font-corpo text-xs text-muted-foreground">
            {indicativo === '244'
              ? 'Coloca apenas os 9 dígitos do número angolano.'
              : 'Coloca o número local, sem o indicativo do país.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-corpo text-sm">Email</Label>
          <Input
            value={email}
            type="email"
            disabled
            className="border-2 border-border bg-muted cursor-not-allowed"
          />
          <p className="font-corpo text-xs text-muted-foreground">
            O email deve ser alterado através da autenticação da conta.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="font-corpo text-sm">Província</Label>
            <select
              value={provincia}
              onChange={e => {
                setProvincia(e.target.value);
                setMunicipio('');
              }}
              className="w-full border-2 border-border bg-background font-corpo text-sm px-3 py-2 focus:outline-none focus:border-primary"
            >
              <option value="">Selecionar</option>
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
              className="w-full border-2 border-border bg-background font-corpo text-sm px-3 py-2 focus:outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="">Selecionar</option>
              {municipiosFiltrados.map(m => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Button type="submit" disabled={saving} className="font-corpo font-semibold bg-green-700 hover:bg-green-800 text-white">
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              A guardar...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Guardar Alterações
            </>
          )}
        </Button>
      </form>

      <div className="space-y-6">
        <div className="painel-dashboard-form space-y-3">
          <h2 className="font-titulo text-lg font-semibold flex items-center gap-2">
            <Lock size={18} />
            Alterar palavra-passe
          </h2>

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
        </div>

        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5 space-y-3">
          <h2 className="font-titulo text-lg font-semibold text-destructive flex items-center gap-2">
            <Trash2 size={18} />
            Apagar Conta
          </h2>

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
        </div>
      </div>
    </div>
  );
}
