# Plano de comércio, serviços e logística

Este documento é a referência de produto e arquitetura para evoluir a ANGROLINK sem quebrar os fluxos atuais de contas, produtos, serviços, aprovações e Supabase.

## Objetivo

Permitir que o cliente escolha entre levantar uma compra no local ou recebê-la por entrega, ligando produtos, vendedores e parceiros logísticos num único pedido.

O lançamento deve ser progressivo, adequado a Angola e acessível a pessoas com conectividade, endereços e métodos de pagamento diferentes.

## Princípios que não devem mudar

- Produtos e serviços já publicados continuam a funcionar durante toda a transição.
- Aprovação, suspensão, rejeição, planos e RLS continuam a ser garantidos no Supabase.
- Dados e fotografias de documentos são privados e só podem ser analisados por administradores autorizados.
- A entrega é opcional. O cliente escolhe sempre entre levantamento e entrega.
- Não haverá transporte de passageiros. A logística da plataforma destina-se exclusivamente a mercadorias.
- A primeira versão logística opera com um único vendedor por pedido.

## Linguagem do produto

| Conceito | Definição |
| --- | --- |
| Cliente | Utilizador que consulta, compra, levanta ou recebe pedidos. |
| Perfil profissional | Conta que opera comercialmente na plataforma; o nome técnico atual `vendedores` pode ser mantido temporariamente na base de dados. |
| Comerciante | Perfil profissional com capacidade de publicar produtos. |
| Prestador de serviços | Perfil profissional com capacidade de publicar serviços. |
| Parceiro de entrega | Perfil profissional aprovado para recolher e entregar mercadorias. Não é vendedor de produtos. |
| Transportador parceiro | Parceiro de entrega com veículo/capacidade para carga média, pesada ou volumosa. |

O termo apresentado ao utilizador deve ser **perfil profissional**, mesmo antes de uma futura alteração técnica do nome da tabela `vendedores`.

## Taxonomia futura

### Tipos de perfil/negócio

Estes tipos descrevem a natureza comercial do perfil, não o serviço que ele presta:

- Vendedor ambulante
- Quitandeira / banca informal
- Produtor agrícola ou pecuário
- Revendedor / banca de mercado
- Mercearia / mini mercado
- Supermercado / grande retalho
- Grossista / distribuidor

`prestador_servico` deixa de ser uma opção de novos cadastros. Mantém-se apenas como valor legado para contas existentes, até haver uma migração específica e aprovada para esses perfis.

### Serviços prestados

Os serviços descrevem atividades que um perfil pode anunciar. Uma conta pode selecionar mais do que um:

- Entregas de mercadorias
- Transporte de mercadorias
- Reparação e manutenção
- Limpeza
- Moagem
- Aluguer de equipamento
- Mão de obra agrícola
- Consultoria
- Outros serviços locais

### Limite da primeira fase — decisão aprovada

Na primeira fase não será aberto um marketplace geral de prestação de serviços. O único serviço disponível para novos prestadores será **Entrega de mercadorias**, apresentado como **Parceiro de Entregas ANGROLINK**.

- Não haverá transporte de passageiros.
- Não haverá, nesta fase, reparação, limpeza, consultoria, moagem ou outros serviços anunciáveis.
- O piloto aceita parceiros com mota, carro e transporte de carga pesada por carrinha/camião. Cada categoria tem limites de carga, documentos e regras de atribuição próprios.
- O parceiro de entregas não é vendedor de produtos; é um perfil profissional com capacidade logística.

### Perfis de entrada no piloto

O cadastro inicial mantém três caminhos claros:

1. **Cliente/comprador**: consulta, compra, escolhe levantamento ou entrega e acompanha pedidos.
2. **Comerciante/vendedor de produtos**: publica produtos, confirma stock e prepara pedidos.
3. **Parceiro de Entregas ANGROLINK**: usa mota, carro, carrinha ou camião para recolher e entregar mercadorias atribuídas pela plataforma.

