const SPORT_LABELS: Record<string, string> = {
  football: 'Fútbol',
  padel: 'Pádel',
  tennis: 'Tenis',
  basketball: 'Básquetbol',
  volleyball: 'Vóleibol',
}

export function sportLabel(sportId: string): string {
  return (
    SPORT_LABELS[sportId] ??
    sportId.charAt(0).toUpperCase() + sportId.slice(1)
  )
}
