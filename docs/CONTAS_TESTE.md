# Matriz oficial de contas de teste

Estas contas existem apenas no Supabase de teste da ANGROLINK. Este ficheiro
não contém e-mails, números de telefone, palavras-passe, tokens ou documentos.

| Identificador operacional | Papel | Propósito obrigatório |
| --- | --- | --- |
| `cliente_teste_a` | cliente | Criar encomendas e confirmar que lê apenas os seus dados. |
| `cliente_teste_b` | cliente | Confirmar isolamento RLS contra dados de `cliente_teste_a`. |
| `vendedor_teste_a` | vendedor | Ter perfil aprovado, conta ativa, `user_id`, Auth e profile coerentes; publicar produtos transacionáveis. |
| `vendedor_teste_b` | vendedor | Confirmar isolamento RLS entre vendedores e testar encomendas de outro catálogo. |
| `parceiro_teste` | parceiro de entrega | Confirmar que não acede a encomendas antes da fase logística. |
| `admin_teste` | admin | Confirmar leitura administrativa e decisões permitidas. |

## Regras de manutenção

- Cada vendedor de teste deve ter `vendedores.user_id` ligado a uma conta em
  `auth.users` e ao respetivo `profiles.id` com `papel = 'vendedor'`.
- Produtos usados em testes transacionais devem pertencer a um vendedor de
  teste autenticável.
- A associação, recuperação ou redefinição de palavras-passe é feita apenas
  pelo painel Auth do Supabase ou por canal seguro fora do repositório.
- Antes de reutilizar uma conta, confirmar o seu estado administrativo e
  remover apenas dados de teste que tenham sido explicitamente aprovados.
