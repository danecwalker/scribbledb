# Users & Plans Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user authentication (BetterAuth), cloud project storage (PostgreSQL + Drizzle), and monetized Free/Pro plans (Paddle) to ScribbleDB.

**Architecture:** Convert the static SvelteKit SPA into a full-stack SvelteKit app with server routes. BetterAuth handles auth via server hooks. Drizzle ORM connects to self-hosted PostgreSQL. Paddle handles subscription billing via client-side checkout overlay + server-side webhooks. The existing editor/diagram stays client-side — only project CRUD and auth go through the server.

**Tech Stack:** SvelteKit (Node adapter), BetterAuth, Drizzle ORM, PostgreSQL, Paddle, TypeScript

---

### Task 1: Install Dependencies & Switch to Node Adapter

**Files:**
- Modify: `package.json`
- Modify: `svelte.config.js`
- Modify: `src/routes/+layout.ts`

**Step 1: Install packages**

Run:
```bash
bun add better-auth drizzle-orm postgres @paddle/paddle-js
bun add -d @sveltejs/adapter-node drizzle-kit @types/better-auth
```

**Step 2: Switch adapter in svelte.config.js**

Replace the full file:
```js
import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
```

**Step 3: Remove static-only settings from +layout.ts**

Replace `src/routes/+layout.ts`:
```ts
export const ssr = false;
```

Remove `prerender = true` since we now need server routes.

**Step 4: Create .env file**

Create `.env`:
```
DATABASE_URL=postgresql://user:password@localhost:5432/scribbledb
BETTER_AUTH_SECRET=change-me-to-a-32-char-random-string
BETTER_AUTH_URL=http://localhost:5173
PADDLE_API_KEY=your-paddle-api-key
PADDLE_WEBHOOK_SECRET=your-paddle-webhook-secret
PADDLE_CLIENT_TOKEN=your-paddle-client-token
PADDLE_PRICE_ID_PRO=your-pro-price-id
```

Add `.env` to `.gitignore` if not already there.

**Step 5: Verify dev server starts**

Run: `bun run dev`
Expected: Dev server starts without errors.

**Step 6: Commit**

```bash
git add package.json svelte.config.js src/routes/+layout.ts .env.example .gitignore bun.lock
git commit -m "chore: switch to node adapter and add auth/db/billing deps"
```

---

### Task 2: Database Schema with Drizzle

**Files:**
- Create: `src/lib/server/db.ts`
- Create: `src/lib/server/schema.ts`
- Create: `drizzle.config.ts`

**Step 1: Create Drizzle database connection**

Create `src/lib/server/db.ts`:
```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!);
export const db = drizzle(client, { schema });
```

**Step 2: Create schema with BetterAuth tables + app tables**

Create `src/lib/server/schema.ts`:
```ts
import { pgTable, text, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

// --- BetterAuth tables (managed by BetterAuth, defined here for Drizzle awareness) ---

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// --- App tables ---

export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  projectLimit: integer('project_limit'), // null = unlimited
  paddlePriceId: text('paddle_price_id'), // null for free plan
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  planId: text('plan_id').notNull().references(() => plans.id),
  paddleSubscriptionId: text('paddle_subscription_id'),
  paddleCustomerId: text('paddle_customer_id'),
  status: text('status').notNull().default('active'), // active, canceled, past_due
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  source: text('source').notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

**Step 3: Create Drizzle config**

Create `drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 4: Generate and run migration**

Run:
```bash
bunx drizzle-kit generate
bunx drizzle-kit migrate
```

Expected: Migration files created in `drizzle/` and applied to database.

**Step 5: Seed the plans table**

Create `src/lib/server/seed.ts`:
```ts
import { db } from './db';
import { plans } from './schema';

async function seed() {
  await db.insert(plans).values([
    {
      id: 'free',
      name: 'free',
      projectLimit: 3,
      paddlePriceId: null,
    },
    {
      id: 'pro',
      name: 'pro',
      projectLimit: null,
      paddlePriceId: process.env.PADDLE_PRICE_ID_PRO || 'pri_placeholder',
    },
  ]).onConflictDoNothing();

  console.log('Plans seeded');
  process.exit(0);
}

seed();
```

