-- ============================================================
-- Seed de datos DEMO para Canchapp
-- Cuenta demo (owner): 04c144d7-1005-429a-92b0-9d71ccb6969d
-- Centro:              74f1018d-b7e3-4894-b157-8625fef6873e ("Demo", Santiago)
--
-- Canchas existentes:
--   633637b7-a11a-464f-bc00-ea6e4a3c0d56  "Cancha 1"        (fútbol, $25.000/h)
--   1e272744-99de-4657-9461-c8fad90ac704  "Cancha 2"        (fútbol, $25.000/h)
-- Canchas nuevas creadas por este script:
--   "Cancha Pádel 1", "Cancha Pádel 2"    (pádel, $22.000/h)
--
-- SOLO DATOS — no modifica el esquema (el esquema vive en Sportmatch).
-- Ejecutar manualmente en el SQL Editor de Supabase (rol postgres).
-- Es re-ejecutable: borra y vuelve a crear los datos demo de este centro.
--
-- Rango de datos: 2026-06-22 a 2026-07-19 (3 semanas pasadas + 1 futura,
-- relativo al 2026-07-11). Horas en America/Santiago.
--
-- Nota sobre los enums: `status`, `payment_status` y `confirmation_source`
-- de `venue_reservations` son tipos enum de Postgres (no texto), y sus
-- nombres exactos (venue_reservation_status, venue_payment_status, etc.)
-- no están documentados en este repo. En vez de adivinarlos, el bloque
-- final de este script los detecta en caliente desde information_schema
-- y arma el INSERT dinámicamente con los casts correctos.
-- ============================================================

begin;

-- 0) Asegurar que la cuenta demo sea tipo venue
update profiles
set account_type = 'venue'
where id = '04c144d7-1005-429a-92b0-9d71ccb6969d'
  and account_type is distinct from 'venue';

-- 1) Horario semanal del centro (0 = domingo … 6 = sábado)
delete from venue_weekly_hours
where venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e';

insert into venue_weekly_hours (venue_id, day_of_week, open_time, close_time) values
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 0, '09:00', '22:00'),
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 1, '08:00', '23:00'),
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 2, '08:00', '23:00'),
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 3, '08:00', '23:00'),
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 4, '08:00', '23:00'),
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 5, '08:00', '23:00'),
  ('74f1018d-b7e3-4894-b157-8625fef6873e', 6, '09:00', '23:00');

-- 2) Crear las 2 canchas de pádel (idempotente: solo si no existen ya por nombre)
insert into venue_courts (venue_id, name, sort_order, price_per_hour)
select '74f1018d-b7e3-4894-b157-8625fef6873e', v.name, v.sort_order, v.price
from (values
  ('Cancha Pádel 1', 2, 22000),
  ('Cancha Pádel 2', 3, 22000)
) as v(name, sort_order, price)
where not exists (
  select 1 from venue_courts vc
  where vc.venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e'
    and vc.name = v.name
);

-- 3) Limpiar reservas previas de TODAS las canchas del centro demo
delete from venue_reservations
where court_id in (
  select id from venue_courts
  where venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e'
);

-- 4) Reservas simuladas (fútbol + pádel)
-- Los tipos enum de status/payment_status/confirmation_source se resuelven
-- dinámicamente para no depender de sus nombres exactos.
do $do$
declare
  v_status_type text;
  v_payment_type text;
  v_confirmation_type text;
  v_sql text;