Os parceiros devem declarar o tipo de veículo no cadastro. Os limites de peso/volume e as regras de compatibilidade de carga serão definidos antes da abertura do piloto.

| Categoria de parceiro | Veículos | Utilização inicial |
| --- | --- | --- |
| Entregador ligeiro | Mota | Pequenas encomendas, documentos, sacos leves e caixas pequenas. |
| Entregador standard | Carro | Compras médias, caixas e mercadoria que não exige veículo de carga. |
| Transportador de carga | Carrinha ou camião | Sacos, grandes quantidades, paletes e carga pesada/volumosa. |

## Cadastro do Parceiro de Entregas — especificação proposta

> Estado: matriz aprovada. A fundação de dados será criada antes do formulário, separada do cadastro de comerciante e do cadastro de cliente.

### Estrutura do fluxo

1. **Conta e identidade**: dados do responsável e contacto.
2. **Veículo e capacidade**: categoria, dados do veículo, zonas e disponibilidade.
3. **Documentos**: frente e verso dos documentos aplicáveis, com validade quando existir.
4. **Revisão**: resumo, declaração de veracidade, aceitação dos termos de parceiro e envio para análise.

### Campos comuns obrigatórios

| Grupo | Campos |
| --- | --- |
| Identidade | Nome completo, BI/passaporte, telefone/WhatsApp confirmado, província, município e bairro/zona base. |
| Perfil operacional | Fotografia de perfil, contacto de emergência, disponibilidade inicial e aceitação dos termos de parceiro. |
| Veículo | Categoria, marca, modelo, cor, matrícula, ano, foto do veículo e capacidade de carga declarada. |
| Área de serviço | Províncias/municípios onde aceita recolhas e entregas, e raio/zona de operação inicial. |

Email, endereço detalhado, experiência profissional, referências e fotografia adicional do veículo são opcionais no cadastro, mas podem ser pedidos pelo administrador numa revisão.

### Campos por categoria

| Categoria | Campos obrigatórios adicionais | Campos opcionais/recomendados |
| --- | --- | --- |
| Entregador ligeiro — mota | Possui caixa/mochila de carga, capacidade declarada em kg, tipo de carga aceite | Dimensões da caixa, foto da caixa/mochila e capa impermeável |
| Entregador standard — carro | Tipo de carroçaria, espaço de bagageira/carga e capacidade declarada em kg | Dimensões úteis, bancos rebatíveis e foto da bagageira |
| Transportador de carga — carrinha/camião | Tipo de carroçaria, capacidade declarada em kg, volume/dimensões úteis, paletes aceites e número de ajudantes disponíveis | Plataforma elevatória, refrigeração, lona/caixa fechada, rotas interprovinciais e base operacional |

O sistema deve guardar capacidade numérica e unidade, mas os limites efetivos não devem ser gravados no código. O administrador define e ajusta limites por categoria antes e durante o piloto.

### Documentos obrigatórios para ativar entregas

| Documento | Mota | Carro | Carrinha/camião |
| --- | ---: | ---: | ---: |
| BI/passaporte do responsável, frente e verso | Sim | Sim | Sim |
| Carta de condução compatível, frente e verso e validade | Sim | Sim | Sim |
| Título/livrete ou documento equivalente do veículo, frente e verso | Sim | Sim | Sim |
| Seguro de responsabilidade civil, frente e verso e validade | Sim | Sim | Sim |
| Inspeção técnica do veículo, quando legalmente aplicável, frente e verso e validade | Validar antes do piloto | Sim | Sim |
| Licença/autorização aplicável ao transporte rodoviário de mercadorias | Validar antes do piloto | Sim | Sim |
| NIF do operador | Opcional no arranque; obrigatório antes de repasses digitais | Opcional no arranque; obrigatório antes de repasses digitais | Sim |
| Certidão comercial e licença empresarial | Não | Não, salvo empresa | Sim quando o operador for empresa |