Run: `bun src/lib/server/seed.ts`

**Step 6: Commit**

```bash
git add src/lib/server/db.ts src/lib/server/schema.ts src/lib/server/seed.ts drizzle.config.ts drizzle/
git commit -m "feat: add database schema with Drizzle (users, plans, subscriptions, projects)"
```

---

### Task 3: BetterAuth Server & Hooks

**Files:**
- Create: `src/lib/server/auth.ts`
- Create: `src/lib/auth-client.ts`
- Create: `src/hooks.server.ts`
- Modify: `src/app.d.ts`

**Step 1: Create BetterAuth server instance**

Create `src/lib/server/auth.ts`:
```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
```

**Step 2: Create auth client for frontend**

Create `src/lib/auth-client.ts`:
```ts
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient();
```

**Step 3: Create SvelteKit hooks**

Create `src/hooks.server.ts`:
```ts
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({
    headers: event.request.headers,
  });

  if (session) {
    event.locals.user = session.user;
    event.locals.session = session.session;
  }

  return svelteKitHandler({ event, resolve, auth });
}
```

**Step 4: Update app.d.ts with typed locals**

Replace `src/app.d.ts`:
```ts
import type { auth } from '$lib/server/auth';

declare global {
  namespace App {
    interface Locals {
      user: typeof auth.$Infer.Session.user | null;
      session: typeof auth.$Infer.Session.session | null;
    }
  }
}

export {};
```

**Step 5: Verify dev server starts with auth**

Run: `bun run dev`
Expected: Dev server starts. Visiting `/api/auth/ok` returns a JSON response confirming BetterAuth is running.

**Step 6: Commit**

```bash
git add src/lib/server/auth.ts src/lib/auth-client.ts src/hooks.server.ts src/app.d.ts
git commit -m "feat: add BetterAuth with Drizzle adapter and SvelteKit hooks"
```

---

### Task 4: Auth Pages (Login & Signup)

**Files:**
- Create: `src/routes/login/+page.svelte`
- Create: `src/routes/signup/+page.svelte`

**Step 1: Create login page**

Create `src/routes/login/+page.svelte`:
```svelte
<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleLogin() {
    error = '';
    loading = true;
    const result = await authClient.signIn.email({ email, password });
    loading = false;

    if (result.error) {
      error = result.error.message ?? 'Login failed';
    } else {
      goto('/app');
    }
  }
</script>

<svelte:head>
  <title>Log In - ScribbleDB</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#1e1e2e]">
  <div class="w-full max-w-sm rounded-lg bg-[#181825] p-8 border border-[#313244]">
    <h1 class="mb-6 text-xl font-semibold text-[#cdd6f4]">Log in to ScribbleDB</h1>

    {#if error}
      <div class="mb-4 rounded bg-[#f38ba8]/10 px-3 py-2 text-sm text-[#f38ba8]">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      <label class="mb-4 block">
        <span class="mb-1 block text-xs text-[#a6adc8]">Email</span>
        <input
          type="email"
          bind:value={email}
          required
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
      <label class="mb-6 block">
        <span class="mb-1 block text-xs text-[#a6adc8]">Password</span>
        <input
          type="password"
          bind:value={password}
          required
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        class="w-full rounded bg-[#89b4fa] px-4 py-2 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Logging in...' : 'Log in'}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[#a6adc8]">
      Don't have an account? <a href="/signup" class="text-[#89b4fa] hover:underline">Sign up</a>
    </p>
  </div>
</div>
```

**Step 2: Create signup page**

