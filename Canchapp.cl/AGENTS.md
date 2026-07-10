# Canchapp — guía para agentes

App B2B Expo para **centros deportivos** del ecosistema Sportmatch.

## Contexto

| Archivo | Uso |
|---------|-----|
| `CLAUDE.md` | Reglas duras, stack, prohibiciones |
| `../docs/PLAN-MAESTRO-ECOSISTEMA-SPORTMATCH.md` | Plan ecosistema |
| `../docs/arquitectura/CONTRATO_SUPABASE_Y_API.md` | Contrato Supabase |

## Estructura

```
app/                    # Expo Router (login, tabs, onboarding)
components/ui/          # Design system (Button, Card, Screen, etc.)
lib/
  auth/                 # Sesión, guard venue, redirects
  supabase/             # venue-queries, mutations
  hooks/                # Realtime reservas
```

## Comandos

```bash
npm start
npm run web
npm run typecheck
```

## Convenciones UI

- Tokens en `lib/theme.ts`
- Español en copy
- Web: no `Alert.alert` — usar `ConfirmModal` + `FeedbackBanner`
- Ionicons en tab bar (no emojis)

## Fuera de alcance MVP

BI avanzado, pagos, registro público, admin, migraciones SQL.
