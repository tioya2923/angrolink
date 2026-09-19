import { MessageCircle, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

export default function PaginaComoFunciona() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Cabecalho />
      <main className="flex-1">
        <section className="border-b-2 border-border bg-green-800 py-12">
          <div className="container">
            <h1 className="font-titulo text-3xl font-bold text-white md:text-4xl">Como funciona a ANGROLINK</h1>
            <p className="mt-3 max-w-2xl font-corpo text-sm text-white/80 md:text-base">Compra produtos, conversa com segurança e acompanha a encomenda dentro da plataforma.</p>
          </div>
        </section>

        <section className="container max-w-4xl space-y-12 py-10">
          <div id="verificados" className="scroll-mt-20 space-y-3">
            <Titulo Icone={ShieldCheck} texto="Vendedores aprovados e verificação" />
            <p className="texto">Os vendedores passam pela análise da ANGROLINK antes de poderem publicar produtos. A aprovação permite operar na plataforma; o selo de verificação, quando apresentado, identifica uma verificação adicional e não é uma garantia sobre produtos, entregas ou transações.</p>
          </div>

          <div id="chat-pre-compra" className="scroll-mt-20 space-y-3">
            <Titulo Icone={MessageCircle} texto="Chat pré-compra seguro para produtos" />
            <p className="texto">Em produtos, compradores autenticados podem conversar com vendedores aprovados dentro da ANGROLINK antes de comprar. O telefone não é partilhado nesse chat. O chat operacional da encomenda é separado e só serve para coordenar uma encomenda já criada.</p>
            <p className="texto">Os serviços preservam o respetivo fluxo próprio de contacto.</p>
          </div>

          <div className="space-y-3">
            <Titulo Icone={ShoppingCart} texto="Carrinho e checkout de produtos" />
            <p className="texto">Adiciona produtos ao carrinho e conclui o checkout na plataforma. Quando disponível, podes escolher levantamento ou entrega; as condições apresentadas dependem da zona operacional e da encomenda.</p>
          </div>

          <div id="entrega" className="scroll-mt-20 space-y-3">
            <Titulo Icone={Truck} texto="Entregas no Huambo" />
            <p className="texto">A operação inicial de entregas decorre no Huambo. A disponibilidade, o levantamento e a entrega são confirmados no fluxo da encomenda; a plataforma não promete entrega em todas as províncias.</p>
          </div>

          <div className="border-t-2 border-border pt-8">
            <p className="font-corpo text-sm text-muted-foreground">Procura produtos por grosso ou a retalho? <Link to="/pesquisa" className="font-semibold text-green-700 hover:underline">Explora os produtos disponíveis</Link>.</p>
          </div>
        </section>
      </main>
      <Rodape />
    </div>
  );
}

function Titulo({ Icone, texto }: { Icone: typeof ShieldCheck; texto: string }) {
  return <div className="flex items-center gap-3"><Icone className="size-7 shrink-0 text-green-700" /><h2 className="font-titulo text-xl font-bold md:text-2xl">{texto}</h2></div>;
}