Create `src/routes/signup/+page.svelte`:
```svelte
<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSignup() {
    error = '';
    loading = true;
    const result = await authClient.signUp.email({ name, email, password });
    loading = false;

    if (result.error) {
      error = result.error.message ?? 'Signup failed';
    } else {
      goto('/app');
    }
  }
</script>

<svelte:head>
  <title>Sign Up - ScribbleDB</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#1e1e2e]">
  <div class="w-full max-w-sm rounded-lg bg-[#181825] p-8 border border-[#313244]">
    <h1 class="mb-6 text-xl font-semibold text-[#cdd6f4]">Create your ScribbleDB account</h1>

    {#if error}
      <div class="mb-4 rounded bg-[#f38ba8]/10 px-3 py-2 text-sm text-[#f38ba8]">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSignup(); }}>
      <label class="mb-4 block">
        <span class="mb-1 block text-xs text-[#a6adc8]">Name</span>
        <input
          type="text"
          bind:value={name}
          required
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
      <label class="mb-4 block">
        <span class="mb-1 block text-xs text-[#a6adc8]">Email</span>
        <input
          type="email"
          bind:value={email}
          required
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
      <label class="mb-6 block">
        <span class="mb-1 block text-xs text-[#a6adc8]">Password</span>
        <input
          type="password"
          bind:value={password}
          required
          minlength="8"
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        class="w-full rounded bg-[#89b4fa] px-4 py-2 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating account...' : 'Sign up'}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[#a6adc8]">
      Already have an account? <a href="/login" class="text-[#89b4fa] hover:underline">Log in</a>
    </p>
  </div>
</div>
```

**Step 3: Verify pages render**

Run: `bun run dev`
Visit `/login` and `/signup`. Expected: Forms render with Catppuccin dark theme styling.

**Step 4: Commit**

```bash
git add src/routes/login/+page.svelte src/routes/signup/+page.svelte
git commit -m "feat: add login and signup pages"
```

---

### Task 5: Assign Free Plan on Signup

**Files:**
- Modify: `src/lib/server/auth.ts`

**Step 1: Add after-signup hook to create free subscription**

Update `src/lib/server/auth.ts` to add a hook that creates a free subscription when a user signs up:

```ts
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from './db';
import * as schema from './schema';
import { subscriptions } from './schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    changeEmail: {
      enabled: true,
    },
  },
  hooks: {
    after: [
      {
        matcher(context) {
          return context.path === '/sign-up/email';
        },
        async handler(ctx) {
          const newUser = ctx.context.newUser;
          if (newUser) {
            await db.insert(subscriptions).values({
              id: crypto.randomUUID(),
              userId: newUser.id,
              planId: 'free',
              status: 'active',
            });
          }
        },
      },
    ],
  },
});
```

**Step 2: Verify signup creates subscription**

Sign up a test user, then check database:
```sql
SELECT u.email, s.plan_id, s.status FROM users u JOIN subscriptions s ON s.user_id = u.id;
```
Expected: New user has a row in `subscriptions` with `plan_id = 'free'`, `status = 'active'`.

**Step 3: Commit**

```bash
git add src/lib/server/auth.ts
git commit -m "feat: auto-assign free plan on user signup"
```

---

### Task 6: Move Editor to /app (Protected Route)

**Files:**
- Create: `src/routes/app/+layout.server.ts`
- Create: `src/routes/app/+layout.svelte`
- Move: `src/routes/+page.svelte` → `src/routes/app/+page.svelte` (with modifications)
- Create: `src/routes/+page.svelte` (new landing page)
- Modify: `src/routes/+layout.svelte`

**Step 1: Create protected layout for /app**

Create `src/routes/app/+layout.server.ts`:
```ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }

  return {
    user: locals.user,
  };
};
```

Create `src/routes/app/+layout.svelte`:
```svelte
<script lang="ts">
  let { children } = $props();
</script>

{@render children()}
```

**Step 2: Move the current +page.svelte to /app/+page.svelte**

Copy `src/routes/+page.svelte` to `src/routes/app/+page.svelte`. This file keeps all existing editor functionality — it will be modified in the next task to use server data instead of localStorage.

**Step 3: Create a landing page**

Create `src/routes/+page.svelte`:
```svelte
<svelte:head>
  <title>ScribbleDB - Design Database Schemas Visually</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center justify-center bg-[#1e1e2e] px-4 text-center">
  <h1 class="mb-4 text-4xl font-bold text-[#cdd6f4]">ScribbleDB</h1>
  <p class="mb-8 max-w-md text-lg text-[#a6adc8]">
    Design and visualize database schemas with DBML. Write markup, see diagrams instantly.
  </p>
  <div class="flex gap-4">
    <a
      href="/signup"
      class="rounded bg-[#89b4fa] px-6 py-2.5 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors"
    >
      Get Started Free
    </a>
    <a
      href="/login"
      class="rounded border border-[#313244] px-6 py-2.5 text-sm font-medium text-[#cdd6f4] hover:bg-[#313244] transition-colors"
    >
      Log In
    </a>
  </div>
</div>
```

