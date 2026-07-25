import { ShieldCheck, MessageCircle, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

export default function PaginaComoFunciona() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Cabecalho />

      <main className="flex-1">
        <section className="border-b-2 border-border bg-green-800 py-12">
          <div className="container">
            <h1 className="font-titulo text-3xl md:text-4xl font-bold text-white">
              Como funciona a ANGROLINK
            </h1>

            <p className="font-corpo text-sm md:text-base text-white/80 mt-3 max-w-2xl">
              Entenda como garantimos confiança e facilitamos a ligação entre
              compradores e vendedores em toda Angola.
            </p>
          </div>
        </section>

        <section className="container py-10 max-w-4xl space-y-12">
          <div id="verificados" className="scroll-mt-20 space-y-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-7 h-7 text-green-700 shrink-0" />
              <h2 className="font-titulo text-xl md:text-2xl font-bold">
                Vendedores verificados
              </h2>
            </div>

            <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
              Antes de publicarem produtos ou serviços, os vendedores passam por uma
              aprovação da equipa ANGROLINK, que confirma os dados de contacto e
              localização apresentados no registo. Vendedores aprovados recebem um
              selo de verificação visível no perfil e nos anúncios, para que os
              compradores saibam com quem estão a negociar.
            </p>

            <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
              Ainda assim, recomendamos que confirme sempre os detalhes do produto,
              preço e condições diretamente com o vendedor antes de fechar negócio.
            </p>
          </div>

          <div id="whatsapp" className="scroll-mt-20 space-y-3">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-7 h-7 text-green-700 shrink-0" />
              <h2 className="font-titulo text-xl md:text-2xl font-bold">
                Contacto direto por WhatsApp
              </h2>
            </div>

            <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
              A ANGROLINK não processa pagamentos nem intermedeia a negociação: ao
              encontrar um produto ou serviço de interesse, basta tocar em
              "Contactar" para abrir uma conversa de WhatsApp diretamente com o
              vendedor ou prestador de serviço responsável pelo anúncio.
            </p>

            <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
              Isto permite combinar quantidade, preço final, forma de entrega e
              pagamento sem intermediários, da forma mais próxima possível do
              contacto que já é comum no mercado angolano.
            </p>
          </div>

          <div id="entrega" className="scroll-mt-20 space-y-3">
            <div className="flex items-center gap-3">
              <Truck className="w-7 h-7 text-green-700 shrink-0" />
              <h2 className="font-titulo text-xl md:text-2xl font-bold">
                Entrega em várias províncias
              </h2>
            </div>

            <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
              Muitos vendedores na plataforma indicam se fazem entrega para outras
              províncias além da sua localização de origem. Essa informação consta
              no perfil de cada vendedor e pode ser confirmada diretamente com ele
              antes da compra.
            </p>

            <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
              A disponibilidade, o prazo e o custo de entrega variam de vendedor
              para vendedor, por isso combine sempre estes detalhes antes de
              finalizar o pedido.
            </p>
          </div>

          <div className="border-t-2 border-border pt-8">
            <p className="font-corpo text-sm text-muted-foreground">
              Procura por produtos vendidos por grosso ou a retalho?{' '}
              <Link to="/pesquisa" className="text-green-700 font-semibold hover:underline">
                Explore os produtos disponíveis
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <Rodape />
    </div>
  );
}
