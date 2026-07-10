import ExcelJS from 'exceljs'

import { fetchBusinessReport } from '@/lib/dashboard/business-report'
import { formatPeriodNavigatorLabel } from '@/lib/dashboard/period'
import type { ExportContext } from '@/lib/dashboard/export-context'
import {
  HEAT_HOURS,
  WEEKDAY_SHORT_ES,
  buildVisualReportData,
} from '@/lib/dashboard/visual-report-data'
import { formatCLP } from '@/lib/money'
import { formatDateLine, formatTimeRange, toDateInputValue } from '@/lib/venue-slots'

const C_PRIMARY = 'FF064A35'
const C_PRIMARY_MID = 'FF2D8A5E'
const C_PRIMARY_LIGHT = 'FFC8E6D4'
const C_PENDING = 'FFE8943A'
const C_MUTED = 'FF8A9A92'
const C_BG = 'FFF4F7F5'
const C_WHITE = 'FFFFFFFF'

function heatArgb(count: number, max: number): string {
  if (count === 0) return 'FFEEF2EF'
  const t = count / max
  if (t < 0.25) return C_PRIMARY_LIGHT
  if (t < 0.5) return 'FF7BC9A0'
  if (t < 0.75) return C_PRIMARY_MID
  return C_PRIMARY
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: C_WHITE }, size: 11 }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C_PRIMARY },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: C_PRIMARY } },
    }
  })
  row.height = 22
}

function styleTitle(cell: ExcelJS.Cell, text: string) {
  cell.value = text
  cell.font = { bold: true, size: 14, color: { argb: C_PRIMARY } }
}

async function fetchAnalysis(ctx: ExportContext): Promise<string> {
  const result = await fetchBusinessReport({
    venue: ctx.venue,
    courts: ctx.courts,
    reservations: ctx.reservations,
    period: ctx.period,
    focusDate: ctx.focusDate,
    stats: ctx.stats,
  })
  if (result.ok) return result.report
  return `Análisis no disponible: ${result.error}`
}

function addDashboardSheet(
  wb: ExcelJS.Workbook,
  ctx: ExportContext,
  periodLabel: string
) {
  const ws = wb.addWorksheet('Dashboard', {
    views: [{ showGridLines: false }],
  })
  ws.columns = [{ width: 22 }, { width: 28 }, { width: 4 }, { width: 22 }, { width: 28 }]

  styleTitle(ws.getCell('A1'), ctx.venue.name)
  ws.getCell('A2').value = `Periodo: ${periodLabel}`
  ws.getCell('A2').font = { color: { argb: C_MUTED }, size: 11 }
  ws.getCell('A3').value = `Generado: ${formatDateLine(new Date())}`
  ws.getCell('A3').font = { color: { argb: C_MUTED }, size: 11 }

  const kpis = [
    ['Pendientes', ctx.stats.pending],
    ['Confirmadas', ctx.stats.confirmed],
    ['Ocupación', `${ctx.stats.occupancy}%`],
    [
      'Recaudación confirmada',
      ctx.stats.hasAnyPrice ? formatCLP(ctx.stats.confirmedRevenue) : '—',
    ],
    [
      'Por confirmar (est.)',
      ctx.stats.hasAnyPrice ? formatCLP(ctx.stats.pendingRevenue) : '—',
    ],
  ]

  let row = 5
  for (const [label, value] of kpis) {
    const labelCell = ws.getCell(row, 1)
    labelCell.value = label
    labelCell.font = { bold: true, size: 11 }
    labelCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: C_BG },
    }
    const valueCell = ws.getCell(row, 2)
    valueCell.value = value
    valueCell.font = { bold: true, size: 13, color: { argb: C_PRIMARY } }
    row++
  }
}

