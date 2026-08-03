import { FileCheck, ImagePlus } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TipoVendedor } from '@/tipos';
import { CATALOGO_DOCUMENTOS, obterRequisitosDocumentos } from '@/dados/documentosVendedor';

interface Props {
  tipo: TipoVendedor | '';
  /** Quando fornecido (com onChange), o componente pede os dados de cada documento. */
  valores?: Record<string, Record<string, string>>;
  onChange?: (documentoId: string, campoId: string, valor: string) => void;
  fotos?: Record<string, { frente?: File; verso?: File }>;
  onFotoChange?: (documentoId: string, lado: 'frente' | 'verso', ficheiro: File | undefined) => void;
}

export default function RequisitosDocumentos({ tipo, valores, onChange, fotos, onFotoChange }: Props) {
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

              <div className={doc.campos.length > 1 ? 'grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.3fr]' : ''}>
                {doc.campos.map(campo => (
                  <div key={campo.id} className="space-y-1">
                    <Label className={`font-corpo text-xs font-medium ${doc.campos.length > 1 ? 'flex min-h-10 items-end whitespace-nowrap text-[11px]' : ''}`}>
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

              {interativo && (
                <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
                  <p className="mb-2 flex items-center gap-1 font-corpo text-xs font-semibold text-primary"><ImagePlus size={14} /> Fotografias do documento *</p>
                  <p className="mb-3 font-corpo text-[11px] text-muted-foreground">Envie imagens legíveis da frente e do verso de {doc.nome}. JPG, PNG ou WEBP, até 3 MB por imagem.</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(['frente', 'verso'] as const).map(lado => (
                      <div key={lado} className="space-y-1">
                        <Label className="font-corpo text-xs font-medium">{lado === 'frente' ? 'Foto da frente *' : 'Foto do verso *'}</Label>
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          required
                          onChange={e => onFotoChange?.(id, lado, e.target.files?.[0])}
                          className="cursor-pointer border-2 border-border text-xs file:mr-2 file:rounded file:border-0 file:bg-primary file:px-2 file:py-1 file:text-xs file:font-medium file:text-primary-foreground"
                        />
                        {fotos?.[id]?.[lado] && <p className="truncate font-corpo text-[11px] text-primary">Selecionada: {fotos[id][lado]!.name}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
