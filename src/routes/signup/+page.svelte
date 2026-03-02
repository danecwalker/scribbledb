<script lang="ts">
  import { authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSignup() {
    error = '';
    loading = true;
    const result = await authClient.signUp.email({ name, email, password });
    loading = false;

    if (result.error) {
      error = result.error.message ?? 'Signup failed';
    } else {
      goto('/app');
    }
  }
</script>

<svelte:head>
  <title>Sign Up - ScribbleDB</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-[#1e1e2e]">
  <div class="w-full max-w-sm rounded-lg bg-[#181825] p-8 border border-[#313244]">
    <h1 class="mb-6 text-xl font-semibold text-[#cdd6f4]">Create your ScribbleDB account</h1>

    {#if error}
      <div class="mb-4 rounded bg-[#f38ba8]/10 px-3 py-2 text-sm text-[#f38ba8]">{error}</div>
    {/if}

    <form onsubmit={(e) => { e.preventDefault(); handleSignup(); }}>
      <label class="mb-4 block">
        <span class="mb-1 block text-xs text-[#a6adc8]">Name</span>
        <input
          type="text"
          bind:value={name}
          required
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
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
          minlength="8"
          class="w-full rounded bg-[#1e1e2e] px-3 py-2 text-sm text-[#cdd6f4] border border-[#313244] outline-none focus:border-[#89b4fa]"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        class="w-full rounded bg-[#89b4fa] px-4 py-2 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] disabled:opacity-50 transition-colors"
      >
        {loading ? 'Creating account...' : 'Sign up'}
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-[#a6adc8]">
      Already have an account? <a href="/login" class="text-[#89b4fa] hover:underline">Log in</a>
    </p>
  </div>
</div>
