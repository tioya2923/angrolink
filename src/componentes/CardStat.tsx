import { Card, CardContent } from "@/components/ui/card";

interface CardStatProps {
  icone: React.ComponentType<any>;
  rotulo: string;
  valor: number | string;

  corIcone?: string;

  subtitulo?: string;

  onClick?: () => void;
}

export default function CardStat({
  icone: Icone,
  rotulo,
  valor,
  corIcone = "text-green-700",
  subtitulo,
  onClick,
}: CardStatProps) {
  return (
    <Card
      onClick={onClick}
      className={`transition-all duration-300 hover:shadow-md ${
        onClick ? "cursor-pointer hover:-translate-y-1" : ""
      }`}
    >
      <CardContent className="p-5">

        <Icone
          size={24}
          className={`${corIcone} mb-4`}
        />

        <p className="text-4xl font-bold">
          {valor}
        </p>

        <p className="text-sm text-muted-foreground mt-1">
          {rotulo}
        </p>

        {subtitulo && (
          <p className="text-xs text-green-700 mt-3">
            {subtitulo}
          </p>
        )}

      </CardContent>
    </Card>
  );
}