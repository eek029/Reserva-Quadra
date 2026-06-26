# Manual do Usuario — Reserva Quadra

Sistema de agendamento da quadra poliesportiva do **Complexo Julio Prestes**.

---

## Sumario

1. [Acessando o Sistema](#1-acessando-o-sistema)
2. [Morador — Como Reservar a Quadra](#2-morador--como-reservar-a-quadra)
3. [Morador — Minhas Reservas e Cancelamento](#3-morador--minhas-reservas-e-cancelamento)
4. [Sindico / Subsindico — Painel de Gestao](#4-sindico--subsindico--painel-de-gestao)
5. [Porteiro — Prancheta Operacional](#5-porteiro--prancheta-operacional)
6. [Porteiro — Controle de Chaves](#6-porteiro--controle-de-chaves)
7. [Porteiro — Reserva Presencial](#7-porteiro--reserva-presencial)
8. [Porteiro — Mural e Comunicacao](#8-porteiro--mural-e-comunicacao)
9. [Fluxos Rapidados](#9-fluxos-rapidos)
10. [Perguntas Frequentes](#10-perguntas-frequentes)

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
   - Foto (opcional)
4. Apos enviar, seu cadastro fica **"pendente"** ate que um sindico da sua torre aprove
5. Quando aprovado, voce recebe uma notificacao e pode comecar a reservar

### Login

- E-mail + senha cadastrados
- Ou "Entrar com Google" (se configurado)

---

## 2. Morador — Como Reservar a Quadra

### Regras

| Regra | Detalhe |
|-------|---------|
| Horario de funcionamento | 9h as 22h |
| Duracao maxima | 2 horas por reserva |
| Limite por dia | 2 horas por unidade (torre + apto) |
| Antecedencia | Pode reservar para qualquer dia futuro |
| Termos de uso | Obrigatorio aceitar a cada reserva |

### Passo a Passo

1. Faca login no sistema
2. Voce ve o **Quadro de Reservas** (calendario mensal)
3. Clique em um dia para ver os horarios disponiveis
   - Horarios em **verde** = disponiveis
   - Horarios em **cinza** = ja reservados
   - Horarios em **vermelho** = bloqueados pela administracao
4. Escolha um horario livre
5. Uma janela aparece com os **Termos de Uso** da quadra
   - Leia os termos
   - Marque a caixa "Li e concordo"
   - Clique em "Confirmar Reserva"
6. Pronto! A reserva aparece no calendario e em "Minhas Reservas"

### Acompanhamento no Dia

No dia da sua reserva:
- O porteiro ve seu nome na prancheta
- Va ate a portaria para pegar a chave
- O porteiro registra a retirada
- Use a quadra pelo periodo reservado
- Devolva a chave na portaria ao terminar

---

## 3. Morador — Minhas Reservas e Cancelamento

### Minhas Reservas

Acesse a aba **"Reservas"** no menu inferior para ver:
- **Reservas Ativas:** horarios futuros que voce agendou
- **Reservas Canceladas:** reservas que voce cancelou

### Cancelar uma Reserva

1. Va em **"Reservas"** > **"Ativas"**
2. Clique em **"Cancelar"** na reserva desejada
3. Confirme o cancelamento na janela que aparece
4. A reserva e movida para "Canceladas" e o horario e liberado

> **Atencao:** Cancelamento e definitivo. Nao e possivel reativar uma reserva cancelada.

---

## 4. Sindico / Subsindico — Painel de Gestao

Sindicos e subsindicos tem acesso a funcionalidades administrativas no menu:
- **Reservas** — quadro geral
- **Quadro** — atalho para o calendario
- **Mensagens** — central de notificacoes
- **Usuarios** — gestao de cadastros
- **Auditoria** (apenas Sindico Geral) — log de todas as acoes
- **Historico** — consulta de reservas passadas

### Aprovacao de Cadastros

Quando um novo morador se cadastra:
1. Uma notificacao aparece no painel do sindico
2. Clique em **"Ver ficha"** para analisar os dados
3. O CPF aparece oculto — clique em "Revelar" se necessario
4. Escolha **"Aprovar"** ou **"Rejeitar"**
5. O morador recebe uma notificacao com o resultado

### Historico de Reservas

1. Va em **"Historico"**
2. Use os filtros para buscar:
   - Periodo (data inicial e final)
   - Status (Todas / Ativa / Cancelada)
   - Nome do morador
3. Clique em qualquer reserva para expandir e ver:
   - Timeline completa (criacao, retirada/devolucao de chave)
   - Quem entregou/recebeu a chave
   - Ocorrencia registrada na devolucao
   - Motivo de cancelamento (se aplicavel)

### Mural de Comunicacao (Broadcast)

1. No painel, va ate a secao **"Mural e Comunicacao"**
2. Escolha o destinatario:
   - **"Todos os Moradores"** — mensagem para todo o condominio
   - **"Morador Especifico"** — mensagem privada
3. Digite o conteudo da mensagem
4. Clique em **"Disparar"**
5. A mensagem aparece na central de notificacoes dos destinatarios

---

## 5. Porteiro — Prancheta Operacional

### Visao Geral

A **Prancheta Operacional** e a tela principal do porteiro. Ela mostra:
- Todas as reservas do dia atual
- Status da chave de cada reserva
- Botoes de acao para gerenciar as chaves
- Botoes para criar reservas presenciais
- Secao de Cadastros Pendentes
- Mural de Comunicacao

### Bloqueios do Dia

Se a administracao bloqueou algum horario (ex: manutencao), ele aparece destacado no topo da prancheta em amarelo.

---

## 6. Porteiro — Controle de Chaves

### Ciclo da Chave

Cada reserva passa por tres estados:

```
AGUARDANDO  →  EM USO  →  CONCLUIDA
  (criada)     (chave    (chave
                retirada)  devolvida)
```

### Entregar Chave

1. Na prancheta, localize o card do morador com status **"AGUARDANDO"**
2. Clique em **"Entregar Chave"**
3. Pronto! O status muda para **"EM USO"**
4. O morador recebe uma notificacao: "Sua chave foi retirada na portaria"

### Receber Chave (Devolucao)

1. Localize o card com status **"EM USO"**
2. Clique em **"Receber Chave"**
3. Uma janela aparece — opcionalmente, digite uma **ocorrencia**:
   - Ex: "Chave devolvida com 15 min de atraso"
   - Ex: "Chave devolvida em perfeito estado"
4. Clique em **"Confirmar Devolucao"**
5. O status muda para **"CONCLUIDA"** e o card exibe "Turno Concluido"

### Timeline

Clique em **"Timeline"** em qualquer card para ver o historico de eventos daquela reserva:
- Data/hora da criacao
- Data/hora da retirada da chave + nome do porteiro
- Data/hora da devolucao da chave + nome do porteiro + ocorrencia (se houver)

---

## 7. Porteiro — Reserva Presencial

Quando um morador sem cadastro (ou que nao consegue acessar o app) quer usar a quadra:

1. Na prancheta, clique em **"Nova Reserva Presencial"**
2. Preencha:
   - **Nome do morador** — ex: "Joao Silva — Torre 2, Apto 304"
   - **Telefone** — formato (XX) XXXXX-XXXX
   - **Horario** — selecione um horario livre
3. Clique em **"Confirmar Reserva"**
4. A reserva aparece na prancheta com a tag **"Presencial"** e o telefone visivel

> A reserva presencial e vinculada ao porteiro para fins de auditoria, mas exibe o nome digitado na lista do dia e no historico.

---

## 8. Porteiro — Mural e Comunicacao

Porteiros podem enviar notificacoes:
- **"Todos os Moradores"** — comunicado geral
- **"Morador Especifico"** — mensagem privada

1. Na secao "Mural e Comunicacao", selecione o destinatario
2. Digite a mensagem
3. Clique em **"Disparar"**

---

## 9. Fluxos Rapidos

### Fluxo Completo — Reserva Online (Morador)

```
1. Login
2. Escolhe dia no calendario
3. Seleciona horario livre
4. Aceita termos
5. Reserva confirmada ✓

No dia:
6. Va a portaria
7. Porteiro entrega a chave
8. Use a quadra
9. Devolva a chave
10. Porteiro registra devolucao
```

### Fluxo Completo — Reserva Presencial

```
1. Morador vai a portaria
2. Porteiro cria reserva presencial
3. Porteiro entrega a chave
4. Morador usa a quadra
5. Morador devolve a chave
6. Porteiro registra devolucao
```

### Fluxo de Cadastro

```
1. Morador se cadastra no site
2. Status: "pendente"
3. Sindico aprova
4. Morador recebe notificacao
5. Status: "ativo"
6. Morador ja pode reservar
```

---

## 10. Perguntas Frequentes

### Posso reservar mais de 2 horas seguidas?

Nao. O limite e de 2 horas por dia por unidade.

### Esqueci de devolver a chave. O que acontece?

O porteiro registra a ocorrencia na devolucao. Casos recorrentes podem gerar notificacao da administracao.

### Alguem reservou meu horario favorito. O que fazer?

O sistema segue a ordem de chegada (first come, first served). Tente reservar com mais antecedencia.

### Meu cadastro esta como "pendente". Quanto tempo leva?

Assim que um sindico ou subsindico da sua torre revisar seu cadastro. Se passar muito tempo, fale com o sindico do seu predio.

### Posso cancelar e outra pessoa pegar o horario?

Sim. Ao cancelar, o horario e liberado imediatamente e qualquer morador pode reserva-lo.

### O que significa "Presencial" na prancheta?

Significa que a reserva foi feita na portaria pelo porteiro, em nome de um morador que estava presente mas nao tem cadastro no sistema (ou nao conseguiu acessar o app).

### Como vejo o historico de uso da quadra?

Sindicos e subsindicos tem acesso a pagina de **Historico**, que permite filtrar por periodo, status e morador.

---

Documento gerado em 26/06/2026.