O administrador deve poder marcar cada documento como `pendente`, `aprovado`, `rejeitado` ou `expirado`, registando motivo e data de expiração. Um parceiro com documento obrigatório expirado perde automaticamente a disponibilidade para receber novas tarefas, mas mantém acesso ao histórico e ao perfil.

### Regras de mercadoria no piloto

São aceites apenas mercadorias lícitas, embaladas e compatíveis com a capacidade/veículo do parceiro.

Ficam fora do piloto, até existir política específica e validação operacional:

- pessoas e transporte de passageiros;
- dinheiro, joias, armas e artigos de elevado risco;
- produtos perigosos, inflamáveis, gases e químicos sem autorização específica;
- medicamentos controlados;
- animais vivos;
- mercadoria sem embalagem segura ou com peso/volume acima da capacidade aprovada.

### Estados do parceiro

```text
Rascunho → Documentos pendentes → Em análise → Aprovado → Disponível
                                         ↘ Rejeitado
Disponível → Indisponível (manual) | Suspenso | Documentação expirada
```

Somente parceiros `aprovados`, `disponíveis` e com documentos válidos entram na distribuição automática de entregas.

`taxista` e `moto_taxista` são valores legados de `tipo_vendedor`. Não devem ser usados em novos registos. Quando a migração for aprovada, serão convertidos para `prestador_servico` e a atividade será preservada como informação histórica/serviço declarado. Não inferir automaticamente um novo serviço publicado para uma conta antiga.

### Capacidades do perfil profissional

No futuro, a classificação deve permitir capacidades independentes:

- `venda_produtos`
- `prestacao_servicos`
- `entregas_mercadorias`

Isto permite, por exemplo, que um produtor venda produtos e realize entregas próprias, sem transformar um entregador num vendedor.

## Documentos e verificação

Os documentos devem ser exigidos pelo risco/atividade e não apenas pelo tipo de perfil.

| Atividade | Verificação mínima proposta |
| --- | --- |
| Comércio ou serviços gerais | BI e dados do responsável, conforme a política atual. |
| Entregas em mota | BI, carta adequada, livrete/registo do veículo, fotografia frente e verso e dados da mota. |
| Transporte em carro/carrinha/camião | BI, carta adequada, livrete/registo, seguro válido, fotografias frente e verso e capacidade do veículo. |

Os documentos existentes mantêm-se guardados em `vendedores.documentos` durante a transição. A futura estrutura deve separar documentos pessoais, documentos do veículo e estado da revisão, mas sem tornar informação sensível pública.

## Matriz proposta para cadastro de perfis profissionais

> Estado: proposta para aprovação. Não alterar formulários ou regras de aprovação antes de validar esta matriz.

### Dados comuns a todos os perfis

| Campo | Regra |
| --- | --- |
| Nome do responsável | Obrigatório |
| Telefone/WhatsApp validado | Obrigatório |
| Palavra-passe e aceitação de termos | Obrigatório |
| Província e município de atividade | Obrigatório |
| Nome comercial/profissional | Obrigatório |
| Descrição curta | Obrigatório |
| Fotografia de perfil ou logótipo | Opcional no cadastro; recomendada para aprovação/verificação |
| Email, bairro, endereço detalhado e horário | Opcionais; podem ser completados depois |

### Comércio e produção

| Tipo de perfil | Dados obrigatórios adicionais | Documentos obrigatórios da plataforma | Opcionais/recomendados |
| --- | --- | --- | --- |
| Ambulante / quitandeira | Tipo de mercadoria e zona habitual | BI, frente e verso | NIF, cartão de vendedor ambulante |
| Produtor agrícola/pecuário | Tipo de produção, culturas/criação e zona de produção | BI, frente e verso | Título/declaração de uso da terra, capacidade/produção mensal |
| Revendedor / banca de mercado | Mercado/bairro e principais produtos | BI, frente e verso | Comprovativo da banca, NIF |
| Mercearia / mini mercado | Bairro/endereço e principais categorias | BI, frente e verso | NIF, alvará, horário, entrega própria |
| Supermercado / hipermercado / grossista | NIF, endereço operacional e responsável | BI do responsável, NIF, certidão comercial e alvará, frente e verso quando aplicável | Catálogo/volume, entrega interprovincial, documentos de armazém |

