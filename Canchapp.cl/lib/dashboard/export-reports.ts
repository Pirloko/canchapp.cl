import * as FileSystem from 'expo-file-system/legacy'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'
import { buildVisualExcelBuffer } from '@/lib/dashboard/export-excel-visual'
import type { ExportContext } from '@/lib/dashboard/export-context'
import { formatPeriodNavigatorLabel } from '@/lib/dashboard/period'
import { reservationRevenue } from '@/lib/dashboard/stats'
import { formatCLP } from '@/lib/money'
import type { VenueReservationRow } from '@/lib/types'
import { formatDateLine, formatTimeRange, toDateInputValue } from '@/lib/venue-slots'

export type { ExportContext } from '@/lib/dashboard/export-context'

function bytesToBase64(bytes: Uint8Array): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0
    const n = (a << 16) | (b << 8) | c
    out += chars[(n >> 18) & 63]
    out += chars[(n >> 12) & 63]
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? chars[n & 63] : '='
  }
  return out
}

function statusLabel(status: VenueReservationRow['status']): string {
  if (status === 'confirmed') return 'Confirmada'
  if (status === 'pending') return 'Pendiente'
  return 'Cancelada'
}

function paymentLabel(
  status: VenueReservationRow['paymentStatus'] | undefined
): string {
  if (status === 'paid') return 'Pagada'
  if (status === 'deposit_paid') return 'Abono'
  return 'Sin pago'
}

function buildRows(ctx: ExportContext) {
  const sorted = [...ctx.reservations].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
  )
  return sorted.map((r) => {
    const revenue = reservationRevenue(r, ctx.courts)
    return {
      Fecha: toDateInputValue(r.startsAt),
      Horario: formatTimeRange(r.startsAt, r.endsAt),
      Cancha: ctx.courtNameById.get(r.courtId) ?? 'Cancha',
      Estado: statusLabel(r.status),
      Pago: paymentLabel(r.paymentStatus),
      'Monto CLP': revenue != null ? Math.round(revenue) : '',
      Notas: r.notes ?? '',
    }
  })
}

function downloadWebBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function shareNativeFile(uri: string, mimeType: string) {
  const canShare = await Sharing.isAvailableAsync()
  if (!canShare) return
  await Sharing.shareAsync(uri, { mimeType, UTI: mimeType })
}

export async function exportDashboardExcel(ctx: ExportContext): Promise<void> {
  const buffer = await buildVisualExcelBuffer(ctx)
  const stamp = toDateInputValue(new Date())
  const filename = `canchapp-${ctx.venue.name.replace(/\s+/g, '-').toLowerCase()}-${stamp}.xlsx`

  if (Platform.OS === 'web') {
    downloadWebBlob(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      filename
    )
    return
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  const base64 =
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(binary)
      : bytesToBase64(bytes)
  const uri = `${FileSystem.cacheDirectory}${filename}`
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  })
  await shareNativeFile(
    uri,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
}

function buildPdfHtml(ctx: ExportContext): string {
  const periodLabel = formatPeriodNavigatorLabel(ctx.period, ctx.focusDate)
  const rows = buildRows(ctx)
  const tableRows = rows
    .map(
      (r) => `<tr>
        <td>${r.Fecha}</td>
        <td>${r.Horario}</td>
        <td>${r.Cancha}</td>
        <td>${r.Estado}</td>
        <td>${r.Pago}</td>
        <td style="text-align:right">${r['Monto CLP']}</td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Informe Canchapp</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a2e24; padding: 32px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .meta { color: #5c6f66; margin-bottom: 24px; }
    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
    .kpi { background: #f4f7f5; border-radius: 10px; padding: 12px 14px; }
    .kpi strong { display: block; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e2e8e4; padding: 8px 6px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #5c6f66; }
  </style>
</head>
<body>
  <h1>${ctx.venue.name}</h1>
  <p class="meta">Periodo: ${periodLabel} · Generado ${formatDateLine(new Date())}</p>
  <div class="kpis">
    <div class="kpi"><strong>${ctx.stats.pending}</strong>Pendientes</div>
    <div class="kpi"><strong>${ctx.stats.confirmed}</strong>Confirmadas</div>
    <div class="kpi"><strong>${ctx.stats.occupancy}%</strong>Ocupación</div>
  </div>
  <p><strong>Recaudación confirmada:</strong> ${
    ctx.stats.hasAnyPrice ? formatCLP(ctx.stats.confirmedRevenue) : '—'
  }</p>
  <h2>Detalle de reservas</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th><th>Horario</th><th>Cancha</th><th>Estado</th><th>Pago</th><th>Monto</th>
      </tr>
    </thead>
    <tbody>${tableRows || '<tr><td colspan="6">Sin reservas en el periodo.</td></tr>'}</tbody>
  </table>
</body>
</html>`
}

export async function exportDashboardPdf(ctx: ExportContext): Promise<void> {
  const html = buildPdfHtml(ctx)
  await exportHtmlAsPdf(html)
}

export async function exportVisualReportPdf(html: string): Promise<void> {
  await exportHtmlAsPdf(html)
}

async function exportHtmlAsPdf(html: string): Promise<void> {
  const stamp = toDateInputValue(new Date())
  const filename = `canchapp-informe-${stamp}.pdf`

  if (Platform.OS === 'web') {
    await Print.printAsync({ html })
    return
  }

  const { uri } = await Print.printToFileAsync({ html })
  await shareNativeFile(uri, 'application/pdf')
}
