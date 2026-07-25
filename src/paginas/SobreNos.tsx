import { Leaf, Target, Eye, Users, ShieldCheck, Handshake } from 'lucide-react';
import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';

const equipa = [
  {
    nome: 'Willian Semedo',
    cargo: 'Fundador & CEO',
    descricao:
      'Estudante de Engenharia Informática na Universidade Autónoma de Lisboa, responsável pela visão, desenvolvimento tecnológico e direção estratégica da ANGROLINK.',
    foto: '/equipa/Willian.png',
  },
  {
    nome: 'Elson Marcos',
    cargo: 'Fundador & Diretor Técnico',
    descricao:
      'Estudante de Engenharia Informática na Universidade Autónoma de Lisboa, participa no desenvolvimento da plataforma e na estruturação técnica do projeto.',
    foto: '/equipa/Elson.png',
  },
  {
    nome: 'Leandro Alexandre',
    cargo: 'Sócio & Responsável de Marketing',
    descricao:
      'Estudante de International Business em Lisboa, responsável pela estratégia de marketing, posicionamento da marca e crescimento comercial da ANGROLINK.',
    foto: '/equipa/Leandro.png',
  },
  {
    nome: 'Clauberth Mbote',
    cargo: 'Sócia & Responsável Jurídica',
    descricao:
      'Estudante de Direito na NOVA School of Law, acompanha a componente jurídica, conformidade legal e proteção institucional da ANGROLINK.',
    foto: '/equipa/Clauberth.png',
  },
];

export default function SobreNos() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Cabecalho />

      <main className="flex-1">
        {/* HERO */}
        <section className="bg-green-800 text-white py-16 md:py-24">
          <div className="container max-w-5xl text-center space-y-5">
            <div className="flex justify-center">
              <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                <Leaf className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="font-titulo text-white md:text-5xl font-bold">
              Sobre a ANGROLINK
            </h1>

            <p className="font-corpo text-sm md:text-lg text-white/90 max-w-3xl mx-auto leading-relaxed">
              Conectamos produtores, vendedores, prestadores de serviços e compradores
              em Angola através de uma plataforma simples, acessível e preparada para
              a realidade do mercado angolano.
            </p>
          </div>
        </section>

        {/* HISTÓRIA */}
        <section className="py-12 md:py-16">
          <div className="container max-w-5xl grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <h2 className="font-titulo text-2xl md:text-3xl font-bold">
                Como tudo começou
              </h2>

              <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
                A ANGROLINK nasceu da observação de um problema real: muitos produtores,
                comerciantes e prestadores de serviços em Angola ainda enfrentam dificuldades
                para divulgar os seus produtos, encontrar clientes e expandir os seus negócios.
              </p>

              <p className="font-corpo text-sm md:text-base text-muted-foreground leading-relaxed">
                Ao mesmo tempo, muitos compradores procuram fornecedores confiáveis, mas ainda
                dependem de contactos informais, grupos de WhatsApp e mercados físicos. A partir
                dessa realidade, decidimos criar uma ponte entre tecnologia, comércio e
                desenvolvimento económico local.
              </p>
            </div>

            <div className="border-2 border-green-700/20 bg-green-50 p-8 rounded-2xl">
              <h3 className="font-titulo text-xl font-semibold text-green-900 mb-3">
                O nosso propósito
              </h3>

              <p className="font-corpo text-sm text-green-900 leading-relaxed">
                Mais do que um marketplace, a ANGROLINK quer ajudar negócios locais a ganharem
                visibilidade, facilitando contactos e oportunidades dentro do setor agrícola e
                comercial angolano.
              </p>
            </div>
          </div>
        </section>

        {/* MISSÃO / VISÃO / OBJETIVO */}
        <section className="py-12 md:py-16 bg-muted/30 border-y-2 border-border">
          <div className="container max-w-6xl grid md:grid-cols-3 gap-4">
            <CardInfo
              icone={Target}
              titulo="Missão"
              texto="Facilitar a ligação entre vendedores, produtores, prestadores de serviços e compradores em Angola."
            />

            <CardInfo
              icone={Eye}
              titulo="Visão"
              texto="Construir uma das principais plataformas digitais de comércio agrícola e serviços em Angola."
            />

            <CardInfo
              icone={Handshake}
              titulo="Objetivo"
              texto="Dar mais visibilidade aos negócios locais e tornar o acesso ao mercado mais simples e organizado."
            />
          </div>
        </section>

        {/* EQUIPA */}
        <section className="py-12 md:py-16">
          <div className="container max-w-6xl">
            <div className="text-center max-w-3xl mx-auto mb-8">
              <div className="flex justify-center mb-3">
                <Users className="w-8 h-8 text-green-700" />
              </div>

              <h2 className="font-titulo text-2xl md:text-3xl font-bold">
                A equipa por trás da ANGROLINK
              </h2>

              <p className="font-corpo text-sm text-muted-foreground mt-2 leading-relaxed">
                Somos uma equipa jovem, multidisciplinar e comprometida em criar uma solução
                útil, simples e adaptada ao contexto angolano.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-8">
              {equipa.map(membro => (
                <div
                  key={membro.nome}
                  className="
                    border-2 border-border
                    rounded-3xl
                    p-6
                    text-center
                    bg-white
                    hover:border-green-700/40
                    hover:bg-green-50
                    hover:shadow-xl
                    transition-all
                    duration-300
                  "
                >
                  <div className="w-full flex justify-center mb-5">
                    <div className="w-[280px] rounded-2xl overflow-hidden border-2 border-green-700/20 shadow-xl bg-[#f5f5f0]">
                        <img
                        src={membro.foto}
                        alt={membro.nome}
                        className="w-full h-[280px] object-cover object-top"
                        />
                    </div>
                  </div>

                  <h3 className="font-titulo text-lg font-bold">
                    {membro.nome}
                  </h3>

                  <p className="font-corpo text-sm font-semibold text-green-700 mt-1">
                    {membro.cargo}
                  </p>

                  <p className="font-corpo text-xs text-muted-foreground mt-3 leading-relaxed">
                    {membro.descricao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VALORES */}
        <section className="py-12 md:py-16 bg-green-800 text-white">
          <div className="container max-w-5xl text-center space-y-6">
            <ShieldCheck className="w-9 h-9 mx-auto text-white" />

            <h2 className="font-titulo text-2xl md:text-3xl font-bold">
              Os nossos valores
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              {[
                'Transparência',
                'Simplicidade',
                'Inovação acessível',
                'Valorização local',
                'Confiança',
                'Crescimento nacional',
              ].map(valor => (
                <div
                  key={valor}
                  className="border border-white/20 rounded-xl px-4 py-3 bg-white/10"
                >
                  {valor}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Rodape />
    </div>
  );
}

function CardInfo({
  icone: Icone,
  titulo,
  texto,
}: {
  icone: React.ComponentType<any>;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="border-2 border-border bg-background rounded-2xl p-5 hover:border-green-700/40 hover:bg-green-50 transition-colors">
      <Icone className="w-7 h-7 text-green-700 mb-3" />

      <h3 className="font-titulo text-lg font-bold mb-2">
        {titulo}
      </h3>

      <p className="font-corpo text-sm text-muted-foreground leading-relaxed">
        {texto}
      </p>
    </div>
  );
}