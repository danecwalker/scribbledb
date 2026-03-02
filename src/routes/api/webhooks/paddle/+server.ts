import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { subscriptions } from '$lib/server/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET!;

function verifySignature(rawBody: string, signature: string): boolean {
  const ts = signature.split(';').find(s => s.startsWith('ts='))?.split('=')[1];
  const h1 = signature.split(';').find(s => s.startsWith('h1='))?.split('=')[1];
  if (!ts || !h1) return false;

  const payload = `${ts}:${rawBody}`;
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  const h1Buffer = Buffer.from(h1);
  const expectedBuffer = Buffer.from(expected);
  if (h1Buffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(h1Buffer, expectedBuffer);
}

function mapPaddleStatus(paddleStatus: string): 'active' | 'canceled' | 'past_due' {
  switch (paddleStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'canceled':
      return 'canceled';
    case 'past_due':
      return 'past_due';
    default:
      return 'active';
  }
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
          status: mapPaddleStatus(data.status),
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
