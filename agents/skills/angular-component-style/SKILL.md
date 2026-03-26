---
name: Angular Component Style Reference
description: Use this skill whenever generating or modifying Angular components in this project.
---

# Component Style Reference

When creating or modifying Angular components, match the coding style and structure demonstrated in this skill's `examples/` directory. Do not copy business logic — only replicate the structural and stylistic patterns.

## File Naming Conventions (CRITICAL)
Every component **MUST** consist of exactly 5 files following this strict naming convention (where `name` is the component name):
1. `name.component.ts`
2. `name.component.html`
3. `name.component.scss`
4. `name.component.spec.ts`
5. `name.animations.ts`

**Absolutely no shortened names** (e.g., do not use `name.ts` or `name.html`).

## Patterns to Match

### TypeScript (`.component.ts`)
- Use `ChangeDetectionStrategy.OnPush`
- Use `inject()` for dependency injection (not constructor injection)
- Use Angular Signals: `signal()`, `computed()`, `input()`, `input.required()`, `output()`
- Organize class members under comment headers in this order:
  1. `// --------------- INPUTS AND OUTPUTS ------------------`
  2. `// --------------- LOCAL UI STATE ----------------------`
  3. `// --------------- COMPUTED DATA -----------------------`
  4. `// --------------- EVENT HANDLING ----------------------`
  5. `// --------------- OTHER -------------------------------`
  6. `// --------------- LOAD AND CLEANUP --------------------`
- Use JSDoc (`/** ... */`) comments on every public property and method
- Import child components in `imports` array (standalone components)

### HTML (`.component.html`)
- Use Angular control flow (`@if`, `@else`, `@for`) instead of `*ngIf` / `*ngFor`
- Use semantic HTML elements (`<article>`, `<header>`, `<section>`, `<ul>`, `<time>`)
- Include accessibility attributes (`aria-label`, `alt`)

### SCSS (`.component.scss`)
- Define SCSS variables at the top of the file for reusable values
- Use nested selectors scoped under a root container class (e.g., `.weekly-goals-container`)
- Use responsive `@media` queries at the bottom of the file for breakpoints

### Animations (`.animations.ts`)
- Define animations in a separate `<component-name>.animations.ts` file
- Export as a named constant array (e.g., `export const WeeklyGoalsAnimations = [...]`)
- Reference in the component via `animations: [WeeklyGoalsAnimations]`

### Tests (`.component.spec.ts`)
- Use `@testing-library/angular` (`render`, `screen`, `within`, `waitFor`)
- Use `@testing-library/user-event` for user interactions
- Create a reusable `setup()` function that accepts optional `providers` for overriding dependencies
- Use mock services for Firebase/backend (`FirebaseMockService`, `BatchWriteMockService`)
- Write integration-style tests that test real user flows (click, type, verify visible text)
