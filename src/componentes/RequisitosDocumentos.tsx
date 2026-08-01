import { FileCheck } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TipoVendedor } from '@/tipos';
import { CATALOGO_DOCUMENTOS, obterRequisitosDocumentos } from '@/dados/documentosVendedor';

interface Props {
  tipo: TipoVendedor | '';
  /** Quando fornecido (com onChange), o componente pede os dados de cada documento. */
  valores?: Record<string, Record<string, string>>;
  onChange?: (documentoId: string, campoId: string, valor: string) => void;
}

export default function RequisitosDocumentos({ tipo, valores, onChange }: Props) {
  const requisitos = obterRequisitosDocumentos(tipo);
  if (!requisitos) return null;

  const interativo = Boolean(onChange);

  return (
    <div className="border-2 border-border bg-muted/30 rounded-md p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileCheck size={16} className="text-primary shrink-0" />
        <h3 className="font-titulo text-sm font-semibold">
          Documentos para {requisitos.rotuloNivel.toLowerCase()}
        </h3>
      </div>

      <div className="space-y-4">
        {requisitos.obrigatorios.map(id => {
          const doc = CATALOGO_DOCUMENTOS[id];
          if (!doc) return null;

          if (!interativo) {
            return (
              <p key={id} className="flex items-start gap-2 font-corpo text-xs">
                <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                <span>
                  <strong className="font-medium">{doc.nome}</strong>
                  {' — '}
                  {doc.descricao}
                </span>
              </p>
            );
          }

          return (
            <div key={id} className="space-y-2">
              <p className="font-corpo text-xs font-semibold">{doc.nome}</p>
              <p className="font-corpo text-[11px] text-muted-foreground -mt-1">
                {doc.descricao}
              </p>

              <div className={doc.campos.length > 1 ? 'grid grid-cols-1 sm:grid-cols-3 gap-3' : ''}>
                {doc.campos.map(campo => (
                  <div key={campo.id} className="space-y-1">
                    <Label className="font-corpo text-xs font-medium">
                      {campo.rotulo} *
                    </Label>
                    <Input
                      type={campo.tipo === 'data' ? 'date' : 'text'}
                      value={valores?.[id]?.[campo.id] || ''}
                      onChange={e => onChange?.(id, campo.id, e.target.value)}
                      placeholder={campo.placeholder}
                      required
                      className="border-2 border-border"
                      maxLength={50}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {requisitos.opcionais.map(id => {
          const doc = CATALOGO_DOCUMENTOS[id];
          if (!doc) return null;

          if (!interativo) {
            return (
              <p key={id} className="flex items-start gap-2 font-corpo text-xs text-muted-foreground">
                <span className="mt-1 shrink-0 w-1.5 h-1.5 rounded-full border border-muted-foreground" />
                <span>
                  {doc.nome} <em>(opcional)</em> — {doc.descricao}
                </span>
              </p>
            );
          }

          return (
            <div key={id} className="space-y-2">
              <p className="font-corpo text-xs font-semibold text-muted-foreground">
                {doc.nome} <em>(opcional)</em>
              </p>

              <div className={doc.campos.length > 1 ? 'grid grid-cols-1 sm:grid-cols-3 gap-3' : ''}>
                {doc.campos.map(campo => (
                  <div key={campo.id} className="space-y-1">
                    <Label className="font-corpo text-xs font-medium text-muted-foreground">
                      {campo.rotulo}
                    </Label>
                    <Input
                      type={campo.tipo === 'data' ? 'date' : 'text'}
                      value={valores?.[id]?.[campo.id] || ''}
                      onChange={e => onChange?.(id, campo.id, e.target.value)}
                      placeholder={campo.placeholder}
                      className="border-2 border-border"
                      maxLength={50}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