begin
  select udt_name into v_status_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'venue_reservations'
    and column_name = 'status';

  select udt_name into v_payment_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'venue_reservations'
    and column_name = 'payment_status';

  select udt_name into v_confirmation_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'venue_reservations'
    and column_name = 'confirmation_source';

  if v_status_type is null or v_payment_type is null or v_confirmation_type is null then
    raise exception 'No se pudo detectar el tipo de status/payment_status/confirmation_source en venue_reservations';
  end if;

  v_sql := $q$
    with clients(name, phone) as (
      values
        ('Matías Rojas',            '+56 9 8123 4561'),
        ('Carolina Pérez',          '+56 9 9234 5672'),
        ('Felipe Soto',             '+56 9 8345 6783'),
        ('Valentina Muñoz',         '+56 9 9456 7894'),
        ('Diego Castro',            '+56 9 8567 8905'),
        ('Camila Fuentes',          '+56 9 9678 9016'),
        ('Sebastián Araya',         '+56 9 8789 0127'),
        ('Fernanda Reyes',          '+56 9 9890 1238'),
        ('Cristóbal Vega',          '+56 9 8901 2349'),
        ('Antonia Silva',           '+56 9 9012 3450'),
        ('Ignacio Morales',         '+56 9 8123 4562'),
        ('Josefa Torres',           '+56 9 9234 5673'),
        ('Vicente Núñez',           '+56 9 8345 6784'),
        ('Martina Díaz',            '+56 9 9456 7895'),
        ('Pablo Herrera',           '+56 9 8567 8906'),
        ('Constanza López',         '+56 9 9678 9017'),
        ('Rodrigo Salazar',         '+56 9 8789 0128'),
        ('Isidora Campos',          '+56 9 9890 1239'),
        ('Tomás Guzmán',            '+56 9 8901 2340'),
        ('Grupo Pichanga Lunes',    '+56 9 9012 3451'),
        ('Liga Vecinal Ñuñoa',      '+56 9 8123 4563'),
        ('Club Deportivo Halcones', '+56 9 9234 5674'),
        ('Empresa TechSur',         '+56 9 8345 6785'),
        ('Colegio San Ignacio',     '+56 9 9456 7896'),
        ('Pareja Rojas-Fernández',  '+56 9 8567 8907'),
        ('Dúo Bravo-Contreras',     '+56 9 9678 9018'),
        ('Club Pádel Andes',        '+56 9 8789 0129'),
        ('Torneo Amateur Pádel',    '+56 9 9890 1240'),
        ('Javiera Silva',           '+56 9 8901 2341'),
        ('Maximiliano Torres',      '+56 9 9012 3452'),
        ('Academia Pádel Sur',      '+56 9 8123 4564'),
        ('Francisca Rivas',         '+56 9 9234 5675')
    ),
    courts(court_name, id) as (
      select name, id
      from venue_courts
      where venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e'
    ),
    rows(court_name, day, start_h, dur_h, status, client) as (
      values
        ('Cancha 1', date '2026-06-22', 19, 1, 'confirmed', 'Matías Rojas'),
        ('Cancha 1', date '2026-06-22', 20, 1, 'confirmed', 'Grupo Pichanga Lunes'),
        ('Cancha 2', date '2026-06-22', 19, 2, 'confirmed', 'Carolina Pérez'),
        ('Cancha 1', date '2026-06-23', 18, 1, 'confirmed', 'Felipe Soto'),
        ('Cancha 2', date '2026-06-23', 20, 1, 'confirmed', 'Valentina Muñoz'),
        ('Cancha 1', date '2026-06-23', 21, 1, 'cancelled', 'Diego Castro'),
        ('Cancha 1', date '2026-06-24', 19, 2, 'confirmed', 'Liga Vecinal Ñuñoa'),
        ('Cancha 2', date '2026-06-24', 18, 1, 'confirmed', 'Camila Fuentes'),
        ('Cancha 2', date '2026-06-25', 19, 1, 'confirmed', 'Sebastián Araya'),
        ('Cancha 1', date '2026-06-25', 20, 2, 'confirmed', 'Club Deportivo Halcones'),
        ('Cancha 1', date '2026-06-26', 18, 1, 'confirmed', 'Fernanda Reyes'),
        ('Cancha 1', date '2026-06-26', 19, 1, 'confirmed', 'Cristóbal Vega'),
        ('Cancha 1', date '2026-06-26', 21, 1, 'confirmed', 'Empresa TechSur'),
        ('Cancha 2', date '2026-06-26', 19, 1, 'confirmed', 'Antonia Silva'),
        ('Cancha 2', date '2026-06-26', 20, 1, 'cancelled', 'Ignacio Morales'),
        ('Cancha 1', date '2026-06-27', 10, 1, 'confirmed', 'Josefa Torres'),
        ('Cancha 1', date '2026-06-27', 11, 1, 'confirmed', 'Vicente Núñez'),
        ('Cancha 1', date '2026-06-27', 16, 1, 'confirmed', 'Martina Díaz'),
        ('Cancha 2', date '2026-06-27', 10, 2, 'confirmed', 'Colegio San Ignacio'),
        ('Cancha 2', date '2026-06-27', 17, 1, 'confirmed', 'Pablo Herrera'),
        ('Cancha 1', date '2026-06-28', 11, 1, 'confirmed', 'Constanza López'),
        ('Cancha 2', date '2026-06-28', 12, 1, 'confirmed', 'Rodrigo Salazar'),
        ('Cancha 2', date '2026-06-28', 18, 1, 'confirmed', 'Isidora Campos'),
        ('Cancha Pádel 1', date '2026-06-22', 18, 1, 'confirmed', 'Pareja Rojas-Fernández'),
        ('Cancha Pádel 2', date '2026-06-23', 19, 1, 'confirmed', 'Dúo Bravo-Contreras'),
        ('Cancha Pádel 1', date '2026-06-24', 20, 1, 'confirmed', 'Club Pádel Andes'),
        ('Cancha Pádel 2', date '2026-06-27', 10, 1, 'confirmed', 'Javiera Silva'),
        ('Cancha Pádel 1', date '2026-06-28', 17, 2, 'confirmed', 'Torneo Amateur Pádel'),
        ('Cancha 1', date '2026-06-29', 19, 1, 'confirmed', 'Matías Rojas'),
        ('Cancha 1', date '2026-06-29', 20, 1, 'confirmed', 'Grupo Pichanga Lunes'),
        ('Cancha 2', date '2026-06-29', 20, 1, 'confirmed', 'Tomás Guzmán'),
        ('Cancha 1', date '2026-06-30', 18, 2, 'confirmed', 'Empresa TechSur'),
        ('Cancha 2', date '2026-06-30', 19, 1, 'cancelled', 'Camila Fuentes'),
        ('Cancha 1', date '2026-07-01', 19, 1, 'confirmed', 'Liga Vecinal Ñuñoa'),
        ('Cancha 2', date '2026-07-01', 20, 1, 'confirmed', 'Felipe Soto'),
        ('Cancha 1', date '2026-07-02', 20, 1, 'confirmed', 'Club Deportivo Halcones'),
        ('Cancha 2', date '2026-07-02', 18, 1, 'confirmed', 'Valentina Muñoz'),
        ('Cancha 1', date '2026-07-03', 18, 1, 'confirmed', 'Cristóbal Vega'),
        ('Cancha 1', date '2026-07-03', 19, 2, 'confirmed', 'Sebastián Araya'),
        ('Cancha 2', date '2026-07-03', 19, 1, 'confirmed', 'Fernanda Reyes'),
        ('Cancha 1', date '2026-07-04', 10, 2, 'confirmed', 'Colegio San Ignacio'),
        ('Cancha 1', date '2026-07-04', 15, 1, 'confirmed', 'Antonia Silva'),
        ('Cancha 2', date '2026-07-04', 11, 1, 'confirmed', 'Josefa Torres'),
        ('Cancha 2', date '2026-07-04', 16, 1, 'pending',   'Vicente Núñez'),
        ('Cancha 1', date '2026-07-05', 12, 1, 'confirmed', 'Martina Díaz'),
        ('Cancha 2', date '2026-07-05', 17, 1, 'confirmed', 'Pablo Herrera'),
        ('Cancha Pádel 1', date '2026-06-29', 19, 1, 'confirmed', 'Maximiliano Torres'),
        ('Cancha Pádel 2', date '2026-06-30', 20, 1, 'confirmed', 'Academia Pádel Sur'),
        ('Cancha Pádel 1', date '2026-07-01', 18, 1, 'cancelled', 'Francisca Rivas'),
        ('Cancha Pádel 2', date '2026-07-04', 11, 1, 'confirmed', 'Pareja Rojas-Fernández'),
        ('Cancha Pádel 1', date '2026-07-05', 16, 2, 'confirmed', 'Club Pádel Andes'),
        ('Cancha 1', date '2026-07-06', 19, 1, 'confirmed', 'Matías Rojas'),
        ('Cancha 1', date '2026-07-06', 20, 1, 'confirmed', 'Grupo Pichanga Lunes'),
        ('Cancha 2', date '2026-07-06', 19, 1, 'confirmed', 'Constanza López'),
        ('Cancha 1', date '2026-07-07', 18, 1, 'confirmed', 'Rodrigo Salazar'),
        ('Cancha 2', date '2026-07-07', 20, 1, 'cancelled', 'Isidora Campos'),
        ('Cancha 1', date '2026-07-08', 19, 2, 'confirmed', 'Liga Vecinal Ñuñoa'),
        ('Cancha 2', date '2026-07-08', 18, 1, 'confirmed', 'Tomás Guzmán'),
        ('Cancha 1', date '2026-07-09', 20, 1, 'confirmed', 'Club Deportivo Halcones'),
        ('Cancha 2', date '2026-07-09', 19, 1, 'confirmed', 'Camila Fuentes'),
        ('Cancha 1', date '2026-07-10', 18, 1, 'confirmed', 'Felipe Soto'),
        ('Cancha 1', date '2026-07-10', 19, 1, 'confirmed', 'Empresa TechSur'),
        ('Cancha 1', date '2026-07-10', 21, 1, 'confirmed', 'Diego Castro'),
        ('Cancha 2', date '2026-07-10', 19, 1, 'confirmed', 'Fernanda Reyes'),
        ('Cancha 1', date '2026-07-11', 10, 1, 'confirmed', 'Josefa Torres'),
        ('Cancha 1', date '2026-07-11', 11, 1, 'confirmed', 'Vicente Núñez'),
        ('Cancha 1', date '2026-07-11', 16, 1, 'confirmed', 'Martina Díaz'),
        ('Cancha 1', date '2026-07-11', 18, 1, 'pending',   'Sebastián Araya'),
        ('Cancha 2', date '2026-07-11', 10, 2, 'confirmed', 'Colegio San Ignacio'),
        ('Cancha 2', date '2026-07-11', 17, 1, 'confirmed', 'Antonia Silva'),
        ('Cancha 2', date '2026-07-11', 19, 1, 'pending',   'Ignacio Morales'),
        ('Cancha 1', date '2026-07-12', 11, 1, 'confirmed', 'Constanza López'),
        ('Cancha 1', date '2026-07-12', 12, 1, 'pending',   'Pablo Herrera'),
        ('Cancha 2', date '2026-07-12', 18, 1, 'confirmed', 'Rodrigo Salazar'),
        ('Cancha Pádel 1', date '2026-07-06', 18, 1, 'confirmed', 'Javiera Silva'),
        ('Cancha Pádel 2', date '2026-07-07', 19, 1, 'confirmed', 'Torneo Amateur Pádel'),
        ('Cancha Pádel 1', date '2026-07-09', 20, 1, 'confirmed', 'Dúo Bravo-Contreras'),
        ('Cancha Pádel 2', date '2026-07-11', 12, 1, 'confirmed', 'Maximiliano Torres'),
        ('Cancha Pádel 1', date '2026-07-11', 20, 1, 'pending',   'Academia Pádel Sur'),
        ('Cancha Pádel 2', date '2026-07-12', 17, 2, 'confirmed', 'Club Pádel Andes'),
        ('Cancha 1', date '2026-07-13', 19, 1, 'confirmed', 'Matías Rojas'),
        ('Cancha 1', date '2026-07-13', 20, 1, 'pending',   'Grupo Pichanga Lunes'),
        ('Cancha 2', date '2026-07-13', 19, 1, 'pending',   'Tomás Guzmán'),
        ('Cancha 1', date '2026-07-14', 18, 2, 'confirmed', 'Empresa TechSur'),
        ('Cancha 2', date '2026-07-14', 20, 1, 'pending',   'Camila Fuentes'),
        ('Cancha 1', date '2026-07-15', 19, 2, 'confirmed', 'Liga Vecinal Ñuñoa'),
        ('Cancha 2', date '2026-07-15', 18, 1, 'pending',   'Valentina Muñoz'),
        ('Cancha 1', date '2026-07-16', 20, 1, 'pending',   'Club Deportivo Halcones'),
        ('Cancha 2', date '2026-07-16', 19, 1, 'confirmed', 'Felipe Soto'),
        ('Cancha 1', date '2026-07-17', 18, 1, 'pending',   'Cristóbal Vega'),
        ('Cancha 1', date '2026-07-17', 19, 1, 'confirmed', 'Sebastián Araya'),
        ('Cancha 2', date '2026-07-17', 20, 1, 'pending',   'Fernanda Reyes'),
        ('Cancha 1', date '2026-07-18', 10, 2, 'pending',   'Colegio San Ignacio'),
        ('Cancha 2', date '2026-07-18', 16, 1, 'confirmed', 'Antonia Silva'),
        ('Cancha 1', date '2026-07-19', 12, 1, 'pending',   'Martina Díaz'),
        ('Cancha Pádel 2', date '2026-07-13', 18, 1, 'confirmed', 'Francisca Rivas'),
        ('Cancha Pádel 1', date '2026-07-15', 19, 1, 'pending',   'Pareja Rojas-Fernández'),
        ('Cancha Pádel 2', date '2026-07-16', 20, 1, 'confirmed', 'Javiera Silva'),
        ('Cancha Pádel 1', date '2026-07-18', 11, 2, 'pending',   'Academia Pádel Sur'),
        ('Cancha Pádel 2', date '2026-07-19', 17, 1, 'confirmed', 'Maximiliano Torres')
    )
    insert into venue_reservations (
      court_id, starts_at, ends_at, status, payment_status, price_per_hour,
      booker_user_id, match_opportunity_id, notes,
      confirmation_source, confirmed_by_user_id, confirmed_at, confirmation_note,
      cancelled_at, cancelled_reason
    )
    select
      c.id,
      (r.day + make_interval(hours => r.start_h)) at time zone 'America/Santiago',
      (r.day + make_interval(hours => r.start_h + r.dur_h)) at time zone 'America/Santiago',
      r.status::
  $q$
  || quote_ident(v_status_type)
  || $q$
      ,
      case when r.status = 'confirmed' then 'paid' else 'unpaid' end::
  $q$
  || quote_ident(v_payment_type)
  || $q$
      ,
      case when c.court_name like 'Cancha Pádel%' then 22000 else 25000 end,
      null,
      null,
      'manual_reservation | cliente:' || r.client || ' | telefono:' || cl.phone,
      case when r.status = 'confirmed' then 'venue_owner' end::
  $q$
  || quote_ident(v_confirmation_type)
  || $q$
      ,
      case when r.status = 'confirmed'
           then '04c144d7-1005-429a-92b0-9d71ccb6969d'::uuid end,
      case when r.status = 'confirmed'
           then least(
             now(),
             ((r.day + make_interval(hours => r.start_h)) at time zone 'America/Santiago')
               - interval '1 day'
           ) end,
      case when r.status = 'confirmed' then 'Reserva manual confirmada' end,
      case when r.status = 'cancelled'
           then ((r.day + make_interval(hours => r.start_h)) at time zone 'America/Santiago')
             - interval '6 hours' end,
      case when r.status = 'cancelled' then 'Cancelada por el cliente' end
    from rows r
    join courts c on c.court_name = r.court_name
    join clients cl on cl.name = r.client
  $q$;

  execute v_sql;
end
$do$;

commit;

-- Verificación rápida:
-- select vc.name, vr.status, count(*)
-- from venue_reservations vr
-- join venue_courts vc on vc.id = vr.court_id
-- where vc.venue_id = '74f1018d-b7e3-4894-b157-8625fef6873e'
-- group by vc.name, vr.status
-- order by vc.name, vr.status;
