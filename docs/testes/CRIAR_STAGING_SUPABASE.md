# Criar staging Supabase da ANGROLINK

Este roteiro é preparatório. Não executar contra o projeto histórico/produção.
Usar worktree e diretório Supabase exclusivos para staging antes de executar
qualquer comando com `--linked`.

## Pré-requisitos

1. Criar um novo projeto Supabase e confirmar visualmente o `project ref`.
2. Guardar segredos apenas no gestor de segredos/variáveis locais; nunca no Git.
3. Confirmar que `supabase/baseline/current/05_reference_data.sql` foi
   validado localmente e que os snapshots estruturais `01` a `04` foram
   capturados depois do hardening. Enquanto a captura estrutural estiver
   desatualizada, **não criar staging**.

## Procedimento futuro

1. Aplicar a infraestrutura nativa do projeto novo e a baseline na ordem
   descrita em `supabase/baseline/current/README.md`.
2. Verificar que as tabelas operacionais começam vazias e que a referência
   canónica existe.
3. Inicializar o histórico de migrations **apenas no novo staging** com uma
   decisão aprovada de baseline; não usar `migration repair` no projeto atual.
   A marca deve representar o estado posterior a `20260830020000`, para que
   migrations futuras continuem daí sem reexecutar a cadeia histórica.
4. Executar `npx supabase migration list --linked` no worktree exclusivo e
   confirmar o projeto antes de qualquer futuro `db push`.
5. Criar um novo administrador e C1/V1/V2/P1/P2 pelos fluxos reais descritos
   em `docs/testes/DATASET_CANONICO_SMOKE.md`.
6. Configurar o frontend de staging apenas com `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY`; nunca com service role, password ou access token.
7. Executar smoke tests e comparar schema, Storage e Realtime com a baseline.

## Proteção contra projeto errado

- Não reutilizar o diretório ligado ao projeto histórico.
- Não executar `supabase link` nesta preparação.
- Antes de qualquer escrita futura, confirmar `project ref`, worktree e
  `migration list --linked` em voz alta no checklist de deploy.
