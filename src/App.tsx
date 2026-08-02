/**
 * ========================================
 * APP — Raiz da aplicação
 * ========================================
 * Configuração de rotas e providers globais.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MunicipioProvider } from "@/contextos/MunicipioContexto";
import { AuthProvider } from "@/contextos/AuthContexto";

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <MunicipioProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <MensagensValidacaoNativas />
            <Routes>
              {/* Páginas públicas */}
              <Route path="/" element={<PaginaInicial />} />
              <Route path="/sobre-nos" element={<SobreNos />} />
              <Route path="/termos" element={<PaginaTermos />} />
              <Route path="/privacidade" element={<PaginaPrivacidade />} />
              <Route path="/como-funciona" element={<PaginaComoFunciona />} />
              <Route path="/pesquisa" element={<PaginaPesquisa />} />
              <Route path="/produto/:id" element={<PaginaProduto />} />
              <Route path="/servico/:id" element={<PaginaServico />} />
              <Route path="/vendedor/:id" element={<PaginaVendedor />} />
              <Route path="/anunciar" element={<PaginaAnunciar />} />
              <Route path="/anunciar-servico" element={<PaginaAnunciarServico />} />
              <Route path="/servicos" element={<PaginaServicos />} />
              {/* Autenticação */}
              <Route path="/login" element={<PaginaLogin />} />
              
              {/* Dashboard unificado (admin/vendedor/cliente) */}
              <Route path="/dashboard/*" element={<DashboardRouter />} />

              {/* Rota genérica — 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </MunicipioProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
