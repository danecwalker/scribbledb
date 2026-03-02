import { db } from '$lib/server/db';
import { projects, subscriptions, plans } from '$lib/server/schema';
import { eq, and, count, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login');

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, locals.user.id))
    .orderBy(desc(projects.updatedAt));

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
    plan: plan?.[0] ?? {
      id: 'free',
      name: 'free',
      projectLimit: 3,
      paddlePriceId: null,
      createdAt: new Date(),
    },
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
        return fail(403, {
          error: 'Project limit reached. Upgrade to Pro for unlimited projects.',
        });
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
