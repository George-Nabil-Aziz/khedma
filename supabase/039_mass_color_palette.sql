-- Run once in Supabase SQL Editor (project: all-my-database), AFTER 038.
-- القداس: the class colours are now ten clearly different hues (red, blue, green, orange, purple,
-- teal, yellow, pink, brown, slate) instead of the first, too-similar set. This swaps the allowed
-- names and turns every stored colour into its new one (each old colour becomes a different new one:
-- sky→blue, emerald→green, amber→yellow, rose→red, violet→purple, teal→teal, orange→orange,
-- lime→brown, fuchsia→pink, cyan→slate). Safe to re-run. The app understands the old names too, so
-- it keeps working before this is run — but picking a new colour needs it.

alter table khedma.mass_classes drop constraint if exists mass_classes_color_check;

update khedma.mass_classes set color = case color
  when 'sky' then 'blue'
  when 'emerald' then 'green'
  when 'amber' then 'yellow'
  when 'rose' then 'red'
  when 'violet' then 'purple'
  when 'lime' then 'brown'
  when 'fuchsia' then 'pink'
  when 'cyan' then 'slate'
  else color
end
where color in ('sky', 'emerald', 'amber', 'rose', 'violet', 'lime', 'fuchsia', 'cyan');

alter table khedma.mass_classes add constraint mass_classes_color_check
  check (color is null or color in ('red', 'blue', 'green', 'orange', 'purple', 'teal', 'yellow', 'pink', 'brown', 'slate'));