### Decisões aprovadas: mini mercados e revendedores

#### Mini mercado — verificação formal obrigatória

Um perfil classificado como mini mercado só pode receber aprovação verificada após apresentar:

- BI/passaporte do responsável, frente e verso;
- NIF do negócio ou comerciante em nome individual;
- certidão comercial ou comprovativo de registo;
- alvará/licença comercial quando aplicável;
- fotografia da fachada/local;
- telefone e localização confirmados.

O destino de repasse bancário/digital será exigido e validado antes de pagamentos online ou repasses elevados. Não deve bloquear o cadastro enquanto estes recursos ainda não estiverem ativos.

#### Revendedor — aprovação progressiva

| Nível | Requisitos | Capacidades propostas |
| --- | --- | --- |
| Básico | BI/passaporte frente e verso, selfie/validação de identidade, telefone, nome, zona e fotografia da mercadoria/local | Catálogo reduzido, limites de valor/volume, levantamento ou pagamento na entrega, sem selo empresarial e monitorização inicial reforçada. |
| Formal/verificado | NIF, BI do responsável, registo de comerciante/empresa, licença quando aplicável, local de atividade e destino de repasse validado quando ativo | Limites comerciais superiores, selo de perfil verificado e acesso progressivo a pagamentos/repasses digitais. |

### Prestador de serviços

| Caso | Dados obrigatórios adicionais | Documentos obrigatórios da plataforma | Opcionais/recomendados |
| --- | --- | --- | --- |
| Serviço geral (limpeza, reparação, moagem, consultoria, mão de obra) | Serviços prestados, zona, descrição e preço indicativo | BI, frente e verso | Certificados profissionais, portefólio, horário e foto de trabalhos |
| Entrega de mercadorias anunciada como serviço | Zona, tipo de veículo, limite de carga, disponibilidade e preço indicativo | BI; restantes documentos só quando aderir como parceiro de entrega | Foto do veículo e zonas adicionais |
| Parceiro de entrega ANGROLINK | Veículo, matrícula, capacidade, zonas, disponibilidade, contacto de emergência e dados de pagamento futuros | BI, carta adequada, título/livrete, seguro, inspeção e licença aplicável; frente e verso de cada documento | Foto do veículo, experiência, referências e certificações |
| Transportador parceiro ANGROLINK | Tudo o que é exigido ao parceiro de entrega, mais tipo de carga e capacidade em peso/volume | Os documentos do parceiro e do veículo; para empresa, NIF, certidão comercial e licença aplicável | Rotas, armazém/base operacional e equipa/motoristas adicionais |

### Regras de aprovação propostas

- Perfis informais podem criar conta e completar perfil com BI; ficam em análise até decisão administrativa.
- Documentos comerciais ausentes não devem impedir automaticamente ambulantes, produtores e pequenos negócios informais de se candidatarem, mas devem reduzir o nível de verificação apresentado publicamente.
- Perfis empresariais que se apresentam como supermercado, hipermercado ou grossista só podem ser aprovados como verificados após NIF, certidão comercial e alvará.
- A capacidade de realizar entregas pela ANGROLINK só é ativada após validação completa dos documentos do condutor, veículo e atividade aplicável.
- Documentos opcionais não bloqueiam o cadastro nem a publicação fora de atividades reguladas.

### Seleção de serviços no cadastro — decisão aprovada

