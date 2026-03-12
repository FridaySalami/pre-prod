const fs = require('fs');
let content = fs.readFileSync('src/routes/dashboard/tools/packing-supplies/+page.svelte', 'utf8');

if (!content.includes('UpdateCostModal')) {
    content = content.replace(
        /import \{ Button \} from '\$lib\/shadcn\/ui\/button';/,
        "import { Button } from '$lib/shadcn/ui/button';\n\timport UpdateCostModal from '$lib/components/UpdateCostModal.svelte';"
    );
}

if (!content.includes('AlertCircle')) {
    content = content.replace(
        /import \{ Plus, Package, FileText, ClipboardList \} from 'lucide-svelte';/,
        "import { Plus, Package, FileText, ClipboardList, AlertCircle } from 'lucide-svelte';"
    );
}

if (!content.includes('unmapped')) {
    content = content.replace(
        /tab'\) \|\| 'log'; \/\/ 'log', 'inventory', 'history'/,
        "tab') || 'log'; // 'log', 'inventory', 'history', 'unmapped'"
    );
}

if (!content.includes('showCostModal')) {
    content = content.replace(
        /let isSavingAdjustment = false;\s*\$: adjustChangeAmount = adjustNewStock - adjustCurrentStock;/,
        `let isSavingAdjustment = false;
\t$: adjustChangeAmount = adjustNewStock - adjustCurrentStock;

\t// Unmapped Order Modal State
\tlet showCostModal = false;
\tlet currentSku = '';
\tlet currentAsin = '';
\tlet currentTitle = '';
\tfunction openCostModal(sku, asin, title) {
\t\tcurrentSku = sku;
\t\tcurrentAsin = asin;
\t\tcurrentTitle = title || '';
\t\tshowCostModal = true;
\t}`
    );
}

if (!content.includes(`Unmapped ({data.unmappedOrders`)) {
    content = content.replace(
        /<ClipboardList class="h-4 w-4" \/> Order History\n\t\t<\/button>/,
        `<ClipboardList class="h-4 w-4" /> Order History
\t\t</button>
\t\t<button
\t\t\tclass="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors {activeTab ===
\t\t\t'unmapped'
\t\t\t\t? 'bg-primary/10 text-primary'
\t\t\t\t: 'text-muted-foreground hover:bg-muted'}"
\t\t\tonclick={() => setTab('unmapped')}
\t\t>
\t\t\t<AlertCircle class="h-4 w-4" /> Unmapped ({data?.unmappedOrders?.length || 0})
\t\t</button>`
    );
}

if (!content.includes(`{#if activeTab === 'unmapped'}`)) {
    content = content.replace(
        /\t<\/div>\n<\/div>\n?$/s,
        `\t\t{#if activeTab === 'unmapped'}
\t\t\t<div class="bg-card text-card-foreground rounded-xl border shadow-sm p-6 w-full">
\t\t\t\t<div class="flex justify-between items-center mb-6">
\t\t\t\t\t<div>
\t\t\t\t\t\t<h2 class="text-xl font-semibold">Missing Box Mappings</h2>
\t\t\t\t\t\t<p class="text-sm text-muted-foreground">Orders created recently that failed packaging deduction because their SKUs are missing dimensions.</p>
\t\t\t\t\t</div>
\t\t\t\t</div>

\t\t\t\t{#if data.unmappedOrders && data.unmappedOrders.length > 0}
\t\t\t\t\t<div class="overflow-x-auto border rounded-xl">
\t\t\t\t\t\t<table class="w-full text-sm text-left">
\t\t\t\t\t\t\t<thead class="bg-muted text-muted-foreground">
\t\t\t\t\t\t\t\t<tr>
\t\t\t\t\t\t\t\t\t<th class="px-4 py-3 font-semibold">Order ID</th>
\t\t\t\t\t\t\t\t\t<th class="px-4 py-3 font-semibold">SKU / ASIN</th>
\t\t\t\t\t\t\t\t\t<th class="px-4 py-3 font-semibold">Product Title</th>
\t\t\t\t\t\t\t\t\t<th class="px-4 py-3 font-semibold text-right">Actions</th>
\t\t\t\t\t\t\t\t</tr>
\t\t\t\t\t\t\t</thead>
\t\t\t\t\t\t\t<tbody class="divide-y relative bg-card">
\t\t\t\t\t\t\t\t{#each data.unmappedOrders as order}
\t\t\t\t\t\t\t\t\t{#each order.items as item}
\t\t\t\t\t\t\t\t\t\t<tr class="hover:bg-muted/30">
\t\t\t\t\t\t\t\t\t\t\t<td class="px-4 py-3 font-mono">{order.amazon_order_id}</td>
\t\t\t\t\t\t\t\t\t\t\t<td class="px-4 py-3 font-mono text-xs">
\t\t\t\t\t\t\t\t\t\t\t\t<div class="font-semibold text-primary">{item.seller_sku}</div>
\t\t\t\t\t\t\t\t\t\t\t\t<div class="text-muted-foreground">{item.asin}</div>
\t\t\t\t\t\t\t\t\t\t\t</td>
\t\t\t\t\t\t\t\t\t\t\t<td class="px-4 py-3 text-xs line-clamp-2 my-2">{item.title}</td>
\t\t\t\t\t\t\t\t\t\t\t<td class="px-4 py-3 text-right whitespace-nowrap">
\t\t\t\t\t\t\t\t\t\t\t\t<Button variant="outline" size="sm" onclick={() => openCostModal(item.seller_sku, item.asin, item.title)}>
\t\t\t\t\t\t\t\t\t\t\t\t\tAssign Dimensions
\t\t\t\t\t\t\t\t\t\t\t\t</Button>
\t\t\t\t\t\t\t\t\t\t\t</td>
\t\t\t\t\t\t\t\t\t\t</tr>
\t\t\t\t\t\t\t\t\t{/each}
\t\t\t\t\t\t\t\t{/each}
\t\t\t\t\t\t\t</tbody>
\t\t\t\t\t\t</table>
\t\t\t\t\t</div>
\t\t\t\t{:else}
\t\t\t\t\t<div class="text-center p-12 text-muted-foreground bg-muted/20 border border-dashed rounded-xl">
\t\t\t\t\t\tNo unmapped orders found. All packaging logic is completely mapped!
\t\t\t\t\t</div>
\t\t\t\t{/if}
\t\t\t</div>
\t\t{/if}
\t</div>
</div>

<UpdateCostModal bind:open={showCostModal} sku={currentSku} asin={currentAsin} title={currentTitle} />
`
    );
}

fs.writeFileSync('src/routes/dashboard/tools/packing-supplies/+page.svelte', content);
