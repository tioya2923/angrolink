import { LucideIcon } from "lucide-react";

interface PerfilInfoItemProps {
  icon: LucideIcon;
  titulo: string;
  valor?: string | number | null;
}

export default function PerfilInfoItem({
  icon: Icon,
  titulo,
  valor,
}: PerfilInfoItemProps) {
  if (!valor) return null;

  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 rounded-full bg-green-50 p-2">
        <Icon className="h-4 w-4 text-green-700" />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {titulo}
        </p>

        <p className="font-medium break-words">
          {valor}
        </p>
      </div>
    </div>
  );
}