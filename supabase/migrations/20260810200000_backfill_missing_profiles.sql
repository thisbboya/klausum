-- Backfill: auth users that never got a user_profiles row.
--
-- Found while verifying the public_profiles fix. Two accounts sat on the weekly
-- leaderboard with 113 and 82 XP — real students who had been studying — but
-- had no profile row at all, so they rendered as "Anonymous" even after the
-- view was fixed. A sweep found five such accounts out of fifteen.
--
-- An on_auth_user_created trigger does exist, so these predate it or lost their
-- row some other way. This repairs the existing gap; the trigger covers new
-- signups.
--
-- Safe to re-run: ON CONFLICT DO NOTHING, and it only ever inserts rows that
-- are missing.
insert into public.user_profiles (id, full_name)
select u.id,
       coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
