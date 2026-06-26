# LGPD Compliance Roadmap

## Status Atual

- ✅ Autenticação & Autorização
- ✅ Criptografia em repouso
- ✅ Logs de auditoria
- ❌ Direito de exclusão (right to be forgotten)
- ❌ Export de dados (right to data portability)
- ❌ Notificação de breach
- ❌ Data Processing Agreement (DPA)

## Tarefas Necessárias

### Sprint 1 (Semanas 1-2): Direito de Exclusão
- [ ] Criar endpoint POST /api/usuarios/[id]/delete-request
- [ ] Validar que usuário é dono da conta
- [ ] Marcar usuário como deleted (soft delete)
- [ ] Agendar exclusão permanente em 30 dias (LGPD requirement)
- [ ] Notificar usuário via email

### Sprint 2 (Semanas 3-4): Export de Dados
- [ ] Criar endpoint POST /api/usuarios/[id]/export-request
- [ ] Gerar JSON com todos dados do usuário
- [ ] Criptografar arquivo
- [ ] Enviar via email

### Sprint 3 (Semanas 5-6): Breach Notification
- [ ] Criar table: breach_notifications
- [ ] Implementar notificação automática se dados vazam
- [ ] Logs de quem acessou que dado

## Referências

- https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd
- https://iapp.org/resources/article/gdpr-101-lgpd-comparison/
