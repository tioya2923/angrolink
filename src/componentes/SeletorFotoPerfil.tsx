import { Camera } from 'lucide-react';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';

interface Props {
  preview: string;
  onSelecionar: (ficheiro: File) => void;
  onRemover: () => void;
  rotulo?: string;
}

export default function SeletorFotoPerfil({
  preview,
  onSelecionar,
  onRemover,
  rotulo = 'Foto de perfil ou logótipo',
}: Props) {
  return (
    <div className="space-y-3 border-2 border-dashed border-primary/30 bg-primary/5 rounded-md p-4">
      <div className="flex items-start gap-2">
        <Camera size={16} className="text-primary shrink-0 mt-0.5" />
        <div>
          <Label className="font-corpo text-sm font-medium">
            {rotulo}{' '}
            <span className="text-primary font-normal">(recomendado)</span>
          </Label>
          <p className="font-corpo text-xs text-muted-foreground mt-0.5">
            Não é obrigatório, mas contas com foto geram mais confiança e mais contactos.
          </p>
        </div>
      </div>

      {preview && (
        <div className="flex flex-col items-center gap-3">
          <img
            src={preview}
            alt="Pré-visualização"
            className="w-28 h-28 rounded-full object-cover border"
          />

          <button
            type="button"
            onClick={onRemover}
            className="text-red-600 text-sm hover:underline"
          >
            Remover foto
          </button>
        </div>
      )}

      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border-2 border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
        Escolher imagem
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const ficheiro = e.target.files?.[0];

            if (!ficheiro) return;

            if (!ficheiro.type.startsWith('image/')) {
              toast.error('Escolha uma imagem.');
              return;
            }

            if (ficheiro.size > 5 * 1024 * 1024) {
              toast.error('A imagem deve ter menos de 5MB.');
              return;
            }

            onSelecionar(ficheiro);
          }}
          className="sr-only"
        />
      </label>
    </div>
  );
}
