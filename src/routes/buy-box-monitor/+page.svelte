<script lang="ts">
  import { 
    ShieldAlert, ShieldCheck, TrendingUp, AlertCircle, RefreshCw, 
    Database, Search, Filter, ExternalLink, Info
  } from 'lucide-svelte';
  import { formatDistanceToNow, isAfter, subMinutes } from 'date-fns';
  import { 
    Badge, 
    Card, CardContent, CardHeader, CardTitle, 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
  } from '$lib/shadcn/components/ui/index.js';
  import type { PageData } from './$types';

  let { data }: { data: any } = $props();

  let filterStatus = $state('ALL');
  let searchQuery = $state('');

  let currentStatus = $derived(data?.currentStatus || []);
  
  let filteredStatusList = $derived(
    currentStatus.filter((item: any) => {
      const matchesSearch = !searchQuery || 
        item.sku.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.asin.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (filterStatus === 'ALL') return matchesSearch;
      if (filterStatus === 'WINNING') return matchesSearch && item.status === 'WINNING';
      if (filterStatus === 'LOSING') return matchesSearch && item.status === 'LOSING';
      if (filterStatus === 'NO_FEATURED_OFFER') return matchesSearch && (item.status === 'SUPPRESSED' || item.status === 'NO_FEATURED_OFFER' || item.status === 'OUT_OF_STOCK');
      return matchesSearch;
    })
  );

  let stats = $derived(data?.stats || { total: 0, winning: 0, losing: 0, suppressed: 0, atRisk: 0 });
  let lastRun = $derived(data?.lastRun);

  let isStale = $derived(lastRun ? isAfter(subMinutes(new Date(), 75), new Date(lastRun.started_at)) : true);

  function formatCurrency(val: number | null, curr = 'GBP') {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: curr }).format(val);
  }

  function getStatusStyle(status: string) {
    switch (status) {
      case 'WINNING': return 'bg-green-50 text-green-700 border-green-200';
      case 'LOSING': return 'bg-red-50 text-red-700 border-red-200';
      case 'SUPPRESSED': 
      case 'NO_FEATURED_OFFER': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }

  function getPriceGap(ours: number, winning: number) {
    if (!ours || !winning) return null;
    return ours - winning;
  }
</script>

<div class="bg-slate-50/50 min-h-screen">
  <div class="container py-6 space-y-6">
    <!-- Compact Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShieldCheck class="text-indigo-600" size={24} />
          Buy Box Monitor
        </h1>
        <div class="flex items-center gap-2 mt-1">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Top 100 Performers</span>
          <span class="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span class="text-xs text-slate-400">
            {#if lastRun}
              Updated {formatDistanceToNow(new Date(lastRun.started_at))} ago
            {:else}
              No data
            {/if}
          </span>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        {#if isStale}
          <Badge variant="destructive" class="animate-pulse py-0.5 px-2 text-[10px]">STALE DATA</Badge>
        {/if}
        <button 
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 active:scale-95 transition-all text-slate-700"
          onclick={() => window.location.reload()}
        >
          <RefreshCw size={14} class={isStale ? 'text-red-500' : 'text-indigo-500'} /> 
          Refresh
        </button>
      </div>
    </div>

    <!-- Compact Stats Bar -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card class="shadow-sm border-slate-200 overflow-hidden">
        <div class="h-1 bg-green-500 w-full"></div>
        <CardContent class="p-3">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Winning</p>
          <div class="flex items-end justify-between mt-1">
            <span class="text-2xl font-bold text-slate-900">{stats.winning}</span>
            <span class="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
              {stats.total > 0 ? Math.round((stats.winning / stats.total) * 100) : 0}%
            </span>
          </div>
        </CardContent>
      </Card>

      <Card class="shadow-sm border-slate-200 overflow-hidden">
        <div class="h-1 bg-red-500 w-full"></div>
        <CardContent class="p-3">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Losing</p>
          <div class="flex items-end justify-between mt-1">
            <span class="text-2xl font-bold text-slate-900">{stats.losing}</span>
            <span class="text-xs font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              Box Lost
            </span>
          </div>
        </CardContent>
      </Card>

      <Card class="shadow-sm border-slate-200 overflow-hidden">
        <div class="h-1 bg-amber-500 w-full"></div>
        <CardContent class="p-3">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Suppressed</p>
          <div class="flex items-end justify-between mt-1">
            <span class="text-2xl font-bold text-slate-900">{stats.suppressed}</span>
            <span class="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              Action
            </span>
          </div>
        </CardContent>
      </Card>

      <Card class="shadow-sm border-slate-200 overflow-hidden">
        <div class="h-1 bg-indigo-500 w-full"></div>
        <CardContent class="p-3">
          <p class="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Revenue At Risk</p>
          <div class="flex items-end justify-between mt-1">
            <span class="text-2xl font-bold text-slate-900">{stats.atRisk}</span>
            <span class="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              Top Items
            </span>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- Main Data Section -->
    <Card class="border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
      <CardHeader class="border-b bg-white py-3 px-4">
        <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
          <div class="flex items-center gap-2">
            <CardTitle class="text-sm font-bold text-slate-700 uppercase tracking-tight">Marketplace Intelligence</CardTitle>
            <Badge variant="outline" class="text-[10px] font-mono text-slate-500">{filteredStatusList.length} SKUs shown</Badge>
          </div>
          
          <div class="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div class="relative w-full sm:w-64">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search SKU or ASIN..." 
                bind:value={searchQuery}
                class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 outline-none transition-all"
              />
            </div>
            
            <div class="relative w-full sm:w-44">
              <Filter class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select 
                bind:value={filterStatus}
                class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 outline-none appearance-none transition-all cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="WINNING">Winning Only</option>
                <option value="LOSING">Losing Only</option>
                <option value="NO_FEATURED_OFFER">Suppressed/OOS</option>
              </select>
            </div>
          </div>
        </div>
      </CardHeader>

      <div class="overflow-x-auto">
        <Table>
          <TableHeader class="bg-slate-50/50">
            <TableRow class="hover:bg-transparent border-b">
              <TableHead class="w-12 text-[10px] font-bold text-slate-500 uppercase text-center px-4">Rank</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase">Product Identification</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase">Status</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase text-right">Our Price</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase text-right">Winning</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase text-center">Price Gap</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase text-right">Next Best</TableHead>
              <TableHead class="text-[10px] font-bold text-slate-500 uppercase text-right px-4">Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {#each filteredStatusList as item, i}
              <TableRow class="group h-12 border-b-slate-100 hover:bg-slate-50/80 transition-colors {item.is_winner === false ? 'bg-red-50/30' : ''}">
                <TableCell class="text-center px-4">
                  <span class="text-xs font-bold text-slate-400">#{item.rank || '—'}</span>
                </TableCell>
                
                <TableCell>
                  <div class="flex flex-col">
                    <span class="text-xs font-semibold text-slate-700 truncate max-w-[180px]" title={item.product_name}>{item.sku}</span>
                    <a 
                      href="https://sellercentral.amazon.co.uk/myinventory/inventory?searchTerm={item.asin}" 
                      target="_blank" 
                      class="text-[10px] text-indigo-500 hover:text-indigo-700 font-mono flex items-center gap-0.5 mt-0.5 group-hover:underline"
                    >
                      {item.asin}
                      <ExternalLink size={8} class="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </div>
                </TableCell>
                
                <TableCell>
                  <Badge variant="outline" class="text-[9px] font-bold px-1.5 py-0 h-4 border-slate-300 {getStatusStyle(item.status)}">
                    {item.status.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                
                <TableCell class="text-right font-medium text-xs text-slate-700 whitespace-nowrap">
                  {formatCurrency(item.our_price)}
                </TableCell>
                
                <TableCell class="text-right font-medium text-xs text-slate-900 border-l border-slate-50 whitespace-nowrap">
                  {formatCurrency(item.buy_box_price)}
                </TableCell>
                
                <TableCell class="text-center border-x border-slate-50">
                  {@const gap = getPriceGap(item.our_price, item.buy_box_price)}
                  {#if gap !== null}
                    <div class="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full {gap > 0 ? 'text-red-600 bg-red-100' : 'text-green-600 bg-green-100'}">
                      {gap > 0 ? '+' : ''}{formatCurrency(gap)}
                    </div>
                  {:else}
                    <span class="text-slate-300 font-serif">—</span>
                  {/if}
                </TableCell>
                
                <TableCell class="text-right font-bold text-xs text-indigo-600 bg-indigo-50/30 whitespace-nowrap">
                  {formatCurrency(item.competitor_price)}
                </TableCell>
                
                <TableCell class="text-right px-4 whitespace-nowrap">
                  <span class="text-[10px] text-slate-400 tabular-nums">
                    {item.last_changed_at ? formatDistanceToNow(new Date(item.last_changed_at)) + ' ago' : 'static'}
                  </span>
                </TableCell>
              </TableRow>
            {:else}
              <TableRow>
                <TableCell colspan="8" class="text-center py-16">
                  <div class="flex flex-col items-center gap-2">
                    <div class="bg-slate-100 p-3 rounded-full">
                      <Search size={24} class="text-slate-400" />
                    </div>
                    <p class="text-sm font-medium text-slate-500">No results found for your search criteria</p>
                    <button class="text-xs text-indigo-600 font-semibold" onclick={() => {searchQuery = ''; filterStatus = 'ALL'}}>Clear all filters</button>
                  </div>
                </TableCell>
              </TableRow>
            {/each}
          </TableBody>
        </Table>
      </div>
    </Card>
    
    <div class="flex items-center justify-between text-[10px] text-slate-400 px-1 italic">
      <div class="flex items-center gap-1">
        <Info size={10} />
        Prices include shipping per Amazon Landed Price calculation.
      </div>
      <div>
        Monitoring {stats.total} Top Sellers
      </div>
    </div>
  </div>
</div>

<style>
  :global(.container) {
    max-width: 1100px;
  }
</style>
