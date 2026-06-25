# Histórico de Reservas — Design

## Contexto

Síndico Geral e Subsíndicos precisam auditar reservas passadas da quadra.
Síndico Geral vê todas as torres; Subsíndico vê apenas a própria torre.

## Modelo de Dados

### Migration: `cancelado_por` em `reservas`

```sql
ALTER TABLE public.reservas
  ADD COLUMN cancelado_por uuid REFERENCES public.usuarios(id);
```

### Service

`listarHistoricoReservas(supabase, callerId, callerCargo, callerTorre, filters)`

Retorna reservas com status `'ativa'` ou `'cancelada'`. Join com `usuarios` (nome, torre, apto,
foto_url) e self-join `usuarios AS cancelador` para `cancelado_por`.

## API

### `GET /api/reservas/historico`

**Headers:** `Authorization: Bearer <token>`

**Query params:**

| Param    | Tipo   | Default           | Descrição                |
| -------- | ------ | ----------------- | ------------------------ |
| `inicio` | date   | -6 meses          | Data inicial (inclusivo) |
| `fim`    | date   | hoje              | Data final (inclusivo)   |
| `status` | string | `'todas'`         | ativa / cancelada / todas |
| `morador`| string | —                 | Busca parcial por nome   |
| `page`   | int    | 1                 | Página (1-based)         |
| `pageSize`| int   | 20                | Itens por página         |

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "data_reserva": "2026-06-01",
      "hora_inicio": "09:00",
      "hora_fim": "10:00",
      "status": "cancelada",
      "motivo_cancelamento": "Manutenção",
      "observacao": null,
      "telefone_contato": null,
      "status_chave": "aguardando",
      "usuarios": { "nome_completo": "João", "torre": "A", "apartamento": "101", "foto_url": "..." },
      "cancelado_por": { "nome_completo": "Síndico", "torre": "A", "apartamento": null }
    }
  ],
  "total": 42,
  "page": 1
}
```

### Segurança

- **Auth:** JWT Bearer via `auth.getUser(token)`
- **Cargo:** Apenas `SysAdmin`, `Síndico Geral`, `Subsíndico`
- **Torre:** Subsíndico tem `WHERE usuarios.torre = callerTorre` aplicado no service
- **Rate limit:** `normalLimiter` — 20 req/min
- **Input:** Zod nos query params (formato data, enum status, page >= 1)

## Frontend

### Card no Dashboard

Na grade de painéis admin, ao lado de "Gestão de Usuários":

```
[Histórico de Reservas]
 Visualizar reservas passadas e cancelamentos
```

Visível para `isAdmin` (Síndico Geral, Subsíndico, SysAdmin).

### Página `/dashboard/historico`

**Layout:**
- Header "Histórico de Reservas" com breadcrumb
- Barra de filtros: período (date range) + status (select) + busca por nome
- Tabela: Data | Horário | Morador | Torre/Apto | Status
- Cada linha expansível (collapse) com detalhes: motivo cancelamento, quem cancelou, observação, telefone, chave
- Paginação no rodapé

**Componentes:**
- `app/(authenticated)/dashboard/historico/page.tsx` — página principal
- `components/HistoricoReservas.tsx` — tabela + filtros + paginação

**Observação:** Subsíndico não vê torre no filtro (já vem filtrado pela API).
            Síndico Geral pode filtrar por torre no futuro (não escopo inicial).

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `src/app/api/reservas/historico/route.ts` | Criar |
| `src/lib/services/reserva.ts` | Adicionar `listarHistoricoReservas()` e atualizar `cancelarReserva()` |
| `src/lib/validators.ts` | Adicionar schema dos query params |
| `src/app/(authenticated)/dashboard/page.tsx` | Adicionar card "Histórico de Reservas" |
| `src/app/(authenticated)/dashboard/historico/page.tsx` | Criar |
| `src/components/HistoricoReservas.tsx` | Criar |

## Pendente (não escopo)

- Histórico por morador (opção 3) — reusa o mesmo service
- Filtro por torre no frontend para Síndico Geral
- Exportar CSV do histórico
