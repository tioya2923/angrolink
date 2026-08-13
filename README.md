# ANGROLINK

Marketplace angolano para compra e venda de produtos, serviços e futura logística de entregas de mercadorias.

## Perfis da plataforma

- **Cliente:** pesquisa produtos e serviços, guarda favoritos e contacta anunciantes.
- **Vendedor:** cria um perfil comercial, submete documentos para análise e publica produtos ou serviços após aprovação.
- **Parceiro de entregas:** regista veículo, zona de cobertura e documentação para análise administrativa. Só pode receber pedidos depois de aprovado.
- **Administrador:** analisa pedidos, documentos, anúncios e utilizações da plataforma.

## Tecnologias

- React, TypeScript, Vite e Tailwind CSS
- Supabase Authentication, Database e Storage
- React Router e TanStack React Query

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie um ficheiro `.env` a partir deste modelo:

   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
   VITE_SUPABASE_BUCKET_PRODUTOS=produtos
   ```

3. Aplique no Supabase, pela ordem necessária, as migrações em `supabase/migrations/`. Estas migrações criam as estruturas e regras de segurança usadas pelos pedidos de vendedores e parceiros de entregas.

4. Inicie a aplicação:

   ```bash
   npm run dev
   ```

## Verificação antes de publicar

```bash
npm run lint
npm run test
npm run build
```

## Regras importantes

- A aprovação, rejeição, suspensão e permissões devem ser garantidas por RLS e funções do Supabase; o estado apresentado na interface não é uma proteção de segurança por si só.
- Os documentos de vendedores e parceiros de entrega são dados sensíveis. Evite colocá-los em buckets públicos e utilize URLs assinadas quando forem privados.
- Números de telefone são guardados no formato internacional (`+indicativo` + número). Para Angola, o formulário aceita nove dígitos e aplica o indicativo `+244` selecionado pelo utilizador.
