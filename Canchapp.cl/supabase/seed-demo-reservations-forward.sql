-- ============================================================
-- Seed de datos DEMO — reservas futuras con ocupación > 50%
-- Cuenta demo (owner): 04c144d7-1005-429a-92b0-9d71ccb6969d
-- Centro:              74f1018d-b7e3-4894-b157-8625fef6873e ("Demo", Santiago)
--
-- Genera reservas aleatorias para las 4 canchas del centro demo desde
-- CURRENT_DATE hasta CURRENT_DATE + 2 meses, apuntando a una ocupación
-- de 60%-78% por cancha y por día (siempre > 50%), respetando el
-- horario semanal ya cargado en venue_weekly_hours y sin traslapes.
--
-- Requiere haber corrido antes supabase/seed-demo-reservations.sql
-- (crea el centro, las 4 canchas y el horario semanal).
--
-- SOLO DATOS — no modifica el esquema. Ejecutar manualmente en el SQL
-- Editor de Supabase (rol postgres).
--
-- Es re-ejecutable: cada corrida borra las reservas existentes en el
-- rango [CURRENT_DATE, CURRENT_DATE + 2 meses) para este centro y
-- vuelve a sortear horarios al azar (ventana siempre "rodante" hacia
-- adelante desde el día en que se ejecute).
-- ============================================================

begin;

do $do$
declare
  v_status_type text;
  v_payment_type text;
  v_confirmation_type text;
  v_venue_id uuid := '74f1018d-b7e3-4894-b157-8625fef6873e';
  v_owner_id uuid := '04c144d7-1005-429a-92b0-9d71ccb6969d';
  v_from date := current_date;
  v_to date := current_date + interval '2 months';
  v_clients text[] := array[
    'Matías Rojas','Carolina Pérez','Felipe Soto','Valentina Muñoz','Diego Castro',
    'Camila Fuentes','Sebastián Araya','Fernanda Reyes','Cristóbal Vega','Antonia Silva',
    'Ignacio Morales','Josefa Torres','Vicente Núñez','Martina Díaz','Pablo Herrera',
    'Constanza López','Rodrigo Salazar','Isidora Campos','Tomás Guzmán',
    'Grupo Pichanga Lunes','Liga Vecinal Ñuñoa','Club Deportivo Halcones','Empresa TechSur',
    'Colegio San Ignacio','Pareja Rojas-Fernández','Dúo Bravo-Contreras','Club Pádel Andes',
    'Torneo Amateur Pádel','Javiera Silva','Maximiliano Torres','Academia Pádel Sur','Francisca Rivas'
  ];
  v_phones text[] := array[
    '+56 9 8123 4561','+56 9 9234 5672','+56 9 8345 6783','+56 9 9456 7894','+56 9 8567 8905',
    '+56 9 9678 9016','+56 9 8789 0127','+56 9 9890 1238','+56 9 8901 2349','+56 9 9012 3450',
    '+56 9 8123 4562','+56 9 9234 5673','+56 9 8345 6784','+56 9 9456 7895','+56 9 8567 8906',
    '+56 9 9678 9017','+56 9 8789 0128','+56 9 9890 1239','+56 9 8901 2340',
    '+56 9 9012 3451','+56 9 8123 4563','+56 9 9234 5674','+56 9 8345 6785',
    '+56 9 9456 7896','+56 9 8567 8907','+56 9 9678 9018','+56 9 8789 0129',
    '+56 9 9890 1240','+56 9 8901 2341','+56 9 9012 3452','+56 9 8123 4564','+56 9 9234 5675'
  ];
  r_court record;
  d date;
  v_open time;
  v_close time;
  v_open_min int;
  v_close_min int;
  v_total_min int;
  v_target_min int;
  v_occupied_min int;
  v_attempt int;
  v_start_hour int;
  v_dur int;
  v_end_hour int;
  v_overlap boolean;
  v_client_idx int;
  v_sql text;
