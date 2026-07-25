/**
 * ========================================
 * CARROSSEL DE PRODUTOS
 * ========================================
 * Carrossel horizontal simples para uma lista de produtos
 * (ex.: produtos com desconto), com autoplay.
 */

import Autoplay from 'embla-carousel-autoplay';
import { useRef } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';
import { Produto } from '@/tipos';
import CardProduto from './CardProduto';

interface CarrosselProdutosProps {
  produtos: Produto[];
  titulo?: string;
}

export default function CarrosselProdutos({
  produtos,
  titulo,
}: CarrosselProdutosProps) {
  const listaSegura = Array.isArray(produtos) ? produtos : [];

  const autoplay = useRef(
    Autoplay({ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true })
  );

  if (listaSegura.length === 0) return null;

  return (
    <section>
      {titulo && (
        <h2 className="font-titulo text-lg md:text-xl mb-1">{titulo}</h2>
      )}

      <Carousel
        opts={{ align: 'start', loop: listaSegura.length > 1 }}
        plugins={[autoplay.current]}
        className="px-1"
      >
        <CarouselContent>
          {listaSegura.map(produto => (
            <CarouselItem
              key={produto.id}
              className="basis-1/2 md:basis-1/3 lg:basis-1/4"
            >
              <CardProduto produto={produto} />
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious className="hidden sm:flex -left-4 bg-background" />
        <CarouselNext className="hidden sm:flex -right-4 bg-background" />
      </Carousel>
    </section>
  );
}
