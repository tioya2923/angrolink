# Migrações Supabase

1. Faça uma cópia de segurança da base de dados.
2. Execute `20260802_hardening_rls_e_tipos_vendedor.sql` integralmente no SQL Editor.
3. Confirme que a conta administrativa correta está presente em `administradores` antes de remover ou alterar o e-mail de bootstrap.
4. Regere os tipos do cliente e substitua `src/types/database.types.ts`:

```sh
supabase gen types typescript --project-id <project-id> --schema public > src/types/database.types.ts
```

Esta migração normaliza `tipo_vendedor`, ativa RLS e cria políticas por proprietário, vendedor e administrador. Não deve ser aplicada parcialmente.
