import type { DashboardStats } from '@/lib/dashboard/stats'
import { formatCLP } from '@/lib/money'
import { formatDateLine } from '@/lib/venue-slots'

import {
  HEAT_HOURS,
  WEEKDAY_SHORT_ES,
  type VisualReportData,
} from './visual-report-data'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function heatColor(count: number, max: number): string {
  if (count === 0) return '#eef2ef'
  const t = count / max
  if (t < 0.25) return '#c8e6d4'
  if (t < 0.5) return '#7bc9a0'
  if (t < 0.75) return '#2d8a5e'
  return '#064a35'
}

function svgHeatmap(data: VisualReportData): string {
  const cellW = 28
  const cellH = 22
  const left = 36
  const top = 24
  const width = left + HEAT_HOURS.length * cellW + 8
  const height = top + 7 * cellH + 28

  let cells = ''
  for (const cell of data.heatmap) {
    const col = HEAT_HOURS.indexOf(cell.hour)
    if (col < 0) continue
    const x = left + col * cellW
    const y = top + cell.weekday * cellH
    cells += `<rect x="${x}" y="${y}" width="${cellW - 2}" height="${cellH - 2}" rx="3" fill="${heatColor(cell.count, data.heatmapMax)}"/>
      <text x="${x + (cellW - 2) / 2}" y="${y + 14}" text-anchor="middle" font-size="9" fill="${cell.count > data.heatmapMax * 0.5 ? '#fff' : '#3d5248'}">${cell.count || ''}</text>`
  }

  const hourLabels = HEAT_HOURS.map((h, i) => {
    const x = left + i * cellW + (cellW - 2) / 2
    return `<text x="${x}" y="${top - 6}" text-anchor="middle" font-size="9" fill="#5c6f66">${h}</text>`
  }).join('')

  const dayLabels = WEEKDAY_SHORT_ES.map((d, i) => {
    const y = top + i * cellH + 14
    return `<text x="4" y="${y}" font-size="10" fill="#5c6f66">${d}</text>`
  }).join('')

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa de calor">
    ${hourLabels}${dayLabels}${cells}
    <text x="${left}" y="${height - 4}" font-size="9" fill="#8a9a92">Intensidad = reservas por día de semana y hora</text>
  </svg>`
}

function svgBarChart(data: VisualReportData): string {
  const bars = data.dailyBars
  const max = Math.max(...bars.map((b) => b.count), 1)
  const barW = Math.min(32, Math.max(12, 480 / Math.max(bars.length, 1)))
  const chartH = 120
  const left = 8
  const width = left + bars.length * (barW + 4) + 8
  const height = chartH + 36

  const rects = bars
    .map((b, i) => {
      const h = b.count === 0 ? 2 : Math.max(8, (b.count / max) * (chartH - 16))
      const x = left + i * (barW + 4)
      const y = chartH - h
      return `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="#064a35"/>
        <text x="${x + barW / 2}" y="${chartH + 14}" text-anchor="middle" font-size="9" fill="#5c6f66">${esc(b.label)}</text>
        <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="#1a2e24">${b.count || ''}</text>`
    })
    .join('')

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Reservas por día">
    <line x1="${left}" y1="${chartH}" x2="${width - 8}" y2="${chartH}" stroke="#e2e8e4"/>
    ${rects}
  </svg>`
}

