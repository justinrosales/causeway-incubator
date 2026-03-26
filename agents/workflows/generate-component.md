---
description: Generating Angular Components using Schematics
---
1. Determine the target directory based on the standard layout:
   - `src/app/admin`: For admin-related components (e.g., waitlists)
   - `src/app/core`: For core services/state (e.g., store, firebase)
   - `src/app/general`: For public facing or general pages (e.g., home, landing)

// turbo
2. Run the Angular Schematic to generate the component in the appropriate directory. For example:
   `npx ng generate component general/landing`
   `npx ng generate component admin/waitlists`

3. The Angular schematic generates `name.component.ts`, `name.component.html`, `name.component.scss`, and `name.component.spec.ts`. **You MUST manually create the required `name.animations.ts` file** alongside these with an empty animation array (e.g., `export const NameAnimations = [];`) to satisfy the 5-file requirement. Make sure you also import it in the component.

4. Verify the generated component, making sure it follows the `.agents/skills/angular-component-style` guidelines and strict file naming conventions.

// turbo
4. Run the project linting script using Angular CLI: `npx ng lint`
