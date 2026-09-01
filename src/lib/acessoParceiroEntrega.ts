import type { EstadoParceiroEntrega } from '@/tipos';

export function parceiroEstaSuspenso(estado?: EstadoParceiroEntrega) {
  return estado === 'suspenso';
}

export function parceiroPodeAcederAreaOperacional(
  estado?: EstadoParceiroEntrega,
) {
  return !parceiroEstaSuspenso(estado);
}
