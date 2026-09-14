import { useNavigate } from 'react-router-dom';
import { FeedbackPilotoDialog } from '@/componentes/FeedbackPilotoDialog';
import { useAuth } from '@/contextos/AuthContexto';
import type { ContextoFeedbackPiloto } from '@/services/feedbackPiloto';
export default function FeedbackPiloto(){const navegar=useNavigate();const {utilizador}=useAuth();const papel=utilizador?.papel;if(!papel||papel==='admin')return null;const contexto=papel as ContextoFeedbackPiloto;return <FeedbackPilotoDialog aberto aoFechar={()=>navegar('/dashboard')} contexto={contexto}/>;}
