import {
MessageSquare,
Package,
Wrench,
TrendingUp
} from 'lucide-react';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contextos/AuthContexto';

import {
  fetchProdutosPorVendedor,
  fetchServicosPorVendedor,
} from '@/services/api';

export default function VendedorDesempenho() {

const { utilizador } = useAuth();

const [produtos,setProdutos]=useState<any[]>([]);
const [servicos,setServicos]=useState<any[]>([]);
const [loading,setLoading]=useState(true);

useEffect(()=>{

async function carregar(){

if(!utilizador?.vendedor_id){
setLoading(false);
return;
}

try{

const [prods,servs] = await Promise.all([
fetchProdutosPorVendedor(utilizador.vendedor_id),
fetchServicosPorVendedor(utilizador.vendedor_id)
]);

setProdutos(prods || []);
setServicos(servs || []);

}
catch(e){
console.error(e);
}
finally{
setLoading(false);
}

}

carregar();

},[utilizador]);

if(loading){
return (
<p className="font-corpo text-sm text-muted-foreground">
A carregar contactos...
</p>
)
}

const totalCliquesProdutos=
produtos.reduce(
(acc,p)=>acc+(p.cliques_whatsapp||0),
0
);

const totalCliquesServicos=
servicos.reduce(
(acc,s)=>acc+(s.cliques_whatsapp||0),
0
);

const maisContactadosProdutos=
[...produtos]
.sort(
(a,b)=>
(b.cliques_whatsapp||0)-
(a.cliques_whatsapp||0)
)
.slice(0,5);

const maisContactadosServicos=
[...servicos]
.sort(
(a,b)=>
(b.cliques_whatsapp||0)-
(a.cliques_whatsapp||0)
)
.slice(0,5);

return (
<div className="space-y-6">

<div className="painel-dashboard-cabecalho mb-8">

  <h1 className="relative z-10 font-titulo text-3xl font-bold text-primary-foreground">
    Desempenho
  </h1>

  <p className="relative z-10 font-corpo mt-2 text-primary-foreground/80 text-base">
    Veja quais produtos e serviços despertaram mais interesse dos clientes através do WhatsApp.
  </p>

</div>


<div className="grid grid-cols-1 md:grid-cols-3 gap-6">

<div className="painel-dashboard-metrica">
<div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">

  <MessageSquare
    size={22}
    className="text-green-700"
  />

</div>

<p className="font-titulo text-4xl font-bold text-slate-800">
{totalCliquesProdutos + totalCliquesServicos}
</p>

<p className="font-corpo text-sm text-muted-foreground mt-2">
Cliques totais
</p>
</div>

<div className="painel-dashboard-metrica">
<div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">

  <Package
    size={22}
    className="text-green-700"
  />

</div>

<p className="font-titulo text-4xl font-bold text-slate-800">
{totalCliquesProdutos}
</p>

<p className="font-corpo text-sm text-muted-foreground mt-2">
Contactos em produtos
</p>
</div>

<div className="painel-dashboard-metrica">
<div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">

  <Wrench
    size={22}
    className="text-green-700"
  />

</div>

<p className="font-titulo text-4xl font-bold text-slate-800">
{totalCliquesServicos}
</p>

<p className="font-corpo text-sm text-muted-foreground mt-2">
Contactos em serviços
</p>
</div>

</div>


<div className="rounded-2xl border bg-card shadow-sm p-6">
<h3 className="font-titulo text-sm mb-4">
📦 Produtos com mais contactos
</h3>

<div className="space-y-3">
{maisContactadosProdutos.length===0 ? (
<p className="text-sm text-muted-foreground">
Sem dados ainda.
</p>
):(
maisContactadosProdutos.map(p=>(
<div
  key={p.id}
  className="
    flex
    items-center
    justify-between
    rounded-xl
    border
    px-4
    py-3
    hover:bg-muted/40
    transition
  "
>
<span className="font-medium text-sm text-slate-800">
{p.nome_produto}
</span>

<div className="flex items-center gap-2 text-green-700 font-semibold text-sm">

  <MessageSquare size={16} />

  {p.cliques_whatsapp || 0}

</div>
</div>
))
)}
</div>
</div>


<div className="rounded-2xl border bg-card shadow-sm p-6">
<h3 className="font-titulo text-lg font-semibold mb-6">
  🛠 Serviços com mais contactos
</h3>

<div className="space-y-3">
{maisContactadosServicos.length===0 ? (
<div className="rounded-xl border border-dashed p-6 text-center">

  <MessageSquare
    size={28}
    className="mx-auto mb-3 text-muted-foreground"
  />

  <p className="font-medium">
    Ainda não existem contactos.
  </p>

  <p className="text-sm text-muted-foreground mt-1">
    Quando os clientes clicarem no WhatsApp dos seus serviços,
    os dados aparecerão aqui.
  </p>

</div>
):(
maisContactadosServicos.map(s=>(
<div
  key={s.id}
  className="
    flex
    items-center
    justify-between
    rounded-xl
    border
    px-4
    py-3
    hover:bg-muted/40
    transition
  "
>
<span className="font-medium text-sm text-slate-800">
{s.nome_servico}
</span>

<div className="flex items-center gap-2 text-green-700 font-semibold">

  <MessageSquare size={16} />

  {s.cliques_whatsapp || 0}

</div>
</div>
))
)}
</div>
</div>


<div className="rounded-2xl border bg-green-50 border-green-200 shadow-sm p-6">
<div className="flex items-start gap-4">

  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">

    <TrendingUp
      size={22}
      className="text-green-700"
    />

  </div>

  <div>

    <h3 className="font-titulo text-lg font-semibold">
      Dica da ANGROLINK
    </h3>

    <p className="font-corpo text-sm text-muted-foreground mt-2">

      {totalCliquesProdutos + totalCliquesServicos === 0
        ? "Ainda não recebeu contactos. Complete o seu perfil e publique mais anúncios para aumentar a sua visibilidade."
        : totalCliquesProdutos > totalCliquesServicos
        ? "Os seus produtos estão a gerar mais interesse do que os serviços. Considere destacar os produtos mais procurados."
        : totalCliquesServicos > totalCliquesProdutos
        ? "Os seus serviços estão a despertar mais interesse. Pode ser uma boa oportunidade para aumentar a oferta."
        : "Os seus produtos e serviços estão a ter um desempenho equilibrado. Continue a manter os anúncios atualizados."}

    </p>

  </div>

</div>

</div>

</div>
)
}
