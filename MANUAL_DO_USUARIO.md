# Manual do Usuário — Reserva Quadra

Sistema de agendamento da quadra poliesportiva do **Complexo Júlio Prestes**.

---

## Sumário

1. [Acessando o Sistema](#1-acessando-o-sistema)
2. [Morador](#2-morador)
   - 2.1 [Como Reservar a Quadra](#21-como-reservar-a-quadra)
   - 2.2 [Minhas Reservas e Cancelamento](#22-minhas-reservas-e-cancelamento)
3. [Síndico / Subsíndico](#3-sindico--subsindico)
   - 3.1 [Painel de Gestão](#31-painel-de-gestao)
   - 3.2 [Aprovação de Cadastros](#32-aprovacao-de-cadastros)
   - 3.3 [Histórico de Reservas](#33-historico-de-reservas)
   - 3.4 [Mural de Comunicação](#34-mural-de-comunicacao)
4. [Porteiro](#4-porteiro)
   - 4.1 [Prancheta Operacional](#41-prancheta-operacional)
   - 4.2 [Controle de Chaves](#42-controle-de-chaves)
   - 4.3 [Reserva Presencial](#43-reserva-presencial)
   - 4.4 [Mural e Comunicação](#44-mural-e-comunicacao)
5. [Fluxos Rápidos](#5-fluxos-rapidos)
6. [Perguntas Frequentes](#6-perguntas-frequentes)

---

## 1. Acessando o Sistema

### URL

```
https://reserva-quadra.vercel.app
```

### Primeiro Acesso (Cadastro)

1. Acesse a URL acima
2. Clique em **"Criar Conta"**
3. Preencha seus dados:
   - Nome completo
   - E-mail
   - Senha
   - CPF e RG
   - Data de nascimento
   - Telefone
   - Torre e apartamento
   - Bloco (apenas Torre 5)
   - Foto
4. Após enviar, seu cadastro fica **"pendente"** até que um síndico da sua torre aprove
5. Quando aprovado, você recebe uma notificação e pode começar a reservar

### Login

- E-mail + senha cadastrados
- Ou "Entrar com Google" (se configurado)

---

## 2. Morador

### 2.1 Como Reservar a Quadra

#### Regras

| Regra | Detalhe |
|-------|---------|
| Horário de funcionamento | 9h às 22h |
| Duração máxima | 2 horas por reserva |
| Limite por dia | 2 horas por unidade (torre + apto) |
| Antecedência | Pode reservar para qualquer dia futuro |
| Termos de uso | Obrigatório aceitar a cada reserva |

#### Passo a Passo

1. Faça login no sistema
2. Você vê o **Quadro de Reservas** (calendário mensal)
3. Clique em um dia para ver os horários disponíveis
   - Horários em **verde** = disponíveis
   - Horários em **cinza** = já reservados
   - Horários em **vermelho** = bloqueados pela administração
4. Escolha um horário livre
5. Uma janela aparece com os **Termos de Uso** da quadra
   - Leia os termos
   - Marque a caixa "Li e concordo"
   - Clique em "Confirmar Reserva"
6. Pronto! A reserva aparece no calendário e em "Minhas Reservas"

#### Acompanhamento no Dia

No dia da sua reserva:
- O porteiro vê seu nome na prancheta
- Vá até a portaria para pegar a chave
- O porteiro registra a retirada
- Use a quadra pelo período reservado
- Devolva a chave na portaria ao terminar

### 2.2 Minhas Reservas e Cancelamento

#### Minhas Reservas

Acesse a aba **"Reservas"** no menu inferior para ver:
- **Reservas Ativas:** horários futuros que você agendou
- **Reservas Canceladas:** reservas que você cancelou

#### Cancelar uma Reserva

1. Vá em **"Reservas"** > **"Ativas"**
2. Clique em **"Cancelar"** na reserva desejada
3. Confirme o cancelamento na janela que aparece
4. A reserva é movida para "Canceladas" e o horário é liberado

> **Atenção:** O cancelamento é definitivo. Não é possível reativar uma reserva cancelada.

---

## 3. Síndico / Subsíndico

### 3.1 Painel de Gestão

Síndicos e subsíndicos têm acesso a funcionalidades administrativas no menu:
- **Reservas** — quadro geral
- **Quadro** — atalho para o calendário
- **Mensagens** — central de notificações
- **Usuários** — gestão de cadastros
- **Auditoria** (apenas Síndico Geral) — log de todas as ações
- **Histórico** — consulta de reservas passadas

### 3.2 Aprovação de Cadastros

Quando um novo morador se cadastra:
1. Uma notificação aparece no painel do síndico
2. Clique em **"Ver ficha"** para analisar os dados
3. O CPF aparece oculto — clique em "Revelar" se necessário
4. Escolha **"Aprovar"** ou **"Rejeitar"**
5. O morador recebe uma notificação com o resultado

### 3.3 Histórico de Reservas

1. Vá em **"Histórico"**
2. Use os filtros para buscar:
   - Período (data inicial e final)
   - Status (Todas / Ativa / Cancelada)
   - Nome do morador
3. Clique em qualquer reserva para expandir e ver:
   - Timeline completa (criação, retirada/devolução de chave)
   - Quem entregou/recebeu a chave
   - Ocorrência registrada na devolução
   - Motivo de cancelamento (se aplicável)

### 3.4 Mural de Comunicação

1. No painel, vá até a seção **"Mural e Comunicação"**
2. Escolha o destinatário:
   - **"Todos os Moradores"** — mensagem para todo o condomínio
   - **"Morador Específico"** — mensagem privada
3. Digite o conteúdo da mensagem
4. Clique em **"Disparar"**
5. A mensagem aparece na central de notificações dos destinatários

---

## 4. Porteiro

### 4.1 Prancheta Operacional

#### Visão Geral

A **Prancheta Operacional** é a tela principal do porteiro. Ela mostra:
- Todas as reservas do dia atual
- Status da chave de cada reserva
- Botões de ação para gerenciar as chaves
- Botões para criar reservas presenciais
- Seção de Cadastros Pendentes
- Mural de Comunicação

#### Bloqueios do Dia

Se a administração bloqueou algum horário (ex: manutenção), ele aparece destacado no topo da prancheta em amarelo.

### 4.2 Controle de Chaves

#### Ciclo da Chave

Cada reserva passa por três estados:

```
AGUARDANDO  →  EM USO  →  CONCLUÍDA
  (criada)     (chave    (chave
                retirada)  devolvida)
```

#### Entregar Chave

1. Na prancheta, localize o card do morador com status **"AGUARDANDO"**
2. Clique em **"Entregar Chave"**
3. Pronto! O status muda para **"EM USO"**
4. O morador recebe uma notificação: "Sua chave foi retirada na portaria"

#### Receber Chave (Devolução)

1. Localize o card com status **"EM USO"**
2. Clique em **"Receber Chave"**
3. Uma janela aparece — opcionalmente, digite uma **ocorrência**:
   - Ex: "Chave devolvida com 15 min de atraso"
   - Ex: "Chave devolvida em perfeito estado"
4. Clique em **"Confirmar Devolução"**
5. O status muda para **"CONCLUÍDA"** e o card exibe "Turno Concluído"

#### Timeline

Clique em **"Timeline"** em qualquer card para ver o histórico de eventos daquela reserva:
- Data/hora da criação
- Data/hora da retirada da chave + nome do porteiro
- Data/hora da devolução da chave + nome do porteiro + ocorrência (se houver)

### 4.3 Reserva Presencial

Quando um morador sem cadastro (ou que não consegue acessar o app) quer usar a quadra:

1. Na prancheta, clique em **"Nova Reserva Presencial"**
2. Preencha:
   - **Nome do morador** — ex: "João Silva — Torre 2, Apto 304"
   - **Telefone** — formato (XX) XXXXX-XXXX
   - **Horário** — selecione um horário livre
3. Clique em **"Confirmar Reserva"**
4. A reserva aparece na prancheta com a tag **"Presencial"** e o telefone visível

> A reserva presencial é vinculada ao porteiro para fins de auditoria, mas exibe o nome digitado na lista do dia e no histórico.

### 4.4 Mural e Comunicação

Porteiros podem enviar notificações:
- **"Todos os Moradores"** — comunicado geral
- **"Morador Específico"** — mensagem privada

1. Na seção "Mural e Comunicação", selecione o destinatário
2. Digite a mensagem
3. Clique em **"Disparar"**

---

## 5. Fluxos Rápidos

### Fluxo Completo — Reserva Online (Morador)

```
1. Login
2. Escolhe dia no calendário
3. Seleciona horário livre
4. Aceita termos
5. Reserva confirmada ✓

No dia:
6. Vá à portaria
7. Porteiro entrega a chave
8. Use a quadra
9. Devolva a chave
10. Porteiro registra devolução
```

### Fluxo Completo — Reserva Presencial

```
1. Morador vai à portaria
2. Porteiro cria reserva presencial
3. Porteiro entrega a chave
4. Morador usa a quadra
5. Morador devolve a chave
6. Porteiro registra devolução
```

### Fluxo de Cadastro

```
1. Morador se cadastra no site
2. Status: "pendente"
3. Síndico aprova
4. Morador recebe notificação
5. Status: "ativo"
6. Morador já pode reservar
```

---

## 6. Perguntas Frequentes

### Posso reservar mais de 2 horas seguidas?

Não. O limite é de 2 horas por dia por unidade.

### Esqueci de devolver a chave. O que acontece?

O porteiro registra a ocorrência na devolução. Casos recorrentes podem gerar notificação da administração.

### Alguém reservou meu horário favorito. O que fazer?

O sistema segue a ordem de chegada (first come, first served). Tente reservar com mais antecedência.

### Meu cadastro está como "pendente". Quanto tempo leva?

Assim que um síndico ou subsíndico da sua torre revisar seu cadastro. Se passar muito tempo, fale com o síndico do seu prédio.

### Posso cancelar e outra pessoa pegar o horário?

Sim. Ao cancelar, o horário é liberado imediatamente e qualquer morador pode reservá-lo.

### O que significa "Presencial" na prancheta?

Significa que a reserva foi feita na portaria pelo porteiro, em nome de um morador que estava presente mas não tem cadastro no sistema (ou não conseguiu acessar o app).

### Como vejo o histórico de uso da quadra?

Síndicos e subsíndicos têm acesso à página de **Histórico**, que permite filtrar por período, status e morador.

---

Documento gerado em 27/06/2026.
