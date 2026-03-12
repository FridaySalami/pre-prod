const fs = require('fs');
let s = fs.readFileSync('src/lib/components/UpdateCostModal.svelte', 'utf8');

s = s.replace(`export let shippingDetails = '';`, `export let shippingDetails = '';\n\texport let supplies: any[] = [];`);

fs.writeFileSync('src/lib/components/UpdateCostModal.svelte', s);
