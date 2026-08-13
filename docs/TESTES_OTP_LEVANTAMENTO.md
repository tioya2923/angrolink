# Testes remotos — OTP de levantamento

Executar estes cenários apenas depois de aplicar a migration
`20260813145920_adicionar_otp_levantamento.sql` num projeto Supabase de teste.
Cada cenário que crie uma encomenda, código ou evento deve correr numa transação
terminada por `ROLLBACK`.

## Pré-condições

- Um cliente de teste ativo.
- Um vendedor de teste elegível, com produto publicado e disponível.
- Um segundo cliente, um segundo vendedor e um parceiro de entrega para os
  testes de autorização.
- Uma encomenda de levantamento transicionada para `pronta_para_levantamento`.

## Casos obrigatórios

1. Chamar `obter_codigo_levantamento_cliente` antes de
   `pronta_para_levantamento`: deve falhar.
2. O cliente dono chama a RPC com a encomenda pronta: recebe exatamente um OTP
   de seis dígitos e validade de 15 minutos.
3. O segundo cliente não consegue obter o código da encomenda.
4. O vendedor, parceiro e admin não recebem OTP em claro pela RPC do cliente.
5. A tabela `codigos_levantamento` não permite `select`, `insert`, `update` ou
   `delete` direto a `authenticated`.
6. O vendedor dono apresenta o OTP correto: `validado = true`, a encomenda vai
   para `levantada`, `usado_em` é preenchido e é criado `levantamento_confirmado`.
7. O vendedor apresenta OTP errado: `validado = false`, `tentativas` aumenta e
   é criado `tentativa_levantamento_falhou`, sem código em `metadados`.
8. Repetir OTP errado até cinco vezes: a quinta resposta indica `bloqueado = true`.
9. Após bloqueio, a validação não aumenta tentativas e o cliente pode renovar
   respeitando o intervalo de 60 segundos e o máximo total de três emissões.
10. Alterar `expira_em` somente numa transação de teste para o passado: a
    validação devolve código expirado e não muda o estado da encomenda.
11. Reutilizar OTP já aceite: não volta a alterar a encomenda.
12. Vendedor errado, parceiro e cliente não conseguem validar a encomenda.
13. Duas validações corretas concorrentes para a mesma encomenda só permitem uma
    mudança para `levantada`; a segunda observa o estado já alterado.
14. `consultar_estado_codigo_levantamento_admin` só devolve estado operacional
    ao admin e nunca inclui `codigo_hash` ou OTP em claro.

## Verificação de segredo

Para a encomenda de teste, confirmar que nenhum `eventos_encomenda.metadados`
contém uma chave ou valor do OTP. Só são permitidos metadados operacionais como
validade, número de gerações, tentativas e bloqueio.

## Limpeza

Concluir todos os cenários de escrita com `ROLLBACK`. Não guardar códigos de
teste, screenshots com OTP ou credenciais no repositório.