**Step 4: Verify routing**

Run: `bun run dev`
- Visit `/` → landing page
- Visit `/app` → redirects to `/login`
- Log in → redirects to `/app` with the editor

**Step 5: Commit**

```bash
git add src/routes/app/ src/routes/+page.svelte
git commit -m "feat: move editor to /app behind auth, add landing page"
```

---

### Task 7: Server-Side Project CRUD

**Files:**
- Create: `src/routes/app/+page.server.ts`
- Modify: `src/routes/app/+page.svelte`

**Step 1: Create server load + form actions for project CRUD**

Create `src/routes/app/+page.server.ts`:
```ts
import { db } from '$lib/server/db';
import { projects, subscriptions, plans } from '$lib/server/schema';
import { eq, and, count } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login');

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, locals.user.id))
    .orderBy(projects.updatedAt);

  const sub = await db
    .select({ planId: subscriptions.planId, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, locals.user.id))
    .limit(1);

  const plan = sub[0]
    ? await db.select().from(plans).where(eq(plans.id, sub[0].planId)).limit(1)
    : null;

  return {
    projects: userProjects,
    plan: plan?.[0] ?? { id: 'free', name: 'free', projectLimit: 3, paddlePriceId: null },
    subscription: sub[0] ?? null,
  };
};

export const actions: Actions = {
  create: async ({ locals }) => {
    if (!locals.user) return fail(401);

    // Check project limit
    const sub = await db
      .select({ planId: subscriptions.planId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, locals.user.id))
      .limit(1);

    const plan = sub[0]
      ? await db.select().from(plans).where(eq(plans.id, sub[0].planId)).limit(1)
      : null;

    const limit = plan?.[0]?.projectLimit;
    if (limit !== null && limit !== undefined) {
      const [{ value: projectCount }] = await db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.userId, locals.user.id));

      if (projectCount >= limit) {
        return fail(403, { error: 'Project limit reached. Upgrade to Pro for unlimited projects.' });
      }
    }

    const newProject = {
      id: crypto.randomUUID(),
      userId: locals.user.id,
      name: 'Untitled',
      source: '',
    };

    await db.insert(projects).values(newProject);
    return { project: newProject };
  },

  update: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const id = data.get('id') as string;
    const name = data.get('name') as string | null;
    const source = data.get('source') as string | null;

    if (!id) return fail(400);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== null) updates.name = name;
    if (source !== null) updates.source = source;

    await db
      .update(projects)
      .set(updates)
      .where(and(eq(projects.id, id), eq(projects.userId, locals.user.id)));

    return { success: true };
  },

  delete: async ({ locals, request }) => {
    if (!locals.user) return fail(401);
    const data = await request.formData();
    const id = data.get('id') as string;
    if (!id) return fail(400);

    await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.userId, locals.user.id)));

    return { success: true };
  },
};
```

**Step 2: Rewrite +page.svelte to use server data**

Modify `src/routes/app/+page.svelte` to replace localStorage with server data:

Key changes:
- Remove `STORAGE_KEY`, `ACTIVE_KEY`, `saveProjects()`, `saveActiveId()`, and the localStorage `$effect`
- Get `projects` and `plan` from `$page.data` (server load)
- Replace `createProject()` with a form action POST to `?/create`
- Replace inline source saves with debounced form action POST to `?/update`
- Replace `deleteProject()` with a form action POST to `?/delete`
- Replace `renameProject()` with a form action POST to `?/update`
- Keep `activeProjectId` and `source` as client state (selected from server-loaded list)
- Keep all editor, diagram, layout, share, and export logic unchanged

The `$effect` for loading becomes:
```ts
// Load projects from server data
$effect(() => {
  untrack(() => {
    const serverProjects = $page.data.projects;
    if (serverProjects.length === 0) {
      // Will create a default project via form action
      return;
    }
    projects = serverProjects;
    activeProjectId = serverProjects[0].id;
    source = serverProjects[0].source;

    // Check for shared diagram in URL hash
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      // ... existing share decompression logic ...
    } else {
      runLayout();
    }
  });
});
```

