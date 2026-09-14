import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FeedbackPiloto from '@/paginas/dashboard/FeedbackPiloto';
const mocks = vi.hoisted(() => ({ utilizador: { papel: 'cliente' } as { papel: string } }));
vi.mock('@/contextos/AuthContexto', () => ({ useAuth: () => ({ utilizador: mocks.utilizador }) }));
vi.mock('@/componentes/FeedbackPilotoDialog', () => ({ FeedbackPilotoDialog: ({ contexto }: { contexto: string }) => <div data-testid="feedback-geral">{contexto}</div> }));
describe('FeedbackPiloto geral', () => { afterEach(()=>cleanup()); it.each(['cliente','vendedor','parceiro_entrega'])('passa contexto %s', papel=>{mocks.utilizador={papel};render(<MemoryRouter><FeedbackPiloto/></MemoryRouter>);expect(screen.getByTestId('feedback-geral').textContent).toBe(papel);}); it('não abre para Admin',()=>{mocks.utilizador={papel:'admin'};render(<MemoryRouter><FeedbackPiloto/></MemoryRouter>);expect(screen.queryByTestId('feedback-geral')).toBeNull();}); });
