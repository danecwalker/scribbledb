import { db } from '$lib/server/db';
import { projects } from '$lib/server/schema';
import { eq, and, count, desc } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { generateId } from '$lib/server/id';
import type { PageServerLoad, Actions } from './$types';

const PROJECT_LIMIT = 3;

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) redirect(302, '/login');

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, locals.user.id))
    .orderBy(desc(projects.updatedAt));

  return {
    projects: userProjects,
    projectLimit: PROJECT_LIMIT,
  };
};

export const actions: Actions = {
  create: async ({ locals }) => {
    if (!locals.user) return fail(401);

    const [{ value: projectCount }] = await db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.userId, locals.user.id));

    if (projectCount >= PROJECT_LIMIT) {
      return fail(403, {
        error: `Project limit reached (max ${PROJECT_LIMIT}).`,
      });
    }

    const newProject = {
      id: generateId(),
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
