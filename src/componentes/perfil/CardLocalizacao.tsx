import { MapPin } from "lucide-react";

import CardSecaoPerfil from "./CardSecaoPerfil";

interface Props {
  children: React.ReactNode;
}

export default function CardLocalizacao({
  children,
}: Props) {
  return (
    <CardSecaoPerfil
      icon={MapPin}
      titulo="Localização"
      descricao="Indique onde os clientes podem encontrar o seu negócio."
    >
      {children}
    </CardSecaoPerfil>
  );
}