function addHeatmapSheet(
  wb: ExcelJS.Workbook,
  visual: ReturnType<typeof buildVisualReportData>
) {
  const ws = wb.addWorksheet('Mapa de calor')
  styleTitle(ws.getCell('A1'), 'Reservas por día de semana y hora')

  const header = ws.getRow(3)
  header.getCell(1).value = ''
  HEAT_HOURS.forEach((h, i) => {
    header.getCell(i + 2).value = `${h}:00`
  })
  styleHeader(header)

  for (let wd = 0; wd < 7; wd++) {
    const row = ws.getRow(4 + wd)
    row.getCell(1).value = WEEKDAY_SHORT_ES[wd]
    row.getCell(1).font = { bold: true }
    HEAT_HOURS.forEach((hour, col) => {
      const cell = visual.heatmap.find(
        (c) => c.weekday === wd && c.hour === hour
      )
      const count = cell?.count ?? 0
      const c = row.getCell(col + 2)
      c.value = count || ''
      c.alignment = { horizontal: 'center' }
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: heatArgb(count, visual.heatmapMax) },
      }
      c.font = {
        bold: count > 0,
        color: { argb: count > visual.heatmapMax * 0.5 ? C_WHITE : 'FF3D5248' },
      }
    })
  }

  ws.getColumn(1).width = 10
  HEAT_HOURS.forEach((_, i) => {
    ws.getColumn(i + 2).width = 6
  })
}

function addChartsSheet(
  wb: ExcelJS.Workbook,
  visual: ReturnType<typeof buildVisualReportData>
) {
  const ws = wb.addWorksheet('Gráficos')
  styleTitle(ws.getCell('A1'), 'Ritmo del periodo')

  const header = ws.getRow(3)
  ;['Día', 'Reservas', 'Recaudación (CLP)', ''].forEach((h, i) => {
    header.getCell(i + 1).value = h
  })
  styleHeader(header)

  const maxCount = Math.max(...visual.dailyBars.map((b) => b.count), 1)
  const barStartCol = 5
  const barCols = 20

  visual.dailyBars.forEach((bar, idx) => {
    const row = ws.getRow(4 + idx)
    row.getCell(1).value = bar.label
    row.getCell(2).value = bar.count
    row.getCell(3).value = bar.revenue > 0 ? bar.revenue : ''
    row.getCell(3).numFmt = '#,##0'

    const filled = bar.count === 0 ? 0 : Math.max(1, Math.round((bar.count / maxCount) * barCols))
    for (let i = 0; i < barCols; i++) {
      const cell = row.getCell(barStartCol + i)
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: i < filled ? C_PRIMARY : C_BG },
      }
    }
  })

  ws.getColumn(1).width = 8
  ws.getColumn(2).width = 12
  ws.getColumn(3).width = 18

  const statusRow = 4 + visual.dailyBars.length + 2
  styleTitle(ws.getCell(`A${statusRow}`), 'Estado de reservas')

  const sHeader = ws.getRow(statusRow + 2)
  ;['Estado', 'Cantidad', 'Visual'].forEach((h, i) => {
    sHeader.getCell(i + 1).value = h
  })
  styleHeader(sHeader)

  const { confirmed, pending, cancelled } = visual.statusBreakdown
  const total = confirmed + pending + cancelled || 1
  const statuses = [
    { label: 'Confirmadas', n: confirmed, color: C_PRIMARY_MID },
    { label: 'Pendientes', n: pending, color: C_PENDING },
    { label: 'Canceladas', n: cancelled, color: 'FFC4CEC8' },
  ]

  statuses.forEach((s, i) => {
    const row = ws.getRow(statusRow + 3 + i)
    row.getCell(1).value = s.label
    row.getCell(2).value = s.n
    const width = Math.round((s.n / total) * 30)
    for (let c = 0; c < 30; c++) {
      row.getCell(3 + c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c < width ? s.color : C_BG },
      }
    }
  })
}

