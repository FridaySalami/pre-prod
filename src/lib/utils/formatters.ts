export function formatCurrency(amount: number | null, currency: string | null = 'GBP') {
    if (amount === null || amount === undefined) return '-';
    const safeCurrency = currency || 'GBP';
    try {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: safeCurrency }).format(
            amount
        );
    } catch (e) {
        return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
    }
}