Auto-save becomes a debounced fetch to the update action:
```ts
function handleSourceChange(newSource: string) {
  if (activeProjectId) {
    // Debounced server save
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const form = new FormData();
      form.set('id', activeProjectId!);
      form.set('source', newSource);
      fetch('?/update', { method: 'POST', body: form });
    }, 1000);
  }

  // Existing debounced parse (unchanged)
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    parseSource(newSource);
  }, 300);
}
```

**Step 3: Verify CRUD works**

- Create a project → appears in sidebar
- Edit DBML → auto-saves to server
- Rename project → persists on reload
- Delete project → removed from list

**Step 4: Commit**

```bash
git add src/routes/app/+page.server.ts src/routes/app/+page.svelte
git commit -m "feat: replace localStorage with server-side project CRUD"
```

---

### Task 8: Upgrade Prompt & Plan Enforcement UI

**Files:**
- Modify: `src/routes/app/+page.svelte` (add upgrade banner when at limit)
- Modify: `src/lib/components/Sidebar.svelte` (show project count / limit)

**Step 1: Add project count display to Sidebar**

Modify `src/lib/components/Sidebar.svelte` to accept and display plan info:

Add to Props interface:
```ts
projectLimit: number | null; // null = unlimited
```

In the header area, below the "Projects" label:
```svelte
<span class="text-[10px] text-[#6c7086]">
  {projects.length}{projectLimit !== null ? `/${projectLimit}` : ''} projects
</span>
```

**Step 2: Show upgrade banner when at project limit**

In `src/routes/app/+page.svelte`, when user tries to create a project and gets a 403:

```svelte
{#if showUpgradePrompt}
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="rounded-lg bg-[#181825] p-6 border border-[#313244] max-w-sm text-center">
      <h2 class="text-lg font-semibold text-[#cdd6f4] mb-2">Project limit reached</h2>
      <p class="text-sm text-[#a6adc8] mb-4">
        Free accounts can have up to 3 projects. Upgrade to Pro for unlimited projects.
      </p>
      <div class="flex gap-3 justify-center">
        <button
          onclick={() => showUpgradePrompt = false}
          class="rounded border border-[#313244] px-4 py-2 text-sm text-[#cdd6f4] hover:bg-[#313244]"
        >
          Cancel
        </button>
        <button
          onclick={openCheckout}
          class="rounded bg-[#89b4fa] px-4 py-2 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec]"
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  </div>
{/if}
```

**Step 3: Commit**

```bash
git add src/routes/app/+page.svelte src/lib/components/Sidebar.svelte
git commit -m "feat: add project limit display and upgrade prompt"
```

---

### Task 9: Paddle Checkout Integration

**Files:**
- Modify: `src/routes/app/+page.svelte` (initialize Paddle, open checkout)
- Create: `src/routes/api/webhooks/paddle/+server.ts`

**Step 1: Add Paddle.js initialization and checkout**

In `src/routes/app/+page.svelte`, add:

```ts
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

let paddle: Paddle | undefined = $state();

$effect(() => {
  initializePaddle({
    token: 'YOUR_PADDLE_CLIENT_TOKEN', // TODO: pass from server via page data
    environment: 'sandbox', // change to 'production' for live
  }).then((p) => {
    if (p) paddle = p;
  });
});

function openCheckout() {
  if (!paddle) return;
  const user = $page.data.user;
  paddle.Checkout.open({
    items: [{ priceId: $page.data.plan?.paddlePriceId ?? '', quantity: 1 }],
    customer: { email: user.email },
    customData: { userId: user.id },
  });
}
```

Note: The `PADDLE_CLIENT_TOKEN` should be passed from the server via page data in `+page.server.ts` or the `/app/+layout.server.ts` load function, using `$env/static/public` or returning it in load data.

**Step 2: Create Paddle webhook handler**

