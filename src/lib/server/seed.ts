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
