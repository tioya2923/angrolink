import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface CardSecaoPerfilProps {
  icon: LucideIcon;
  titulo: string;
  descricao?: string;
  children: ReactNode;
}

export default function CardSecaoPerfil({
  icon: Icon,
  titulo,
  descricao,
  children,
}: CardSecaoPerfilProps) {
  return (
    <Card className="rounded-2xl shadow-sm border">

      <CardHeader className="pb-4">

        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">

            <Icon className="h-5 w-5 text-green-700" />

          </div>

          <div>

            <CardTitle className="text-lg">
              {titulo}
            </CardTitle>

            {descricao && (
              <CardDescription>
                {descricao}
              </CardDescription>
            )}

          </div>

        </div>

      </CardHeader>

      <CardContent className="space-y-5">

        {children}

      </CardContent>

    </Card>
  );
}