# Canchapp

App Expo (web + iOS + Android) para **dueños de centros deportivos** del ecosistema Sportmatch.

## Requisitos

- Node.js 20+
- Credenciales del proyecto Supabase Sportmatch

## Configuración

```bash
cp .env.example .env
# Edita EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
```

## Desarrollo

```bash
npm start      # Expo dev server
npm run web    # Solo web
npm run typecheck
```

## Auth

Solo cuentas `account_type = 'venue'`. Jugadores y admin son redirigidos a pantalla de acceso denegado.

## MVP incluido

- Login / logout
- Onboarding centro (`sports_venues`)
- Reservas (listar, confirmar, cancelar, manual, WhatsApp, Realtime)
- Canchas (CRUD + precio)
- Horario semanal
- Perfil + cambio de contraseña

Ver `CLAUDE.md` para reglas de desarrollo con IA.
