import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

export default function PaginaPrivacidade() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Cabecalho />

      <main className="flex-1">
        <section className="border-b-2 border-border bg-green-800 py-12">
          <div className="container">
            <h1 className="font-titulo text-3xl md:text-4xl font-bold text-white">
              Política de Privacidade
            </h1>

            <p className="font-corpo text-sm md:text-base text-white/80 mt-3 max-w-2xl">
              Explicamos como a ANGROLINK recolhe, utiliza e protege os dados dos utilizadores.
            </p>
          </div>
        </section>

        <section className="container py-10 max-w-4xl">
          <div className="space-y-8 font-corpo text-sm md:text-base leading-relaxed text-foreground">
            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                1. Dados que recolhemos
              </h2>
              <p>
                Podemos recolher dados como nome, email, telefone, localização, tipo de conta,
                informações de perfil, produtos publicados, serviços publicados, pesquisas,
                visualizações e cliques em contactos via WhatsApp.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                2. Como usamos os dados
              </h2>
              <p>
                Utilizamos os dados para criar e gerir contas, apresentar produtos e serviços,
                facilitar contactos entre utilizadores, melhorar a experiência da plataforma,
                gerar estatísticas internas e aumentar a segurança do marketplace.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                3. Dados públicos
              </h2>
              <p>
                Algumas informações de vendedores e prestadores podem ser exibidas publicamente,
                como nome comercial, localização, produtos, serviços, imagens, descrição e contacto
                comercial.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                4. Contactos por WhatsApp
              </h2>
              <p>
                Quando um utilizador clica para contactar um vendedor ou prestador, poderá ser
                redirecionado para o WhatsApp. A partir desse momento, a comunicação passa a ocorrer
                fora da ANGROLINK e fica sujeita às regras da respetiva aplicação.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                5. Métricas e estatísticas
              </h2>
              <p>
                Podemos registar visualizações, pesquisas e cliques para compreender a procura,
                melhorar rankings, identificar categorias populares e ajudar vendedores a perceber
                o desempenho dos seus anúncios.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                6. Segurança
              </h2>
              <p>
                Aplicamos medidas técnicas e organizacionais para proteger os dados, incluindo
                autenticação, permissões de acesso e regras de segurança na base de dados.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                7. Desativação de conta
              </h2>
              <p>
                Quando uma conta é desativada, os dados podem ser mantidos para fins de segurança,
                histórico, auditoria, prevenção de fraude e cumprimento de obrigações legais. No
                caso de vendedores, os anúncios podem deixar de ficar visíveis publicamente.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                8. Partilha de dados
              </h2>
              <p>
                Não vendemos dados pessoais dos utilizadores. Podemos partilhar informações apenas
                quando necessário para operação da plataforma, cumprimento legal, segurança ou
                proteção dos direitos da ANGROLINK e dos utilizadores.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                9. Direitos dos utilizadores
              </h2>
              <p>
                Os utilizadores podem solicitar atualização, correção ou desativação dos seus dados,
                de acordo com as regras aplicáveis e os canais oficiais da ANGROLINK.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                10. Contacto
              </h2>
              <p>
                Para questões sobre privacidade e tratamento de dados, contacte a equipa ANGROLINK
                através dos canais oficiais da plataforma.
              </p>
            </div>

            <p className="text-xs text-muted-foreground border-t-2 border-border pt-4">
              Última atualização: {new Date().getFullYear()}. Este documento é uma versão inicial e deve ser revisto juridicamente antes do lançamento oficial.
            </p>
          </div>
        </section>
      </main>

      <Rodape />
    </div>
  );
}