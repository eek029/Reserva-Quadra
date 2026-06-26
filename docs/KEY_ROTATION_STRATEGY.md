# Encryption Key Rotation Strategy

## Status Atual

- Chaves encriptam CPF e RG
- Usando Supabase pgcrypto (não rotacionável sem reencriptação)

## Problema

- Se chave vazar, toda coluna CPF é comprometida
- Não há estratégia de rotação implementada

## Solução (Future)

### Opção 1: Field-level Encryption (Recomendado)
- Implementar chaves por campo
- Rotacionar CPF separadamente de RG
- Código: Node.js crypto + Supabase Vault

### Opção 2: Database-level Encryption (Mais Caro)
- Usar Supabase Vault (enterprise feature)
- Rotação automática de chaves
- Custo: ~$500/mês

### Próximas Ações

- [ ] Avaliar opção 1 vs opção 2 com time
- [ ] Estimar custo/benefício
- [ ] Implementar em 2-3 meses
