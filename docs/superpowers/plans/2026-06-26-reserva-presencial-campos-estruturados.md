# Reserva Presencial — Campos Estruturados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar campos estruturados (torre, apto, bloco, documento) à reserva presencial, permitindo que subsíndicos filtrem pelo próprio torre no histórico.

**Architecture:** Novas colunas na tabela `reservas` (`presencial_nome`, `presencial_torre`, `presencial_apt`, `presencial_bloco`, `presencial_documento`), formulário expandido no modal do porteiro, fallback `presencial_nome ?? observacao` para compatibilidade com registros antigos. No histórico, subsíndicos filtram por `usuarios.torre` (reservas de cadastrados) OU `presencial_torre` (presenciais).

**Tech Stack:** Next.js, Supabase (PostgreSQL), Zod, TypeScript

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260626_campos_presenciais.sql`
- Modify: `schema.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Adiciona campos estruturados para reserva presencial
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS presencial_nome     text,
  ADD COLUMN IF NOT EXISTS presencial_torre    text,
  ADD COLUMN IF NOT EXISTS presencial_apt      text,
  ADD COLUMN IF NOT EXISTS presencial_bloco    text,
  ADD COLUMN IF NOT EXISTS presencial_documento text;
```

Save to `supabase/migrations/20260626_campos_presenciais.sql`.

- [ ] **Step 2: Update schema.sql**

Add the 5 new columns to the `reservas` table definition (around line 21-40), after `observacao text,`:

```sql
    presencial_nome     text,
    presencial_torre    text,
    presencial_apt      text,
    presencial_bloco    text,
    presencial_documento text,
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260626_campos_presenciais.sql schema.sql
git commit -m "feat: add presencial_nome, torre, apt, bloco, documento columns to reservas"
```

---

### Task 2: Expand Zod Schema (validators.ts)

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Add new fields to `reservaPresencialSchema`**

Replace the current schema:

```typescript
export const reservaPresencialSchema = z.object({
  observacao: z.string().min(1, 'Observacao e obrigatoria'),
  telefone_contato: z.string().regex(telefoneRegex, 'Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX'),
  hora_inicio: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
  hora_fim: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
})
```

With:

```typescript
export const reservaPresencialSchema = z.object({
  presencial_nome: z.string().min(3, 'Nome do morador e obrigatorio'),
  telefone_contato: z.string().regex(telefoneRegex, 'Telefone deve estar no formato (XX) XXXXX-XXXX ou (XX) XXXX-XXXX'),
  presencial_torre: z.enum(['1', '2', '3', '4', '5'], { message: 'Torre invalida' }),
  presencial_apt: z.string().min(1, 'Apartamento e obrigatorio'),
  presencial_bloco: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
  presencial_documento: z.string().min(3, 'Documento deve ter ao menos 3 caracteres').optional().nullable(),
  hora_inicio: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
  hora_fim: z.string().regex(timeRegex, 'Formato deve ser HH:MM'),
})
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat: expand reservaPresencialSchema with structured fields"
```

---

### Task 3: Update Service (criarReservaPresencial)

**Files:**
- Modify: `src/lib/services/reserva.ts`

- [ ] **Step 1: Update `criarReservaPresencial` to pass new fields**

Replace the destructuring and INSERT in the function (lines 185-224):

**Before:**
```typescript
export async function criarReservaPresencial(supabase: SupabaseClient, body: unknown, requesterId: string) {
  const parsed = reservaPresencialSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { observacao, telefone_contato, hora_inicio, hora_fim } = parsed.data
  // ...
  const { data, error } = await supabase
    .from('reservas')
    .insert([{
      usuario_id: requesterId, data_reserva, hora_inicio, hora_fim,
      status: 'ativa', status_chave: 'aguardando', aceite_termos: true,
      observacao, telefone_contato,
    }])
    .select().maybeSingle()
```

**After:**
```typescript
export async function criarReservaPresencial(supabase: SupabaseClient, body: unknown, requesterId: string) {
  const parsed = reservaPresencialSchema.safeParse(body)
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message)
  const { presencial_nome, telefone_contato, presencial_torre, presencial_apt, presencial_bloco, presencial_documento, hora_inicio, hora_fim } = parsed.data
  // ... (validation unchanged) ...
  const { data, error } = await supabase
    .from('reservas')
    .insert([{
      usuario_id: requesterId, data_reserva, hora_inicio, hora_fim,
      status: 'ativa', status_chave: 'aguardando', aceite_termos: true,
      presencial_nome, telefone_contato, presencial_torre, presencial_apt, presencial_bloco, presencial_documento,
    }])
    .select().maybeSingle()
```

The `observacao` field is no longer set by the service for new reservas presencial — it stays NULL.

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/reserva.ts
git commit -m "feat: insert structured presencial fields in criarReservaPresencial"
```

---

### Task 4: Update Modal Form (PorteiroAgendaHoje)

**Files:**
- Modify: `src/components/PorteiroAgendaHoje.tsx`

- [ ] **Step 1: Add new state variables (after line 111)**

```typescript
const [nomePresencial, setNomePresencial] = useState('');
const [torrePresencial, setTorrePresencial] = useState('');
const [aptPresencial, setAptPresencial] = useState('');
const [blocoPresencial, setBlocoPresencial] = useState('');
const [documentoPresencial, setDocumentoPresencial] = useState('');
```

- [ ] **Step 2: Update `openPresencialModal` to reset new fields (line 172)**

```typescript
const openPresencialModal = async () => {
    setIsPresencialOpen(true);
    setNomePresencial('');
    setTelefonePresencial('');
    setTorrePresencial('');
    setAptPresencial('');
    setBlocoPresencial('');
    setDocumentoPresencial('');
    // ... rest stays same
```

- [ ] **Step 3: Update `handleConfirmarPresencial` to send new fields (around line 212-225)**

Replace the request body:

```typescript
const res = await fetch('/api/reservas/presencial', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
    },
    body: JSON.stringify({
        presencial_nome: nomePresencial.trim(),
        telefone_contato: telefonePresencial.trim(),
        presencial_torre: torrePresencial,
        presencial_apt: aptPresencial.trim(),
        presencial_bloco: blocoPresencial || null,
        presencial_documento: documentoPresencial.trim() || null,
        hora_inicio: selectedSlot,
        hora_fim: slot?.hora_fim,
    }),
});
```

- [ ] **Step 4: Replace the form in the modal (lines 450-474)**

Replace the "Nome e Apto do Morador" and "Telefone" inputs with:

```tsx
<div className="mb-4">
    <label className="block text-sm font-semibold text-gray-700 mb-1">
        Nome do Morador <span className="text-red-500">*</span>
    </label>
    <input
        type="text"
        value={nomePresencial}
        onChange={e => setNomePresencial(e.target.value)}
        placeholder="Ex: João Silva"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
    />
</div>

<div className="mb-4">
    <label className="block text-sm font-semibold text-gray-700 mb-1">
        Telefone de Contato <span className="text-red-500">*</span>
    </label>
    <input
        type="tel"
        value={telefonePresencial}
        onChange={e => setTelefonePresencial(e.target.value)}
        placeholder="Ex: (11) 99999-8888"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
    />
</div>

<div className="grid grid-cols-2 gap-3 mb-4">
    <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
            Torre <span className="text-red-500">*</span>
        </label>
        <select
            value={torrePresencial}
            onChange={e => { setTorrePresencial(e.target.value); if (e.target.value !== '5') setBlocoPresencial(''); }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500 bg-white"
        >
            <option value="">Selecione...</option>
            {['1','2','3','4','5'].map(t => (
                <option key={t} value={t}>Torre {t}</option>
            ))}
        </select>
    </div>
    <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
            Apartamento <span className="text-red-500">*</span>
        </label>
        <input
            type="text"
            value={aptPresencial}
            onChange={e => setAptPresencial(e.target.value)}
            placeholder="Ex: 304"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
        />
    </div>
</div>

{torrePresencial === '5' && (
    <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Bloco</label>
        <select
            value={blocoPresencial}
            onChange={e => setBlocoPresencial(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500 bg-white"
        >
            <option value="">Selecione...</option>
            {['A','B','C','D'].map(b => (
                <option key={b} value={b}>Bloco {b}</option>
            ))}
        </select>
    </div>
)}

<div className="mb-4">
    <label className="block text-sm font-semibold text-gray-700 mb-1">
        Documento (RG/CPF)
    </label>
    <input
        type="text"
        value={documentoPresencial}
        onChange={e => setDocumentoPresencial(e.target.value)}
        placeholder="Ex: 12.345.678-9 ou 123.456.789-00"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-violet-500 focus:border-violet-500"
    />
</div>
```

- [ ] **Step 5: Update the Confirm button disabled condition**

Change the disabled condition from:
```tsx
disabled={!observacaoPresencial.trim() || !telefonePresencial.trim() || !selectedSlot || isSavingPresencial || freeSlots.length === 0}
```
To:
```tsx
disabled={!nomePresencial.trim() || !telefonePresencial.trim() || !torrePresencial || !aptPresencial.trim() || !selectedSlot || isSavingPresencial || freeSlots.length === 0}
```

- [ ] **Step 6: Update card display to use `presencial_nome` (line 342)**

Replace the card display block (lines 342-357) from:
```tsx
{res.observacao ? (
    <>
        <p className="font-bold text-gray-900 leading-tight">{res.observacao}</p>
        <p className="text-xs text-amber-600 font-semibold mt-0.5">Presencial</p>
    </>
) : (
    <>
        <p className="font-bold text-gray-900 leading-tight">{res.usuarios?.nome_completo}</p>
        <p className="text-xs font-semibold text-violet-700 bg-violet-100 inline-block px-2 py-0.5 rounded-full mt-1">
            Torre {res.usuarios?.torre} - Apto {res.usuarios?.apartamento}
        </p>
    </>
)}
```

To:
```tsx
{res.presencial_nome || res.observacao ? (
    <>
        <p className="font-bold text-gray-900 leading-tight">{res.presencial_nome || res.observacao}</p>
        <p className="text-xs text-amber-600 font-semibold mt-0.5">Presencial</p>
        {res.presencial_torre && (
            <p className="text-xs text-gray-500 mt-0.5">
                T{res.presencial_torre}{res.presencial_apt ? `, Apto ${res.presencial_apt}` : ''}
                {res.presencial_bloco ? `, Bloco ${res.presencial_bloco}` : ''}
            </p>
        )}
        {res.telefone_contato && (
            <p className="text-xs text-gray-500 mt-0.5">Tel: {res.telefone_contato}</p>
        )}
    </>
) : (
    <>
        <p className="font-bold text-gray-900 leading-tight">{res.usuarios?.nome_completo}</p>
        <p className="text-xs font-semibold text-violet-700 bg-violet-100 inline-block px-2 py-0.5 rounded-full mt-1">
            Torre {res.usuarios?.torre} - Apto {res.usuarios?.apartamento}
        </p>
    </>
)}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/PorteiroAgendaHoje.tsx
git commit -m "feat: update presencial modal form and card display with structured fields"
```

---

### Task 5: Update Dashboard Page Display (page.tsx)

**Files:**
- Modify: `src/app/(authenticated)/dashboard/page.tsx`

- [ ] **Step 1: Add new fields to interface**

Add to `ReservaSlotAdmin` (around line 36-50):

```typescript
interface ReservaSlotAdmin {
    reserva_id: string;
    usuario_id: string;
    slot: Slot;
    observacao?: string;
    telefone_contato?: string;
    presencial_nome?: string;
    presencial_torre?: string;
    presencial_apt?: string;
    presencial_bloco?: string;
    usuarios: {
        nome?: string;
        nome_completo?: string;
        foto_url?: string;
        torre?: string;
        apartamento?: string;
        cargo?: string;
    } | null;
}
```

- [ ] **Step 2: Pass new fields from API response (around line 399-406)**

```typescript
newMap[String(match.id)] = {
    reserva_id: reserva.id as string,
    usuario_id: reserva.usuario_id as string,
    slot: match,
    observacao: (reserva.observacao as string) || undefined,
    telefone_contato: (reserva.telefone_contato as string) || undefined,
    presencial_nome: (reserva.presencial_nome as string) || undefined,
    presencial_torre: (reserva.presencial_torre as string) || undefined,
    presencial_apt: (reserva.presencial_apt as string) || undefined,
    presencial_bloco: (reserva.presencial_bloco as string) || undefined,
    usuarios: dadosUsuario as ReservaSlotAdmin['usuarios'],
};
```

- [ ] **Step 3: Update slot name display (lines 665-701)**

Replace the display block:

**Before:**
```tsx
{info.observacao ? (
    <div className="flex flex-col">
        <span className="text-sm font-bold text-gray-700">
            {info.observacao}
        </span>
        <span className="text-xs text-amber-600 font-semibold">
            Presencial — {info.usuarios.nome_completo || info.usuarios.nome}
        </span>
        {info.telefone_contato && (
            <span className="text-xs text-gray-500 mt-0.5">
                Tel: {info.telefone_contato}
            </span>
        )}
    </div>
) : (
```

**After:**
```tsx
{info.presencial_nome || info.observacao ? (
    <div className="flex flex-col">
        <span className="text-sm font-bold text-gray-700">
            {info.presencial_nome || info.observacao}
        </span>
        <span className="text-xs text-amber-600 font-semibold">
            Presencial
        </span>
        {info.presencial_torre && (
            <span className="text-xs text-gray-500">
                T{info.presencial_torre}{info.presencial_apt ? `, Apto ${info.presencial_apt}` : ''}
                {info.presencial_bloco ? `, Bloco ${info.presencial_bloco}` : ''}
            </span>
        )}
        {info.telefone_contato && (
            <span className="text-xs text-gray-500 mt-0.5">
                Tel: {info.telefone_contato}
            </span>
        )}
    </div>
) : (
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(authenticated\)/dashboard/page.tsx
git commit -m "feat: display structured presencial fields in dashboard slots"
```

---

### Task 6: Update Histórico Page and Service

**Files:**
- Modify: `src/app/(authenticated)/dashboard/historico/page.tsx`
- Modify: `src/lib/services/reserva.ts` (listarHistoricoReservas)

- [ ] **Step 1: Add new fields to interface (historico/page.tsx)**

Add to `ReservaHistorico`:

```typescript
interface ReservaHistorico {
  // ... existing fields
  presencial_nome?: string
  presencial_torre?: string
  presencial_apt?: string
  presencial_bloco?: string
  presencial_documento?: string
}
```

- [ ] **Step 2: Update historico service to filter by presencial_torre**

In `src/lib/services/reserva.ts`, `listarHistoricoReservas` function (lines 119-124), replace the subsíndico filter:

**Before:**
```typescript
if (callerCargo === 'Subsíndico' && callerTorre) {
    const { data: torreUserIds } = await supabase
        .from('usuarios').select('id').eq('torre', callerTorre)
    const ids = torreUserIds?.map(u => u.id) ?? []
    query = query.in('usuario_id', ids)
}
```

**After:**
```typescript
if (callerCargo === 'Subsíndico' && callerTorre) {
    const { data: torreUserIds } = await supabase
        .from('usuarios').select('id').eq('torre', callerTorre)
    const ids = torreUserIds?.map(u => u.id) ?? []
    // Reserva de morador cadastrado OR reserva presencial da mesma torre
    query = query.or(`usuario_id.in.(${ids.length > 0 ? ids.join(',') : '00000000-0000-0000-0000-000000000000'}),presencial_torre.eq.${callerTorre}`)
}
```

- [ ] **Step 3: Update historico page display (lines 192-202)**

Replace the summary name line:

**Before:**
```tsx
{reserva.observacao ? (
    <span className="text-sm text-gray-600 truncate hidden sm:block">
        {reserva.observacao}
        <span className="text-xs text-amber-600 font-semibold ml-2">Presencial</span>
    </span>
) : reserva.usuarios && (
```

**After:**
```tsx
{reserva.presencial_nome || reserva.observacao ? (
    <span className="text-sm text-gray-600 truncate hidden sm:block">
        {reserva.presencial_nome || reserva.observacao}
        {reserva.presencial_torre && ` • T${reserva.presencial_torre}`}
        <span className="text-xs text-amber-600 font-semibold ml-2">Presencial</span>
    </span>
) : reserva.usuarios && (
```

- [ ] **Step 4: Update historico expanded detail (lines 218-233)**

Replace the expanded Morador section:

**Before:**
```tsx
<div>
    <span className="text-gray-400 font-semibold text-xs">Morador</span>
    <p className="text-gray-700">
        {reserva.observacao
            ? reserva.observacao
            : (reserva.usuarios?.nome_completo ?? '—')}
    </p>
    {reserva.observacao && (
        <span className="text-xs text-amber-600 font-semibold mt-0.5 inline-block">Presencial</span>
    )}
    {!reserva.observacao && reserva.usuarios?.torre && (
        <span className="text-xs text-gray-500 mt-0.5 inline-block">
            T{reserva.usuarios.torre}{reserva.usuarios.apartamento ? `, Apto ${reserva.usuarios.apartamento}` : ''}
        </span>
    )}
</div>
```

**After:**
```tsx
<div>
    <span className="text-gray-400 font-semibold text-xs">Morador</span>
    <p className="text-gray-700">
        {reserva.presencial_nome || reserva.observacao || reserva.usuarios?.nome_completo || '—'}
    </p>
    {(reserva.presencial_nome || reserva.observacao) && (
        <span className="text-xs text-amber-600 font-semibold mt-0.5 inline-block">Presencial</span>
    )}
    {reserva.presencial_torre && (
        <span className="text-xs text-gray-500 mt-0.5 inline-block">
            T{reserva.presencial_torre}{reserva.presencial_apt ? `, Apto ${reserva.presencial_apt}` : ''}
            {reserva.presencial_bloco ? `, Bloco ${reserva.presencial_bloco}` : ''}
        </span>
    )}
    {!reserva.presencial_nome && !reserva.observacao && reserva.usuarios?.torre && (
        <span className="text-xs text-gray-500 mt-0.5 inline-block">
            T{reserva.usuarios.torre}{reserva.usuarios.apartamento ? `, Apto ${reserva.usuarios.apartamento}` : ''}
        </span>
    )}
</div>
```

- [ ] **Step 5: Add documento to expanded detail**

After `telefone_contato` section (around line 240), add document display:

```tsx
{reserva.presencial_documento && (
    <div>
        <span className="text-gray-400 font-semibold text-xs">Documento</span>
        <p className="text-gray-700 font-mono">{reserva.presencial_documento}</p>
    </div>
)}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/\(authenticated\)/dashboard/historico/page.tsx src/lib/services/reserva.ts
git commit -m "feat: filter historico by presencial_torre for subsindicos, display structured fields"
```

---

### Task 7: Update API Select for Presencial Fields

**Files:**
- Modify: `src/app/api/reservas/route.ts` (GET — list reservas by date)

- [ ] **Step 1: Read the API route to check if new fields are already in the select**

Run: `grep -n 'select\|presencial' src/app/api/reservas/route.ts`

If the query uses `.select('*')` or doesn't include the new fields, update it to include them. If it already uses `*`, no changes needed.

- [ ] **Step 2: Commit if changes were made**

---

### Task 8: Build & Deploy

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Commit and push**

```bash
git add -A
git commit -m "opencode: implementa campos estruturados para reserva presencial"
git push
```

Expected: Push succeeds, Vercel deploys automatically.
