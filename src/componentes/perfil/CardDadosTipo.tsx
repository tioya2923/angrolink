import { Sprout } from "lucide-react";

import CardSecaoPerfil from "./CardSecaoPerfil";

interface Props {
  titulo: string;
  descricao: string;
  children: React.ReactNode;
}

export default function CardDadosTipo({
  titulo,
  descricao,
  children,
}: Props) {
  return (
    <CardSecaoPerfil
      icon={Sprout}
      titulo={titulo}
      descricao={descricao}
    >
      {children}
    </CardSecaoPerfil>
  );
}