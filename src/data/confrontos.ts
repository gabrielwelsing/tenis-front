// =============================================================================
// Confrontos divulgados na Home (card do topo), além dos desafios aceitos no app.
// Saem sozinhos 3h depois do horário do jogo.
// =============================================================================

export interface ConfrontoVitrine {
  data: string;     // AAAA-MM-DD
  horario: string;  // HH:MM
  a: string;
  b: string;
  local?: string;
}

export const CONFRONTOS_MANUAIS: ConfrontoVitrine[] = [
  { data: '2026-10-22', horario: '20:00', a: 'Renato', b: 'Igor Pinheiro' },
  { data: '2026-10-25', horario: '08:00', a: 'João Carneiro', b: 'Gustavo Viana' },
  { data: '2026-10-25', horario: '10:00', a: 'Jeff', b: 'Julian' },
];
