<script lang="ts">
  import { page } from '$app/stores';
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  const data = $derived($page.data);

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
        Current plan: <span class="font-medium text-[#cdd6f4] capitalize">{(data.plan as any)?.name ?? 'Free'}</span>
      </p>
      {#if (data.plan as any)?.name === 'pro' && (data.subscription as any)?.paddleSubscriptionId}
        <p class="mt-2 text-xs text-[#6c7086]">
          Manage your subscription, invoices, and payment method through Paddle.
        </p>
      {:else}
        <p class="mt-2 text-xs text-[#6c7086]">
          Free plan: up to {(data.plan as any)?.projectLimit ?? 3} projects.
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
