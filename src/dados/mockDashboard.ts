/**
 * ========================================
 * DADOS MOCK — Dashboard
 * ========================================
 * Dados fictícios para os dashboards.
 * TODO (backend): Substituir por chamadas à API.
 */

import { ContactoRecebido, HistoricoContacto } from '@/tipos';

/** Contactos recebidos pelo vendedor v1 (mock) */
export const CONTACTOS_VENDEDOR_MOCK: ContactoRecebido[] = [
  { id: 'ct1', produto_id: 'p1', nome_produto: 'Tomate Cereja Fresco', telefone_cliente: '+244 912 345 678', data: '2026-03-10' },
  { id: 'ct2', produto_id: 'p2', nome_produto: 'Couve Manteiga', telefone_cliente: '+244 923 456 789', data: '2026-03-09' },
  { id: 'ct3', produto_id: 'p10', nome_produto: 'Pimenta Jindungo Fresca', telefone_cliente: '+244 934 567 890', data: '2026-03-08' },
  { id: 'ct4', produto_id: 'p1', nome_produto: 'Tomate Cereja Fresco', telefone_cliente: '+244 945 678 901', data: '2026-03-07' },
  { id: 'ct5', produto_id: 'p2', nome_produto: 'Couve Manteiga', telefone_cliente: '+244 956 789 012', data: '2026-03-06' },
];

/** Histórico de contactos do cliente (mock) */
export const HISTORICO_CLIENTE_MOCK: HistoricoContacto[] = [
  { id: 'h1', cliente_id: 'c1', vendedor_id: 'v1', nome_vendedor: 'Horta da Dona Maria', produto_id: 'p1', nome_produto: 'Tomate Cereja Fresco', criado_em: '2026-03-10' },
  { id: 'h2', cliente_id: 'c1', vendedor_id: 'v2', nome_vendedor: 'Avícola Bengo', produto_id: 'p3', nome_produto: 'Frango de Campo (Inteiro)', criado_em: '2026-03-08' },
  { id: 'h3', cliente_id: 'c1', vendedor_id: 'v3', nome_vendedor: 'Cereais do Huambo', produto_id: 'p5', nome_produto: 'Milho em Grão (Saco 50kg)', criado_em: '2026-03-05' },
];

/** IDs de produtos favoritos do cliente (mock) */
export const FAVORITOS_CLIENTE_MOCK: string[] = ['p1', 'p3', 'p5', 'p7'];

/** Estatísticas mock do vendedor */
export const STATS_VENDEDOR_MOCK = {
  totalProdutos: 3,
  produtosAtivos: 3,
  visualizacoes: 340,
  cliquesWhatsapp: 28,
  produtosDestacados: 1,
  perfilVisto: 45,
};

/** Estatísticas mock do cliente */
export const STATS_CLIENTE_MOCK = {
  produtosVisualizados: 24,
  vendedoresContactados: 3,
  produtosGuardados: 4,
};
