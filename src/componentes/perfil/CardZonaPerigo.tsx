import { Trash2 } from "lucide-react";

import CardSecaoPerfil from "./CardSecaoPerfil";

interface Props {
  children: React.ReactNode;
}

export default function CardZonaPerigo({
  children,
}: Props) {
  return (
    <CardSecaoPerfil
      icon={Trash2}
      titulo="Zona de perigo"
      descricao="Ações irreversíveis relacionadas com a sua conta."
    >
      {children}
    </CardSecaoPerfil>
  );
}