function svgStatusDonut(data: VisualReportData): string {
  const { confirmed, pending, cancelled } = data.statusBreakdown
  const total = confirmed + pending + cancelled
  if (total === 0) {
    return `<p style="color:#8a9a92;font-size:13px">Sin reservas en el periodo.</p>`
  }
  const r = 44
  const cx = 56
  const cy = 56
  const circ = 2 * Math.PI * r
  const parts = [
    { n: confirmed, color: '#2d8a5e', label: 'Confirmadas' },
    { n: pending, color: '#e8943a', label: 'Pendientes' },
    { n: cancelled, color: '#c4cec8', label: 'Canceladas' },
  ]
  let offset = 0
  const arcs = parts
    .filter((p) => p.n > 0)
    .map((p) => {
      const len = (p.n / total) * circ
      const dash = `${len} ${circ - len}`
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${p.color}" stroke-width="14"
        stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`
      offset += len
      return el
    })
    .join('')

  const legend = parts
    .map(
      (p) =>
        `<div class="legend-item"><span class="dot" style="background:${p.color}"></span>${p.label}: <strong>${p.n}</strong></div>`
    )
    .join('')

  return `<div class="donut-wrap">
    <svg width="112" height="112" viewBox="0 0 112 112">${arcs}
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#1a2e24">${total}</text>
    </svg>
    <div class="legend">${legend}</div>
  </div>`
}

function svgBoard(data: VisualReportData): string {
  const span = Math.max(data.boardClose - data.boardOpen, 60)
  const rowH = 36
  const labelW = 72
  const trackW = 400
  const width = labelW + trackW + 16
  const height = data.boardCourts.length * rowH + 40

  const ticks = [data.boardOpen, data.boardOpen + span / 2, data.boardClose]
    .map((m) => {
      const h = Math.floor(m / 60)
      const min = m % 60
      const label = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
      const x = labelW + ((m - data.boardOpen) / span) * trackW
      return `<text x="${x}" y="14" font-size="9" fill="#8a9a92">${label}</text>`
    })
    .join('')

  const rows = data.boardCourts
    .map((court, i) => {
      const y = 24 + i * rowH
      const blocks = court.blocks
        .map((b) => {
          const left = ((b.startMin - data.boardOpen) / span) * trackW
          const w = Math.max(((b.endMin - b.startMin) / span) * trackW, 4)
          const fill = b.status === 'confirmed' ? '#2d8a5e' : '#e8943a'
          return `<rect x="${labelW + left}" y="${y + 6}" width="${w}" height="${rowH - 14}" rx="4" fill="${fill}"/>`
        })
        .join('')
      return `<text x="4" y="${y + 22}" font-size="11" fill="#3d5248">${esc(court.name)}</text>
        <rect x="${labelW}" y="${y + 4}" width="${trackW}" height="${rowH - 8}" rx="6" fill="#f4f7f5"/>
        ${blocks}`
    })
    .join('')

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pizarra de ocupación">
    ${ticks}${rows}
  </svg>`
}

function analysisHtml(text: string): string {
  return esc(text)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')
}

export function buildVisualReportHtml(input: {
  venueName: string
  periodLabel: string
  stats: DashboardStats
  visual: VisualReportData
  analysis: string
}): string {
  const { venueName, periodLabel, stats, visual, analysis } = input
  const generated = formatDateLine(new Date())

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Informe ${esc(venueName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a2e24; margin: 0; padding: 24px; background: #fafbfa; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #064a35; }
    h2 { font-size: 15px; margin: 0 0 12px; color: #064a35; text-transform: uppercase; letter-spacing: 0.04em; }
    .meta { color: #5c6f66; font-size: 13px; margin-bottom: 20px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 24px; }
    .kpi { background: #fff; border: 1px solid #e2e8e4; border-radius: 10px; padding: 12px; text-align: center; }
    .kpi strong { display: block; font-size: 22px; color: #064a35; }
    .kpi span { font-size: 11px; color: #8a9a92; text-transform: uppercase; }
    .section { background: #fff; border: 1px solid #e2e8e4; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 640px) { .grid-2 { grid-template-columns: 1fr; } .kpis { grid-template-columns: 1fr; } }
    .analysis p { font-size: 14px; line-height: 1.65; color: #3d5248; margin: 0 0 12px; }
    .donut-wrap { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .legend { font-size: 13px; color: #3d5248; }
    .legend-item { margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .caption { font-size: 11px; color: #8a9a92; margin-top: 8px; }
  </style>
</head>
<body>
  <h1>${esc(venueName)}</h1>
  <p class="meta">Periodo: ${esc(periodLabel)} · Generado ${esc(generated)}</p>

  <div class="kpis">
    <div class="kpi"><strong>${stats.pending}</strong><span>Pendientes</span></div>
    <div class="kpi"><strong>${stats.confirmed}</strong><span>Confirmadas</span></div>
    <div class="kpi"><strong>${stats.occupancy}%</strong><span>Ocupación</span></div>
  </div>
  <p style="margin:0 0 20px;font-size:14px"><strong>Recaudación confirmada:</strong> ${
    stats.hasAnyPrice ? esc(formatCLP(stats.confirmedRevenue)) : '—'
  }</p>

  <div class="grid-2">
    <div class="section">
      <h2>Mapa de calor</h2>
      ${svgHeatmap(visual)}
      <p class="caption">Día de la semana × hora de inicio</p>
    </div>
    <div class="section">
      <h2>Estado de reservas</h2>
      ${svgStatusDonut(visual)}
    </div>
  </div>

  <div class="section">
    <h2>Ritmo del periodo</h2>
    ${svgBarChart(visual)}
  </div>

  <div class="section">
    <h2>Pizarra · ${esc(visual.boardDayLabel)}</h2>
    ${visual.boardCourts.length > 0 ? svgBoard(visual) : '<p class="caption">Sin canchas configuradas.</p>'}
    <p class="caption">Verde = confirmada · Naranja = pendiente</p>
  </div>

  <div class="section analysis">
    <h2>Análisis con IA</h2>
    ${analysisHtml(analysis)}
  </div>
</body>
</html>`
}