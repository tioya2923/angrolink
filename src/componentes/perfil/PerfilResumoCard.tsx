import {
  Camera,
  Mail,
  Phone,
  ShieldCheck,
  BadgeCheck,
  Package,
} from "lucide-react";

import PerfilInfoItem from "./PerfilInfoItem";

interface Props {
  fotoPreview: string | null;

  nomeComercial: string;
  nomeResponsavel: string;
  email: string;
  whatsapp: string;

  plano?: string;
  verificado?: boolean;

  statusAprovacao: string;

  onSelecionarFoto: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;

  onRemoverFoto: () => void;
}

export default function PerfilResumoCard({
  fotoPreview,

  nomeComercial,
  nomeResponsavel,
  email,
  whatsapp,

  plano,
  verificado,

  statusAprovacao,
  onRemoverFoto,

  onSelecionarFoto,
}: Props) {
  const textoEstado =
    statusAprovacao === "aprovado"
      ? "Conta aprovada"
      : statusAprovacao === "rejeitado"
      ? "Conta rejeitada"
      : statusAprovacao === "suspenso"
      ? "Conta suspensa"
      : "Conta em análise";

  return (
    <div className="rounded-2xl border bg-card shadow-sm p-6">

      <div className="flex flex-col md:flex-row gap-6">

        {/* Foto */}
        <div className="relative shrink-0">

          <div className="w-36 h-36 lg:w-40 lg:h-40 rounded-full overflow-hidden border-4 border-green-700/20 bg-muted flex items-center justify-center">

            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt={nomeComercial}
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera className="w-10 h-10 text-muted-foreground" />
            )}

          </div>

          <div className="mt-4 flex gap-2">

            <label className="flex-1 cursor-pointer inline-flex items-center justify-center rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800 transition">

              <Camera className="mr-2 h-4 w-4" />

              Alterar foto

              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={onSelecionarFoto}
              />

            </label>

            {fotoPreview && (

              <button
                type="button"
                onClick={onRemoverFoto}
                className="inline-flex items-center justify-center rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
              >

                Remover foto

              </button>

            )}

          </div>

        </div>

        {/* Informação */}
        <div className="flex flex-1 flex-col justify-center space-y-4">

          <div  className="space-y-1">

            <h2 className="text-3xl font-bold tracking-tight">
              {nomeComercial}
            </h2>

            {nomeResponsavel && (
              <p className="text-base text-muted-foreground">
                {nomeResponsavel}
              </p>
            )}

          </div>

          <div className="flex flex-wrap gap-2">

            <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium">
              {textoEstado}
            </span>

            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              <ShieldCheck className="inline mr-1 h-3 w-3" />

              {verificado
                ? "Verificada"
                : "Não verificada"}
            </span>

            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              <Package className="inline mr-1 h-3 w-3" />

              {plano || "Gratuito"}
            </span>

          </div>

          <div className="flex flex-wrap items-start gap-8">

            <PerfilInfoItem
              icon={Mail}
              titulo="Email"
              valor={email}
            />

            <PerfilInfoItem
              icon={Phone}
              titulo="WhatsApp"
              valor={whatsapp}
            />

          </div>

        </div>

      </div>

    </div>
  );
}