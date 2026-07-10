// Supabase Edge Function — informe de negocio con Claude (API key en secreto del proyecto).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type Payload = {
  venue: {
    id: string
    name: string
    city: string
    courts: number
    slotMinutes: number
  }
  period: 'day' | 'week' | 'month'
  focusDate: string
  stats: {
    pending: number
    confirmed: number
    occupancy: number
    confirmedRevenue: number
    pendingRevenue: number
    hasAnyPrice: boolean
  }
  summary: {
    byStatus: Record<string, number>
    byWeekday: Record<string, number>
    byHour: Record<string, number>
    total: number
  }
  sample: Array<{
    date: string
    hour: number
    status: string
    courtId: string
  }>
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'ANTHROPIC_API_KEY no configurada. Agrégala como secreto en Supabase.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = (await req.json()) as Payload
    const prompt = `Eres un consultor de operaciones para centros deportivos en Chile.
El informe ya incluye visualizaciones generadas por el sistema: mapa de calor (día×hora), gráfico de barras por día, pizarra de canchas y desglose de estados.
NO describas los gráficos línea por línea. Enfócate en interpretación, causas probables y acciones.

Redacta un análisis breve en español (máx. 450 palabras) con:
1. Resumen ejecutivo del periodo
2. Patrones de negocio (días/horarios fuertes o débiles, estacionalidad)
3. Riesgos u oportunidades (pendientes, baja ocupación, cancelaciones, recaudación)
4. 3 recomendaciones concretas y priorizadas para mejora continua

Datos JSON:
${JSON.stringify(body, null, 2)}

Responde solo con el análisis en texto plano, sin JSON ni markdown.`

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // claude-sonnet-4-20250514 fue retirado el 15-jun-2026.
        model: Deno.env.get('ANTHROPIC_MODEL')?.trim() ?? 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      return new Response(
        JSON.stringify({ error: `Claude API: ${errText.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const claudeJson = await claudeRes.json()
    const report =
      claudeJson?.content?.find((c: { type: string }) => c.type === 'text')
        ?.text ?? 'Sin contenido generado.'

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error interno'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