O prestador de serviços escolhe, no cadastro, uma ou mais atividades que pretende prestar. A seleção serve para configurar o perfil, apresentar campos operacionais relevantes e determinar requisitos documentais.

- Cada anúncio de serviço deve pertencer a uma atividade previamente declarada pelo prestador.
- Serviços gerais podem ser publicados após a aprovação normal do perfil.
- A seleção de entrega ou transporte de mercadorias inicia a verificação logística; a atividade fica marcada como `em análise` até os documentos específicos serem validados.
- Um prestador pode manter outras atividades gerais ativas enquanto a atividade logística estiver em análise, desde que a política de aprovação o permita.

## Compra, levantamento e entrega

### Opções no checkout

O checkout apresenta duas opções claras:

1. **Levantar no local**: o vendedor prepara e o cliente recolhe.
2. **Receber por entrega**: a ANGROLINK procura um parceiro elegível depois da confirmação do vendedor.

Para ambas as opções, o cliente deve informar telefone e um contacto de referência. Para entrega, deve indicar também província, município, bairro, ponto de referência, horário preferido e, quando possível, pin no mapa.

### Estados do pedido

Fluxo de levantamento:

```text
Aguardando confirmação → Em preparação → Pronto para levantamento → Levantado → Concluído
```

Fluxo de entrega:

```text
Aguardando confirmação → Em preparação → À procura de parceiro
→ Parceiro atribuído → Recolhido → Em entrega → Entregue → Concluído
```

Estados de exceção: cancelado, recusado pelo vendedor, parceiro não encontrado, falha de recolha, falha de entrega e disputa.

### Códigos de segurança

- Código de recolha: o vendedor entrega a mercadoria ao parceiro apenas após validar o código.
- Código de entrega: o parceiro conclui apenas após validação pelo cliente.
- Prova complementar: foto da embalagem selada na recolha e, quando necessário, foto/assinatura na entrega.

## Distribuição automática de entregas

Uma tarefa de entrega só é enviada a parceiros que cumpram todos os critérios obrigatórios:

- conta ativa, aprovada e com documentos válidos;
- disponibilidade ligada;
- zona de recolha e entrega coberta;
- veículo compatível com peso, volume e tipo de carga;
- capacidade disponível;
- sem outra tarefa incompatível em curso.

Ordem recomendada de priorização: compatibilidade da carga, zona, proximidade à recolha, taxa de aceitação, entregas concluídas e avaliação. A primeira versão pode enviar a oferta por grupos e atribuir ao primeiro parceiro que aceitar; a atribuição deve ser atómica no servidor para impedir que dois parceiros recebam a mesma entrega.

## Realidade operacional em Angola

| Situação | Resposta no produto |
| --- | --- |
| Moradas incompletas | Bairro e ponto de referência obrigatórios; mapa e coordenadas opcionais. |
| Internet, energia ou GPS instáveis | Interface leve, estados persistidos, atualização manual, SMS/WhatsApp como apoio operacional. |
| Diferentes hábitos de pagamento | Dinheiro na entrega/levantamento inicialmente; pagamentos digitais entram por etapas. |
| Falta de confiança | Perfis verificados, códigos de entrega, histórico, avaliações e processos de disputa. |
| Stock desatualizado | Nenhum parceiro é chamado antes da confirmação e preparação pelo vendedor. |
| Mercadorias heterogéneas | Peso, volume e categoria de carga declarados pelo vendedor; limite de capacidade por veículo. |

O produto deve começar numa área geográfica pequena e operacionalmente acompanhada, antes de expandir para outras zonas ou províncias.

## Pagamentos e receitas

### Ordem de adoção de pagamentos

1. Dinheiro no levantamento ou na entrega, com confirmação por código.
2. Referência/transferência e Multicaixa Express, depois de definida a reconciliação financeira.
3. Pagamento integrado, carteira do parceiro e liquidação automática, apenas com parceiro de pagamentos e validação operacional/jurídica.

