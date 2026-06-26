# Reserva Quadra — Documento de Especificação

## 1. Visão Geral

O **Reserva Quadra** é um sistema de agendamento online para a quadra poliesportiva do **Complexo Júlio Prestes**, um condomínio residencial com 5 torres. O sistema permite que moradores reservem horários, que porteiros gerenciem a agenda e a chave da quadra, e que síndicos administrem o uso, usuários e bloqueios.

O projeto foi inteiramente desenvolvido em **Next.js 16 (App Router)** com **Supabase** como backend (PostgreSQL + Auth + Storage), implantado na **Vercel**.

---

## 2. Público-Alvo

| Perfil | Descrição |
|--------|-----------|
| **Morador** | Residentes das torres 1–5, maiores de 18 anos, que desejam usar a quadra |
| **Porteiro** | Funcionários da portaria que controlam a entrada da quadra e a chave |
| **Subsíndico** | Administrador por torre — gerencia moradores da sua torre |
| **Síndico Geral** | Administrador geral do condomínio |
| **SysAdmin** | Administrador técnico (superusuário) |

---

## 3. Funcionalidades

### 3.1 Autenticação e Cadastro

- **Login**: email/senha ou Google OAuth
- **Cadastro**: formulário com nome, CPF, RG (criptografados), data de nascimento, telefone, torre, apartamento, bloco (apenas Torre 5) e foto
- **Recuperação de senha**: via email
- **Aprovação de cadastro**: novos usuários ficam com status `pendente` até aprovação de um síndico
- **Completar cadastro**: página intermediária para usuários que fizeram login mas não concluíram o perfil

### 3.2 Reservas

- **Calendário visual**: grade de horários das 09h às 22h, organizada em slots de 1 hora
- **Reserva online**: morador seleciona data, horário e aceita os termos de uso
- **Reserva presencial**: porteiro pode registrar reserva em nome de um morador (para atendimento presencial na portaria)
- **Visualização em tempo real**: conflitos de horário são verificados no momento da reserva

### 3.3 Regras de Negócio (validadas no backend)

| Regra | Detalhe |
|-------|---------|
| **Horário de funcionamento** | 09h às 22h |
| **Duração máxima por reserva** | 2 horas |
| **Limite diário por unidade** | 2 horas por dia (soma de todas as reservas ativas) |
| **Conflito de horário** | Não pode haver duas reservas ativas no mesmo horário |
| **Bloqueios** | Síndico Geral pode bloquear horários por chuva ou manutenção; bloqueios cancelam reservas conflitantes automaticamente |
| **Cancelamento** | Síndicos podem cancelar reservas com motivo; morador é notificado |

### 3.4 Gestão de Usuários

- **Lista de usuários**: filtros por torre e status (pendente/aprovado/rejeitado)
- **Aprovação/Rejeição**: síndicos aprovam ou rejeitam cadastros pendentes
- **Alteração de cargo**: síndico geral pode promover morador a porteiro ou subsíndico; SysAdmin pode atribuir qualquer cargo
- **Exclusão de usuário**: com confirmação em两步
- **Visualização de dados sensíveis**: CPF e RG são criptografados no banco (PGP); descriptografia é auditada em `audit_logs`

### 3.5 Gestão da Chave

Fluxo controlado pelo porteiro/síndico:

1. Morador chega na portaria e solicita a chave
2. Porteiro registra a **retirada** (status_chave: `aguardando` → `em_uso`)
3. Ao devolver, porteiro registra a **devolução** (status_chave: `em_uso` → `concluida`), com campo opcional para ocorrência
4. Cada operação registra turno (Dia/Noite), horário e quem realizou

### 3.6 Bloqueios de Horário

- **Motivos válidos**: `Chuva` ou `Manutenção`
- Visíveis no calendário para todos os usuários
- Ao criar um bloqueio, reservas ativas no período são automaticamente canceladas

### 3.7 Notificações

