# My Day In Log

Name the block. Log the hours.

A small daily time log: pick what you are doing, swipe to start, swipe to end. The day fills in as a 24-hour bar, a pie of your blocks, and a chronological log. Unlogged time is simply leftover — nothing is guessed for you.

It is a sibling to **Milestone**, not a fork. Same cozy phone-width shell and passcode sign-in. No gems, tasks, or mentors.

---

## How to use

### 1. Sign in

1. Open the app.
2. Type your **5-character passcode**. After a short pause it signs you in by itself.
3. First time? Tap **Start MyDayInLog**. The app fills in an unused code, then signs you up. **Write that code down** — it is the only way back in. There is no email reset.

Same passcode as Milestone (`CODE` → `{CODE}@mvp.local`) logs you into the same account. Nickname and photo are shared between the two apps.

### 2. First setup

Set a nickname (and optionally a photo). Swipe to continue, then copy your passcode on the remember screen.

### 3. Log a block (today)

1. Tap an activity chip (Work, Study, Sleep, …).
2. On the bottom sheet, **swipe** **Start …** to begin.
3. When you switch, **swipe to end**. That saves the block. Only one block can run at a time — end it before starting another.

The green ring on a chip is the activity that is running.

### 4. Activities

- **+ Add** — new name + color (press anywhere on the candy color field).
- **Edit** (or long-press a chip) — rename, recolor, or delete. You cannot delete the activity that is currently running.

### 5. The day at a top

The cream bar at the top stays put while you scroll:

- **Today / Past day** and the date
- Prev / next day
- Thin **24-hour** occupancy bar (logged colors + leftover unlogged time)

Past days hide the activity chips. Use **Back to today** on the bottom sheet to return.

Below that you get:

- **Activity summary** — one pie slice per time block (same activity twice = two slices)
- **Log** — blocks in order, with color, time range, and duration

### 6. Profile

Tap your photo in the header.

- Change nickname (saves to Milestone too)
- Tap the photo to change it (same store as Milestone)
- Copy your passcode
- Sign out

---

## Run it locally

Need **Node.js 20+**.

```bash
npm install
cp .env.example .env.local
# fill in the values (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

### Environment

Copy from Milestone’s `.env.local` if you share the same Supabase project. Never commit `.env.local`.

| Variable | Why |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Shared Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server client |
| `SUPABASE_SERVICE_ROLE_KEY` | Creating passcode accounts (`Start MyDayInLog`) |
| `BLOB_READ_WRITE_TOKEN` | Profile photos (same Vercel Blob store as Milestone) |

Email confirmation on the Supabase project should stay **off** (passcode auth uses `{code}@mvp.local`).

### Database (once per project)

This app **must not** write to Milestone’s `profiles`, `sessions`, or `tasks`. It uses its own tables:

| Table | Purpose |
| --- | --- |
| `daylog_profiles` | Passcode account, nickname, photo |
| `daylog_activity_types` | Activity chips |
| `daylog_time_blocks` | Started / ended blocks |

In the Supabase SQL editor, run **one** of:

- `scripts/daylog_tables.sql`
- `scripts/migrate_mydayinlog.sql`

If Start MyDayInLog returns a permission error, the `GRANT`s at the bottom of that file were not applied.

---

## Default activities

On first use the app seeds:

Work, Study, Lesson, Revision, Reading, Sports, Exercise, Commute, Meals, Housework, Social, Music, Rest, Sleep.

You can add your own. Old template names Errands, Screen, and Other are archived if they are still sitting around unused.

---

## Deploy

Same as any Next.js app (Vercel works well). Set the four env vars on the host, and point the production URL at the same Supabase project. Run the SQL on that project before the first signup.
