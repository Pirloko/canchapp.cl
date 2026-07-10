-- =============================================================================
-- CENTRO DEPORTIVO (Canchapp.cl) — SQL consolidado
-- =============================================================================
-- Proyecto: SportMatch + Canchapp (misma base de datos Supabase)
-- Generado: 2026-07-09
--
-- PROPÓSITO
--   Inventario único de TODO lo que usa el rol "centro deportivo" (account_type = venue)
--   en la BD compartida. Canchapp.cl consume estas tablas/funciones/policies; SportMatch
--   sigue creando reservas desde el lado jugador y el centro las ve en Canchapp.
--
-- ARQUITECTURA COMPARTIDA
--   SportMatch (jugadores)                    Canchapp (centro deportivo)
--   -------------------------                 -----------------------------
--   book_venue_slot()                         fetchVenueReservationsRange()
--   create_match_opportunity_with_optional_   confirm_venue_reservation_as_owner()
--     reservation()                           cancel_venue_reservation_as_owner()
--   match_opportunities.sports_venue_id       sports_venues / venue_courts / hours
--   venue_reservations (INSERT pending)       venue_reservations (SELECT/UPDATE)
--
-- TABLAS PROPIAS DEL CENTRO
--   profiles.account_type = 'venue'
--   sports_venues, venue_courts, venue_weekly_hours
--   venue_reservations, venue_reservation_events
--   sports_venue_reviews (+ view sports_venue_review_stats)
--
-- TABLAS COMPARTIDAS (solo lectura contextual en Canchapp)
--   profiles (organizador: name, whatsapp_phone)
--   match_opportunities (partido vinculado a reserva)
--   geo_cities / geo_regions / geo_countries (ciudad del centro)
--
-- REALTIME (Supabase)
--   sports_venues, venue_reservations — Canchapp escucha venue_reservations
--
-- ALTA DE CUENTA CENTRO (manual en Supabase hasta tener registro propio)
--   UPDATE public.profiles SET account_type = 'venue' WHERE id = '<auth.users.id>';
--   El usuario luego completa onboarding en Canchapp → INSERT sports_venues.
--
-- NOTA: Este archivo documenta el estado consolidado de migraciones. En producción
--   ya deberían estar aplicadas vía supabase/migrations/*.sql. Úsalo como referencia
--   al separar el acceso centro deportivo de SportMatch.
--
-- INVENTARIO RÁPIDO
--   Enums: account_type, venue_reservation_status, venue_payment_status
--   Tablas: sports_venues, venue_courts, venue_weekly_hours, venue_reservations,
--           venue_reservation_events, sports_venue_reviews, geo_countries/regions/cities
--   Views: sports_venue_review_stats, bi_venue_reservations_fact
--   Funciones clave: is_venue_owner, book_venue_slot,
--     confirm_venue_reservation_as_owner, cancel_venue_reservation_as_owner,
--     confirm_venue_reservation_as_booker, venue_public_reservations_in_range,
--     bi_venue_kpis_snapshot, bi_venue_income_timeseries, bi_venue_courts_breakdown
--   SportMatch escribe reservas vía: book_venue_slot / create_match_opportunity_with_optional_reservation
-- =============================================================================


-- =============================================================================
-- [01/14] PREREQUISITO: set_updated_at()
-- =============================================================================

-- Función auxiliar usada por sports_venues.updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- [02/14] 20250327100000_sports_venues_and_bookings.sql
-- =============================================================================

-- Centros deportivos, canchas, horario semanal, reservas y vinculación opcional a partidos.
-- Cuentas `venue`: solo asignar account_type = 'venue' manualmente en DB / service_role.

CREATE TYPE public.account_type AS ENUM ('player', 'venue');

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type public.account_type NOT NULL DEFAULT 'player';

DROP POLICY IF EXISTS profiles_insert_own_id ON public.profiles;
CREATE POLICY profiles_insert_own_id
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id AND account_type = 'player');

CREATE TYPE public.venue_reservation_status AS ENUM ('confirmed', 'cancelled');

CREATE TABLE public.sports_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  maps_url TEXT,
  phone TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Rancagua',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60
    CHECK (slot_duration_minutes >= 15 AND slot_duration_minutes <= 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sports_venues_owner ON public.sports_venues (owner_id);
CREATE INDEX idx_sports_venues_city ON public.sports_venues (city);

CREATE TRIGGER trg_sports_venues_updated
  BEFORE UPDATE ON public.sports_venues
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.venue_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.sports_venues (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_venue_courts_venue ON public.venue_courts (venue_id);

CREATE TABLE public.venue_weekly_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.sports_venues (id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  UNIQUE (venue_id, day_of_week)
);

ALTER TABLE public.match_opportunities
  ADD COLUMN IF NOT EXISTS sports_venue_id UUID REFERENCES public.sports_venues (id) ON DELETE SET NULL;

CREATE TABLE public.venue_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES public.venue_courts (id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  booker_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  match_opportunity_id UUID REFERENCES public.match_opportunities (id) ON DELETE SET NULL,
  status public.venue_reservation_status NOT NULL DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_reservations_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX idx_venue_reservations_court_time ON public.venue_reservations (court_id, starts_at);
CREATE INDEX idx_venue_reservations_booker ON public.venue_reservations (booker_user_id);
CREATE INDEX idx_venue_reservations_match ON public.venue_reservations (match_opportunity_id);

ALTER TABLE public.match_opportunities
  ADD COLUMN IF NOT EXISTS venue_reservation_id UUID REFERENCES public.venue_reservations (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.venue_reservations_check_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.venue_reservations r
    WHERE r.court_id = NEW.court_id
      AND r.status = 'confirmed'
      AND r.id IS DISTINCT FROM NEW.id
      AND r.starts_at < NEW.ends_at
      AND r.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'venue_reservation_overlap' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_reservations_overlap ON public.venue_reservations;
CREATE TRIGGER trg_venue_reservations_overlap
  BEFORE INSERT OR UPDATE ON public.venue_reservations
  FOR EACH ROW EXECUTE PROCEDURE public.venue_reservations_check_overlap();

CREATE OR REPLACE FUNCTION public.is_venue_owner(p_venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sports_venues v
    WHERE v.id = p_venue_id
      AND v.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_venue_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_venue_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.book_venue_slot(
  p_venue_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court_id uuid;
  v_res_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sports_venues v WHERE v.id = p_venue_id) THEN
    RAISE EXCEPTION 'venue_not_found';
  END IF;

  SELECT c.id INTO v_court_id
  FROM public.venue_courts c
  WHERE c.venue_id = p_venue_id
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_reservations r
      WHERE r.court_id = c.id
        AND r.status = 'confirmed'
        AND r.starts_at < p_ends_at
        AND r.ends_at > p_starts_at
    )
  ORDER BY c.sort_order, c.name, c.id
  LIMIT 1;

  IF v_court_id IS NULL THEN
    RAISE EXCEPTION 'no_court_available';
  END IF;

  INSERT INTO public.venue_reservations (court_id, starts_at, ends_at, booker_user_id, status)
  VALUES (v_court_id, p_starts_at, p_ends_at, auth.uid(), 'confirmed')
  RETURNING id INTO v_res_id;

  RETURN v_res_id;
END;
$$;

REVOKE ALL ON FUNCTION public.book_venue_slot(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_venue_slot(uuid, timestamptz, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.sports_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_weekly_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sports_venues_select_authenticated
  ON public.sports_venues FOR SELECT TO authenticated USING (true);

CREATE POLICY sports_venues_select_anon
  ON public.sports_venues FOR SELECT TO anon USING (true);

CREATE POLICY sports_venues_insert_venue_owner
  ON public.sports_venues FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'venue'
    )
  );

CREATE POLICY sports_venues_update_owner
  ON public.sports_venues FOR UPDATE TO authenticated
  USING (public.is_venue_owner(id))
  WITH CHECK (public.is_venue_owner(id));

CREATE POLICY sports_venues_delete_owner
  ON public.sports_venues FOR DELETE TO authenticated
  USING (public.is_venue_owner(id));

CREATE POLICY venue_courts_select_authenticated
  ON public.venue_courts FOR SELECT TO authenticated USING (true);

CREATE POLICY venue_courts_select_anon
  ON public.venue_courts FOR SELECT TO anon USING (true);

CREATE POLICY venue_courts_write_owner
  ON public.venue_courts FOR ALL TO authenticated
  USING (public.is_venue_owner(venue_id))
  WITH CHECK (public.is_venue_owner(venue_id));

CREATE POLICY venue_weekly_hours_select_authenticated
  ON public.venue_weekly_hours FOR SELECT TO authenticated USING (true);

CREATE POLICY venue_weekly_hours_select_anon
  ON public.venue_weekly_hours FOR SELECT TO anon USING (true);

CREATE POLICY venue_weekly_hours_write_owner
  ON public.venue_weekly_hours FOR ALL TO authenticated
  USING (public.is_venue_owner(venue_id))
  WITH CHECK (public.is_venue_owner(venue_id));

CREATE POLICY venue_reservations_select
  ON public.venue_reservations FOR SELECT TO authenticated
  USING (
    booker_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.venue_courts c
      WHERE c.id = venue_reservations.court_id
        AND public.is_venue_owner(c.venue_id)
    )
  );

CREATE POLICY venue_reservations_update
  ON public.venue_reservations FOR UPDATE TO authenticated
  USING (
    booker_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.venue_courts c
      WHERE c.id = venue_reservations.court_id
        AND public.is_venue_owner(c.venue_id)
    )
  )
  WITH CHECK (true);

CREATE POLICY venue_reservations_delete_owner
  ON public.venue_reservations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.venue_courts c
      WHERE c.id = venue_reservations.court_id
        AND public.is_venue_owner(c.venue_id)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sports_venues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_courts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_weekly_hours TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.venue_reservations TO authenticated;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_venues;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_reservations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- [03/14] 20250327110000_venue_public_reservations_rpc.sql
-- =============================================================================

-- Lectura pública de reservas por rango (solo filas del venue indicado); para huecos en /centro/[id].

CREATE OR REPLACE FUNCTION public.venue_public_reservations_in_range(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  court_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.court_id, r.starts_at, r.ends_at
  FROM public.venue_reservations r
  INNER JOIN public.venue_courts c
    ON c.id = r.court_id AND c.venue_id = p_venue_id
  WHERE r.status = 'confirmed'
    AND r.starts_at < p_to
    AND r.ends_at > p_from;
$$;

REVOKE ALL ON FUNCTION public.venue_public_reservations_in_range(uuid, timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_public_reservations_in_range(uuid, timestamptz, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.venue_public_reservations_in_range(uuid, timestamptz, timestamptz) TO authenticated;

-- =============================================================================
-- [04/14] 20260326200000_venue_reservations_payments_and_history.sql
-- =============================================================================

-- Flujo de pagos para reservas de centros deportivos:
-- - venue_reservations.status: pending | confirmed | cancelled
-- - campos de precio/abono/pago + timestamps + motivo de cancelación
-- - historial (venue_reservation_events)
-- - al cancelar una reserva vinculada a un partido, se cancela el partido con motivo

DO $$
BEGIN
  -- Agregar valor 'pending' al enum si no existe.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'venue_reservation_status'
      AND e.enumlabel = 'pending'
  ) THEN
    ALTER TYPE public.venue_reservation_status ADD VALUE 'pending' BEFORE 'confirmed';
  END IF;
END
$$;

CREATE TYPE public.venue_payment_status AS ENUM ('unpaid', 'deposit_paid', 'paid');

ALTER TABLE public.venue_reservations
  ADD COLUMN IF NOT EXISTS payment_status public.venue_payment_status NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS price_per_hour INTEGER,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS deposit_amount INTEGER,
  ADD COLUMN IF NOT EXISTS paid_amount INTEGER,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;

-- Backfill: si ya están confirmadas, setear timestamp de confirmación.
UPDATE public.venue_reservations
SET confirmed_at = COALESCE(confirmed_at, created_at)
WHERE status = 'confirmed' AND confirmed_at IS NULL;

-- Historial de eventos
CREATE TABLE IF NOT EXISTS public.venue_reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.venue_reservations (id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vre_reservation_id ON public.venue_reservation_events (reservation_id, created_at DESC);

ALTER TABLE public.venue_reservation_events ENABLE ROW LEVEL SECURITY;

-- Solo el dueño del centro (por la cancha) o el booker puede ver el historial.
DROP POLICY IF EXISTS venue_reservation_events_select ON public.venue_reservation_events;
CREATE POLICY venue_reservation_events_select
  ON public.venue_reservation_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.venue_reservations r
      JOIN public.venue_courts c ON c.id = r.court_id
      WHERE r.id = venue_reservation_events.reservation_id
        AND (
          r.booker_user_id = auth.uid()
          OR public.is_venue_owner(c.venue_id)
        )
    )
  );

-- Solo el dueño del centro puede insertar eventos (para logging interno).
DROP POLICY IF EXISTS venue_reservation_events_insert_owner ON public.venue_reservation_events;
CREATE POLICY venue_reservation_events_insert_owner
  ON public.venue_reservation_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.venue_reservations r
      JOIN public.venue_courts c ON c.id = r.court_id
      WHERE r.id = venue_reservation_events.reservation_id
        AND public.is_venue_owner(c.venue_id)
    )
  );

GRANT SELECT, INSERT ON public.venue_reservation_events TO authenticated;

-- Overlap: ahora pending también bloquea (para que no se duplique mientras se paga).
CREATE OR REPLACE FUNCTION public.venue_reservations_check_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.venue_reservations r
    WHERE r.court_id = NEW.court_id
      AND r.status IN ('pending', 'confirmed')
      AND r.id IS DISTINCT FROM NEW.id
      AND r.starts_at < NEW.ends_at
      AND r.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'venue_reservation_overlap' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- Reservar: ahora crea pending (no confirmed)
CREATE OR REPLACE FUNCTION public.book_venue_slot(
  p_venue_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court_id uuid;
  v_res_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sports_venues v WHERE v.id = p_venue_id) THEN
    RAISE EXCEPTION 'venue_not_found';
  END IF;

  SELECT c.id INTO v_court_id
  FROM public.venue_courts c
  WHERE c.venue_id = p_venue_id
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_reservations r
      WHERE r.court_id = c.id
        AND r.status IN ('pending', 'confirmed')
        AND r.starts_at < p_ends_at
        AND r.ends_at > p_starts_at
    )
  ORDER BY c.sort_order, c.name, c.id
  LIMIT 1;

  IF v_court_id IS NULL THEN
    RAISE EXCEPTION 'no_court_available';
  END IF;

  INSERT INTO public.venue_reservations (court_id, starts_at, ends_at, booker_user_id, status, payment_status)
  VALUES (v_court_id, p_starts_at, p_ends_at, auth.uid(), 'pending', 'unpaid')
  RETURNING id INTO v_res_id;

  RETURN v_res_id;
END;
$$;

-- Al cancelar una reserva vinculada a un partido, cancelar el partido (historial para organizador).
CREATE OR REPLACE FUNCTION public.handle_venue_reservation_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'confirmed' AND (OLD.status IS DISTINCT FROM 'confirmed') THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, now());
  END IF;

  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
    IF NEW.match_opportunity_id IS NOT NULL THEN
      UPDATE public.match_opportunities mo
      SET status = 'cancelled',
          suspended_at = now(),
          suspended_reason = COALESCE(NEW.cancelled_reason, 'Reserva cancelada por el centro deportivo')
      WHERE mo.id = NEW.match_opportunity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_venue_reservation_status_change ON public.venue_reservations;
CREATE TRIGGER trg_venue_reservation_status_change
  BEFORE UPDATE ON public.venue_reservations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_venue_reservation_status_change();


-- =============================================================================
-- [05/14] 20260327001000_admin_and_self_confirmed_reservations.sql
-- =============================================================================

-- Admin global + autoconfirmación guiada por organizador/booker.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'account_type'
      AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.account_type ADD VALUE 'admin';
  END IF;
END
$$;

ALTER TABLE public.venue_reservations
  ADD COLUMN IF NOT EXISTS confirmed_by_user_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmation_source TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_note TEXT;

ALTER TABLE public.venue_reservations
  DROP CONSTRAINT IF EXISTS venue_reservations_confirmation_source_check;

ALTER TABLE public.venue_reservations
  ADD CONSTRAINT venue_reservations_confirmation_source_check
  CHECK (
    confirmation_source IS NULL
    OR confirmation_source IN ('venue_owner', 'booker_self', 'admin')
  );

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.account_type::text = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS venue_reservations_select_admin ON public.venue_reservations;
CREATE POLICY venue_reservations_select_admin
  ON public.venue_reservations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS venue_reservations_update_admin ON public.venue_reservations;
CREATE POLICY venue_reservations_update_admin
  ON public.venue_reservations
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================================
-- [06/14] 20260327012000_venue_manual_reservations_insert_policy.sql
-- =============================================================================

-- Permite al dueño del centro ingresar reservas manuales desde dashboard.

DROP POLICY IF EXISTS venue_reservations_insert_owner ON public.venue_reservations;
CREATE POLICY venue_reservations_insert_owner
  ON public.venue_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.venue_courts c
      WHERE c.id = venue_reservations.court_id
        AND public.is_venue_owner(c.venue_id)
    )
  );

GRANT INSERT ON public.venue_reservations TO authenticated;

-- =============================================================================
-- [07/14] 20260329120000_geo_locations.sql
-- =============================================================================

-- ============================================================================
-- Ubicación geográfica (Bloque 1 de N)
--
-- Plan por bloques:
--   1) Esta migración: tablas geo_* + seed Chile → VI Región → Rancagua,
--      columnas city_id + backfill + RLS + default para nuevas filas.
--   2) App: tipos, queries Supabase, leer catálogo en cliente.
--   3) UI: selects encadenados (de momento solo Rancagua visible / deshabilitado).
--   4) Admin: API + pantalla para alta país/región/ciudad.
--   5) Filtros por city_id del perfil; opcional retirar columna city TEXT antigua.
--
-- De momento solo existe un país (CL), una región (VI) y una ciudad (Rancagua).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo
-- ---------------------------------------------------------------------------
CREATE TABLE public.geo_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iso_code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_countries_iso_code_lower CHECK (iso_code = lower(iso_code)),
  CONSTRAINT geo_countries_iso_code_len CHECK (char_length(iso_code) = 2)
);

CREATE UNIQUE INDEX geo_countries_iso_code_key ON public.geo_countries (iso_code);

CREATE TABLE public.geo_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id UUID NOT NULL REFERENCES public.geo_countries (id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_regions_code_upper CHECK (code = upper(code))
);

CREATE UNIQUE INDEX geo_regions_country_code_key ON public.geo_regions (country_id, code);

CREATE INDEX idx_geo_regions_country ON public.geo_regions (country_id);

CREATE TABLE public.geo_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES public.geo_regions (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT geo_cities_slug_lower CHECK (slug = lower(slug))
);

CREATE UNIQUE INDEX geo_cities_region_slug_key ON public.geo_cities (region_id, slug);

CREATE INDEX idx_geo_cities_region ON public.geo_cities (region_id);

-- Seed: Chile, VI Región, Rancagua
INSERT INTO public.geo_countries (iso_code, name, is_active)
VALUES ('cl', 'Chile', true);

INSERT INTO public.geo_regions (country_id, code, name, is_active)
SELECT c.id, 'VI', 'Región del Libertador General Bernardo O''Higgins', true
FROM public.geo_countries c
WHERE c.iso_code = 'cl';

INSERT INTO public.geo_cities (region_id, name, slug, is_active)
SELECT r.id, 'Rancagua', 'rancagua', true
FROM public.geo_regions r
JOIN public.geo_countries c ON c.id = r.country_id
WHERE c.iso_code = 'cl' AND r.code = 'VI';

-- Ciudad por defecto (nuevas filas hasta que la app envíe otro city_id)
CREATE OR REPLACE FUNCTION public.default_geo_city_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.id
  FROM public.geo_cities c
  INNER JOIN public.geo_regions r ON r.id = c.region_id
  INNER JOIN public.geo_countries co ON co.id = r.country_id
  WHERE co.iso_code = 'cl'
    AND r.code = 'VI'
    AND c.slug = 'rancagua'
    AND c.is_active
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.default_geo_city_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.default_geo_city_id() TO authenticated, anon;

-- ---------------------------------------------------------------------------
-- FKs en tablas de negocio (conviven con city TEXT hasta Bloque 5)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities (id) ON DELETE RESTRICT;

ALTER TABLE public.sports_venues
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities (id) ON DELETE RESTRICT;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities (id) ON DELETE RESTRICT;

ALTER TABLE public.match_opportunities
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.geo_cities (id) ON DELETE RESTRICT;

UPDATE public.profiles SET city_id = public.default_geo_city_id() WHERE city_id IS NULL;
UPDATE public.sports_venues SET city_id = public.default_geo_city_id() WHERE city_id IS NULL;
UPDATE public.teams SET city_id = public.default_geo_city_id() WHERE city_id IS NULL;
UPDATE public.match_opportunities SET city_id = public.default_geo_city_id() WHERE city_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN city_id SET NOT NULL,
  ALTER COLUMN city_id SET DEFAULT public.default_geo_city_id();

ALTER TABLE public.sports_venues
  ALTER COLUMN city_id SET NOT NULL,
  ALTER COLUMN city_id SET DEFAULT public.default_geo_city_id();

ALTER TABLE public.teams
  ALTER COLUMN city_id SET NOT NULL,
  ALTER COLUMN city_id SET DEFAULT public.default_geo_city_id();

ALTER TABLE public.match_opportunities
  ALTER COLUMN city_id SET NOT NULL,
  ALTER COLUMN city_id SET DEFAULT public.default_geo_city_id();

CREATE INDEX IF NOT EXISTS idx_profiles_city_id ON public.profiles (city_id);
CREATE INDEX IF NOT EXISTS idx_sports_venues_city_id ON public.sports_venues (city_id);
CREATE INDEX IF NOT EXISTS idx_teams_city_id ON public.teams (city_id);
CREATE INDEX IF NOT EXISTS idx_match_opportunities_city_id ON public.match_opportunities (city_id);
CREATE INDEX IF NOT EXISTS idx_match_opportunities_city_id_time
  ON public.match_opportunities (city_id, date_time);

-- ---------------------------------------------------------------------------
-- RLS: lectura pública del catálogo; mutación solo admin (listo para Bloque 4)
-- ---------------------------------------------------------------------------
ALTER TABLE public.geo_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY geo_countries_select_all
  ON public.geo_countries FOR SELECT
  USING (true);

CREATE POLICY geo_regions_select_all
  ON public.geo_regions FOR SELECT
  USING (true);

CREATE POLICY geo_cities_select_all
  ON public.geo_cities FOR SELECT
  USING (true);

CREATE POLICY geo_countries_admin_insert
  ON public.geo_countries FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY geo_countries_admin_update
  ON public.geo_countries FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY geo_countries_admin_delete
  ON public.geo_countries FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY geo_regions_admin_insert
  ON public.geo_regions FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY geo_regions_admin_update
  ON public.geo_regions FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY geo_regions_admin_delete
  ON public.geo_regions FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY geo_cities_admin_insert
  ON public.geo_cities FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY geo_cities_admin_update
  ON public.geo_cities FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY geo_cities_admin_delete
  ON public.geo_cities FOR DELETE TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.geo_countries TO anon;
GRANT SELECT ON public.geo_regions TO anon;
GRANT SELECT ON public.geo_cities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_countries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_regions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_cities TO authenticated;
GRANT ALL ON public.geo_countries TO service_role;
GRANT ALL ON public.geo_regions TO service_role;
GRANT ALL ON public.geo_cities TO service_role;

-- =============================================================================
-- [08/14] 20260329160000_court_price_per_hour.sql
-- =============================================================================

-- Precio por hora (CLP) por cancha; se copia a venue_reservations al reservar vía RPC.

ALTER TABLE public.venue_courts
  ADD COLUMN IF NOT EXISTS price_per_hour INTEGER;

ALTER TABLE public.venue_courts
  DROP CONSTRAINT IF EXISTS venue_courts_price_per_hour_nonneg;

ALTER TABLE public.venue_courts
  ADD CONSTRAINT venue_courts_price_per_hour_nonneg CHECK (
    price_per_hour IS NULL OR price_per_hour >= 0
  );

COMMENT ON COLUMN public.venue_courts.price_per_hour IS
  'Precio por hora en CLP (opcional). Se guarda en venue_reservations al crear la reserva.';

-- Participantes del partido pueden leer la reserva vinculada (costo / reparto).
DROP POLICY IF EXISTS venue_reservations_select_match_participant ON public.venue_reservations;
CREATE POLICY venue_reservations_select_match_participant
  ON public.venue_reservations FOR SELECT TO authenticated
  USING (
    match_opportunity_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.match_opportunity_participants p
      WHERE p.opportunity_id = venue_reservations.match_opportunity_id
        AND p.user_id = auth.uid()
        AND p.status IN ('pending', 'confirmed')
    )
  );

CREATE OR REPLACE FUNCTION public.book_venue_slot(
  p_venue_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_court_id uuid;
  v_res_id uuid;
  v_price integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.sports_venues v WHERE v.id = p_venue_id) THEN
    RAISE EXCEPTION 'venue_not_found';
  END IF;

  SELECT c.id, c.price_per_hour INTO v_court_id, v_price
  FROM public.venue_courts c
  WHERE c.venue_id = p_venue_id
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_reservations r
      WHERE r.court_id = c.id
        AND r.status IN ('pending', 'confirmed')
        AND r.starts_at < p_ends_at
        AND r.ends_at > p_starts_at
    )
  ORDER BY c.sort_order, c.name, c.id
  LIMIT 1;

  IF v_court_id IS NULL THEN
    RAISE EXCEPTION 'no_court_available';
  END IF;

  INSERT INTO public.venue_reservations (
    court_id,
    starts_at,
    ends_at,
    booker_user_id,
    status,
    payment_status,
    price_per_hour,
    currency
  )
  VALUES (
    v_court_id,
    p_starts_at,
    p_ends_at,
    auth.uid(),
    'pending',
    'unpaid',
    v_price,
    'CLP'
  )
  RETURNING id INTO v_res_id;

  RETURN v_res_id;
END;
$$;

-- =============================================================================
-- [09/14] 20260408130000_venue_reservation_rpcs.sql
-- =============================================================================

-- RPCs para mutaciones críticas de reservas (Fase 4):
-- - confirmar/cancelar por dueño del centro
-- - confirmar por el booker (autoconfirmación)

CREATE OR REPLACE FUNCTION public.confirm_venue_reservation_as_owner(
  p_reservation_id uuid,
  p_mark_paid boolean DEFAULT true,
  p_note text DEFAULT 'Confirmada por centro deportivo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT c.venue_id INTO v_venue_id
  FROM public.venue_reservations r
  JOIN public.venue_courts c ON c.id = r.court_id
  WHERE r.id = p_reservation_id;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;

  IF NOT public.is_venue_owner(v_venue_id) THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.venue_reservations
  SET status = 'confirmed',
      payment_status = CASE WHEN p_mark_paid THEN 'paid'::public.venue_payment_status ELSE payment_status END,
      confirmation_source = 'venue_owner',
      confirmed_by_user_id = auth.uid(),
      confirmation_note = COALESCE(NULLIF(TRIM(p_note), ''), 'Confirmada por centro deportivo'),
      confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = p_reservation_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_venue_reservation_as_owner(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_venue_reservation_as_owner(uuid, boolean, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.cancel_venue_reservation_as_owner(
  p_reservation_id uuid,
  p_reason text DEFAULT 'Cancelada por el centro deportivo'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id uuid;
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT c.venue_id INTO v_venue_id
  FROM public.venue_reservations r
  JOIN public.venue_courts c ON c.id = r.court_id
  WHERE r.id = p_reservation_id;

  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'reservation_not_found';
  END IF;

  IF NOT public.is_venue_owner(v_venue_id) THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_reason := COALESCE(NULLIF(TRIM(p_reason), ''), 'Cancelada por el centro deportivo');

  UPDATE public.venue_reservations
  SET status = 'cancelled',
      cancelled_reason = v_reason,
      cancelled_at = COALESCE(cancelled_at, now())
  WHERE id = p_reservation_id;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_venue_reservation_as_owner(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_venue_reservation_as_owner(uuid, text) TO authenticated;


CREATE OR REPLACE FUNCTION public.confirm_venue_reservation_as_booker(
  p_reservation_id uuid,
  p_note text DEFAULT 'Confirmada por organizador en flujo guiado',
  p_mark_paid boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booker_id uuid;
  v_note text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT r.booker_user_id INTO v_booker_id
  FROM public.venue_reservations r
  WHERE r.id = p_reservation_id;

  IF v_booker_id IS NULL THEN
    -- Incluye caso reserva no existe o no tiene booker: ambos son no autorizados.
    RAISE EXCEPTION 'not_booker' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_booker_id <> auth.uid() THEN
    RAISE EXCEPTION 'not_booker' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_note := COALESCE(NULLIF(TRIM(p_note), ''), 'Confirmada por organizador en flujo guiado');

  UPDATE public.venue_reservations
  SET status = 'confirmed',
      payment_status = CASE WHEN p_mark_paid THEN 'paid'::public.venue_payment_status ELSE payment_status END,
      confirmation_source = 'booker_self',
      confirmed_by_user_id = auth.uid(),
      confirmation_note = v_note,
      confirmed_at = COALESCE(confirmed_at, now())
  WHERE id = p_reservation_id
    AND booker_user_id = auth.uid();

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_venue_reservation_as_booker(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_venue_reservation_as_booker(uuid, text, boolean) TO authenticated;


-- =============================================================================
-- [10/14] 20260412120000_sports_venues_is_paused.sql
-- =============================================================================

-- Ocultar centros en exploración pública sin borrarlos (panel admin: pausar / reactivar).

ALTER TABLE public.sports_venues
  ADD COLUMN IF NOT EXISTS is_paused BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.sports_venues.is_paused IS
  'Si true, el centro no se lista en exploración ni páginas públicas de jugadores.';

-- =============================================================================
-- [11/14] 20260429200000_sports_venue_reviews.sql
-- =============================================================================

-- Reseñas de jugadores a centros deportivos (solo reservas cancha sin partido).

CREATE TABLE public.sports_venue_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.sports_venues (id) ON DELETE CASCADE,
  venue_reservation_id UUID NOT NULL REFERENCES public.venue_reservations (id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  court_quality SMALLINT NOT NULL CHECK (court_quality >= 1 AND court_quality <= 5),
  management_rating SMALLINT NOT NULL CHECK (management_rating >= 1 AND management_rating <= 5),
  facilities_rating SMALLINT NOT NULL CHECK (facilities_rating >= 1 AND facilities_rating <= 5),
  comment TEXT,
  reviewer_name_snapshot TEXT NOT NULL CHECK (
    char_length(trim(reviewer_name_snapshot)) >= 1
    AND char_length(reviewer_name_snapshot) <= 80
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sports_venue_reviews_one_per_reservation UNIQUE (venue_reservation_id)
);

CREATE INDEX idx_sports_venue_reviews_venue ON public.sports_venue_reviews (venue_id);
CREATE INDEX idx_sports_venue_reviews_created ON public.sports_venue_reviews (venue_id, created_at DESC);

COMMENT ON TABLE public.sports_venue_reviews IS
  'Opiniones de jugadores tras reservar solo cancha; una fila por reserva.';

-- Agregados para ficha pública (lectura anon).
CREATE OR REPLACE VIEW public.sports_venue_review_stats AS
SELECT
  venue_id,
  count(*)::integer AS review_count,
  round(avg(court_quality)::numeric, 1) AS avg_court_quality,
  round(avg(management_rating)::numeric, 1) AS avg_management,
  round(avg(facilities_rating)::numeric, 1) AS avg_facilities,
  round(
    (
      avg(court_quality) + avg(management_rating) + avg(facilities_rating)
    )::numeric / 3,
    1
  ) AS avg_overall
FROM public.sports_venue_reviews
GROUP BY venue_id;

ALTER TABLE public.sports_venue_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY sports_venue_reviews_select_public
  ON public.sports_venue_reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY sports_venue_reviews_insert_booker
  ON public.sports_venue_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.venue_reservations vr
      INNER JOIN public.venue_courts vc ON vc.id = vr.court_id
      WHERE vr.id = sports_venue_reviews.venue_reservation_id
        AND vr.booker_user_id = auth.uid()
        AND vr.match_opportunity_id IS NULL
        AND vr.status = 'confirmed'
        AND vc.venue_id = sports_venue_reviews.venue_id
        AND vr.ends_at < now()
    )
  );

GRANT SELECT ON public.sports_venue_reviews TO anon, authenticated;
GRANT INSERT ON public.sports_venue_reviews TO authenticated;
GRANT SELECT ON public.sports_venue_review_stats TO anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'sports_venue_reviews'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_venue_reviews;
  END IF;
END $$;

-- =============================================================================
-- [12/14] 20260431180000_sync_reservation_price_when_court_price_updates.sql
-- =============================================================================

-- Al cambiar el precio por hora de una cancha, propagar a reservas activas
-- (pendientes o confirmadas cuyo turno aún no terminó), para que el panel
-- del centro y los partidos vinculados muestren el valor vigente.

CREATE OR REPLACE FUNCTION public.sync_future_reservations_price_from_court()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.price_per_hour IS DISTINCT FROM OLD.price_per_hour) THEN
    UPDATE public.venue_reservations r
    SET price_per_hour = NEW.price_per_hour
    WHERE r.court_id = NEW.id
      AND r.status IN (
        'pending'::public.venue_reservation_status,
        'confirmed'::public.venue_reservation_status
      )
      AND r.ends_at > now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_future_reservations_price_from_court() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_venue_courts_price_sync_future_reservations ON public.venue_courts;

CREATE TRIGGER trg_venue_courts_price_sync_future_reservations
  AFTER UPDATE OF price_per_hour ON public.venue_courts
  FOR EACH ROW
  EXECUTE PROCEDURE public.sync_future_reservations_price_from_court();

COMMENT ON FUNCTION public.sync_future_reservations_price_from_court IS
  'Copia el nuevo price_per_hour de venue_courts a venue_reservations futuras al editar tarifa.';

-- Alinear datos ya existentes: reservas no finalizadas con el precio actual de la cancha.
UPDATE public.venue_reservations r
SET price_per_hour = c.price_per_hour
FROM public.venue_courts c
WHERE r.court_id = c.id
  AND r.status IN (
    'pending'::public.venue_reservation_status,
    'confirmed'::public.venue_reservation_status
  )
  AND r.ends_at > now()
  AND (r.price_per_hour IS DISTINCT FROM c.price_per_hour);

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- [13/14] 20260428120000_bi_kpis_avg_ticket_align_revenue.sql
-- =============================================================================

-- Ticket promedio alineado con ingreso cobrado: ingreso total / nº de reservas que aportan a ese ingreso
-- (misma condición que el SUM de revenue: no cancelada y paid | deposit_paid).

CREATE OR REPLACE FUNCTION public.bi_venue_kpis_snapshot(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text DEFAULT 'America/Santiago'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration_seconds numeric := GREATEST(EXTRACT(EPOCH FROM (p_to - p_from)), 1);
  v_prev_from timestamptz := p_from - (p_to - p_from);
  v_prev_to timestamptz := p_from;
  v_venue_exists boolean;
  v_courts_count int := 0;
  v_open_minutes numeric := 0;
  v_open_hours numeric := 0;
  v_booked_minutes_confirmed numeric := 0;
  v_booked_minutes_operational numeric := 0;
  v_reservations_total int := 0;
  v_reservations_confirmed int := 0;
  v_reservations_cancelled int := 0;
  v_revenue bigint := 0;
  v_reservations_with_collected_revenue int := 0;
  v_revenue_prev bigint := 0;
  v_ticket_avg numeric := 0;
  v_cancel_rate numeric := 0;
  v_revpath numeric := 0;
  v_occupancy_confirmed numeric := 0;
  v_occupancy_operational numeric := 0;
  v_recurrent_clients int := 0;
  v_peak_hour int := null;
  v_peak_count int := 0;
  v_valley_hour int := null;
  v_valley_count int := 0;
  v_alerts jsonb := '[]'::jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.sports_venues sv
    WHERE sv.id = p_venue_id
  )
  INTO v_venue_exists;
  IF NOT v_venue_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'venue_not_found');
  END IF;

  SELECT COUNT(*)
  INTO v_courts_count
  FROM public.venue_courts vc
  WHERE vc.venue_id = p_venue_id;

  WITH scoped AS (
    SELECT
      f.*,
      EXTRACT(
        EPOCH FROM (
          LEAST(f.ends_at, p_to) - GREATEST(f.starts_at, p_from)
        )
      ) / 60.0 AS overlap_minutes
    FROM public.bi_venue_reservations_fact f
    WHERE f.sports_venue_id = p_venue_id
      AND f.starts_at < p_to
      AND f.ends_at > p_from
  ),
  open_minutes_calc AS (
    SELECT COALESCE(
      SUM(
        GREATEST(
          EXTRACT(
            EPOCH FROM (
              (d.d::date + wh.close_time) -
              (d.d::date + wh.open_time)
            )
          ) / 60.0,
          0
        )
      ),
      0
    ) * GREATEST(v_courts_count, 0) AS minutes_open
    FROM generate_series(
      date_trunc('day', timezone(p_tz, p_from))::date,
      date_trunc('day', timezone(p_tz, p_to))::date,
      interval '1 day'
    ) AS d(d)
    JOIN public.venue_weekly_hours wh
      ON wh.venue_id = p_venue_id
     AND wh.day_of_week = EXTRACT(DOW FROM d.d::date)::int
  ),
  peak_valley AS (
    SELECT
      hour_local,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_count
    FROM (
      SELECT
        EXTRACT(HOUR FROM timezone(p_tz, starts_at))::int AS hour_local,
        status
      FROM scoped
    ) x
    GROUP BY hour_local
  )
  SELECT
    COALESCE((SELECT minutes_open FROM open_minutes_calc), 0),
    COALESCE(SUM(CASE WHEN status = 'confirmed' THEN overlap_minutes ELSE 0 END), 0),
    COALESCE(
      SUM(
        CASE
          WHEN status IN ('pending', 'confirmed')
          THEN overlap_minutes
          ELSE 0
        END
      ),
      0
    ),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'confirmed')::int,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int,
    COALESCE(
      SUM(
        CASE
          WHEN status <> 'cancelled'
           AND payment_status IN ('paid', 'deposit_paid')
          THEN amount_effective
          ELSE 0
        END
      ),
      0
    )::bigint,
    COUNT(*) FILTER (
      WHERE status <> 'cancelled'
        AND payment_status IN ('paid', 'deposit_paid')
    )::int,
    COALESCE(
      (
        SELECT hour_local
        FROM peak_valley
        ORDER BY confirmed_count DESC, hour_local ASC
        LIMIT 1
      ),
      null
    ),
    COALESCE(
      (
        SELECT confirmed_count
        FROM peak_valley
        ORDER BY confirmed_count DESC, hour_local ASC
        LIMIT 1
      ),
      0
    ),
    COALESCE(
      (
        SELECT hour_local
        FROM peak_valley
        ORDER BY confirmed_count ASC, hour_local ASC
        LIMIT 1
      ),
      null
    ),
    COALESCE(
      (
        SELECT confirmed_count
        FROM peak_valley
        ORDER BY confirmed_count ASC, hour_local ASC
        LIMIT 1
      ),
      0
    )
  INTO
    v_open_minutes,
    v_booked_minutes_confirmed,
    v_booked_minutes_operational,
    v_reservations_total,
    v_reservations_confirmed,
    v_reservations_cancelled,
    v_revenue,
    v_reservations_with_collected_revenue,
    v_peak_hour,
    v_peak_count,
    v_valley_hour,
    v_valley_count
  FROM scoped;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN f.status <> 'cancelled'
         AND f.payment_status IN ('paid', 'deposit_paid')
        THEN f.amount_effective
        ELSE 0
      END
    ),
    0
  )::bigint
  INTO v_revenue_prev
  FROM public.bi_venue_reservations_fact f
  WHERE f.sports_venue_id = p_venue_id
    AND f.starts_at < v_prev_to
    AND f.ends_at > v_prev_from;

  SELECT COUNT(*)::int
  INTO v_recurrent_clients
  FROM (
    SELECT f.booker_user_id
    FROM public.bi_venue_reservations_fact f
    WHERE f.sports_venue_id = p_venue_id
      AND f.starts_at < p_to
      AND f.ends_at > p_from
      AND f.status = 'confirmed'
      AND f.booker_user_id IS NOT NULL
    GROUP BY f.booker_user_id
    HAVING COUNT(*) >= 2
  ) recurring;

  v_open_hours := v_open_minutes / 60.0;
  v_ticket_avg := CASE
    WHEN v_reservations_with_collected_revenue > 0
    THEN v_revenue::numeric / v_reservations_with_collected_revenue::numeric
    ELSE 0
  END;
  v_cancel_rate := CASE
    WHEN v_reservations_total > 0
    THEN (v_reservations_cancelled::numeric / v_reservations_total::numeric) * 100.0
    ELSE 0
  END;
  v_revpath := CASE
    WHEN v_open_hours > 0
    THEN v_revenue::numeric / v_open_hours
    ELSE 0
  END;
  v_occupancy_confirmed := CASE
    WHEN v_open_minutes > 0
    THEN (v_booked_minutes_confirmed / v_open_minutes) * 100.0
    ELSE 0
  END;
  v_occupancy_operational := CASE
    WHEN v_open_minutes > 0
    THEN (v_booked_minutes_operational / v_open_minutes) * 100.0
    ELSE 0
  END;

  IF v_occupancy_confirmed < 35 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'low_occupancy',
      'severity', 'warning',
      'message', 'Ocupación baja en el periodo. Considera promociones o ajustes de precio.'
    );
  END IF;
  IF v_cancel_rate > 20 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'high_cancellation',
      'severity', 'warning',
      'message', 'Tasa de cancelación alta. Revisa confirmaciones y recordatorios.'
    );
  END IF;
  IF v_valley_hour IS NOT NULL AND v_peak_hour IS NOT NULL AND v_valley_hour <> v_peak_hour THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'valley_window',
      'severity', 'info',
      'message',
      format(
        'Baja actividad cerca de %s:00 versus peak %s:00. Evalúa campañas horarias.',
        lpad(v_valley_hour::text, 2, '0'),
        lpad(v_peak_hour::text, 2, '0')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'meta', jsonb_build_object(
      'venueId', p_venue_id,
      'from', p_from,
      'to', p_to,
      'timezone', p_tz,
      'durationDays', ROUND(v_duration_seconds / 86400.0, 2)
    ),
    'kpis', jsonb_build_object(
      'occupancyConfirmedPct', ROUND(v_occupancy_confirmed, 2),
      'occupancyOperationalPct', ROUND(v_occupancy_operational, 2),
      'deadHours', ROUND(GREATEST(v_open_hours - (v_booked_minutes_confirmed / 60.0), 0), 2),
      'revenueTotal', v_revenue,
      'revPath', ROUND(v_revpath, 2),
      'avgTicket', ROUND(v_ticket_avg, 2),
      'cancellationRatePct', ROUND(v_cancel_rate, 2),
      'reservationsTotal', v_reservations_total,
      'reservationsConfirmed', v_reservations_confirmed,
      'reservationsCancelled', v_reservations_cancelled,
      'peakHour', v_peak_hour,
      'peakCount', v_peak_count,
      'valleyHour', v_valley_hour,
      'valleyCount', v_valley_count,
      'recurringClients', v_recurrent_clients,
      'openHours', ROUND(v_open_hours, 2)
    ),
    'comparative', jsonb_build_object(
      'previousRevenueTotal', v_revenue_prev,
      'revenueDeltaAbs', v_revenue - v_revenue_prev,
      'revenueDeltaPct',
      CASE
        WHEN v_revenue_prev > 0
        THEN ROUND(((v_revenue - v_revenue_prev)::numeric / v_revenue_prev::numeric) * 100.0, 2)
        WHEN v_revenue > 0 THEN 100
        ELSE 0
      END
    ),
    'alerts', v_alerts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bi_venue_kpis_snapshot(uuid, timestamptz, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- [14/14] 20260502120000_venue_bi_dashboard_block1.sql
-- =============================================================================

-- BI bloque 1 para dashboard de centro deportivo (single venue con múltiples canchas)

CREATE OR REPLACE VIEW public.bi_venue_reservations_fact AS
SELECT
  r.id,
  c.venue_id AS sports_venue_id,
  r.court_id,
  c.name AS court_name,
  r.starts_at,
  r.ends_at,
  r.status,
  r.payment_status,
  r.booker_user_id,
  r.match_opportunity_id,
  COALESCE(r.paid_amount, r.deposit_amount, r.price_per_hour, 0) AS amount_effective,
  EXTRACT(EPOCH FROM (r.ends_at - r.starts_at)) / 60.0 AS reserved_minutes
FROM public.venue_reservations r
JOIN public.venue_courts c ON c.id = r.court_id;

COMMENT ON VIEW public.bi_venue_reservations_fact IS
  'Hechos de reservas por centro/cancha con monto efectivo normalizado para BI.';

CREATE INDEX IF NOT EXISTS idx_venue_courts_venue_id_id
  ON public.venue_courts (venue_id, id);

CREATE INDEX IF NOT EXISTS idx_venue_reservations_court_starts_ends
  ON public.venue_reservations (court_id, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_venue_reservations_status_starts
  ON public.venue_reservations (status, starts_at);

CREATE INDEX IF NOT EXISTS idx_venue_reservations_payment_status_starts
  ON public.venue_reservations (payment_status, starts_at);

CREATE INDEX IF NOT EXISTS idx_venue_reservations_booker_starts
  ON public.venue_reservations (booker_user_id, starts_at);

CREATE OR REPLACE FUNCTION public.bi_venue_income_timeseries(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text DEFAULT 'America/Santiago'
)
RETURNS TABLE (
  bucket_date date,
  revenue_collected bigint,
  reservations_confirmed int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH buckets AS (
    SELECT generate_series(
      date_trunc('day', timezone(p_tz, p_from)),
      date_trunc('day', timezone(p_tz, p_to)),
      interval '1 day'
    )::date AS bucket_date
  ),
  scoped AS (
    SELECT
      timezone(p_tz, f.starts_at)::date AS local_date,
      f.amount_effective,
      f.status,
      f.payment_status
    FROM public.bi_venue_reservations_fact f
    WHERE f.sports_venue_id = p_venue_id
      AND f.starts_at < p_to
      AND f.ends_at > p_from
  )
  SELECT
    b.bucket_date,
    COALESCE(
      SUM(
        CASE
          WHEN s.status <> 'cancelled'
           AND s.payment_status IN ('paid', 'deposit_paid')
          THEN s.amount_effective
          ELSE 0
        END
      ),
      0
    )::bigint AS revenue_collected,
    COALESCE(
      COUNT(*) FILTER (WHERE s.status = 'confirmed'),
      0
    )::int AS reservations_confirmed
  FROM buckets b
  LEFT JOIN scoped s ON s.local_date = b.bucket_date
  GROUP BY b.bucket_date
  ORDER BY b.bucket_date;
$$;

CREATE OR REPLACE FUNCTION public.bi_venue_courts_breakdown(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS TABLE (
  court_id uuid,
  court_name text,
  reservations_total int,
  reservations_confirmed int,
  reservations_cancelled int,
  revenue_collected bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.court_id,
    MIN(f.court_name)::text AS court_name,
    COUNT(*)::int AS reservations_total,
    COUNT(*) FILTER (WHERE f.status = 'confirmed')::int AS reservations_confirmed,
    COUNT(*) FILTER (WHERE f.status = 'cancelled')::int AS reservations_cancelled,
    COALESCE(
      SUM(
        CASE
          WHEN f.status <> 'cancelled'
           AND f.payment_status IN ('paid', 'deposit_paid')
          THEN f.amount_effective
          ELSE 0
        END
      ),
      0
    )::bigint AS revenue_collected
  FROM public.bi_venue_reservations_fact f
  WHERE f.sports_venue_id = p_venue_id
    AND f.starts_at < p_to
    AND f.ends_at > p_from
  GROUP BY f.court_id
  ORDER BY revenue_collected DESC, reservations_total DESC;
$$;

CREATE OR REPLACE FUNCTION public.bi_venue_kpis_snapshot(
  p_venue_id uuid,
  p_from timestamptz,
  p_to timestamptz,
  p_tz text DEFAULT 'America/Santiago'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_duration_seconds numeric := GREATEST(EXTRACT(EPOCH FROM (p_to - p_from)), 1);
  v_prev_from timestamptz := p_from - (p_to - p_from);
  v_prev_to timestamptz := p_from;
  v_venue_exists boolean;
  v_courts_count int := 0;
  v_open_minutes numeric := 0;
  v_open_hours numeric := 0;
  v_booked_minutes_confirmed numeric := 0;
  v_booked_minutes_operational numeric := 0;
  v_reservations_total int := 0;
  v_reservations_confirmed int := 0;
  v_reservations_cancelled int := 0;
  v_revenue bigint := 0;
  v_revenue_prev bigint := 0;
  v_ticket_avg numeric := 0;
  v_cancel_rate numeric := 0;
  v_revpath numeric := 0;
  v_occupancy_confirmed numeric := 0;
  v_occupancy_operational numeric := 0;
  v_recurrent_clients int := 0;
  v_peak_hour int := null;
  v_peak_count int := 0;
  v_valley_hour int := null;
  v_valley_count int := 0;
  v_alerts jsonb := '[]'::jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.sports_venues sv
    WHERE sv.id = p_venue_id
  )
  INTO v_venue_exists;
  IF NOT v_venue_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'venue_not_found');
  END IF;

  SELECT COUNT(*)
  INTO v_courts_count
  FROM public.venue_courts vc
  WHERE vc.venue_id = p_venue_id;

  WITH scoped AS (
    SELECT
      f.*,
      EXTRACT(
        EPOCH FROM (
          LEAST(f.ends_at, p_to) - GREATEST(f.starts_at, p_from)
        )
      ) / 60.0 AS overlap_minutes
    FROM public.bi_venue_reservations_fact f
    WHERE f.sports_venue_id = p_venue_id
      AND f.starts_at < p_to
      AND f.ends_at > p_from
  ),
  open_minutes_calc AS (
    SELECT COALESCE(
      SUM(
        GREATEST(
          EXTRACT(
            EPOCH FROM (
              (d.d::date + wh.close_time) -
              (d.d::date + wh.open_time)
            )
          ) / 60.0,
          0
        )
      ),
      0
    ) * GREATEST(v_courts_count, 0) AS minutes_open
    FROM generate_series(
      date_trunc('day', timezone(p_tz, p_from))::date,
      date_trunc('day', timezone(p_tz, p_to))::date,
      interval '1 day'
    ) AS d(d)
    JOIN public.venue_weekly_hours wh
      ON wh.venue_id = p_venue_id
     AND wh.day_of_week = EXTRACT(DOW FROM d.d::date)::int
  ),
  peak_valley AS (
    SELECT
      hour_local,
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_count
    FROM (
      SELECT
        EXTRACT(HOUR FROM timezone(p_tz, starts_at))::int AS hour_local,
        status
      FROM scoped
    ) x
    GROUP BY hour_local
  )
  SELECT
    COALESCE((SELECT minutes_open FROM open_minutes_calc), 0),
    COALESCE(SUM(CASE WHEN status = 'confirmed' THEN overlap_minutes ELSE 0 END), 0),
    COALESCE(
      SUM(
        CASE
          WHEN status IN ('pending', 'confirmed')
          THEN overlap_minutes
          ELSE 0
        END
      ),
      0
    ),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE status = 'confirmed')::int,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int,
    COALESCE(
      SUM(
        CASE
          WHEN status <> 'cancelled'
           AND payment_status IN ('paid', 'deposit_paid')
          THEN amount_effective
          ELSE 0
        END
      ),
      0
    )::bigint,
    COALESCE(
      (
        SELECT hour_local
        FROM peak_valley
        ORDER BY confirmed_count DESC, hour_local ASC
        LIMIT 1
      ),
      null
    ),
    COALESCE(
      (
        SELECT confirmed_count
        FROM peak_valley
        ORDER BY confirmed_count DESC, hour_local ASC
        LIMIT 1
      ),
      0
    ),
    COALESCE(
      (
        SELECT hour_local
        FROM peak_valley
        ORDER BY confirmed_count ASC, hour_local ASC
        LIMIT 1
      ),
      null
    ),
    COALESCE(
      (
        SELECT confirmed_count
        FROM peak_valley
        ORDER BY confirmed_count ASC, hour_local ASC
        LIMIT 1
      ),
      0
    )
  INTO
    v_open_minutes,
    v_booked_minutes_confirmed,
    v_booked_minutes_operational,
    v_reservations_total,
    v_reservations_confirmed,
    v_reservations_cancelled,
    v_revenue,
    v_peak_hour,
    v_peak_count,
    v_valley_hour,
    v_valley_count
  FROM scoped;

  SELECT COALESCE(
    SUM(
      CASE
        WHEN f.status <> 'cancelled'
         AND f.payment_status IN ('paid', 'deposit_paid')
        THEN f.amount_effective
        ELSE 0
      END
    ),
    0
  )::bigint
  INTO v_revenue_prev
  FROM public.bi_venue_reservations_fact f
  WHERE f.sports_venue_id = p_venue_id
    AND f.starts_at < v_prev_to
    AND f.ends_at > v_prev_from;

  SELECT COUNT(*)::int
  INTO v_recurrent_clients
  FROM (
    SELECT f.booker_user_id
    FROM public.bi_venue_reservations_fact f
    WHERE f.sports_venue_id = p_venue_id
      AND f.starts_at < p_to
      AND f.ends_at > p_from
      AND f.status = 'confirmed'
      AND f.booker_user_id IS NOT NULL
    GROUP BY f.booker_user_id
    HAVING COUNT(*) >= 2
  ) recurring;

  v_open_hours := v_open_minutes / 60.0;
  v_ticket_avg := CASE
    WHEN v_reservations_confirmed > 0
    THEN v_revenue::numeric / v_reservations_confirmed::numeric
    ELSE 0
  END;
  v_cancel_rate := CASE
    WHEN v_reservations_total > 0
    THEN (v_reservations_cancelled::numeric / v_reservations_total::numeric) * 100.0
    ELSE 0
  END;
  v_revpath := CASE
    WHEN v_open_hours > 0
    THEN v_revenue::numeric / v_open_hours
    ELSE 0
  END;
  v_occupancy_confirmed := CASE
    WHEN v_open_minutes > 0
    THEN (v_booked_minutes_confirmed / v_open_minutes) * 100.0
    ELSE 0
  END;
  v_occupancy_operational := CASE
    WHEN v_open_minutes > 0
    THEN (v_booked_minutes_operational / v_open_minutes) * 100.0
    ELSE 0
  END;

  IF v_occupancy_confirmed < 35 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'low_occupancy',
      'severity', 'warning',
      'message', 'Ocupación baja en el periodo. Considera promociones o ajustes de precio.'
    );
  END IF;
  IF v_cancel_rate > 20 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'high_cancellation',
      'severity', 'warning',
      'message', 'Tasa de cancelación alta. Revisa confirmaciones y recordatorios.'
    );
  END IF;
  IF v_valley_hour IS NOT NULL AND v_peak_hour IS NOT NULL AND v_valley_hour <> v_peak_hour THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'valley_window',
      'severity', 'info',
      'message',
      format(
        'Baja actividad cerca de %s:00 versus peak %s:00. Evalúa campañas horarias.',
        lpad(v_valley_hour::text, 2, '0'),
        lpad(v_peak_hour::text, 2, '0')
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'meta', jsonb_build_object(
      'venueId', p_venue_id,
      'from', p_from,
      'to', p_to,
      'timezone', p_tz,
      'durationDays', ROUND(v_duration_seconds / 86400.0, 2)
    ),
    'kpis', jsonb_build_object(
      'occupancyConfirmedPct', ROUND(v_occupancy_confirmed, 2),
      'occupancyOperationalPct', ROUND(v_occupancy_operational, 2),
      'deadHours', ROUND(GREATEST(v_open_hours - (v_booked_minutes_confirmed / 60.0), 0), 2),
      'revenueTotal', v_revenue,
      'revPath', ROUND(v_revpath, 2),
      'avgTicket', ROUND(v_ticket_avg, 2),
      'cancellationRatePct', ROUND(v_cancel_rate, 2),
      'reservationsTotal', v_reservations_total,
      'reservationsConfirmed', v_reservations_confirmed,
      'reservationsCancelled', v_reservations_cancelled,
      'peakHour', v_peak_hour,
      'peakCount', v_peak_count,
      'valleyHour', v_valley_hour,
      'valleyCount', v_valley_count,
      'recurringClients', v_recurrent_clients,
      'openHours', ROUND(v_open_hours, 2)
    ),
    'comparative', jsonb_build_object(
      'previousRevenueTotal', v_revenue_prev,
      'revenueDeltaAbs', v_revenue - v_revenue_prev,
      'revenueDeltaPct',
      CASE
        WHEN v_revenue_prev > 0
        THEN ROUND(((v_revenue - v_revenue_prev)::numeric / v_revenue_prev::numeric) * 100.0, 2)
        WHEN v_revenue > 0 THEN 100
        ELSE 0
      END
    ),
    'alerts', v_alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bi_venue_income_timeseries(uuid, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bi_venue_courts_breakdown(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bi_venue_kpis_snapshot(uuid, timestamptz, timestamptz, text) FROM PUBLIC;

GRANT SELECT ON public.bi_venue_reservations_fact TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_venue_income_timeseries(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_venue_courts_breakdown(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bi_venue_kpis_snapshot(uuid, timestamptz, timestamptz, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- MAPA DE USO EN CANCHAPP.CL (código → BD)
-- =============================================================================
-- lib/auth/provider.tsx
--   profiles: SELECT id, name, account_type | UPDATE name
--   sports_venues: INSERT (onboarding), SELECT por owner_id
--
-- lib/supabase/venue-queries.ts
--   sports_venues, venue_courts, venue_weekly_hours, venue_reservations
--
-- lib/supabase/venue-dashboard-queries.ts
--   match_opportunities (id, title, creator_id)
--   profiles (id, name, whatsapp_phone)
--
-- lib/supabase/venue-owner-mutations.ts
--   sports_venues UPDATE | venue_courts CRUD | venue_weekly_hours sync
--
-- lib/supabase/venue-reservation-mutations.ts
--   venue_reservations INSERT (manual)
--   RPC confirm_venue_reservation_as_owner / cancel_venue_reservation_as_owner
--
-- lib/hooks/use-venue-reservations-realtime.ts
--   Realtime: venue_reservations (INSERT/UPDATE/DELETE)
--
-- FLUJO RESERVA DESDE SPORTMATCH → CANCHAPP
--   1. Jugador reserva: book_venue_slot() → venue_reservations status=pending
--   2. Centro ve reserva en Canchapp (RLS is_venue_owner)
--   3. Centro confirma: confirm_venue_reservation_as_owner() → confirmed + paid
--   4. Si hay match_opportunity_id vinculado, el partido sigue activo
--   5. Si centro cancela: cancel_venue_reservation_as_owner() → cancela partido si aplica
-- =============================================================================
