# Canchapp — reglas para IA

Producto B2B para **centros deportivos** (`account_type = 'venue'`) del ecosistema Sportmatch.

## Stack

- Expo SDK 57 + Expo Router + TypeScript
- TanStack Query + Supabase JS
- Web + iOS + Android (una codebase)

## Reglas duras

1. **Solo usuarios `venue`** — bloquear `player` y `admin` en auth guard.
2. **Mismo Supabase Sportmatch** — tablas permitidas:
   - `profiles`, `sports_venues`, `venue_courts`, `venue_weekly_hours`, `venue_reservations`
   - Lectura contextual: `match_opportunities`, `profiles` (organizador en reservas)
3. **NO usar** esquema CanchApp-master (`courts`, `bookings`, `facility_name`).
4. **NO service role** en cliente.
5. **NO migraciones SQL** desde este repo (esquema vive en Sportmatch web/Expo).
6. UI y copy en **español**.

## RPCs venue usadas

- `confirm_venue_reservation_as_owner`
- `cancel_venue_reservation_as_owner`

## Alta de centros

No hay registro público. Admin crea cuentas en Sportmatch web (`/api/admin/create-venue-user`) o onboarding si ya es `venue`.

## Comandos

```bash
npm start
npm run web
npx tsc --noEmit
```

## Fuera de alcance MVP

BI avanzado, pagos integrados, registro público de centros, panel admin.
