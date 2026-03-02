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

  </div>
</div>
