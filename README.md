# Reserva Quadra

Sistema de agendamento online para a quadra poliesportiva do **Complexo Julio Prestes**, um condominio residencial com 5 torres. O sistema substitui o controle em papel, eliminando conflitos de horario e registrando toda a operacao da quadra: reservas, entrega de chave, ocorrencias e auditoria.

## Indice

- [Problema e Solucao](#problema-e-solucao)
- [Funcionalidades](#funcionalidades)
- [Papeis e Permissoes](#papeis-e-permissoes)
- [Fluxos Principais](#fluxos-principais)
- [Stack Tecnologica](#stack-tecnologica)
- [Arquitetura](#arquitetura)
- [Banco de Dados](#banco-de-dados)
- [API](#api)
- [Seguranca](#seguranca)
- [Variaveis de Ambiente](#variaveis-de-ambiente)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Estrutura do Projeto](#estrutura-do-projeto)

---

## Problema e Solucao

**Problema:** Moradores agendavam a quadra em uma folha de papel na portaria. Isso gerava conflitos de horario (duas reservas para o mesmo horario em folhas diferentes), perda de informacao e impossibilidade de auditagem.

**Solucao:** Sistema web onde moradores fazem reservas online, porteiros gerenciam a agenda e a chave fisica, e a administracao tem visibilidade completa do historico. Toda operacao fica registrada com data, responsavel e detalhes.

---

## Funcionalidades

### Calendario de Reservas

O dashboard do morador exibe um calendario mensal com os horarios disponiveis e ocupados. Cada reserva tem no maximo 2 horas de duracao, e cada unidade (torre + apartamento) tem limite de 2 horas por dia.

- Visualizacao dia a dia com slots de 30 minutos
- Horarios reservados (status ativa) aparecem como ocupados
- Horarios bloqueados pela administracao aparecem como indisponiveis
- Aceite de termos de uso obrigatorio antes de confirmar

### Prancheta do Porteiro (Agenda do Dia)

O porteiro ve uma lista de todos os moradores com reserva para o dia atual, com foto, horario e status da chave. A interface e atualizada em tempo real via Supabase Realtime.

- Card do morador com foto, nome, torre/apartamento
- Horario e status da chave (Aguardando / Em Uso / Concluida)
- Botoes para Entregar Chave e Receber Chave
- Timeline expansivel com todos os eventos da reserva
- Destaque visual para reservas presenciais

### Reserva Presencial

Quando um morador sem cadastro no sistema (ou que nao consegue acessar o app) quer usar a quadra, o porteiro cria a reserva presencialmente:

- Porteiro seleciona um horario livre
- Digita o nome do morador no campo de observacao
- Digita o telefone de contato
- A reserva e criada vinculada ao porteiro (para auditagem), mas exibe o nome digitado na lista do dia e no historico

### Entrega e Devolucao de Chave

Fluxo completo de controle da chave fisica:

1. **Aguardando:** reserva criada, chave na portaria
2. **Entregar Chave:** porteiro registra a retirada com turno (Dia/Noite) e timestamp
3. **Em Uso:** chave com o morador
4. **Receber Chave:** porteiro registra a devolucao, pode incluir ocorrencia (ex: "chave devolvida com atraso")
5. **Concluida:** reserva finalizada

Cada acao gera uma notificacao para o morador e um registro em `audit_logs`.

### Timeline

Cada reserva tem uma timeline de eventos:

- **Reserva criada** — data/hora da criacao
- **Chave retirada** — data/hora + nome do porteiro que entregou
- **Chave devolvida** — data/hora + nome do porteiro que recebeu + ocorrencia (se houver)

Visivel tanto na prancheta do porteiro quanto no historico da administracao.

### Historico de Reservas

Pagina administrativa com listagem completa de todas as reservas, com filtros:

- Periodo (data inicio e fim)
- Status (Todas / Ativa / Cancelada)
- Busca por nome do morador
- Paginacao (20 por pagina)

Cada reserva tem um expandable card com detalhes completos:

- Nome do morador (ou observacao, se presencial)
- Telefone de contato
- Timeline com porteiros e timestamps
- Ocorrencia registrada na devolucao
- Informacao de cancelamento (motivo + responsavel, com distincao entre admin e auto-cancelamento)
- Observacao e turno de registro

### Cancelamento de Reserva

- **Auto-cancelamento:** morador cancela sua propria reserva pelo dashboard (status vai para "cancelada", sem `cancelado_por`)
- **Cancelamento administrativo:** sindico/subsindico cancela com motivo obrigatorio; registra `cancelado_por` com o ID do admin e o motivo

### Notificacoes

Central de mensagens no dashboard:

- Notificacoes pessoais (ex: "Sua reserva foi cancelada", "Sua chave foi retirada")
- Broadcast da administracao (mural de comunicacao)
- Marcar como lida / nao lida
- Excluir notificacoes individuais ou em lote
- Roteamento automatico por tipo: alteracao de perfil vai para `/dashboard/revisao-perfil`, demais para `/dashboard/mensagens`
- Atualizacao em tempo real via Supabase Realtime

### Perfil e Aprovacao de Cadastro

- Cadastro com nome, CPF e RG (criptografados com `pgp_sym_encrypt`), data de nascimento, telefone, torre, apartamento, bloco e foto
- Novos usuarios ficam com status "pendente" ate aprovacao de um sindico
- Aprovacao/rejeicao pelo Subsindico da torre ou Sindico Geral
- Solicitacao de alteracao de dados: morador solicita, sindico aprova/rejeita com revisao comparativa
- CPF oculto com botao de revelar na tela de revisao

### Auditoria

- Registro de todas as acoes sensiveis em `audit_logs`
- Visivel apenas para o Sindico Geral
- Exportacao CSV com protecao contra CSV injection

### Mural de Comunicacao (Broadcast)

O Sindico Geral e Subsindico podem enviar notificacoes broadcast para todos os moradores, visiveis na central de mensagens.

---

## Papeis e Permissoes

| Papel | Reservas | Usuarios | Notificacoes | Auditoria | Chave |
|-------|----------|----------|--------------|-----------|-------|
| **Morador** | Criar, ver proprias, auto-cancelar | Ver/editar proprio perfil, solicitar alteracao | Ler proprias | Nao | Nao |
| **Porteiro** | Criar presencial, ver todas do dia, entregar/receber chave | Nao | Nao | Nao | Sim |
| **Subsindico** | Ver historico da propria torre, cancelar da torre | Aprovar cadastros da torre, revisar solicitacoes | Criar broadcast | Nao | Sim |
| **Sindico Geral** | Ver historico completo, cancelar qualquer | Aprovar qualquer cadastro, alterar cargo | Criar broadcast | Sim | Sim |
| **SysAdmin** | Tudo | Tudo, incluindo alterar qualquer cargo | Tudo | Sim | Sim |

---

## Fluxos Principais

### Reserva Online

```
Morador abre dashboard
  -> Seleciona dia no calendario
  -> Escolhe horario livre
  -> Aceita termos de uso
  -> POST /api/reservas (valida 2h/dia, conflitos, horario permitido 9h-22h)
  -> Reserva criada com status "ativa", chave "aguardando"
  -> Dashboard atualiza
```

No dia da reserva, o porteiro ve o card do morador na prancheta e gerencia a chave.

### Reserva Presencial

```
Morador sem cadastro vai na portaria
  -> Porteiro abre modal "Reserva Presencial"
  -> Seleciona horario livre
  -> Digita nome do morador e telefone
  -> POST /api/reservas/presencial (valida conflitos, 2h/dia)
  -> Reserva criada vinculada ao porteiro (usuario_id = porteiro)
  -> Card exibe nome digitado (observacao) em vez do nome do usuario
```

### Entrega de Chave

```
Porteiro na prancheta
  -> Clica "Entregar Chave" no card
  -> PUT /api/reservas/[id]/chave { acao: "entregar" }
  -> reservas.retirada_em = now(), entregue_por = porteiro_id, status_chave = "em_uso"
  -> Notificacao: "Sua chave foi retirada na portaria as 14:30."
  -> Audit log: acao = "entregar_chave"
```

### Devolucao de Chave

```
Morador devolve a chave na portaria
  -> Porteiro abre modal, opcionalmente digita ocorrencia
  -> PUT /api/reservas/[id]/chave { acao: "receber", ocorrencia_texto?: "..." }
  -> reservas.devolvida_em = now(), recebida_por = porteiro_id, status_chave = "concluida"
  -> Notificacao: "Sua chave foi devolvida..."
  -> Audit log: acao = "receber_chave"
```

---

## Stack Tecnologica

| Componente | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript (strict mode) |
| Banco de Dados | PostgreSQL 17 (Supabase) |
| Autenticacao | Supabase Auth (email+senha + Google OAuth) |
| Cliente DB | Supabase JS Client (PostgREST) |
| Estilizacao | Tailwind CSS 4 |
| Validacao | Zod |
| Deploy | Vercel (serverless functions) |
| Migracoes | SQL via Supabase CLI / MCP |
| Tempo Real | Supabase Realtime (WebSocket) |
| Criptografia | pgcrypto + Supabase Vault |

---

## Arquitetura

### Padrao de Camadas

Toda requisicao segue o mesmo fluxo:

```
Browser -> Next.js (Server/Client) -> API Route -> Service -> Supabase (service client)
                                                                     |
                                                              PostgreSQL (RLS bypass)
```

- **Client Components** fazem fetch para `/api/*` com Bearer token
- **API Routes** verificam auth + CSRF + rate limit + validacao
- **Services** contem a logica de negocios e queries
- **Service Client** (`getServiceClient()`) bypassa RLS (opera como superuser)

Excecao: leituras simples do morador (ex: `MinhasReservas`) usam o client anonimo com RLS.

### Seguranca por Camada

```
1. CSP Headers (middleware) - bloqueia XSS e exfiltracao
2. CSRF double-submit cookie - toda mutacao via cookie + header
3. Rate Limiting - in-memory, por endpoint com prefixo unico
4. Auth Bearer Token - JWT verificado via supabase.auth.getUser()
5. Validacao Zod - schema validation em toda entrada
6. Service Layer - regras de negocio (2h/dia, conflitos, horarios) 
7. RLS Policies - controle de acesso no banco (camada extra)
```

---

## Banco de Dados

### Tabelas

#### `usuarios`
Vinculada ao `auth.users` do Supabase via FK `ON DELETE CASCADE`.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Mesmo ID do auth.users |
| nome_completo | text | Nome visivel |
| rg_encrypted | bytea | Criptografado com pgp_sym_encrypt |
| cpf_encrypted | bytea | Criptografado com pgp_sym_encrypt |
| data_nascimento | date | |
| telefone | text | |
| apartamento | text | |
| torre | text | |
| bloco | text | Apenas Torre 5 |
| foto_url | text | Avatar |
| cargo | text | Morador, Porteiro, Subsindico, Sindico Geral, SysAdmin |
| status | text | pendente, ativo, inativo |

#### `reservas`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| usuario_id | uuid FK > usuarios | Dono da reserva |
| data_reserva | date | |
| hora_inicio | time | Slot inicio |
| hora_fim | time | Slot fim |
| status | text | ativa, cancelada |
| status_chave | text | aguardando, em_uso, concluida |
| retirada_em | timestamptz | Quando a chave foi entregue |
| entregue_por | uuid FK > usuarios | Porteiro que entregou |
| devolvida_em | timestamptz | Quando a chave foi devolvida |
| recebida_por | uuid FK > usuarios | Porteiro que recebeu |
| cancelado_por | uuid FK > usuarios | Admin que cancelou (null = auto-cancelamento) |
| ocorrencia_texto | text | Ocorrencia na devolucao |
| turno_registro | text | Turno Dia / Turno Noite |
| observacao | text | Usado em reservas presenciais (nome do morador digitado) |
| telefone_contato | text | Contato para reserva presencial |
| motivo_cancelamento | text | Motivo do cancelamento admin |
| aceite_termos | boolean | |
| versao_termos | text | |
| timestamp_aceite | timestamptz | |

#### `audit_logs`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| perfil_id | uuid | Quem executou a acao |
| acao | text | entregar_chave, receber_chave, etc. |
| detalhes | jsonb | Payload com contexto |
| created_at | timestamptz | |

#### `notificacoes`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| mensagem | text | |
| destinatario_id | uuid FK > usuarios | Null = broadcast |
| lida | boolean | |
| created_at | timestamptz | |

#### `solicitacoes_perfil`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| usuario_id | uuid FK | Quem solicitou |
| novo_nome | text | |
| novo_cpf | text | |
| nova_foto_url | text | |
| status | text | pendente, aprovado, rejeitado |
| revisado_por | uuid FK | Admin que revisou |
| created_at | timestamptz | |

### RLS Policies

Todas as tabelas tem RLS ativado. As policies usam funcoes auxiliares `SECURITY DEFINER` (`get_current_user_cargo()`, `get_current_user_torre()`) para evitar recursao.

Principais regras:
- Usuarios veem apenas seus proprios dados sensiveis (RLS na coluna)
- Subsindico ve apenas moradores da sua torre
- Audit_logs visivel apenas para Sindico Geral
- Notificacoes broadcast (destinatario_id = null) visiveis para todos
- Porteiros e admins tem acesso total a reservas (via service client nas API routes)

### Funcoes do Banco

- `handle_new_user()` — Trigger `on_auth_user_created`: cria registro em `usuarios` quando usuario se cadastra no Supabase Auth
- `create_usuario_encrypted()` — `SECURITY DEFINER`: insere usuario com CPF/RG criptografados usando chave do Supabase Vault
- `get_usuario_decrypted()` — `SECURITY DEFINER`: descriptografa CPF/RG para leitura (uso restrito)
- `safe_decrypt()` — Wrapper que retorna null em vez de erro se a descriptografia falhar

---

## API

Todas as rotas sao `force-dynamic` (serverless).

### Rotas Publicas / Semi-Publicas

| Metodo | Rota | Descricao |
|--------|------|-----------|
| GET | `/api/reservas?data=YYYY-MM-DD` | Lista reservas ativas de uma data |
| GET | `/api/reservas/historico?inicio=&fim=&status=&morador=&page=&pageSize=` | Historico completo (admin) |
| GET | `/api/usuarios` | Lista usuarios (admin) |
| GET | `/api/usuarios/[id]` | Detalhes do usuario (admin) |
| GET | `/api/notificacoes` | Notificacoes do usuario logado |

### Rotas de Mutacao (exigem CSRF + Bearer)

| Metodo | Rota | Descricao |
|--------|------|-----------|
| POST | `/api/reservas` | Criar reserva (morador) |
| POST | `/api/reservas/presencial` | Criar reserva presencial (porteiro/admin) |
| POST | `/api/reservas/validate` | Validar horario antes de reservar |
| PATCH | `/api/reservas/[id]` | Cancelar reserva (admin) |
| PUT | `/api/reservas/[id]/chave` | Registrar entrega/devolucao de chave |
| PATCH | `/api/usuarios/[id]` | Aprovar/rejeitar perfil, alterar cargo |
| DELETE | `/api/notificacoes` | Excluir notificacoes |

### Rate Limits

| Grupo | Limite | Janela |
|-------|--------|--------|
| `reservas-historico` | 60 req/min | 60s |
| `reservas` | 60 req/min | 60s |
| `reserva-id` | 30 req/min | 60s |
| `reservas-presencial` | 30 req/min | 60s |
| `usuarios` | 30 req/min | 60s |
| `notificacoes` | 30 req/min | 60s |

---

## Seguranca

### Criptografia de Dados Sensiveis

CPF e RG sao criptografados com `pgp_sym_encrypt` usando uma chave de 32 bytes armazenada no Supabase Vault (`vault.decrypted_secrets`). A chave tambem existe como env var `ENCRYPTION_KEY` para operacoes que precisam dela em tempo de execucao.

### CSP (Content Security Policy)

Definida via middleware do Next.js:
- `script-src`: 'self', 'unsafe-inline', 'unsafe-eval' (necessario para Next.js)
- `style-src`: 'self', 'unsafe-inline'
- `connect-src`: 'self', https://*.supabase.co
- `frame-src`: 'none'
- Bloqueia conexoes de exfiltracao para dominios externos

### CSRF

Double-submit cookie pattern:
- Cookie `csrf-token` setado no middleware com valor randomico
- Toda mutacao envia `x-csrf-token` no header
- API route compara header com cookie

### Logger

Logger estruturado que sanitiza automaticamente:
- Campos de senha/token: `[REDACTED]`
- Payloads de erro: sem dados sensiveis
- Rotacao de identificadores

---

## Variaveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# URL base (usada pelo middleware CSRF)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Criptografia (32 bytes em hex)
ENCRYPTION_KEY=abcdef0123456789...

# Supabase Vault (mesma chave)
# Nome do secret: encryption_key
```

---

## Desenvolvimento Local

### Pre-requisitos

- Node.js 20+
- npm
- Supabase CLI (opcional, para banco local)

### Setup

```bash
# Instalar dependencias
npm install

# Iniciar dev server
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Banco de Dados

O schema completo esta em `schema.sql`. Para aplicar localmente:

```bash
npx supabase start
npx supabase db reset
```

As migrations incrementais estao em `supabase/migrations/`.

### Construcao

```bash
npm run build
```

---

## Estrutura do Projeto

```
src/
  app/
    api/
      bloqueios/        -- GET (listar bloqueios)
      notificacoes/     -- GET (listar), DELETE (excluir)
      reservas/
        [id]/
          chave/        -- PUT (registrar chave)
          route.ts      -- PATCH (cancelar admin)
        historico/      -- GET (historico admin)
        presencial/     -- POST (criar presencial)
        validate/       -- POST (validar horario)
        route.ts        -- GET (listar dia), POST (criar)
      usuarios/
        [id]/
          cargo/        -- PATCH (alterar cargo)
          route.ts      -- PATCH (aprovar perfil)
        route.ts        -- GET (listar), POST (criar)
    (authenticated)/
      dashboard/
        auditoria/      -- Pagina de auditoria (Sindico Geral)
        historico/      -- Pagina de historico (admin)
        mensagens/      -- Central de notificacoes
        revisao-perfil/ -- Revisao de solicitacoes de perfil
        usuarios/       -- Gestao de usuarios (admin)
        page.tsx        -- Dashboard com calendario + minhas reservas
    auth/
      callback/         -- Callback OAuth
      login/            -- Login
      register/         -- Novo cadastro
    completar-cadastro/ -- Completar registro apos OAuth
    page.tsx            -- Landing page
  components/
    Dashboard.tsx
    Header.tsx          -- Nav + notificacoes + realtime
    PorteiroAgendaHoje.tsx  -- Prancheta do porteiro
    MinhasReservas.tsx      -- Minhas reservas (morador)
    Calendario.tsx          -- Calendario de reservas
    ProfileReviewPanel.tsx  -- Revisao de perfil (admin)
    AdminNotificationPanel.tsx  -- Mural de comunicacao
  lib/
    services/
      reserva.ts        -- Logica: listar, criar, cancelar, chave, historico
      usuario.ts        -- Logica: criar, atualizar, perfil
    supabase.ts          -- Client anon (RLS)
    supabase-server.ts   -- Service client
    validators.ts        -- Schemas Zod
    rate-limit.ts        -- Rate limiter in-memory
    csrf.ts             -- CSRF validation
    logger.ts           -- Logger estruturado
    auditoria.ts        -- Query de auditoria
    turno.ts            -- Logica de turno (Dia/Noite)
    api-validation.ts   -- Validacao generica de payload
supabase/
  migrations/           -- Migrations SQL incrementais
schema.sql              -- Schema completo (regenerado do banco)
```
