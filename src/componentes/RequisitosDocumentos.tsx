import { FileCheck } from 'lucide-react';

import { TipoVendedor } from '@/tipos';
import { CATALOGO_DOCUMENTOS, obterRequisitosDocumentos } from '@/dados/documentosVendedor';

interface Props {
  tipo: TipoVendedor | '';
}

export default function RequisitosDocumentos({ tipo }: Props) {
  const requisitos = obterRequisitosDocumentos(tipo);
  if (!requisitos) return null;

  return (
    <div className="border-2 border-border bg-muted/30 rounded-md p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileCheck size={16} className="text-primary shrink-0" />
        <h3 className="font-titulo text-sm font-semibold">
          Documentos para {requisitos.rotuloNivel.toLowerCase()}
        </h3>
      </div>

      <ul className="space-y-1.5">
        {requisitos.obrigatorios.map(id => {
          const doc = CATALOGO_DOCUMENTOS[id];
          if (!doc) return null;

          return (
            <li key={id} className="flex items-start gap-2 font-corpo text-xs">
              <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
              <span>
                <strong className="font-medium">{doc.nome}</strong>
                {' — '}
                {doc.descricao}
              </span>
            </li>
          );
        })}

        {requisitos.opcionais.map(id => {
          const doc = CATALOGO_DOCUMENTOS[id];
          if (!doc) return null;

          return (
            <li key={id} className="flex items-start gap-2 font-corpo text-xs text-muted-foreground">
              <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full border border-muted-foreground" />
              <span>
                {doc.nome} <em>(opcional)</em> — {doc.descricao}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
