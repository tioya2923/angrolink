/**
 * ========================================
 * APP — Raiz da aplicação
 * ========================================
 * Configuração de rotas e providers globais.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MunicipioProvider } from "@/contextos/MunicipioContexto";
import { AuthProvider } from "@/contextos/AuthContexto";
import { CarrinhoProvider } from "@/contextos/CarrinhoContexto";
import { useAuth } from "@/contextos/AuthContexto";
import AtualizacoesTempoReal from '@/componentes/AtualizacoesTempoReal';

// Páginas
import PaginaInicial from "@/paginas/PaginaInicial";
import PaginaPesquisa from "@/paginas/PaginaPesquisa";
import PaginaProduto from "@/paginas/PaginaProduto";
import PaginaVendedor from "@/paginas/PaginaVendedor";
import PaginaAnunciar from "@/paginas/PaginaAnunciar";
import PaginaLogin from "@/paginas/PaginaLogin";
import DashboardRouter from "@/paginas/dashboard/DashboardRouter";
import ScrollToTop from "@/componentes/ScrollToTop";
import MensagensValidacaoNativas from "@/componentes/MensagensValidacaoNativas";
import NotFound from "./pages/NotFound.tsx";
import PaginaServico from "@/paginas/PaginaServico";
import PaginaAnunciarServico from "@/paginas/PaginaAnunciarServico";
import PaginaServicos from "@/paginas/PaginaServicos";
import SobreNos from "@/paginas/SobreNos";
import PaginaTermos from "@/paginas/PaginaTermos";
import PaginaPrivacidade from "@/paginas/PaginaPrivacidade";
import PaginaComoFunciona from "@/paginas/PaginaComoFunciona";
import PaginaCadastroParceiroEntrega from "@/paginas/PaginaCadastroParceiroEntrega";
import PaginaCarrinho from "@/paginas/PaginaCarrinho";
import PaginaCheckoutPendente from "@/paginas/PaginaCheckoutPendente";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RotaInicial() {
  const { utilizador, pronto } = useAuth();

  if (!pronto) return null;
  if (utilizador?.papel === 'parceiro_entrega') {
    return <Navigate to="/dashboard" replace />;
  }
  return <PaginaInicial />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MunicipioProvider>
        <AuthProvider>
          <CarrinhoProvider>
          <AtualizacoesTempoReal>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ScrollToTop />
              <MensagensValidacaoNativas />
              <Routes>
              {/* Páginas públicas */}
              <Route path="/" element={<RotaInicial />} />
              <Route path="/sobre-nos" element={<SobreNos />} />
              <Route path="/termos" element={<PaginaTermos />} />
              <Route path="/privacidade" element={<PaginaPrivacidade />} />
              <Route path="/como-funciona" element={<PaginaComoFunciona />} />
              <Route path="/pesquisa" element={<PaginaPesquisa />} />
              <Route path="/produto/:id" element={<PaginaProduto />} />
              <Route path="/servico/:id" element={<PaginaServico />} />
              <Route path="/vendedor/:id" element={<PaginaVendedor />} />
              <Route path="/anunciar" element={<PaginaAnunciar />} />
              <Route path="/parceiro-entregas/cadastro" element={<PaginaCadastroParceiroEntrega />} />
              <Route path="/anunciar-servico" element={<PaginaAnunciarServico />} />
              <Route path="/servicos" element={<PaginaServicos />} />
              <Route path="/carrinho" element={<PaginaCarrinho />} />
              <Route path="/checkout" element={<PaginaCheckoutPendente />} />
              {/* Autenticação */}
              <Route path="/login" element={<PaginaLogin />} />
              
              {/* Dashboard unificado (admin/vendedor/cliente) */}
              <Route path="/dashboard/*" element={<DashboardRouter />} />

              {/* Rota genérica — 404 */}
              <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AtualizacoesTempoReal>
          </CarrinhoProvider>
        </AuthProvider>
      </MunicipioProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
