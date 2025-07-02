# Shadcn Global Migration Plan

## Overview
Strategy for migrating from isolated shadcn implementation to global availability while minimizing breaking changes.

## Phase 1: Preparation (Low Risk)
**Goal**: Prepare for global shadcn without breaking existing functionality

### 1.1 Update Global CSS
- Move shadcn CSS variables from `.shadcn-scope` to `:root`
- Keep existing shadcn styles as fallback
- Test all existing functionality

### 1.2 Create Migration Utilities
```typescript
// src/lib/shadcn/migration-utils.ts
export function migrateComponent(componentName: string) {
  // Helper to identify components ready for global shadcn
}
```

### 1.3 Documentation
- Document all existing custom components that might conflict
- Create style guide for shadcn vs custom component usage
- Set up testing strategy

## Phase 2: Selective Global Access (Medium Risk)
**Goal**: Enable global shadcn for new development while maintaining isolation for existing

### 2.1 Hybrid Configuration
- Modify `components.json` to support both approaches
- Create global shadcn exports alongside scoped versions
- Enable developers to choose which approach to use

### 2.2 Component Library Expansion
- Add commonly needed shadcn components globally
- Create wrappers for existing custom components
- Establish naming conventions to avoid conflicts

## Phase 3: Systematic Migration (High Risk)
**Goal**: Migrate existing components page by page

### 3.1 Page-by-Page Migration
Priority order:
1. **Analytics pages** (already partially using shadcn)
2. **New features** (dashboard, reports)
3. **Less critical pages** (settings, profiles)
4. **Core functionality** (schedules, metrics)

### 3.2 Component Replacement Strategy
- Replace custom buttons with shadcn Button
- Migrate cards and panels to shadcn Card
- Update forms to use shadcn Input/Select
- Standardize tables with shadcn Table

## Phase 4: Cleanup (Low Risk)
**Goal**: Remove old implementations and consolidate

### 4.1 Remove Isolation
- Remove `.shadcn-scope` requirements
- Clean up duplicate CSS
- Optimize bundle size

### 4.2 Style Consolidation
- Remove redundant custom CSS
- Standardize color schemes
- Update component documentation

## Risk Mitigation

### Testing Strategy
1. **Visual Regression Testing**
   - Screenshot comparisons for each page
   - Component-level testing
   - Cross-browser compatibility

2. **Functionality Testing**
   - Ensure all interactive elements work
   - Test accessibility features
   - Validate responsive behavior

### Rollback Plan
1. Keep isolated shadcn as fallback
2. Feature flags for new vs old components
3. Page-level rollback capability

## Timeline Estimate
- **Phase 1**: 1-2 days
- **Phase 2**: 3-5 days  
- **Phase 3**: 2-3 weeks (depending on scope)
- **Phase 4**: 2-3 days

## Success Metrics
- No visual regressions in existing functionality
- Improved development velocity for new features
- Reduced CSS bundle size
- Better component consistency

## Decision Matrix

| Factor | Keep Isolated | Go Global | Hybrid Approach |
|--------|---------------|-----------|-----------------|
| **Development Speed** | ⚠️ Slow | ✅ Fast | ✅ Fast |
| **Risk Level** | ✅ Low | ⚠️ High | ✅ Medium |
| **Maintenance** | ⚠️ Complex | ✅ Simple | ⚠️ Complex |
| **Future Scalability** | ❌ Limited | ✅ Excellent | ✅ Good |
| **Migration Effort** | ✅ None | ❌ High | ⚠️ Medium |

## Recommendation: **Hybrid Approach**

Start with Phase 1-2 to enable global shadcn for new development while maintaining existing isolation. This provides:

1. ✅ **Immediate benefits** for new features
2. ✅ **Zero risk** to existing functionality  
3. ✅ **Flexibility** to migrate gradually
4. ✅ **Future-proofing** without commitment

Implementation can begin immediately with low risk and high reward.