begin
  select udt_name into v_status_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'venue_reservations' and column_name = 'status';

  select udt_name into v_payment_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'venue_reservations' and column_name = 'payment_status';

  select udt_name into v_confirmation_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'venue_reservations' and column_name = 'confirmation_source';

  if v_status_type is null or v_payment_type is null or v_confirmation_type is null then
    raise exception 'No se pudo detectar el tipo de status/payment_status/confirmation_source en venue_reservations';
  end if;

  -- limpiar solo el rango futuro que vamos a regenerar
  delete from venue_reservations
  where court_id in (select id from venue_courts where venue_id = v_venue_id)
    and starts_at >= v_from
    and starts_at < v_to;

  create temporary table tmp_slots (
    court_id uuid,
    day date,
    start_hour int,
    dur int,
    status text,
    client text,
    phone text
  ) on commit drop;

  for r_court in select id from venue_courts where venue_id = v_venue_id loop
    d := v_from;
    while d < v_to loop
      v_open := null;
      v_close := null;

      select open_time, close_time into v_open, v_close
      from venue_weekly_hours
      where venue_id = v_venue_id and day_of_week = extract(dow from d)::int
      limit 1;

      if v_open is not null then
        v_open_min := extract(hour from v_open)::int * 60 + extract(minute from v_open)::int;
        v_close_min := extract(hour from v_close)::int * 60 + extract(minute from v_close)::int;
        v_total_min := greatest(v_close_min - v_open_min, 60);
        -- objetivo 60%-78% de ocupación (siempre por sobre el 50% pedido)
        v_target_min := round(v_total_min * (0.60 + random() * 0.18));
        v_occupied_min := 0;
        v_attempt := 0;

        while v_occupied_min < v_target_min and v_attempt < 120 loop
          v_attempt := v_attempt + 1;
          v_dur := case when random() < 0.25 then 2 else 1 end;
          v_start_hour := (v_open_min / 60)
            + floor(random() * greatest(((v_close_min - v_open_min) / 60) - v_dur + 1, 1))::int;
          v_end_hour := v_start_hour + v_dur;

          if v_end_hour * 60 <= v_close_min then
            select exists (
              select 1 from tmp_slots s
              where s.court_id = r_court.id and s.day = d
                and s.start_hour < v_end_hour and (s.start_hour + s.dur) > v_start_hour
            ) into v_overlap;

            if not v_overlap then
              v_client_idx := 1 + floor(random() * array_length(v_clients, 1))::int;
              insert into tmp_slots (court_id, day, start_hour, dur, status, client, phone)
              values (
                r_court.id, d, v_start_hour, v_dur,
                case when random() < 0.82 then 'confirmed' else 'pending' end,
                v_clients[v_client_idx],
                v_phones[v_client_idx]
              );
              v_occupied_min := v_occupied_min + v_dur * 60;
            end if;
          end if;
        end loop;
      end if;

      d := d + 1;
    end loop;
  end loop;

  v_sql := $q$
    insert into venue_reservations (
      court_id, starts_at, ends_at, status, payment_status, price_per_hour,
      booker_user_id, match_opportunity_id, notes,
      confirmation_source, confirmed_by_user_id, confirmed_at, confirmation_note,
      cancelled_at, cancelled_reason
    )
    select
      s.court_id,
      (s.day + make_interval(hours => s.start_hour)) at time zone 'America/Santiago',
      (s.day + make_interval(hours => s.start_hour + s.dur)) at time zone 'America/Santiago',
      s.status::
  $q$
  || quote_ident(v_status_type)
  || $q$
      ,
      (case when s.status = 'confirmed' then 'paid' else 'unpaid' end)::
  $q$
  || quote_ident(v_payment_type)
  || $q$
      ,
      coalesce(vc.price_per_hour, 25000),
      null,
      null,
      'manual_reservation | cliente:' || s.client || ' | telefono:' || s.phone,
      (case when s.status = 'confirmed' then 'venue_owner' end)::
  $q$
  || quote_ident(v_confirmation_type)
  || $q$
      ,
      case when s.status = 'confirmed' then $q$ || quote_literal(v_owner_id::text) || $q$::uuid end,
      case when s.status = 'confirmed'
           then least(
             now(),
             ((s.day + make_interval(hours => s.start_hour)) at time zone 'America/Santiago')
               - interval '1 day'
           ) end,
      case when s.status = 'confirmed' then 'Reserva manual confirmada' end,
      null,
      null
    from tmp_slots s
    join venue_courts vc on vc.id = s.court_id
  $q$;

  execute v_sql;
end
$do$;

commit;

-- Verificación rápida de ocupación por cancha (horas reservadas / horas
-- de apertura totales del rango, activo = no cancelado):
--
-- select vc.name,
--        round(100.0 * sum(extract(epoch from (vr.ends_at - vr.starts_at)) / 3600)
--          / nullif((select sum(extract(hour from wh.close_time) - extract(hour from wh.open_time))
--                    from venue_weekly_hours wh
--                    where wh.venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e') * 61 / 7.0, 0), 1
--        ) as ocupacion_pct_aprox
-- from venue_reservations vr
-- join venue_courts vc on vc.id = vr.court_id
-- where vc.venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e'
--   and vr.status <> 'cancelled'
--   and vr.starts_at >= current_date
--   and vr.starts_at < current_date + interval '2 months'
-- group by vc.name
-- order by vc.name;
