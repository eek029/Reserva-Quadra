/**
 * Retrieves the current 12x36 Shift according to Sao Paulo Timezone.
 * Shift 1 (Turno Dia): 07:00 to 18:59
 * Shift 2 (Turno Noite): 19:00 to 06:59
 */
export function getTurnoAtual(): 'Turno Dia' | 'Turno Noite' {
    const agora = new Date();

    // Safely extract the hour in America/Sao_Paulo timezone, ignoring server system-time
    const formatter = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: 'numeric',
        hour12: false
    });

    const parts = formatter.formatToParts(agora);
    const hourPart = parts.find(p => p.type === 'hour');
    const horasBRT = hourPart ? parseInt(hourPart.value, 10) : 0;

    if (horasBRT >= 7 && horasBRT < 19) {
        return 'Turno Dia';
    }
    return 'Turno Noite';
}