function addBoardSheet(
  wb: ExcelJS.Workbook,
  visual: ReturnType<typeof buildVisualReportData>
) {
  const ws = wb.addWorksheet('Pizarra')
  styleTitle(ws.getCell('A1'), `Ocupación · ${visual.boardDayLabel}`)

  const header = ws.getRow(3)
  header.getCell(1).value = 'Cancha'
  header.getCell(2).value = 'Horario'
  header.getCell(3).value = 'Estado'
  styleHeader(header)

  let rowIdx = 4
  for (const court of visual.boardCourts) {
    if (court.blocks.length === 0) {
      const row = ws.getRow(rowIdx++)
      row.getCell(1).value = court.name
      row.getCell(2).value = 'Libre'
      row.getCell(2).font = { color: { argb: C_MUTED } }
      continue
    }
    for (const block of court.blocks) {
      const row = ws.getRow(rowIdx++)
      row.getCell(1).value = court.name
      const h = Math.floor(block.startMin / 60)
      const m = block.startMin % 60
      const he = Math.floor(block.endMin / 60)
      const me = block.endMin % 60
      row.getCell(2).value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} – ${String(he).padStart(2, '0')}:${String(me).padStart(2, '0')}`
      row.getCell(3).value =
        block.status === 'confirmed' ? 'Confirmada' : 'Pendiente'
      row.getCell(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: block.status === 'confirmed' ? C_PRIMARY_MID : C_PENDING,
        },
      }
      row.getCell(3).font = { color: { argb: C_WHITE }, bold: true }
    }
  }

  ws.getColumn(1).width = 16
  ws.getColumn(2).width = 18
  ws.getColumn(3).width = 14
}

function addReservationsSheet(wb: ExcelJS.Workbook, ctx: ExportContext) {
  const ws = wb.addWorksheet('Reservas')
  const header = ws.addRow([
    'Fecha',
    'Horario',
    'Cancha',
    'Estado',
    'Pago',
    'Monto CLP',
    'Notas',
  ])
  styleHeader(header)

  const sorted = [...ctx.reservations].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
  )

  for (const r of sorted) {
    const court = ctx.courtNameById.get(r.courtId) ?? 'Cancha'
    const revenue =
      r.pricePerHour != null
        ? r.pricePerHour *
          ((r.endsAt.getTime() - r.startsAt.getTime()) / 3_600_000)
        : null
    ws.addRow([
      toDateInputValue(r.startsAt),
      formatTimeRange(r.startsAt, r.endsAt),
      court,
      r.status === 'confirmed'
        ? 'Confirmada'
        : r.status === 'pending'
          ? 'Pendiente'
          : 'Cancelada',
      r.paymentStatus === 'paid'
        ? 'Pagada'
        : r.paymentStatus === 'deposit_paid'
          ? 'Abono'
          : 'Sin pago',
      revenue != null ? Math.round(revenue) : '',
      r.notes ?? '',
    ])
  }

  ws.columns = [
    { width: 12 },
    { width: 16 },
    { width: 14 },
    { width: 12 },
    { width: 10 },
    { width: 12 },
    { width: 24 },
  ]
  ws.autoFilter = { from: 'A1', to: 'G1' }
}

function addAnalysisSheet(wb: ExcelJS.Workbook, analysis: string) {
  const ws = wb.addWorksheet('Análisis IA')
  styleTitle(ws.getCell('A1'), 'Análisis con inteligencia artificial')
  ws.getCell('A2').value =
    'Interpretación del periodo, patrones detectados y recomendaciones.'
  ws.getCell('A2').font = { italic: true, color: { argb: C_MUTED }, size: 10 }

  const cell = ws.getCell('A4')
  cell.value = analysis
  cell.alignment = { wrapText: true, vertical: 'top' }
  cell.font = { size: 11 }
  ws.getColumn(1).width = 90
  ws.getRow(4).height = 280
}

export async function buildVisualExcelBuffer(
  ctx: ExportContext
): Promise<ArrayBuffer> {
  const periodLabel = formatPeriodNavigatorLabel(ctx.period, ctx.focusDate)
  const visual = buildVisualReportData({
    reservations: ctx.reservations,
    courts: ctx.courts,
    weeklyHours: ctx.weeklyHours,
    period: ctx.period,
    focusDate: ctx.focusDate,
    focusDayKey: ctx.focusDayKey,
    periodLabel,
  })

  const analysis = await fetchAnalysis(ctx)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Canchapp'
  wb.created = new Date()
  wb.title = `Informe ${ctx.venue.name}`

  addDashboardSheet(wb, ctx, periodLabel)
  addHeatmapSheet(wb, visual)
  addChartsSheet(wb, visual)
  addBoardSheet(wb, visual)
  addReservationsSheet(wb, ctx)
  addAnalysisSheet(wb, analysis)

  const buffer = await wb.xlsx.writeBuffer()
  return buffer as ArrayBuffer
}
