import { db } from '$lib/server/db';
import { projects } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const [project] = await db
		.select({ source: projects.source, name: projects.name })
		.from(projects)
		.where(eq(projects.id, params.id))
		.limit(1);

	if (!project) throw error(404, 'Project not found');

	return { source: project.source, name: project.name };
};
