import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle } from 'lucide-react';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

import { useAuth } from '@/contextos/AuthContexto';

import {
  fetchServicoPorId,
  incrementarVisualizacaoServico,
  incrementarCliqueWhatsappServico,
  guardarVisualizacaoServico,
  guardarHistoricoContactoServico,
} from '@/services/api';

import { gerarLinkWhatsApp } from '@/lib/whatsapp';
import { Servico } from '@/tipos';
import SeloVendedor from '@/componentes/SeloVendedor';

export default function PaginaServico() {
  const { id } = useParams<{ id: string }>();
  const { utilizador } = useAuth();

  const [servico, setServico] = useState<Servico | null>(null);
  const [loading, setLoading] = useState(true);

  // ====================================
  // CARREGAR SERVIÇO + REGISTAR VIEW
  // ====================================
  useEffect(() => {
    async function carregarServico() {
      if (!id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const data = await fetchServicoPorId(id);

        setServico(data);

        if (data?.id) {
          // =============================
          // 🔥 BLOQUEAR AUTO-VISUALIZAÇÃO
          // =============================
          const vendedorDono =
            utilizador?.papel === 'vendedor' &&
            utilizador?.vendedor_id === data.vendedor_id;

          const admin = utilizador?.papel === 'admin';

          if (!vendedorDono && !admin) {
            incrementarVisualizacaoServico(data.id);

            // guardar apenas para cliente
            if (utilizador?.id && utilizador?.papel === 'cliente') {
              guardarVisualizacaoServico({
                cliente_id: utilizador.id,
                servico: data,
              });
            }
          }
        }

      } catch (error) {
        console.error(
          'Erro ao carregar serviço:',
          error
        );

        setServico(null);

      } finally {
        setLoading(false);
      }
    }

    carregarServico();
  }, [id, utilizador?.id, utilizador?.papel, utilizador?.vendedor_id]);

  // ====================================
  // REGISTAR CLIQUE WHATSAPP
  // ====================================
  const handleCliqueWhatsapp = async () => {
    if (!servico?.id) return;

    console.log("Clique WhatsApp Serviço");
    // =============================
    // 🔥 BLOQUEAR AUTO-CLIQUE
    // =============================
    const vendedorDono =
      utilizador?.papel === 'vendedor' &&
      utilizador?.vendedor_id === servico.vendedor_id;

    const admin = utilizador?.papel === 'admin';

    if (vendedorDono || admin) return;

    try {
      await incrementarCliqueWhatsappServico(
        servico.id
      );
    } catch (error) {
      console.error(
        'Erro ao registar clique WhatsApp:',
        error
      );
    }

    if (utilizador?.id && utilizador?.papel === 'cliente') {
      await guardarHistoricoContactoServico({
        cliente_id: utilizador.id,
        servico,
      });
    }

    // =============================
    // USER NÃO LOGADO → LOCAL
    // =============================
    if (!utilizador?.id) {
      const historicoLocal = JSON.parse(
        localStorage.getItem('historico_servicos') || '[]'
      );

      historicoLocal.push({
        servico_id: servico.id,
        nome_servico: servico.nome_servico,
        telefone: telefoneContacto,
        data: new Date().toISOString(),
      });

      localStorage.setItem(
        'historico_servicos',
        JSON.stringify(historicoLocal)
      );
    }
  };

  // ====================================
  // LOADING
  // ====================================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />

        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">
            A carregar serviço...
          </p>
        </main>

        <Rodape />
      </div>
    );
  }

  // ====================================
  // NÃO ENCONTRADO
  // ====================================
  if (!servico) {
    return (
      <div className="min-h-screen flex flex-col">
        <Cabecalho />

        <main className="flex-1 flex items-center justify-center">
          <p className="font-corpo text-muted-foreground">
            Serviço não encontrado.
          </p>
        </main>

        <Rodape />
      </div>
    );
  }

  // ====================================
  // DADOS DO PRESTADOR
  // ====================================
  const vendedor = servico.vendedor;

  const nomePrestador =
    vendedor?.nome_comercial ||
    servico.nome_prestador ||
    'Prestador';

  const telefoneContacto =
    vendedor?.telefone_whatsapp ||
    servico.telefone_whatsapp;

  const vendedorDono =
    utilizador?.papel === 'vendedor' &&
    utilizador?.vendedor_id === servico.vendedor_id;

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1">
        <div className="container py-4">

          {/* VOLTAR */}
          <Link
            to="/servicos"
            className="inline-flex items-center gap-1 font-corpo text-sm text-muted-foreground hover:text-primary mb-4"
          >
            <ArrowLeft size={16} />
            Voltar aos serviços
          </Link>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* IMAGEM */}
            <div className="border-2 border-border overflow-hidden aspect-square">
              <img
                src={
                  servico.imagem_url ||
                  '/placeholder.png'
                }
                alt={servico.nome_servico}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src =
                    '/placeholder.png';
                }}
              />
            </div>

            {/* INFO */}
            <div className="space-y-4">

              <h1 className="font-titulo text-2xl md:text-3xl">
                {servico.nome_servico}
              </h1>

              <p className="font-corpo text-sm text-muted-foreground">
                {servico.tipo_servico || 'Serviço'}
              </p>

              <p className="font-titulo text-3xl text-primary">
                {servico.preco_estimado
                  ? `${Number(
                      servico.preco_estimado
                    ).toLocaleString()} Kz`
                  : 'Preço sob consulta'}
              </p>

              <p className="font-corpo text-sm text-muted-foreground">
                {servico.descricao ||
                  'Sem descrição'}
              </p>

              <p className="font-corpo text-sm text-muted-foreground">
                📍 {servico.municipio || 'Sem município'},
                {' '}
                {servico.provincia || 'Sem província'}
              </p>

              {servico.zona_atuacao && (
                <p className="font-corpo text-sm text-muted-foreground">
                  Zona de atuação: {servico.zona_atuacao}
                </p>
              )}

              {/* PRESTADOR */}
              <div className="border-2 border-border p-3 flex items-center justify-between">
                {vendedor ? (
                  <Link
                    to={`/vendedor/${vendedor.id}`}
                    className="font-titulo text-sm hover:text-primary flex items-center gap-2"
                  >
                    {nomePrestador}
                    <SeloVendedor vendedor={vendedor} compacto />
                  </Link>
                ) : (
                  <span className="font-titulo text-sm">
                    {nomePrestador}
                  </span>
                )}
              </div>

              {/* WHATSAPP */}
              {telefoneContacto ? (
                <a
                  href={gerarLinkWhatsApp(
                    telefoneContacto,
                    servico.nome_servico
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleCliqueWhatsapp}
                  className="btn-whatsapp w-full flex items-center justify-center gap-2 text-lg border-2 border-foreground"
                >
                  <MessageCircle size={22} />
                  Contactar no WhatsApp
                </a>
              ) : (
                <p className="font-corpo text-sm text-muted-foreground">
                  Este serviço ainda não tem contacto disponível.
                </p>
              )}

            </div>
          </div>
        </div>
      </main>

      <Rodape />
    </div>
  );
}