Create `src/routes/api/webhooks/paddle/+server.ts`:
```ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { subscriptions } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET!;

function verifySignature(rawBody: string, signature: string): boolean {
  // Paddle webhook signature verification
  // See Paddle docs for exact algorithm
  const ts = signature.split(';').find(s => s.startsWith('ts='))?.split('=')[1];
  const h1 = signature.split(';').find(s => s.startsWith('h1='))?.split('=')[1];
  if (!ts || !h1) return false;

  const payload = `${ts}:${rawBody}`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(h1), Buffer.from(expected));
}

export const POST: RequestHandler = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get('paddle-signature') ?? '';

  if (!verifySignature(rawBody, signature)) {
    return json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  switch (event.event_type) {
    case 'subscription.created':
    case 'subscription.updated': {
      const data = event.data;
      const userId = data.custom_data?.userId;
      if (!userId) break;

      await db
        .update(subscriptions)
        .set({
          planId: 'pro',
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customer_id,
          status: data.status === 'active' ? 'active' : data.status,
          currentPeriodStart: new Date(data.current_billing_period.starts_at),
          currentPeriodEnd: new Date(data.current_billing_period.ends_at),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));
      break;
    }

    case 'subscription.canceled': {
      const data = event.data;
      const userId = data.custom_data?.userId;
      if (!userId) break;

      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));
      break;
    }
  }

  return json({ received: true });
};
```

**Step 3: Verify checkout opens**

Click "Upgrade to Pro" → Paddle overlay appears (in sandbox mode). After completing test checkout, webhook fires and subscription status updates.

**Step 4: Commit**

```bash
git add src/routes/app/+page.svelte src/routes/api/webhooks/paddle/+server.ts
git commit -m "feat: add Paddle checkout and webhook handler for Pro upgrades"
```

---

### Task 10: Settings Page (Account & Billing)

**Files:**
- Create: `src/routes/app/settings/+page.server.ts`
- Create: `src/routes/app/settings/+page.svelte`

**Step 1: Create settings server load**

Create `src/routes/app/settings/+page.server.ts`:
```ts
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { subscriptions, plans } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login');

  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, locals.user.id))
    .limit(1);

  const plan = sub[0]
    ? await db.select().from(plans).where(eq(plans.id, sub[0].planId)).limit(1)
    : null;

  return {
    user: locals.user,
    subscription: sub[0] ?? null,
    plan: plan?.[0] ?? null,
  };
};
```

**Step 2: Create settings page**

Create `src/routes/app/settings/+page.svelte`:
```svelte
<script lang="ts">
  import { page } from '$app/stores';
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  const { data } = $page;

  async function handleLogout() {
    await authClient.signOut();
    goto('/');
  }
</script>

<svelte:head>
  <title>Settings - ScribbleDB</title>
</svelte:head>

<div class="flex min-h-screen bg-[#1e1e2e]">
  <div class="mx-auto w-full max-w-xl px-4 py-12">
    <div class="mb-4">
      <a href="/app" class="text-sm text-[#89b4fa] hover:underline">&larr; Back to editor</a>
    </div>

    <h1 class="mb-8 text-2xl font-bold text-[#cdd6f4]">Settings</h1>

    <!-- Account -->
    <section class="mb-8 rounded-lg bg-[#181825] p-6 border border-[#313244]">
      <h2 class="mb-4 text-lg font-semibold text-[#cdd6f4]">Account</h2>
      <div class="space-y-2 text-sm text-[#a6adc8]">
        <p><span class="text-[#6c7086]">Name:</span> {data.user?.name}</p>
        <p><span class="text-[#6c7086]">Email:</span> {data.user?.email}</p>
      </div>
      <button
        onclick={handleLogout}
        class="mt-4 rounded border border-[#f38ba8]/30 px-4 py-1.5 text-sm text-[#f38ba8] hover:bg-[#f38ba8]/10 transition-colors"
      >
        Log out
      </button>
    </section>

    <!-- Plan & Billing -->
    <section class="rounded-lg bg-[#181825] p-6 border border-[#313244]">
      <h2 class="mb-4 text-lg font-semibold text-[#cdd6f4]">Plan & Billing</h2>
      <p class="text-sm text-[#a6adc8]">
        Current plan: <span class="font-medium text-[#cdd6f4] capitalize">{data.plan?.name ?? 'Free'}</span>
      </p>
      {#if data.plan?.name === 'pro' && data.subscription?.paddleSubscriptionId}
        <p class="mt-2 text-xs text-[#6c7086]">
          Manage your subscription, invoices, and payment method through Paddle.
        </p>
        <!-- Paddle customer portal link would go here -->
      {:else}
        <p class="mt-2 text-xs text-[#6c7086]">
          Free plan: up to {data.plan?.projectLimit ?? 3} projects.
        </p>
        <a
          href="/app"
          class="mt-3 inline-block rounded bg-[#89b4fa] px-4 py-1.5 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors"
        >
          Upgrade to Pro
        </a>
      {/if}
    </section>
  </div>
</div>
```

