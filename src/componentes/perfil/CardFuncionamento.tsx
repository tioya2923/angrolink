import { Clock3 } from "lucide-react";

import CardSecaoPerfil from "./CardSecaoPerfil";

interface Props {
  children: React.ReactNode;
}

export default function CardFuncionamento({
  children,
}: Props) {
  return (
    <CardSecaoPerfil
      icon={Clock3}
      titulo="Funcionamento"
      descricao="Informe como e quando os clientes podem entrar em contacto consigo."
    >
      {children}
    </CardSecaoPerfil>
  );
}