# AI Prompts — Debugging

Real debugging prompts respond to whatever actually breaks, so they can't be fully scripted in advance. Use DB-0 as a reusable template for whatever you hit. DB-1 through DB-4 are pre-drafted because they're common enough with this exact stack (Express + Prisma + Postgres + a Vite dev server talking to a separate API port) that there's a decent chance you'll run into at least one. If you don't hit any of them, that's fine — note in your log which ones you skipped and why, rather than leaving them ambiguously blank.

---

### DB-0 — Reusable template

**Prompt:**
```
[Paste the exact error message / stack trace.] This happens when [exact action —
e.g. "submitting the status-change form on a ticket detail page"]. Expected: [X].
Actual: [Y]. Relevant files: [paste or reference the file(s)]. Don't just patch the
symptom — walk me through why it's happening before suggesting a fix.
```

---

### DB-1 — Prisma enum / status string mismatch

**Prompt:**
```
Getting "Invalid value for argument status. Expected TicketStatus." when calling the
status-change endpoint with a valid-looking status string from the frontend. My
guess is a casing mismatch between the frontend's status strings and the Prisma enum
values — walk me through where to check before changing anything.
```

---

### DB-2 — CORS between Vite dev server and Express API

**Prompt:**
```
The Vite dev server on 5173 is getting CORS errors calling the Express API on 3001 —
Access-Control-Allow-Origin missing. Show me the minimal cors() config for local dev
only, and how to keep it from silently applying in production if I forget to change
it later.
```

---

### DB-3 — Concurrent writes to the same ticket

**Prompt:**
```
If a status-change request and a comment-add request land at nearly the same time
for the same ticket, could updatedAt from one clobber the other, or is that a
non-issue with Prisma's default update behavior here? Walk me through it rather than
just telling me it's fine.
```

---

### DB-4 — Seed script not idempotent

**Prompt:**
```
Running `npm run db:seed` twice throws a unique constraint error on User.email
instead of skipping existing rows. Show me how to make the seed script idempotent —
upsert on the natural key — rather than assuming a clean database every time.
```