/**
 * ========================================
 * ÍCONE POR CATEGORIA
 * ========================================
 * Mapeamento partilhado entre o menu de categorias
 * e a faixa de categorias em destaque da homepage.
 */

import {
  Leaf,
  Wheat,
  Beef,
  Wine,
  UtensilsCrossed,
  Package,
  Wrench,
  LucideIcon,
} from 'lucide-react';

const MAPA_ICONES: Record<string, LucideIcon> = {
  alimentos: UtensilsCrossed,
  bebidas: Wine,
  'grãos e cereais': Wheat,
  'pecuária': Beef,
  'produtos frescos': Leaf,
  serviços: Wrench,
};

export function obterIconeCategoria(nome?: string | null): LucideIcon {
  const chave = nome?.toLowerCase().trim() || '';
  return MAPA_ICONES[chave] || Package;
}
