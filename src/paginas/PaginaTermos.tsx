import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

export default function PaginaTermos() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Cabecalho />

      <main className="flex-1">
        <section className="border-b-2 border-border bg-green-800 py-12">
          <div className="container">
            <h1 className="font-titulo text-3xl md:text-4xl font-bold text-white">
              Termos e Condições
            </h1>

            <p className="font-corpo text-sm md:text-base text-white/80 mt-3 max-w-2xl">
              Estes termos regulam a utilização da plataforma ANGROLINK por compradores,
              vendedores, produtores, prestadores de serviços e visitantes.
            </p>
          </div>
        </section>

        <section className="container py-10 max-w-4xl">
          <div className="space-y-8 font-corpo text-sm md:text-base leading-relaxed text-foreground">
            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                1. Sobre a ANGROLINK
              </h2>
              <p>
                A ANGROLINK é uma plataforma digital que tem como objetivo aproximar
                produtores, vendedores, prestadores de serviços e compradores ligados
                ao setor agrícola em Angola. A plataforma facilita a divulgação de
                produtos e serviços, permitindo que os interessados entrem em contacto
                diretamente com os anunciantes.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                2. Natureza da plataforma
              </h2>
              <p>
                Nesta fase inicial, a ANGROLINK atua como uma plataforma de visibilidade
                e contacto. Não realizamos pagamentos internos, não processamos compras
                diretamente e não somos parte das negociações feitas entre compradores
                e vendedores fora da plataforma.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                3. Responsabilidade dos vendedores e prestadores
              </h2>
              <p>
                Cada vendedor ou prestador de serviço é responsável pela veracidade das
                informações publicadas, incluindo preços, disponibilidade, imagens,
                localização, qualidade dos produtos, condições de entrega e dados de
                contacto.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                4. Responsabilidade dos compradores
              </h2>
              <p>
                Os compradores devem confirmar diretamente com o vendedor ou prestador
                todas as condições antes de fechar qualquer negócio, incluindo preço
                final, quantidade, local de entrega, estado do produto e método de
                pagamento.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                5. Contas de utilizador
              </h2>
              <p>
                A ANGROLINK pode aprovar, rejeitar, suspender ou desativar contas que
                apresentem dados falsos, comportamento abusivo, tentativas de fraude,
                violação destes termos ou uso indevido da plataforma.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                6. Destaques e visibilidade
              </h2>
              <p>
                A plataforma pode disponibilizar recursos de destaque para aumentar a
                visibilidade de produtos e serviços. Na fase inicial, estes recursos
                podem ser gratuitos, limitados e sujeitos a regras de rotatividade,
                aprovação da conta e disponibilidade.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                7. Conteúdo proibido
              </h2>
              <p>
                É proibido publicar conteúdos falsos, ofensivos, ilegais, fraudulentos,
                enganosos, discriminatórios ou que violem direitos de terceiros. A
                ANGROLINK reserva-se o direito de remover conteúdos que prejudiquem a
                confiança e segurança da comunidade.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                8. Limitação de responsabilidade
              </h2>
              <p>
                A ANGROLINK não garante a concretização de vendas, entregas ou acordos
                entre utilizadores. A plataforma não se responsabiliza por perdas,
                danos, incumprimentos, atrasos ou conflitos resultantes de negociações
                realizadas diretamente entre compradores e vendedores.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                9. Alterações aos termos
              </h2>
              <p>
                Estes termos podem ser atualizados para acompanhar a evolução da
                plataforma, novas funcionalidades, requisitos legais ou mudanças no
                modelo de negócio. A utilização contínua da ANGROLINK após alterações
                significa aceitação dos novos termos.
              </p>
            </div>

            <div>
              <h2 className="font-titulo text-xl font-bold mb-2">
                10. Contacto
              </h2>
              <p>
                Para dúvidas, pedidos ou questões relacionadas com estes termos, os
                utilizadores podem contactar a equipa ANGROLINK através dos canais
                oficiais disponibilizados na plataforma.
              </p>
            </div>

            <div id="termos-parceiros" className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5">
              <h2 className="font-titulo text-xl font-bold mb-2 text-primary">
                11. Termos para Parceiros de Entregas ANGROLINK
              </h2>
              <div className="space-y-3">
                <p>O parceiro de entregas declara que as informações, documentos e dados do veículo submetidos são verdadeiros, atuais e lhe pertencem ou estão legalmente autorizados para utilização.</p>
                <p>O parceiro só pode aceitar tarefas após aprovação da ANGROLINK e enquanto os seus documentos, veículo e estado de disponibilidade se mantiverem válidos.</p>
                <p>É proibido transportar passageiros, dinheiro, armas, bens ilícitos, mercadorias perigosas sem autorização, animais vivos ou cargas incompatíveis com o veículo aprovado.</p>
                <p>O parceiro compromete-se a recolher e entregar mercadorias com cuidado, respeitar os códigos de recolha e entrega, manter comunicação adequada e reportar incidentes imediatamente.</p>
                <p>A ANGROLINK pode suspender ou remover a disponibilidade do parceiro perante documentos expirados, fraude, comportamento inseguro, incumprimento destes termos ou reclamações fundamentadas.</p>
                <p>As regras de preços, pagamentos, comissões, cancelamentos, danos e repasses serão apresentadas antes da ativação operacional do serviço de entregas.</p>
              </div>
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
