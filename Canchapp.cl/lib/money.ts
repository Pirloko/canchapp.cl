/** Montos en CLP — sin decimales, separador de miles chileno. */
export function formatCLP(amount: number): string {
  const rounded = Math.round(amount)
  try {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(rounded)
  } catch {
    const digits = Math.abs(rounded)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    return `${rounded < 0 ? '-' : ''}$${digits}`
  }
}
