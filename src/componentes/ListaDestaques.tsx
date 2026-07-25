import Autoplay from 'embla-carousel-autoplay';
import { useRef } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { Produto, Servico } from '@/tipos';
import CardProduto from './CardProduto';
import CardServico from './CardServico';

type Destaque =
  | {
      tipo: 'produto';
      item: Produto;
    }
  | {
      tipo: 'servico';
      item: Servico;
    };

interface ListaDestaquesProps {
  destaques: Destaque[];
  titulo?: string;
}

export default function ListaDestaques({
  destaques,
  titulo = 'Destaques ANGROLINK',
}: ListaDestaquesProps) {
  const listaSegura = Array.isArray(destaques) ? destaques : [];

  const autoplay = useRef(
    Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  if (listaSegura.length === 0) return null;

  return (
    <section>
      <h2 className="font-titulo text-xl md:text-2xl mb-4 text-white">
        {titulo}
      </h2>

      <Carousel
        opts={{ align: 'start', loop: listaSegura.length > 1 }}
        plugins={[autoplay.current]}
        className="px-1"
      >
        <CarouselContent>
          {listaSegura.map(destaque => (
            <CarouselItem
              key={`${destaque.tipo}-${destaque.item.id}`}
              className="basis-1/2 md:basis-1/3 lg:basis-1/4"
            >
              {destaque.tipo === 'produto' ? (
                <CardProduto produto={destaque.item} />
              ) : (
                <CardServico servico={destaque.item} />
              )}
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious className="hidden sm:flex -left-4 bg-background" />
        <CarouselNext className="hidden sm:flex -right-4 bg-background" />
      </Carousel>
    </section>
  );
}
