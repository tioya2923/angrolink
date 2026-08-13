import { useEffect, useMemo, useState } from 'react';

import Cabecalho from '@/componentes/Cabecalho';
import Rodape from '@/componentes/Rodape';
import ListaServicos from '@/componentes/ListaServicos';

import { fetchServicos } from '@/services/api';
import { Servico } from '@/tipos';
import { MUNICIPIOS, PROVINCIAS } from '@/dados/constantes';
import { useAtualizacaoTempoReal } from '@/hooks/useAtualizacaoTempoReal';

const TIPOS_SERVICO = [
  'Transporte de mercadorias',
  'Entrega de mercadorias',
  'Moagem',
  'Limpeza',
  'Reparação',
  'Aluguer de Equipamento',
  'Mão de obra agrícola',
  'Consultoria',
  'Outros',
];

export default function PaginaServicos() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [pesquisa, setPesquisa] = useState('');
  const [tipoServico, setTipoServico] = useState('');
  const [provincia, setProvincia] = useState('');
  const [municipio, setMunicipio] = useState('');

  useEffect(() => {
    async function carregarServicos() {
      try {
        setLoading(true);
        setErro(null);

        const data = await fetchServicos();
        setServicos(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setErro('Erro ao carregar serviços');
        setServicos([]);
      } finally {
        setLoading(false);
      }
    }

    carregarServicos();
  }, []);

  useAtualizacaoTempoReal(['servicos', 'vendedores'], async () => {
    const data = await fetchServicos();
    setServicos(Array.isArray(data) ? data : []);
  });

  const municipiosFiltrados = MUNICIPIOS.filter(
    m => m.provincia_id === PROVINCIAS.find(p => p.nome === provincia)?.id
  );

  const servicosFiltrados = useMemo(() => {
    let resultado = [...servicos];

    resultado = resultado.filter(s => s.disponivel !== false);

    if (pesquisa.trim()) {
      const termo = pesquisa.toLowerCase().trim();

      resultado = resultado.filter(s =>
        s.nome_servico?.toLowerCase().includes(termo) ||
        s.descricao?.toLowerCase().includes(termo) ||
        s.tipo_servico?.toLowerCase().includes(termo)
      );
    }

    if (tipoServico) {
      resultado = resultado.filter(
        s => s.tipo_servico === tipoServico
      );
    }

    if (provincia) {
      resultado = resultado.filter(
        s => s.provincia?.toLowerCase().trim() === provincia.toLowerCase().trim()
      );
    }

    if (municipio) {
      resultado = resultado.filter(
        s => s.municipio?.toLowerCase().trim() === municipio.toLowerCase().trim()
      );
    }

    return resultado.sort(
      (a, b) =>
        new Date(b.criado_em || 0).getTime() -
        new Date(a.criado_em || 0).getTime()
    );
  }, [servicos, pesquisa, tipoServico, provincia, municipio]);

  return (
    <div className="min-h-screen flex flex-col">
      <Cabecalho />

      <main className="flex-1">
        <section className="border-b-2 border-border py-6">
          <div className="container space-y-4">
            <div>
              <h1 className="font-titulo text-2xl md:text-3xl">
                Serviços disponíveis
              </h1>

              <p className="font-corpo text-sm text-muted-foreground mt-1">
                Encontre transporte, entrega, reparação, mão de obra agrícola e outros serviços locais.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                value={pesquisa}
                onChange={e => setPesquisa(e.target.value)}
                placeholder="Pesquisar serviço..."
                className="border-2 border-border px-3 py-2"
              />

              <select
                value={tipoServico}
                onChange={e => setTipoServico(e.target.value)}
                className="border-2 border-border px-3 py-2"
              >
                <option value="">Todos os tipos</option>

                {TIPOS_SERVICO.map(tipo => (
                  <option key={tipo} value={tipo}>
                    {tipo}
                  </option>
                ))}
              </select>

              <select
                value={provincia}
                onChange={e => {
                  setProvincia(e.target.value);
                  setMunicipio('');
                }}
                className="border-2 border-border px-3 py-2"
              >
                <option value="">Todas as províncias</option>

                {PROVINCIAS.map(p => (
                  <option key={p.id} value={p.nome}>
                    {p.nome}
                  </option>
                ))}
              </select>

              <select
                value={municipio}
                onChange={e => setMunicipio(e.target.value)}
                disabled={!provincia}
                className="border-2 border-border px-3 py-2 disabled:opacity-50"
              >
                <option value="">
                  {provincia ? 'Todos os municípios' : 'Escolha província'}
                </option>

                {municipiosFiltrados.map(m => (
                  <option key={m.id} value={m.nome}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="py-6">
          <div className="container">
            {loading && <p>A carregar serviços...</p>}

            {erro && <p>{erro}</p>}

            {!loading && !erro && (
              <>
                <p className="font-corpo text-sm text-muted-foreground mb-4">
                  {servicosFiltrados.length} serviços encontrados
                </p>

                <ListaServicos servicos={servicosFiltrados} />
              </>
            )}
          </div>
        </section>
      </main>

      <Rodape />
    </div>
  );
}
