# Users & Plans — Design

## Overview

Add user authentication, cloud project storage, and a monetized Free/Pro plan system to ScribbleDB. Converts the current static SPA into a full-stack SvelteKit app.

## Stack

| Component | Technology |
|-----------|-----------|
| Framework | SvelteKit (Node adapter, server routes) |
| Auth | BetterAuth (email/password) |
| Database | Self-hosted PostgreSQL |
| ORM | Drizzle ORM |
| Billing | Paddle (merchant of record) |

## Data Model

```
users (managed by BetterAuth)
├── id (text, PK)
├── email (text, unique)
├── name (text)
├── emailVerified (boolean)
├── image (text, nullable)
├── createdAt (timestamp)
└── updatedAt (timestamp)

sessions (managed by BetterAuth)
├── id (text, PK)
├── userId → users.id
├── expiresAt (timestamp)
└── token (text, unique)

accounts (managed by BetterAuth, for OAuth providers)
├── id (text, PK)
├── userId → users.id
├── provider (text)
└── providerAccountId (text)

plans
├── id (text, PK)
├── name (text) — "free", "pro"
├── projectLimit (integer) — 3 for free, null for pro (unlimited)
├── paddlePriceId (text, nullable) — null for free, Paddle price ID for pro
└── createdAt (timestamp)

subscriptions
├── id (text, PK)
├── userId → users.id (unique — one active sub per user)
├── planId → plans.id
├── paddleSubscriptionId (text, nullable)
├── paddleCustomerId (text, nullable)
├── status (text) — "active", "canceled", "past_due", "trialing"
├── currentPeriodStart (timestamp)
├── currentPeriodEnd (timestamp)
├── createdAt (timestamp)
└── updatedAt (timestamp)

projects
├── id (text, PK)
├── userId → users.id
├── name (text)
├── source (text) — the DBML content
├── createdAt (timestamp)
└── updatedAt (timestamp)
```

Every user gets a `subscription` row — free users point to the "free" plan.

## Auth Flow

- BetterAuth server instance in `src/lib/server/auth.ts` (Drizzle + Postgres)
- BetterAuth client in `src/lib/auth-client.ts`
- `hooks.server.ts` handles BetterAuth routes (`/api/auth/*`) and loads session into `event.locals`
- Protected routes check session in `+layout.server.ts`, redirect to `/login` if unauthenticated

## Route Structure

```
/ .................. Landing/marketing page (public)
/login ............. Sign in form
/signup ............ Sign up form
/app ............... Main editor (protected)
/app/settings ...... Account & billing management
/api/auth/* ........ BetterAuth endpoints (automatic)
/api/webhooks/paddle  Paddle webhook handler
```

## Billing Flow (Paddle)

1. User clicks "Upgrade to Pro" → Paddle.js opens checkout overlay (email pre-filled)
2. Paddle handles payment UI
3. Webhook at `/api/webhooks/paddle` processes events:
   - `subscription.created` → create subscription record
   - `subscription.updated` → update status
   - `subscription.canceled` → mark canceled
   - `transaction.completed` → payment confirmation
4. User session reloads, Pro features unlocked

Plan enforcement: server-side check on project creation — count projects vs `plan.projectLimit`. Client shows upgrade prompt but enforcement is server-side only.

Paddle customer portal linked from `/app/settings` for billing management.

## Pro Features

- **Free tier:** 3 projects, all editor/export/share features included
- **Pro tier:** Unlimited projects

All other features (SQL export, image download, share links, diagram rendering) remain free.

## Migration Strategy

1. Switch from `adapter-static` to `adapter-node`
2. Move current `+page.svelte` editor to `/app/+page.svelte` (protected)
3. New `/+page.svelte` becomes landing page
4. Sidebar switches from localStorage to server API calls
5. On sign-up, offer one-time "import local projects" to migrate localStorage data to Postgres
6. Editor and Diagram components unchanged — they receive `source` from server instead of localStorage
