/**
 * ========================================
 * IMAGENS DOS PRODUTOS
 * ========================================
 * Mapeamento centralizado das imagens dos produtos.
 * Facilita a substituição futura por URLs do backend.
 */

import imgTomate from '@/assets/produtos/tomate.jpg';
import imgCouve from '@/assets/produtos/couve.jpg';
import imgFrango from '@/assets/produtos/frango.jpg';
import imgOvos from '@/assets/produtos/ovos.jpg';
import imgMilho from '@/assets/produtos/milho.jpg';
import imgFeijao from '@/assets/produtos/feijao.jpg';
import imgSumoManga from '@/assets/produtos/sumo-manga.jpg';
import imgOleoPalma from '@/assets/produtos/oleo-palma.jpg';
import imgArroz from '@/assets/produtos/arroz.jpg';
import imgJindungo from '@/assets/produtos/jindungo.jpg';

/** Mapa de ID do produto → imagem */
export const IMAGENS_PRODUTOS: Record<string, string> = {
  p1: imgTomate,
  p2: imgCouve,
  p3: imgFrango,
  p4: imgOvos,
  p5: imgMilho,
  p6: imgFeijao,
  p7: imgSumoManga,
  p8: imgOleoPalma,
  p9: imgArroz,
  p10: imgJindungo,
};

/**
 * Obter imagem real de um produto pelo ID.
 * Se não existir, retorna placeholder.
 */
export function obterImagemProduto(produtoId: string): string {
  return IMAGENS_PRODUTOS[produtoId] || '/placeholder.svg';
}
