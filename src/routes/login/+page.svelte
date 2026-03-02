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