**Step 3: Add settings link to app header**

Add a user avatar / settings link in the editor toolbar (in `src/routes/app/+page.svelte`), e.g., a small user icon in the top-right that links to `/app/settings`.

**Step 4: Commit**

```bash
git add src/routes/app/settings/
git commit -m "feat: add settings page with account info and plan display"
```

---

### Task 11: LocalStorage Import on First Login

**Files:**
- Modify: `src/routes/app/+page.svelte`

**Step 1: Check for localStorage data on first load**

When the server returns zero projects for a user and localStorage has `scribbledb-projects` data, show an import prompt:

```ts
$effect(() => {
  untrack(() => {
    if ($page.data.projects.length > 0) return;

    // Check for localStorage projects to import
    try {
      const raw = localStorage.getItem('scribbledb-projects');
      if (raw) {
        const localProjects = JSON.parse(raw);
        if (localProjects.length > 0) {
          showImportPrompt = true;
          localProjectsToImport = localProjects;
          return;
        }
      }
    } catch {}

    // No local data either — create default project
    createProject();
  });
});
```

**Step 2: Import modal**

```svelte
{#if showImportPrompt}
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="rounded-lg bg-[#181825] p-6 border border-[#313244] max-w-sm">
      <h2 class="text-lg font-semibold text-[#cdd6f4] mb-2">Import local projects?</h2>
      <p class="text-sm text-[#a6adc8] mb-4">
        Found {localProjectsToImport.length} project(s) saved in this browser. Import them to your account?
      </p>
      <div class="flex gap-3 justify-end">
        <button onclick={skipImport} class="rounded border border-[#313244] px-4 py-2 text-sm text-[#cdd6f4]">
          Skip
        </button>
        <button onclick={importLocalProjects} class="rounded bg-[#89b4fa] px-4 py-2 text-sm font-medium text-[#1e1e2e]">
          Import
        </button>
      </div>
    </div>
  </div>
{/if}
```

**Step 3: Import function**

Posts each local project to the `?/create` action with name and source, then clears localStorage.

**Step 4: Commit**

```bash
git add src/routes/app/+page.svelte
git commit -m "feat: add localStorage import prompt for new users"
```

---

### Task 12: Navigation & Polish

**Files:**
- Modify: `src/routes/+layout.svelte` (add global nav if needed)
- Modify: `src/routes/app/+page.svelte` (add user menu / settings link)
- Modify: `src/lib/components/Sidebar.svelte` (add settings + logout links at bottom)

**Step 1: Add user menu to Sidebar**

At the bottom of `Sidebar.svelte`, add:
```svelte
<div class="border-t border-[#313244] px-3 py-2">
  <a href="/app/settings" class="block text-xs text-[#a6adc8] hover:text-[#cdd6f4] py-1">Settings</a>
</div>
```

**Step 2: Handle already-logged-in users on landing page**

In `src/routes/+page.svelte` or `src/routes/+layout.server.ts`, if the user is already authenticated and visits `/`, optionally redirect to `/app` or show a "Go to app" button.

**Step 3: Verify full flow**

1. Visit `/` → see landing page
2. Click "Sign up" → create account → redirected to `/app`
3. Import local projects prompt appears (if applicable)
4. Create projects, edit DBML, rename, delete
5. Hit project limit → upgrade prompt → Paddle checkout
6. After upgrade → unlimited projects
7. Visit `/app/settings` → see plan info, log out
8. Log out → redirected to `/`
9. Log back in → all projects persisted

**Step 4: Commit**

```bash
git add src/routes/ src/lib/components/Sidebar.svelte
git commit -m "feat: add navigation, user menu, and polish auth flow"
```

---

Plan complete and saved to `docs/plans/2026-03-02-users-and-plans-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
