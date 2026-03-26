---
description: Tech4Good Angular development standards
---

# T4G Standard Rules

## Angular CLI Version

This project **MUST** use `@angular/cli@21`. When generating components, running schematics, or performing any Angular CLI operations, always ensure you are using Angular CLI version 21.

- Do **NOT** upgrade to a newer major version of `@angular/cli` without explicit approval.
- If `package.json` specifies a different version, flag it to the user before proceeding.
- All `ng generate`, `ng add`, and `ng update` commands must target Angular CLI v21 compatibility.

## Required Schematics Package

This project uses **`@tech4good/angular-schematics`** for component and module generation.

- The `@tech4good/angular-schematics` package **MUST** be installed as a dev dependency.
- When generating new components, services, or other Angular constructs, prefer using `@tech4good/angular-schematics` schematics over the default `@schematics/angular`.
- Use the command: `ng generate @tech4good/angular-schematics:<schematic-name>` when available.

## Directory Layout

Follow the standard source layout:

| Directory          | Purpose                                        |
| ------------------ | ---------------------------------------------- |
| `src/app/admin`    | Admin-facing components (e.g., waitlists)      |
| `src/app/core`     | Core services, state, and infrastructure logic |
| `src/app/general`  | Public/general user pages (e.g., home, landing)|

## Enforcement

- Before running any `ng generate` or `ng new` command, verify that:
  1. `@angular/cli` is at version `21.x`
  2. `@tech4good/angular-schematics` is installed and listed in `devDependencies`
- If either condition is not met, install or fix the versions before proceeding.

## Workflow

When generating a new component, follow the `/generate-component` workflow defined in `.agents/workflows/generate-component.md`.
