# Reserva Presencial — Campos Estruturados (Torre, Apto, Bloco, Documento)

## Problema

Reservas presenciais armazenam nome do morador, torre e apartamento em um único campo
`observacao` (texto livre). Isso impede:

- Subsíndicos verem **apenas** reservas da sua torre no Histórico
- Exibição padronizada de torre/apt nos cards e relatórios
- Rastreamento por documento (RG/CPF) para responsabilização

## Solução

Novas colunas na tabela `reservas`, formulário expandido para o porteiro, e fallback
compatível com registros antigos.

## Schema (Migration)

```sql
ALTER TABLE public.reservas
  ADD COLUMN presencial_nome     text,
  ADD COLUMN presencial_torre    text,
  ADD COLUMN presencial_apt      text,
  ADD COLUMN presencial_bloco    text,
  ADD COLUMN presencial_documento text;
```

Todas opcionais (registros antigos ficam `NULL`). Nenhuma coluna existente é alterada.

## Validação (Zod — reservaPresencialSchema)

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `presencial_nome` | string min 3 | sim |
| `telefone_contato` | string regex telefone | sim |
| `presencial_torre` | enum "1"-"5" | sim |
| `presencial_apt` | string min 1 | sim |
| `presencial_bloco` | enum "A"\|"B"\|"C"\|"D" | não (só Torre 5) |
| `presencial_documento` | string min 3 | não |
| `hora_inicio` | string HH:MM | sim |
| `hora_fim` | string HH:MM | sim |

## Formulário (Modal do Porteiro)

```
┌─────────────────────────────────┐
│ Nova Reserva Presencial         │
├─────────────────────────────────┤
│ Nome do Morador     [_________] │
│ Telefone            [_________] │
│ Torre  [▼]  Apto    [_________] │
│ Bloco  [▼]  (só se Torre = 5)   │
│ Documento (RG/CPF) [_________]  │
│ Horário [____________________]  │
│         [Voltar] [Confirmar]   │
└─────────────────────────────────┘
```

- Torre: dropdown (1-5)
- Bloco: dropdown (A/B/C/D), visível apenas quando torre = "5"
- Demais campos: texto livre

## Display (Prancheta, Histórico)

Substituir `observacao` por `presencial_nome ?? observacao` (coalescência):

```ts
const nomeExibido = reserva.presencial_nome ?? reserva.observacao
```

Cards com dados estruturados mostram:

```
Presencial
João Silva — T2, Apto 304
```

Cards antigos (fallback) mostram o texto original de `observacao`.

## Filtro por Torre no Histórico

A query de histórico para Subsíndicos ganha:

```ts
if (cargo === 'Subsíndico') {
  query = query.or(`usuarios.torre.eq.${torre},presencial_torre.eq.${torre}`)
}
```

Isso cobre tanto reservas de moradores cadastrados quanto presenciais.

## Backward Compatibility

- Registros existentes: `presencial_nome = NULL`, exibem `observacao`
- Código existente que lê `observacao` continua funcionando
- Nenhum dado existente é migrado ou alterado

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `schema.sql` | Adicionar colunas |
| Migration SQL | `ALTER TABLE` |
| `src/lib/validators.ts` | Expandir `reservaPresencialSchema` |
| `src/lib/services/reserva.ts` | Inserir novos campos em `criarReservaPresencial` |
| `src/app/api/reservas/presencial/route.ts` | Nenhuma (body validado pelo schema) |
| `src/components/PorteiroAgendaHoje.tsx` | Novo formulário no modal |
| `src/app/(authenticated)/dashboard/page.tsx` | Exibir nome via fallback |
| `src/app/(authenticated)/dashboard/historico/page.tsx` | Exibir tag + torre/apt; filtro por `presencial_torre` |
| `src/app/(authenticated)/dashboard/atual/page.tsx` | Mesmo fallback no display |