- Notificações internas no sistema (sem email)
- Podem ser enviadas a um usuário específico ou em broadcast
- Sino de notificações no cabeçalho com dropdown

### 3.8 Histórico e Auditoria

- **Histórico de reservas**: consulta paginada com filtros por período, status e nome do morador
- **Auditoria da chave**: relatório completo com todas as interações de retirada/devolução
- **Auditoria de dados sensíveis**: toda consulta a CPF/RG é registrada em `audit_logs`
- **Logs de alteração de cargo**: registrados em `audit_logs`

### 3.9 Privacidade (LGPD)

- Banner de consentimento de cookies
- Página de privacidade com informações sobre tratamento de dados
- Botão para solicitar exclusão de conta
- Dados sensíveis (CPF, RG) armazenados com criptografia PGP

---

## 4. Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | Next.js 16 (App Router, React 19) |
| **Linguagem** | TypeScript 5 (strict mode) |
| **Estilização** | Tailwind CSS 3.4 |
| **Ícones** | Lucide React |
| **Validação** | Zod 4 |
| **Autenticação** | Supabase Auth (email + Google OAuth) |
| **Banco de dados** | Supabase PostgreSQL (RLS + pgcrypto) |
| **Storage** | Supabase Storage (fotos de perfil) |
| **Deploy** | Vercel (serverless) |

---

## 5. Arquitetura

```
[Browser] → [Next.js App Router] → [API Routes] → [Supabase (Service Client)]
                              ↕                    ↕
                    [Server Components]     [Supabase Auth (User)]
                              ↕
                    [Client Components]
                              ↕
                    [Supabase Client SDK]
```

### Camadas

#### 5.1 Páginas (src/app/)
- **Públicas**: `/` (login), `/register`, `/forgot-password`, `/auth/callback`, `/privacy`
- **Autenticadas**: `/dashboard`, `/dashboard/usuarios`, `/dashboard/historico`, `/dashboard/auditoria`, `/profile`, `/regras`, `/completar-cadastro`
- **Middleware**: protege rotas autenticadas, injecta cookie CSRF, redireciona usuários logados para o dashboard

#### 5.2 API Routes (src/app/api/)
Todas as mutações passam por API routes com service client (bypass RLS):

| Método | Rota | Função |
|--------|------|--------|
| GET/POST | `/api/reservas` | Listar / Criar reservas |
| PATCH | `/api/reservas/[id]` | Cancelar reserva |
| PATCH | `/api/reservas/[id]/chave` | Retirar/Devolver chave |
| POST | `/api/reservas/presencial` | Reserva presencial (porteiro) |
| GET | `/api/reservas/historico` | Histórico paginado |
| POST | `/api/reservas/validate` | Validar reserva sem persistir |
| GET/POST | `/api/usuarios` | Listar / Criar usuários |
| GET/PATCH | `/api/usuarios/[id]` | Visualizar dados / Aprovar usuário |
| PATCH | `/api/usuarios/[id]/cargo` | Alterar cargo |
| GET/POST | `/api/bloqueios` | Listar / Criar bloqueios |
| DELETE | `/api/bloqueios/[id]` | Remover bloqueio |

#### 5.3 Service Layer (src/lib/services/)
- `reserva.ts`: `criarReserva`, `cancelarReserva`, `listarReservas`, `listarHistoricoReservas`, `criarReservaPresencial`, `registrarChave`, `validarReserva`
- Separa validação de negócio da camada de transporte (API route)
- Utiliza `SupabaseClient` (service role) para operações no banco

#### 5.4 Segurança

| Mecanismo | Descrição |
|-----------|-----------|
| **CSRF** | Double-submit cookie: token em cookie `csrf-token` + header `x-csrf-token` |
| **Rate Limiting** | Limiter por IP + prefixo por endpoint (30–60 req/min) |
| **Validação de payload** | Content-Type + Content-Length + Zod schemas |
| **Logger sanitizado** | Redação de dados sensíveis em produção (CPF, RG, senha, token) |
| **Security Headers** | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy |
| **Criptografia PGP** | CPF e RG criptografados com `pgp_sym_encrypt` |
| **Auditoria** | Toda consulta a dados sensíveis e alteração de cargo é logada |
| **RLS** | Row-Level Security no Supabase como camada adicional |

