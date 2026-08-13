import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contextos/AuthContexto';
import DashboardLayout from './DashboardLayout';

import AdminResumo from './admin/AdminResumo';
import AdminVendedores from './admin/AdminVendedores';
import AdminProdutos from './admin/AdminProdutos';
import AdminUtilizadores from './admin/AdminUtilizadores';
import AdminPedidosVendedores from './admin/AdminPedidosVendedores';
import AdminEntregadores from './admin/AdminEntregadores';

import ClienteResumo from './cliente/ClienteResumo';
import Favoritos from './cliente/Favoritos';
import ClienteHistorico from './cliente/ClienteHistorico';
import ClienteRecomendacoes from './cliente/ClienteRecomendacoes';
import ClienteDefinicoes from './cliente/ClienteDefinicoes';
import ClienteEncomendas from './cliente/ClienteEncomendas';
import ClienteEncomendaDetalhe from './cliente/ClienteEncomendaDetalhe';

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
import ParceiroResumo from './parceiro/ParceiroResumo';
import VendedorDocumentos from './vendedor/VendedorDocumentos';
import VendedorEncomendas from './vendedor/VendedorEncomendas';
import VendedorEncomendaDetalhe from './vendedor/VendedorEncomendaDetalhe';

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

return(
<DashboardLayout>

<Routes>

{utilizador.papel === "parceiro_entrega" && (
  <>
    <Route index element={<ParceiroResumo />} />
    <Route path="pedidos" element={<ParceiroResumo secao="pedidos" />} />
    <Route path="dados" element={<ParceiroResumo secao="dados" />} />
    <Route path="veiculo" element={<ParceiroResumo secao="veiculo" />} />
    <Route path="areas" element={<ParceiroResumo secao="areas" />} />
    <Route path="documentos" element={<ParceiroResumo secao="documentos" />} />
    <Route path="apoio" element={<ParceiroResumo secao="apoio" />} />
  </>
)}

{utilizador.papel==="admin" && (
<>
<Route index element={<AdminResumo/>}/>
<Route path="vendedores" element={<AdminVendedores/>}/>
<Route path="pedidos-vendedores" element={<AdminPedidosVendedores/>}/>
<Route path="pedidos-entregadores" element={<AdminEntregadores apenasPedidos/>}/>
<Route path="entregadores" element={<AdminEntregadores/>}/>
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
  element={utilizador.status_aprovacao === 'aprovado' ? <VendedorProdutos /> : <Navigate to="/dashboard/documentos" replace />}
/>
<Route
  path="servicos"
  element={utilizador.status_aprovacao === 'aprovado' ? <VendedorServicos /> : <Navigate to="/dashboard/documentos" replace />}
/>
<Route
  path="favoritos"
  element={utilizador.status_aprovacao === 'aprovado' ? <Favoritos /> : <Navigate to="/dashboard/documentos" replace />}
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

<Route path="desempenho" element={utilizador.status_aprovacao === 'aprovado' ? <VendedorDesempenho/> : <Navigate to="/dashboard/documentos" replace />}/>
<Route
  path="contactos"
  element={utilizador.status_aprovacao === 'aprovado' ? <VendedorContactos /> : <Navigate to="/dashboard/documentos" replace />}
/>
<Route path="estatisticas" element={utilizador.status_aprovacao === 'aprovado' ? <VendedorEstatisticas/> : <Navigate to="/dashboard/documentos" replace />}/>
<Route path="perfil" element={<VendedorPerfil/>}/>
<Route path="documentos" element={<VendedorDocumentos/>}/>
<Route path="encomendas" element={<VendedorEncomendas/>}/>
<Route path="encomendas/:id" element={<VendedorEncomendaDetalhe/>}/>
</>
)}

{utilizador.papel==="cliente" &&(
<>
<Route index element={<ClienteResumo/>}/>
<Route path="favoritos" element={<Favoritos/>}/>
<Route path="historico" element={<ClienteHistorico/>}/>
<Route path="recomendacoes" element={<ClienteRecomendacoes/>}/>
<Route path="definicoes" element={<ClienteDefinicoes/>}/>
<Route path="encomendas" element={<ClienteEncomendas/>}/>
<Route path="encomendas/:id" element={<ClienteEncomendaDetalhe/>}/>
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
