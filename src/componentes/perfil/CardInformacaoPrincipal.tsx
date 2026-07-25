import { Building2 } from "lucide-react";

import CardSecaoPerfil from "./CardSecaoPerfil";

interface Props {
  children: React.ReactNode;
}

export default function CardInformacaoPrincipal({
  children,
}: Props) {
  return (
    <CardSecaoPerfil
      icon={Building2}
      titulo="Informação principal"
      descricao="Atualize as informações que serão apresentadas aos clientes na ANGROLINK."
    >
      {children}
    </CardSecaoPerfil>
  );
}