---

## 6. Banco de Dados

### 6.1 Tabelas

| Tabela | Finalidade |
|--------|-----------|
| `usuarios` | Perfis de usuário (dados sensíveis criptografados) |
| `reservas` | Reservas da quadra (ativa/cancelada + status da chave) |
| `bloqueios` | Bloqueios de horário (chuva/manutenção) |
| `notificacoes` | Notificações internas |
| `audit_logs` | Log de auditoria (acesso a dados sensíveis, alterações de cargo) |
| `solicitacoes_perfil` | Solicitações de alteração de perfil (nome, CPF, foto) |
| `blackout_periods` | Períodos de indisponibilidade global |
| `terms_versions` | Versões dos termos de uso |
| `terms_acceptance_logs` | Registro de aceite de termos |

### 6.2 Funções do Banco

- `get_current_user_torre()` / `get_current_user_cargo()` — helpers para RLS
- `handle_new_user()` — trigger que cria perfil ao registrar
- `create_usuario_encrypted()` — insere com criptografia PGP
- `get_usuario_decrypted()` — descriptografa com auditoria
- `safe_decrypt()` — wrapper com tratamento de exceção

---

## 7. Modelo de Permissões

```
SysAdmin ─── acesso irrestrito, pode alterar qualquer cargo
    │
Síndico Geral ─── aprova/rejeita, cancela reservas, bloqueia horários,
    │               altera cargos (exceto SysAdmin e Síndico Geral)
    │
Subsíndico ─── escopo por torre: aprova moradores da própria torre,
    │            cancela reservas da torre, vê dados da torre
    │
Porteiro ─── vê agenda do dia, gerencia chave, faz reservas presenciais
    │
Morador ─── reserva horários, vê próprias reservas, edita perfil
```

---

## 8. Fluxos Principais

### 8.1 Primeiro Acesso

```
Registro → Login → Completar Cadastro → Pendente → Síndico Aprova → Dashboard
```

### 8.2 Reserva Online

```
Dashboard → Selecionar Data → Ver Grade → Selecionar Slot →
Aceitar Termos → Confirmar → Reserva Criada → Porteiro vê na Agenda
```

### 8.3 Uso da Quadra

```
Dia da Reserva → Morador vai à Portaria → Porteiro Entrega Chave →
Uso da Quadra → Morador Devolve Chave → Porteiro Registra Devolução
```

### 8.4 Bloqueio por Chuva/Manutenção

```
Síndico → Cria Bloqueio → Reservas Conflitantes Canceladas →
Notificações Enviadas → Todos veem Bloqueio no Calendário
```

---

## 9. Deploy e Infraestrutura

- **Hospedagem**: Vercel (serverless functions + edge middleware)
- **Banco de dados**: Supabase PostgreSQL (projeto `bgkedrkyeofuwctiteuf`)
- **Armazenamento**: Supabase Storage (bucket `avatars` para fotos)
- **Autenticação**: Supabase Auth (templates de email personalizados)
- **Domínio**: `reserva-quadra.vercel.app` (produção)

---

## 10. Documentos Relacionados

| Documento | Localização |
|-----------|-------------|
| Security Audit | `docs/SECURITY_AUDIT_2026-06-25.md` |
| Security Headers | `docs/SECURITY_HEADERS.md` |
| CSRF Protection | `docs/CSRF-PROTECTION.md` |
| LGPD Roadmap | `docs/LGPD_ROADMAP.md` |
| Key Rotation | `docs/KEY_ROTATION_STRATEGY.md` |
| Histórico Design | `docs/superpowers/specs/2026-06-25-historico-reservas-design.md` |
| Regras da Quadra | Página `/regras` no app |
