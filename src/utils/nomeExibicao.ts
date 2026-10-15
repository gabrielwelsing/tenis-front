// Nome curto para exibição (saudação, cartão do perfil). Não altera o nome salvo.
// "GABRIEL WELSING FCAMIDU" -> "Gabriel W. Fcamidu"
const MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

function capitalizar(nome: string): string {
  return nome
    .toLowerCase()
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

export function nomeExibicao(nome: string, max = 18): string {
  const limpo = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!limpo) return '';

  // Só corrige caixa quando o nome veio todo em maiúsculas ou todo em minúsculas
  const base = limpo === limpo.toUpperCase() || limpo === limpo.toLowerCase() ? capitalizar(limpo) : limpo;
  if (base.length <= max) return base;

  const partes = base.split(' ').filter(p => !MINUSCULAS.has(p.toLowerCase()));
  if (partes.length < 2) return base;

  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  const meio = partes.slice(1, -1).map(p => p.charAt(0).toUpperCase() + '.');

  const abreviado = [primeiro, ...meio, ultimo].join(' ');
  if (abreviado.length <= max) return abreviado;

  const primeiroUltimo = `${primeiro} ${ultimo}`;
  if (primeiroUltimo.length <= max) return primeiroUltimo;

  return `${primeiro} ${ultimo.charAt(0).toUpperCase()}.`;
}
