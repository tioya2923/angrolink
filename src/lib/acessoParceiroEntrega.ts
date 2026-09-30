import type { EstadoParceiroEntrega } from '@/tipos';

export function parceiroEstaSuspenso(estado?: EstadoParceiroEntrega) {
  return estado === 'suspenso';
}

export function parceiroEstaRestrito(estado?: EstadoParceiroEntrega) {
  return estado !== 'aprovado';
}

export function parceiroPodeAcederAreaOperacional(
  estado?: EstadoParceiroEntrega,
) {
  return estado === 'aprovado';
}
