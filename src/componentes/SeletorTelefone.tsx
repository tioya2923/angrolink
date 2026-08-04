import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { PAISES, paisPorIndicativo } from '@/dados/paises';
import { cn } from '@/lib/utils';

interface SeletorTelefoneProps {
  indicativo: string;
  onIndicativoChange: (indicativo: string) => void;
  valor: string;
  onValorChange: (valor: string) => void;
  placeholder?: string;
  required?: boolean;
  id?: string;
  maxLength?: number;
  className?: string;
}

export default function SeletorTelefone({
  indicativo,
  onIndicativoChange,
  valor,
  onValorChange,
  placeholder,
  required,
  id,
  maxLength = 9,
  className,
}: SeletorTelefoneProps) {
  const [aberto, setAberto] = useState(false);

  const paisAtual = paisPorIndicativo(indicativo);

  return (
    <div className={cn('flex', className)}>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Escolher indicativo do país"
            className="flex shrink-0 items-center gap-1 px-3 border-2 border-r-0 border-border rounded-l-md bg-muted text-sm text-muted-foreground hover:bg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <span>{paisAtual.bandeira}</span>
            <span>+{indicativo}</span>
            <ChevronDown size={14} />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Pesquisar país..." />
            <CommandList>
              <CommandEmpty>Nenhum país encontrado.</CommandEmpty>
              <CommandGroup>
                {PAISES.map(pais => (
                  <CommandItem
                    key={pais.iso2}
                    value={`${pais.nome} +${pais.indicativo}`}
                    onSelect={() => {
                      onIndicativoChange(pais.indicativo);
                      setAberto(false);
                    }}
                  >
                    <span className="mr-2">{pais.bandeira}</span>
                    <span className="flex-1 truncate">{pais.nome}</span>
                    <span className="text-muted-foreground">+{pais.indicativo}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Input
        id={id}
        type="tel"
        value={valor}
        onChange={e => onValorChange(e.target.value.replace(/\D/g, '').slice(0, maxLength))}
        placeholder={placeholder}
        className="rounded-l-none border-2 border-border"
        required={required}
      />
    </div>
  );
}
