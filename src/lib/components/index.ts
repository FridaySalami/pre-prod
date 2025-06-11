// Global Shadcn Components (Phase 2 Implementation)
// src/lib/components/index.ts

// Re-export shadcn components globally while maintaining backward compatibility
export {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Input,
  Select,
  Skeleton
} from '$lib/shadcn/components';

// Export Command component and its parts
export {
  Root as Command,
  Dialog as CommandDialog,
  Empty as CommandEmpty,
  Group as CommandGroup,
  Item as CommandItem,
  Input as CommandInput,
  List as CommandList,
  Separator as CommandSeparator,
  Shortcut as CommandShortcut,
  LinkItem as CommandLinkItem
} from '$lib/shadcn/ui/command';

// Export chart components globally
export {
  ChartContainer,
  ChartTooltip,
  MonthlyChart,
  type ChartConfig
} from '$lib/shadcn/components';

// Utility exports
export { cn } from '$lib/shadcn/utils';
