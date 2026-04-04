<script lang="ts">
	import { format, isSameMonth, isSameDay } from 'date-fns';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { 
		Card, 
		CardHeader, 
		CardTitle, 
		Badge 
	} from '$lib/shadcn/components';

	export let holidays: any[] = [];
	export let calendarDate: Date = new Date();
	export let calendarDays: Date[] = [];
	
	export let onNextMonth: () => void;
	export let onPrevMonth: () => void;
	export let onGoToToday: () => void;

	function getHolidaysForDay(day: Date, holidays: any[]) {
		return holidays.filter((h) => {
			if (!h.from_date || !h.to_date) return false;
			const start = new Date(h.from_date);
			start.setHours(0, 0, 0, 0);
			const end = new Date(h.to_date);
			end.setHours(23, 59, 59, 999);
			const current = new Date(day);
			current.setHours(0, 0, 0, 0);

			return current >= start && current <= end;
		});
	}

	function getStatusStyles(status: string) {
		const s = status?.toLowerCase() || '';
		if (s === 'accepted') return 'bg-green-50 text-green-800 border-green-100';
		if (s.includes('rejected') || s.includes('declined'))
			return 'bg-red-50 text-red-800 border-red-100';
		if (s.includes('withdrawn') || s.includes('cancelled') || s.includes('removed'))
			return 'bg-gray-50 text-gray-600 border-gray-100 decoration-line-through';
		return 'bg-yellow-50 text-yellow-800 border-yellow-100';
	}
</script>

<Card class="flex flex-col h-full overflow-hidden border-none shadow-none">
    <CardHeader class="py-3 px-4 border-b shrink-0">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-6">
                <CardTitle class="text-lg">Holiday Calendar</CardTitle>
                <div class="hidden md:flex items-center gap-3">
                    <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <div class="w-2 h-2 rounded-[2px] bg-green-50 border border-green-200"></div>
                        <span>Approved</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] text-slate-500">
                        <div class="w-2 h-2 rounded-[2px] bg-yellow-50 border border-yellow-200"></div>
                        <span>Pending</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-1 bg-gray-50 rounded-md p-1 border">
                <button
                    class="p-1 hover:bg-white rounded hover:shadow-sm transition-all"
                    onclick={onPrevMonth}
                >
                    <ChevronLeft class="w-3.5 h-3.5 text-gray-600" />
                </button>
                <button
                    class="px-2 py-0.5 text-[11px] font-semibold min-w-[80px] text-center"
                    onclick={onGoToToday}
                >
                    {format(calendarDate, 'MMMM yyyy')}
                </button>
                <button
                    class="p-1 hover:bg-white rounded hover:shadow-sm transition-all"
                    onclick={onNextMonth}
                >
                    <ChevronRight class="w-3.5 h-3.5 text-gray-600" />
                </button>
            </div>
        </div>
    </CardHeader>

    <div class="flex flex-col flex-1 min-h-0">
        <div class="grid grid-cols-7 border-b bg-gray-50/50 shrink-0">
            {#each ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as day}
                <div class="py-1 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {day}
                </div>
            {/each}
        </div>
        <div class="grid grid-cols-7 auto-rows-fr h-full bg-gray-100 gap-px overflow-hidden">
            {#each calendarDays as day}
                {@const isCurrentMonth = isSameMonth(day, calendarDate)}
                {@const isToday = isSameDay(day, new Date())}
                {@const dayHolidays = getHolidaysForDay(day, holidays)}

                <div class="bg-white p-1 relative h-full flex flex-col min-h-0 {isCurrentMonth ? '' : 'bg-gray-50/50 text-gray-200'}">
                    <div class="flex justify-between items-start mb-0.5">
                        <span class="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center {isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}">
                            {format(day, 'd')}
                        </span>
                    </div>
                    <div class="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-0.5">
                        {#each dayHolidays.slice(0, 4) as holiday}
                            {@const nameParts = holiday.employee_name.split(' ')}
                            {@const displayName = nameParts[0]}
                            <div class="px-1 py-0.5 text-[9px] rounded-[2px] border truncate leading-tight {getStatusStyles(holiday.status)}" title={holiday.employee_name}>
                                {displayName}
                            </div>
                        {/each}
                        {#if dayHolidays.length > 4}
                            <div class="text-[8px] text-gray-400 font-bold pl-1 leading-none mt-0.5">
                                +{dayHolidays.length - 4} more
                            </div>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</Card>

<style>
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
