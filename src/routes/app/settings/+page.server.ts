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
