<script lang="ts">
  import { page } from '$app/stores';

  const user = $derived(($page.data as any).user);
</script>

<svelte:head>
  <title>ScribbleDB - Design Database Schemas Visually</title>
  <meta name="description" content="Write DBML markup, see auto-laid-out database diagrams instantly. Export to SQL, PNG, SVG, and more." />
</svelte:head>

<!-- Nav -->
<nav class="fixed top-0 left-0 right-0 z-40 border-b border-[#313244] bg-[#1e1e2e]/90 backdrop-blur-sm">
  <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
    <a href="/" class="text-lg font-bold text-[#cdd6f4]">ScribbleDB</a>
    <div class="flex items-center gap-3">
      {#if user}
        <a href="/app" class="rounded bg-[#89b4fa] px-4 py-1.5 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors">
          Go to App
        </a>
      {:else}
        <a href="/login" class="text-sm text-[#a6adc8] hover:text-[#cdd6f4] transition-colors">Log In</a>
        <a href="/signup" class="rounded bg-[#89b4fa] px-4 py-1.5 text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors">
          Get Started Free
        </a>
      {/if}
    </div>
  </div>
</nav>

<!-- Hero -->
<section class="flex min-h-screen flex-col items-center justify-center bg-[#1e1e2e] px-6 pt-16 text-center">
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-6 text-5xl font-extrabold leading-tight text-[#cdd6f4]">
      Design database schemas<br /><span class="text-[#89b4fa]">visually</span>
    </h1>
    <p class="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-[#a6adc8]">
      Write DBML markup on the left, see a beautiful auto-laid-out diagram on the right. Export to SQL, PNG, SVG, or share with a link.
    </p>
    <div class="flex justify-center gap-4">
      {#if user}
        <a href="/app" class="rounded-lg bg-[#89b4fa] px-8 py-3 text-base font-semibold text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors">
          Open Editor
        </a>
      {:else}
        <a href="/signup" class="rounded-lg bg-[#89b4fa] px-8 py-3 text-base font-semibold text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors">
          Get Started Free
        </a>
        <a href="#pricing" class="rounded-lg border border-[#313244] px-8 py-3 text-base font-semibold text-[#cdd6f4] hover:bg-[#313244] transition-colors">
          See Plans
        </a>
      {/if}
    </div>
  </div>

  <!-- Schema illustration -->
  <div class="mx-auto mt-16 w-full max-w-3xl">
    <div class="rounded-xl border border-[#313244] bg-[#181825] p-1 shadow-2xl shadow-black/40">
      <div class="flex gap-1.5 px-3 py-2">
        <div class="h-2.5 w-2.5 rounded-full bg-[#f38ba8]"></div>
        <div class="h-2.5 w-2.5 rounded-full bg-[#fab387]"></div>
        <div class="h-2.5 w-2.5 rounded-full bg-[#a6e3a1]"></div>
      </div>
      <svg viewBox="0 0 800 320" class="w-full" xmlns="http://www.w3.org/2000/svg">
        <!-- Grid dots -->
        {#each Array(20) as _, x}
          {#each Array(8) as _, y}
            <circle cx={40 * x + 20} cy={40 * y + 20} r="1" fill="#313244" />
          {/each}
        {/each}

        <!-- Table: users -->
        <g transform="translate(60, 40)">
          <rect width="180" height="140" rx="8" fill="#181825" stroke="#313244" />
          <rect width="180" height="32" rx="8" fill="#89b4fa" />
          <rect y="24" width="180" height="8" fill="#89b4fa" />
          <text x="14" y="22" font-size="13" font-weight="600" fill="#1e1e2e" font-family="system-ui">users</text>
          <text x="14" y="54" font-size="11" fill="#cdd6f4" font-family="system-ui">id</text>
          <text x="120" y="54" font-size="10" fill="#6c7086" font-family="system-ui">integer PK</text>
          <text x="14" y="76" font-size="11" fill="#cdd6f4" font-family="system-ui">email</text>
          <text x="120" y="76" font-size="10" fill="#6c7086" font-family="system-ui">varchar</text>
          <text x="14" y="98" font-size="11" fill="#cdd6f4" font-family="system-ui">name</text>
          <text x="120" y="98" font-size="10" fill="#6c7086" font-family="system-ui">varchar</text>
          <text x="14" y="120" font-size="11" fill="#cdd6f4" font-family="system-ui">created_at</text>
          <text x="120" y="120" font-size="10" fill="#6c7086" font-family="system-ui">timestamp</text>
        </g>

        <!-- Table: orders -->
        <g transform="translate(320, 20)">
          <rect width="180" height="162" rx="8" fill="#181825" stroke="#313244" />
          <rect width="180" height="32" rx="8" fill="#f38ba8" />
          <rect y="24" width="180" height="8" fill="#f38ba8" />
          <text x="14" y="22" font-size="13" font-weight="600" fill="#1e1e2e" font-family="system-ui">orders</text>
          <text x="14" y="54" font-size="11" fill="#cdd6f4" font-family="system-ui">id</text>
          <text x="120" y="54" font-size="10" fill="#6c7086" font-family="system-ui">integer PK</text>
          <text x="14" y="76" font-size="11" fill="#cdd6f4" font-family="system-ui">user_id</text>
          <text x="120" y="76" font-size="10" fill="#6c7086" font-family="system-ui">integer FK</text>
          <text x="14" y="98" font-size="11" fill="#cdd6f4" font-family="system-ui">total</text>
          <text x="120" y="98" font-size="10" fill="#6c7086" font-family="system-ui">decimal</text>
          <text x="14" y="120" font-size="11" fill="#cdd6f4" font-family="system-ui">status</text>
          <text x="120" y="120" font-size="10" fill="#6c7086" font-family="system-ui">varchar</text>
          <text x="14" y="142" font-size="11" fill="#cdd6f4" font-family="system-ui">placed_at</text>
          <text x="120" y="142" font-size="10" fill="#6c7086" font-family="system-ui">timestamp</text>
        </g>

        <!-- Table: products -->
        <g transform="translate(580, 60)">
          <rect width="180" height="140" rx="8" fill="#181825" stroke="#313244" />
          <rect width="180" height="32" rx="8" fill="#a6e3a1" />
          <rect y="24" width="180" height="8" fill="#a6e3a1" />
          <text x="14" y="22" font-size="13" font-weight="600" fill="#1e1e2e" font-family="system-ui">products</text>
          <text x="14" y="54" font-size="11" fill="#cdd6f4" font-family="system-ui">id</text>
          <text x="120" y="54" font-size="10" fill="#6c7086" font-family="system-ui">integer PK</text>
          <text x="14" y="76" font-size="11" fill="#cdd6f4" font-family="system-ui">name</text>
          <text x="120" y="76" font-size="10" fill="#6c7086" font-family="system-ui">varchar</text>
          <text x="14" y="98" font-size="11" fill="#cdd6f4" font-family="system-ui">price</text>
          <text x="120" y="98" font-size="10" fill="#6c7086" font-family="system-ui">decimal</text>
          <text x="14" y="120" font-size="11" fill="#cdd6f4" font-family="system-ui">sku</text>
          <text x="120" y="120" font-size="10" fill="#6c7086" font-family="system-ui">varchar</text>
        </g>

        <!-- Relationship lines -->
        <!-- users -> orders -->
        <path d="M240,110 C280,110 280,76 320,76" fill="none" stroke="#585b70" stroke-width="1.5" />
        <circle cx="240" cy="110" r="4" fill="#89b4fa" />
        <circle cx="320" cy="76" r="4" fill="#f38ba8" />

        <!-- orders -> products (implied via order_items) -->
        <path d="M500,100 C540,100 540,130 580,130" fill="none" stroke="#585b70" stroke-width="1.5" />
        <circle cx="500" cy="100" r="4" fill="#f38ba8" />
        <circle cx="580" cy="130" r="4" fill="#a6e3a1" />

        <!-- Cardinality labels -->
        <text x="248" y="106" font-size="10" fill="#89b4fa" font-family="system-ui" font-weight="600">1</text>
        <text x="308" y="72" font-size="10" fill="#f38ba8" font-family="system-ui" font-weight="600">N</text>
        <text x="508" y="96" font-size="10" fill="#f38ba8" font-family="system-ui" font-weight="600">N</text>
        <text x="568" y="126" font-size="10" fill="#a6e3a1" font-family="system-ui" font-weight="600">1</text>

        <!-- Payments table (small) -->
        <g transform="translate(180, 220)">
          <rect width="160" height="96" rx="8" fill="#181825" stroke="#313244" />
          <rect width="160" height="32" rx="8" fill="#fab387" />
          <rect y="24" width="160" height="8" fill="#fab387" />
          <text x="14" y="22" font-size="13" font-weight="600" fill="#1e1e2e" font-family="system-ui">payments</text>
          <text x="14" y="54" font-size="11" fill="#cdd6f4" font-family="system-ui">id</text>
          <text x="106" y="54" font-size="10" fill="#6c7086" font-family="system-ui">integer PK</text>
          <text x="14" y="76" font-size="11" fill="#cdd6f4" font-family="system-ui">order_id</text>
          <text x="106" y="76" font-size="10" fill="#6c7086" font-family="system-ui">integer FK</text>
        </g>

        <!-- orders -> payments -->
        <path d="M410,182 C410,220 340,220 340,220" fill="none" stroke="#585b70" stroke-width="1.5" />
        <circle cx="410" cy="182" r="4" fill="#f38ba8" />
        <circle cx="340" cy="220" r="4" fill="#fab387" />
        <text x="418" y="186" font-size="10" fill="#f38ba8" font-family="system-ui" font-weight="600">1</text>
        <text x="345" y="216" font-size="10" fill="#fab387" font-family="system-ui" font-weight="600">N</text>
      </svg>
    </div>
  </div>
</section>

<!-- Features -->
<section class="bg-[#181825] px-6 py-24">
  <div class="mx-auto max-w-5xl">
    <h2 class="mb-4 text-center text-3xl font-bold text-[#cdd6f4]">Everything you need to design schemas</h2>
    <p class="mx-auto mb-16 max-w-lg text-center text-[#a6adc8]">
      A focused tool that does one thing well — turns DBML into beautiful, interactive diagrams.
    </p>
    <div class="grid gap-8 md:grid-cols-3">
      <!-- Feature 1 -->
      <div class="rounded-xl border border-[#313244] bg-[#1e1e2e] p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#89b4fa]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 4h14M3 8h10M3 12h12M3 16h8" stroke="#89b4fa" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <h3 class="mb-2 text-base font-semibold text-[#cdd6f4]">Write DBML</h3>
        <p class="text-sm leading-relaxed text-[#a6adc8]">
          Full-featured code editor with syntax highlighting, autocomplete, and real-time error detection. Write schemas in clean, readable markup.
        </p>
      </div>

      <!-- Feature 2 -->
      <div class="rounded-xl border border-[#313244] bg-[#1e1e2e] p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#a6e3a1]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="#a6e3a1" stroke-width="1.5" />
            <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="#a6e3a1" stroke-width="1.5" />
            <path d="M9 5.5h2.5a2 2 0 012 2V11" stroke="#a6e3a1" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <h3 class="mb-2 text-base font-semibold text-[#cdd6f4]">See Diagrams Instantly</h3>
        <p class="text-sm leading-relaxed text-[#a6adc8]">
          Auto-laid-out schema diagrams with color-coded tables, relationship lines, and cardinality indicators. Pan, zoom, and drag to arrange.
        </p>
      </div>

      <!-- Feature 3 -->
      <div class="rounded-xl border border-[#313244] bg-[#1e1e2e] p-6">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#f38ba8]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 13l4 4 8-10" stroke="#f38ba8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h3 class="mb-2 text-base font-semibold text-[#cdd6f4]">Export Anywhere</h3>
        <p class="text-sm leading-relaxed text-[#a6adc8]">
          Export to PostgreSQL, MySQL, MSSQL, or Oracle SQL. Download diagrams as PNG or SVG. Share schemas with a single link.
        </p>
      </div>
    </div>
  </div>
</section>

<!-- How It Works -->
<section class="bg-[#1e1e2e] px-6 py-24">
  <div class="mx-auto max-w-5xl">
    <h2 class="mb-16 text-center text-3xl font-bold text-[#cdd6f4]">How it works</h2>
    <div class="grid gap-12 md:grid-cols-3">
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#89b4fa]/10 text-lg font-bold text-[#89b4fa]">1</div>
        <h3 class="mb-2 text-base font-semibold text-[#cdd6f4]">Write your schema</h3>
        <p class="text-sm text-[#a6adc8]">Define tables, columns, and relationships using DBML — a clean, human-readable markup language.</p>
      </div>
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#a6e3a1]/10 text-lg font-bold text-[#a6e3a1]">2</div>
        <h3 class="mb-2 text-base font-semibold text-[#cdd6f4]">Visualize instantly</h3>
        <p class="text-sm text-[#a6adc8]">Your schema renders as an interactive diagram in real time. Tables are auto-arranged with smart layout algorithms.</p>
      </div>
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f38ba8]/10 text-lg font-bold text-[#f38ba8]">3</div>
        <h3 class="mb-2 text-base font-semibold text-[#cdd6f4]">Export and share</h3>
        <p class="text-sm text-[#a6adc8]">Generate SQL for any major database, download images for documentation, or share a link with your team.</p>
      </div>
    </div>
  </div>
</section>

<!-- Pricing -->
<section id="pricing" class="bg-[#181825] px-6 py-24">
  <div class="mx-auto max-w-5xl">
    <h2 class="mb-4 text-center text-3xl font-bold text-[#cdd6f4]">Simple pricing</h2>
    <p class="mx-auto mb-16 max-w-md text-center text-[#a6adc8]">
      Start free. Upgrade when you need more.
    </p>
    <div class="mx-auto grid max-w-2xl gap-6 md:grid-cols-2">
      <!-- Free -->
      <div class="rounded-xl border border-[#313244] bg-[#1e1e2e] p-8">
        <h3 class="mb-1 text-lg font-semibold text-[#cdd6f4]">Free</h3>
        <p class="mb-6 text-sm text-[#6c7086]">For personal projects</p>
        <ul class="mb-8 space-y-3 text-sm text-[#a6adc8]">
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Up to 3 projects
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Full DBML editor with syntax highlighting
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Auto-layout diagrams
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            SQL, PNG, SVG export
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Shareable links
          </li>
        </ul>
        <a
          href="/signup"
          class="block w-full rounded-lg border border-[#313244] py-2.5 text-center text-sm font-medium text-[#cdd6f4] hover:bg-[#313244] transition-colors"
        >
          Get Started
        </a>
      </div>

      <!-- Pro -->
      <div class="relative rounded-xl border-2 border-[#89b4fa] bg-[#1e1e2e] p-8">
        <div class="absolute -top-3 left-6 rounded-full bg-[#89b4fa] px-3 py-0.5 text-xs font-semibold text-[#1e1e2e]">Popular</div>
        <h3 class="mb-1 text-lg font-semibold text-[#cdd6f4]">Pro</h3>
        <p class="mb-6 text-sm text-[#6c7086]">For teams and power users</p>
        <ul class="mb-8 space-y-3 text-sm text-[#a6adc8]">
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <strong class="text-[#cdd6f4]">Unlimited</strong>&nbsp;projects
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Full DBML editor with syntax highlighting
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Auto-layout diagrams
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            SQL, PNG, SVG export
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Shareable links
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Cloud sync across devices
          </li>
          <li class="flex items-start gap-2">
            <svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#a6e3a1]" viewBox="0 0 16 16" fill="none">
              <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            Priority support
          </li>
        </ul>
        <a
          href="/signup"
          class="block w-full rounded-lg bg-[#89b4fa] py-2.5 text-center text-sm font-medium text-[#1e1e2e] hover:bg-[#74c7ec] transition-colors"
        >
          Start Free, Upgrade Anytime
        </a>
      </div>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="border-t border-[#313244] bg-[#1e1e2e] px-6 py-8">
  <div class="mx-auto flex max-w-5xl items-center justify-between">
    <span class="text-xs text-[#6c7086]">&copy; {new Date().getFullYear()} ScribbleDB</span>
    <div class="flex gap-4">
      <a href="/login" class="text-xs text-[#6c7086] hover:text-[#a6adc8] transition-colors">Log In</a>
      <a href="/signup" class="text-xs text-[#6c7086] hover:text-[#a6adc8] transition-colors">Sign Up</a>
    </div>
  </div>
</footer>
