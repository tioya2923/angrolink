import { Lock } from "lucide-react";

import CardSecaoPerfil from "./CardSecaoPerfil";

interface Props {
  children: React.ReactNode;
}

export default function CardSeguranca({
  children,
}: Props) {
  return (
    <CardSecaoPerfil
      icon={Lock}
      titulo="Segurança"
      descricao="Altere a palavra-passe da sua conta."
    >
      {children}
    </CardSecaoPerfil>
  );
}
