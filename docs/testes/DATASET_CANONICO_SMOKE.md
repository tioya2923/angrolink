# Dataset canónico de smoke tests — Staging

## Estado do bootstrap

Este dataset só deve ser usado depois de uma baseline oficial e reproduzível do
schema legado ter sido aprovada para um novo projeto Supabase. As migrations
atuais começam em encomendas e pressupõem `profiles`, `clientes`, `vendedores`,
`produtos`, `servicos`, `eh_admin()` e buckets Storage já existentes.

Não copiar dados, IDs, estados administrativos, documentos, paths Storage ou
credenciais do ambiente histórico.

## Admin

- Criar uma nova conta Auth manualmente no projeto de staging.
- Criar o respetivo `profiles` pelo fluxo de autenticação aplicável.
- Associar a conta nova a `public.administradores` por procedimento
  administrativo aprovado; nunca reutilizar UUID histórico.
- Guardar a password somente no gestor de segredos do operador, fora do Git.

## Comprador C1

Modelo de dados: cliente residencial com telefone e localização completos.

- Papel: `cliente`.
- Localização de staging: Luanda / Ingombota.
- Tipo: `casa`.
- Criar exclusivamente pela página de cadastro de comprador.
- Usar email e telefone sintéticos únicos no projeto de staging.

## Vendedor V1

### Perfil

- Modelo: produtor de produtos físicos, com perfil comercial completo.
- Localização de staging: Luanda / Ingombota.
- Criar exclusivamente pela página de cadastro de vendedor.
- Depois, aprovar pelo painel Admin de staging.

### Produtos

- Produto A1: retalho, unidade `kg`, preço de teste inteiro em centimos,
  quantidade mínima compatível com compra unitária.
- Produto A2: venda a grosso, unidade `saco`, mínimo superior a uma unidade.
- Para o smoke de entrega: peso, volume e requisitos logísticos conhecidos,
  sem refrigeração, sem paletes e sem requisito de caixa.

### Serviço

Opcional. Se criado, mantê-lo separado do checkout de produtos e usar apenas
para verificar publicação e contacto.

## Vendedor V2

### Perfil

- Modelo: grossista distinto de V1, com catálogo físico e dados comerciais
  completos.
- Localização de staging: Luanda / Ingombota.
- Criar pelo fluxo real e aprovar pelo Admin de staging.

### Produtos

- Produto B1: retalho, unidade `unidade` ou `kg`.
- Produto B2 opcional: compra a grosso.
- Usar os mesmos requisitos logísticos conservadores de V1 para que ambos os
  parceiros sejam candidatos ao matching.

## Parceiro P1

### Perfil

- Modelo: parceiro baseado em Luanda, com cobertura em Ingombota.
- Criar pelo fluxo real de parceiro; não copiar documentos ou paths antigos.

### Veículo

- Tipo: `mota`.
- Capacidade alvo: pelo menos 50 kg e 10 m³.
- Caixa de carga: sim.
- Refrigeração e paletes: não necessárias para os produtos deste dataset.

### Área e documentos

- Área ativa: Luanda / Ingombota.
- Enviar novos documentos sintéticos compatíveis com o fluxo de staging e
  aprová-los pelo Admin. Nunca reutilizar imagens, números ou versões antigas.

## Parceiro P2

### Perfil

- Modelo: segundo parceiro baseado em Luanda / Ingombota.
- Criar pelo fluxo real e aprovar pelo Admin de staging.

### Veículo

- Tipo: `mota`.
- Capacidade alvo: pelo menos 10 kg.
- Caixa de carga: sim.
- Sem requisitos de refrigeração ou paletes neste dataset.

### Área e documentos

- Área ativa: Luanda / Ingombota.
- Usar documentos sintéticos novos e aprovados no novo projeto.

## Compatibilidade territorial e de matching

Todos os intervenientes operacionais usam Luanda / Ingombota. Os produtos de
entrega devem ficar abaixo de 10 kg, com volume conhecido baixo, sem
refrigeração, caixa obrigatória ou paletes. Assim, P1 e P2 podem ser avaliados
para a mesma encomenda quando estiverem aprovados, disponíveis, com área ativa
e documentos/veículos operacionais.

## Cenários suportados

1. Cadastro de C1, V1, V2, P1 e P2 pelos fluxos reais.
2. Aprovação administrativa de vendedores, parceiros, veículos e documentos.
3. Produto e serviço; publicação e catálogo.
4. Carrinho simples e carrinho multi-vendedor, produzindo grupos/encomendas
   distintos por vendedor.
5. Levantamento com OTP e conclusão.
6. Entrega: confirmação do vendedor, preparação, pronto, atribuição, aceite,
   chegada à origem, recolha confirmada, deslocação ao destino (sem estado
   decorativo `em_transito`), chegada ao destino, pagamento na entrega, OTP
   de entrega e conclusão.
7. Recusa de P1, libertação administrativa e reatribuição para P2.
8. Incidente após recolha, resolução e segundo incidente sequencial.
9. Notificações e Realtime de comprador, vendedor e parceiro.

## Convenções de credenciais

Usar apenas os rótulos `C1`, `V1`, `V2`, `P1` e `P2` nos roteiros. Emails e
telefones são sintéticos, únicos por ambiente e definidos pelo operador. Não
guardar passwords, tokens, URLs assinadas ou chaves no repositório.

## Estratégia de ambientes

- Mesmo código React para todos os ambientes.
- `.env.local`, `.env.staging` e `.env.production` contêm apenas
  `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` adequadas a cada ambiente.
- Nenhum ficheiro de ambiente com segredos deve ser versionado.
- Antes de qualquer `supabase link` ou `db push`, confirmar manualmente o
  project ref, executar `supabase migration list --linked` e depois
  `supabase db push --dry-run` no ambiente selecionado.
