/**
 * Centralized business logic for Packing Supplies tool.
 * Decouples calculation and formatting from UI components.
 */

export interface PackingSupply {
	id: string;
	name: string;
	code: string;
	type: string;
	current_stock: number;
	packing_supplier_prices?: Array<{
		supplier_id: string;
		default_price: number;
	}>;
}

export interface UsageStats {
	[supplyId: string]: number;
}

/**
 * Calculates the Weighted Average Cost (WAC) or default price for a supply item.
 * @param supply The supply item object.
 * @param history Invoice history to calculate WAC.
 */
export function getEstimatedUnitCost(supply: PackingSupply, history: any[] = []): number {
	// 1. Prefer Weighted Average Cost (WAC) from actual invoice history
	if (history && history.length > 0) {
		let totalQty = 0;
		let totalCost = 0;

		history.forEach((invoice) => {
			const lines = invoice.packing_invoice_lines || [];
			lines.forEach((line: any) => {
				if (line.supply_id === supply.id && line.quantity > 0) {
					totalQty += line.quantity;
					totalCost += line.quantity * Number(line.unit_price || 0);
				}
			});
		});

		if (totalQty > 0) {
			return totalCost / totalQty;
		}
	}

	// 2. Fallback: Average of configured default supplier prices
	const prices = supply.packing_supplier_prices || [];
	if (prices.length === 0) return 0;
	const sum = prices.reduce((acc, p) => acc + Number(p.default_price || 0), 0);
	return sum / prices.length;
}

/**
 * Normalizes usage to a 30-day window based on short-term peaks.
 */
export function getUsage30d(supplyId: string, usageStats2d: UsageStats = {}, usageStats7d: UsageStats = {}): number {
	const avg2d = (usageStats2d[supplyId] || 0) / 2;
	const avg7d = (usageStats7d[supplyId] || 0) / 7;
	return Math.max(avg2d, avg7d) * 30;
}

/**
 * Calculates how many days of stock are remaining.
 */
export function getDaysRemaining(supply: PackingSupply, usage30d: number): number {
	const dailyBurn = usage30d / 30;
	if (dailyBurn <= 0) return 999;
	return (supply.current_stock || 0) / dailyBurn;
}

/**
 * Determines the reorder quantity for a 30-day coverage target.
 */
export function getReorderQty(supply: PackingSupply, usage30d: number, targetDays = 30): number {
	const dailyBurn = usage30d / 30;
	if (dailyBurn <= 0) return 0;
	const needed = dailyBurn * targetDays;
	const stock = Math.max(0, supply.current_stock || 0);
	return Math.max(0, Math.ceil(needed - stock));
}

/**
 * Gets a human-readable bundle/pack info string based on supply type/name.
 */
export function getBundleInfo(supply: PackingSupply, qty: number): string | null {
	if (!supply) return null;
	const name = supply.name.toLowerCase();
	if (name.includes('9x6x6')) return Math.ceil(qty / 120) + ' bundles';
	if (name.includes('6x6x6')) return Math.ceil(qty / 150) + ' bundles';
	if (name.includes('12x9x6')) return Math.ceil(qty / 75) + ' bundles';
	if (supply.type === 'tape') return Math.ceil(qty / 6) + ' packs';
	return null;
}
