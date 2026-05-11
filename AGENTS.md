<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Task Management

For any task that touches 2+ files or has 3+ steps — create a todo list first using TaskCreate, show it to the user, then work through items one by one marking them in_progress → completed. Never start implementing without a visible task list.

# Project Context

**Stack:** Next.js 16 (App Router) + Supabase + Tailwind CSS  
**Project:** SFRC — Startup Fest Robotics Challenge results & judges panel  
**Folder:** `~/Desktop/sfrc-next`

## Modes
- **Mock mode** (no `.env.local`): uses hardcoded data + `sfrc-mock-session` cookie auth
- **Supabase mode** (`.env.local` present): real DB + Supabase Auth

## Key files
- `src/lib/data.ts` — data fetching (auto-switches mock ↔ Supabase)
- `src/lib/mock-data.ts` — mock teams + results
- `src/lib/standings/a|b|c|d.ts` — standings computation logic
- `src/app/api/auth/login/route.ts` — login API (mock + Supabase)
- `src/middleware.ts` — route protection for `/judges/*`
- `src/types/database.ts` — all DB types

## Judges accounts (mock mode)
admin / admin · judge_a1 / Line@Track#2026 · judge_b1 / Sumo@Ring#2026 · etc.
Full list in Obsidian: sfrc-judges-credentials.md
