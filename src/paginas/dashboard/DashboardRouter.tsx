import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';
import DashboardLayout from './DashboardLayout';

import AdminResumo from './admin/AdminResumo';
import AdminVendedores from './admin/AdminVendedores';
import AdminProdutos from './admin/AdminProdutos';
import AdminUtilizadores from './admin/AdminUtilizadores';
import AdminPedidosVendedores from './admin/AdminPedidosVendedores';

import ClienteResumo from './cliente/ClienteResumo';
import Favoritos from './cliente/Favoritos';
import ClienteHistorico from './cliente/ClienteHistorico';
import ClienteRecomendacoes from './cliente/ClienteRecomendacoes';
import ClienteDefinicoes from './cliente/ClienteDefinicoes';

import VendedorResumo from './vendedor/VendedorResumo';
import VendedorProdutos from './vendedor/VendedorProdutos';
import VendedorAdicionarProduto from './vendedor/VendedorAdicionarProduto';
import VendedorAdicionarServico from './vendedor/VendedorAdicionarServico';
import VendedorDesempenho from './vendedor/VendedorDesempenho';
import VendedorContactos from './vendedor/VendedorContactos';
import VendedorEstatisticas from './vendedor/VendedorEstatisticas';
import VendedorPerfil from './vendedor/VendedorPerfil';
import VendedorServicos from './vendedor/VendedorServicos';
import AdminRankings from './admin/AdminRankings';

export default function DashboardRouter() {

const {
utilizador,
autenticado,
pronto
}=useAuth();


// MUITO IMPORTANTE
if(!pronto){
 return (
  <div className="p-8 text-center">
   A carregar sessão...
  </div>
 );
}

if(!autenticado || !utilizador){
 return <Navigate to="/login" replace />;
}

const vendedorAprovado =
  utilizador.papel === 'vendedor' &&
  utilizador.status_aprovacao === 'aprovado';
  
return(
<DashboardLayout>

<Routes>

{utilizador.papel==="admin" && (
<>
<Route index element={<AdminResumo/>}/>
<Route path="vendedores" element={<AdminVendedores/>}/>
<Route path="pedidos-vendedores" element={<AdminPedidosVendedores/>}/>
<Route path="utilizadores" element={<AdminUtilizadores/>}/>
<Route path="produtos" element={<AdminProdutos/>}/>
<Route path="rankings" element={<AdminRankings/>}/>
</>
)}

{utilizador.papel==="vendedor" &&(
<>
<Route index element={<VendedorResumo/>}/>
<Route
  path="produtos"
  element={
    utilizador.status_aprovacao === 'aprovado'
      ? <VendedorProdutos />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>
<Route
  path="servicos"
  element={
    utilizador.status_aprovacao === 'aprovado'
      ? <VendedorServicos />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>
<Route
  path="favoritos"
  element={<Favoritos />}
/>
<Route
  path="adicionar"
  element={
    utilizador.status_aprovacao === 'aprovado'
      ? <VendedorAdicionarProduto />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>

<Route
  path="produtos/novo"
  element={
    utilizador.status_aprovacao === "aprovado"
      ? <VendedorAdicionarProduto />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>

<Route
  path="produtos/editar/:id"
  element={
    utilizador.status_aprovacao === "aprovado"
      ? <VendedorAdicionarProduto />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>

<Route
  path="adicionar-servico"
  element={
    utilizador.status_aprovacao === 'aprovado'
      ? <VendedorAdicionarServico />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>

<Route
  path="servicos/novo"
  element={
    utilizador.status_aprovacao === "aprovado"
      ? <VendedorAdicionarServico />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>

<Route
  path="servicos/editar/:id"
  element={
    utilizador.status_aprovacao === "aprovado"
      ? <VendedorAdicionarServico />
      : <Navigate to="/dashboard/perfil" replace />
  }
/>

<Route path="desempenho" element={<VendedorDesempenho/>}/>
<Route
  path="contactos"
  element={<VendedorContactos />}
/>
<Route path="estatisticas" element={<VendedorEstatisticas/>}/>
<Route path="perfil" element={<VendedorPerfil/>}/>
</>
)}

{utilizador.papel==="cliente" &&(
<>
<Route index element={<ClienteResumo/>}/>
<Route path="favoritos" element={<Favoritos/>}/>
<Route path="historico" element={<ClienteHistorico/>}/>
<Route path="recomendacoes" element={<ClienteRecomendacoes/>}/>
<Route path="definicoes" element={<ClienteDefinicoes/>}/>
</>
)}

<Route
  path="*"
  element={
    <Navigate
      to={
        utilizador.papel === 'admin'
          ? '/dashboard'
          : utilizador.papel === 'vendedor'
          ? '/dashboard'
          : '/dashboard'
      }
      replace
    />
  }
/>

</Routes>

</DashboardLayout>
);

}