### Modelo de preço da entrega

```text
taxa de entrega = preço base da zona + distância/faixa + suplemento de peso ou volume
```

O preço deve ser apresentado antes da confirmação do pedido. A taxa é dividida entre ganho do parceiro e comissão explícita da ANGROLINK.

Receitas complementares: comissão por entrega concluída, planos profissionais, destaques de produtos/serviços e soluções logísticas para comerciantes/grossistas. Não cobrar comissão sobre o valor do produto na primeira fase.

## Fases de implementação

### Fase 0 — decisão e desenho

- Aprovar esta taxonomia e a linguagem do produto.
- Definir a primeira cidade/zona, limites de peso e tipos de veículos.
- Definir a política de cancelamento, disputas, dinheiro e comissão.
- Desenhar protótipos antes de alterar tabelas ou fluxos de autenticação.

### Fase 1 — pedidos com levantamento

- Carrinho limitado a um vendedor.
- Endereço/ponto de referência e contacto do cliente.
- Criação de pedido, confirmação de stock, preparação e código de levantamento.
- Painéis básicos para cliente, vendedor e administrador.

### Fase 2 — entrega assistida

- Registo e verificação de parceiros de entrega.
- Veículo, capacidade, áreas de atuação e disponibilidade.
- Taxa por zona e pedido enviado a parceiros elegíveis.
- Atribuição manual/assistida pelo administrador quando necessário.

### Fase 3 — distribuição automática

- Matching no servidor e bloqueio atómico da atribuição.
- Painel do parceiro com aceitar/recusar, recolher e entregar.
- Códigos, histórico de eventos, incidências e avaliações.

### Fase 4 — logística avançada

- Estimativa de preço por distância/carga.
- Localização partilhada durante entregas ativas, com consentimento.
- Pagamentos integrados, carteira e liquidação do parceiro.
- Rotas, lotes de entrega e métricas operacionais.

## Proteções técnicas obrigatórias

- Criar novas tabelas e políticas RLS de forma aditiva; não alterar ou apagar estruturas atuais sem migração e cópia de segurança.
- Toda a criação, transição de estado, preço e atribuição de entrega deve ser validada por função/RPC no Supabase, e não apenas pelo cliente React.
- Guardar um histórico imutável de eventos do pedido e da entrega.
- Usar transações/bloqueios para atribuir uma entrega a apenas um parceiro.
- Guardar valores monetários em Kwanza com precisão decimal e apresentar todos os preços claramente.
- Nunca expor URLs ou números de documentos em cartões, perfis públicos ou APIs públicas.

## Métricas para decidir expansão

- pedidos confirmados por dia;
- percentagem de pedidos entregues/levantados;
- tempo até confirmação do vendedor;
- tempo até aceitação por parceiro;
- taxa de cancelamento e motivo;
- taxa de falha de entrega;
- ganho médio do parceiro, comissão da plataforma e margem por entrega;
- repetição de compra e avaliação de cliente/vendedor/parceiro.

## Decisões pendentes

- Zona exata do piloto e horários de operação.
- Limites de peso/volume para mota, carro, carrinha e camião.
- Quem assume a cobrança de dinheiro na entrega e como será feita a reconciliação.
- Regra de cancelamento e responsabilidade por mercadoria danificada/perdida.
- Taxa base, comissão da plataforma e eventuais subsídios promocionais.
- Critérios de aceitação e suspensão de parceiros de entrega.
- Parceiro de pagamento e revisão jurídica antes de pagamentos integrados.

## Referências de contexto

- Censo 2024 do INE: usar como referência para diferenças de infraestrutura entre províncias e para a necessidade de operação resiliente a energia/conectividade.
- EMIS/Multicaixa Express: referência para futuras fases de pagamentos por referência, TPA e pagamentos móveis.
- Banco Nacional de Angola e parceiros de pagamento: validar requisitos atuais antes de qualquer integração financeira.
