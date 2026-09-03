# MyDayInLog — copy pack from Milestone

Use this folder when scaffolding **MyDayInLog** next to Milestone.  
Do **not** copy the whole Milestone repo.

## Recommended workflow

1. Create empty project: `Desktop/MyDayInLog` (fresh `create-next-app`, same stack as Milestone).
2. From Milestone, run:

```powershell
cd C:\Users\mongk\Desktop\milestone
.\transfer\mydayinlog-seed\copy-into-mydayinlog.ps1 -Dest "C:\Users\mongk\Desktop\MyDayInLog"
```

3. Open **MyDayInLog** as the Cursor workspace (not Milestone).
4. Tell the agent: follow `transfer/mydayinlog-seed/README.md` (or the copy that landed in MyDayInLog as `FROM_MILESTONE.md`).

---

## Shared Supabase (important)

Milestone and MyDayInLog share **one Supabase project**.  
Milestone already owns `profiles`, `sessions`, `tasks`, etc.

**MyDayInLog must use prefixed tables** so nothing collides:

| MyDayInLog table | Purpose |
| --- | --- |
| `daylog_profiles` | passcode accounts for this app only |
| `daylog_activity_types` | Lesson / Revision / Jogging / … |
| `daylog_time_blocks` | started/ended focus blocks |

Auth users live in the shared `auth.users` table (same mechanism as Milestone: `{code}@mvp.local`).  
**Do not** insert MyDayInLog users into Milestone’s `profiles` table.

See `schema/daylog_tables.sql` in this pack.

---

## A) Copy as-is (drop into MyDayInLog keeping paths)

These are safe baselines; little or no Milestone product logic:

```
src/lib/auth.ts
src/lib/invitation-code.ts
src/lib/datetime.ts
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts
src/components/ui/SwipeToEnter.tsx
src/components/ui/DurationClock.tsx
src/components/ui/CozyBackground.tsx
src/components/ui/PartyPopBurst.tsx
src/components/ui/Icons.tsx
src/app/globals.css
public/brand/          (logos / icons — optional, rebrand later)
```

Also useful config references (compare, don’t blindly overwrite if create-next-app already made them):

```
proxy.ts                 → adapt auth allowlist for /login /setup /remember-code
next.config.ts
tsconfig.json
postcss.config.mjs
eslint.config.mjs
AGENTS.md                → keep Next.js “read docs” note
```

---

## B) Copy then rewrite (patterns only)

Ship these into MyDayInLog under `_from_milestone/` or read from Milestone path — **do not use as final app routes unchanged**:

| Milestone source | What to steal | Rewrite into |
| --- | --- | --- |
| `src/app/(auth)/login/page.tsx` | Solo “Start a …” + swipe signup | MyDayInLog arrival |
| `src/app/(auth)/setup/page.tsx` | nickname once | setup |
| `src/app/(auth)/remember-codes/page.tsx` | **solo one-code** layout only | remember-code |
| `src/app/api/auth/route.ts` | `createSolo` branch | `createDaylog` → insert `daylog_profiles` |
| `src/app/api/auth/mentor-suggest/route.ts` | unused code suggest | `/api/auth/suggest` |
| `src/components/timer/SessionTimer.tsx` | sheet + swipe start/end + optional note bubbles | `DayTimer.tsx` (no GPS, no EXP, no tutorial) |
| `src/hooks/useGeolocation.ts` | **`useSessionClock` only** | `src/hooks/useSessionClock.ts` |
| `src/lib/scoring.ts` | `formatDuration` only | `src/lib/time-format.ts` |

Strip from SessionTimer rewrite: `isChild`, tutorial ×3, EnvironmentalCheck, family-sync, gems/EXP claim UI (keep duration + note).

---

## C) Do NOT copy

Anything Milestone-product:

- All of `src/components/tasks/**`, `progress/**`, `shop/**`, `profile/Linked*`
- `src/app/(dashboard)/tasks|milestones|shop|community|resources`
- `src/app/api/tasks|milestones|gems|invite|community|upload|session*`
- `src/lib/roles.ts`, `user-tasks.ts`, `prize-path.ts`, `task-*`, `family-sync.ts`, `daily-quote.ts`, `import-sample-template.ts`
- `src/data/prize-path-template.json`, `quotes.json`
- Mentor first-child / remember dual codes flow
- GPS / EnvironmentalCheck / LocationMapPreview

---

## D) What the new bot should build (not copy)

```
src/app/(app)/page.tsx              # home: summary + chips + DayTimer
src/app/(app)/profile/page.tsx
src/app/api/blocks/route.ts
src/app/api/activities/route.ts
src/app/api/profile/route.ts        # daylog_profiles only
src/components/timer/DayTimer.tsx
src/components/summary/DailyBreakdown.tsx
scripts/migrate or schema/daylog_tables.sql
```

---

## Env vars (same Supabase project as Milestone)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

No Blob required for v1.

---

## Prompt snippet for the MyDayInLog agent

```
Build MyDayInLog from the MVP plan. Reuse files listed in FROM_MILESTONE.md
(section A as-is, section B rewrite). Use daylog_* tables in the shared
Supabase project — never Milestone profiles/sessions/tasks. One purpose:
swipe start/end activity time blocks + daily logged-time summary.
```
