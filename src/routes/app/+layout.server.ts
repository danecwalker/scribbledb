import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }

  return {
    user: locals.user,
    paddleClientToken: process.env.PADDLE_CLIENT_TOKEN ?? '',
    paddlePriceId: process.env.PADDLE_PRICE_ID_PRO ?? '',
  };
};
