import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAtualizacaoCatalogoPublico } from '@/hooks/useCatalogoQuery';

describe('useAtualizacaoCatalogoPublico', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('revalida lista vazia por foco, reconexao e intervalo, e limpa listeners', () => {
    const { result, unmount } = renderHook(() => useAtualizacaoCatalogoPublico([]));
    expect(result.current).toBe(0);

    act(() => window.dispatchEvent(new Event('focus')));
    expect(result.current).toBe(1);
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(2);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(3);

    unmount();
    act(() => window.dispatchEvent(new Event('focus')));
  });

  it('agenda uma revalidacao no fim conhecido do destaque', () => {
    vi.setSystemTime(new Date('2026-10-13T10:00:00.000Z'));
    const { result } = renderHook(() => useAtualizacaoCatalogoPublico([
      { destaque_fim_em: '2026-10-13T10:00:01.000Z' },
    ]));

    act(() => vi.advanceTimersByTime(1_049));
    expect(result.current).toBe(0);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(1);
  });
});
