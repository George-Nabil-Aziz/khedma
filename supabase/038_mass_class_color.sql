-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 037.
-- القداس: each servant class keeps its own colour (shown on the schedule and in the name lists, and
-- changeable from the names pages). `color` is one of the app's palette names. Existing classes get
-- the colour they already show (the palette picked by position), so nothing changes visually.
-- Without this the app keeps showing the palette-by-position and the colour picker is off.

alter table khedma.mass_classes add column if not exists color text;

alter table khedma.mass_classes drop constraint if exists mass_classes_color_check;
alter table khedma.mass_classes add constraint mass_classes_color_check
  check (color is null or color in ('sky', 'emerald', 'amber', 'rose', 'violet', 'teal', 'orange', 'lime', 'fuchsia', 'cyan'));

-- Backfill only the classes without one: the palette by position, wrapping round — the same as the app did.
update khedma.mass_classes c
set color = (array['sky', 'emerald', 'amber', 'rose', 'violet', 'teal', 'orange', 'lime', 'fuchsia', 'cyan'])[
  (((coalesce(o.position, o.rn) - 1) % 10) + 10) % 10 + 1
]
from (
  select id, position, row_number() over (order by position nulls last, created_at) as rn
  from khedma.mass_classes
) o
where c.id = o.id and c.color is null;
