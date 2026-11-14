# melocoton-web

Progressive web app for Melocotón, a management app for a ceramics workshop. It is a client of [`melocoton-api`](../melocoton-api) and shares nothing with it but the HTTP contract.

Design documents and the development plan live in `../docs/` (in Spanish). Code naming follows `../docs/glosario_en.md`; everything a person reads in the app is in Spanish.

## Stack

React · TypeScript (strict) · Vite · React Router · TanStack Query · vite-plugin-pwa · react-hook-form with zod · CSS Modules. Tests with Vitest, Testing Library and jsdom.

## Requirements

- Node 26 and npm
- `melocoton-api` running on http://localhost:8080 to see real data (tests do not need it)

## Setup

1. `npm install`
2. Optionally copy `.env.example` to `.env` to point to another API. `VITE_API_URL` defaults to `http://localhost:8080`. No secrets live in this project.

## Commands

```
npm run dev          # start the app on http://localhost:5173
npm run build        # type-check and build the PWA into dist/
npm run preview      # serve dist/ on http://localhost:4173
npm run typecheck    # TypeScript only
npm run lint         # ESLint
npm test             # Vitest, once
npm run test:watch   # Vitest, watching
npm run gen:api      # regenerate src/api/schema.d.ts from ../melocoton-api/openapi/openapi.json
npm run gen:api:local  # same, from a running API (http://localhost:8080/v3/api-docs)
npm run gen:icons    # regenerate the placeholder icons in public/icons
```

## API types

The API contract is `melocoton-api/openapi/openapi.json`. `npm run gen:api` turns it into TypeScript types with openapi-typescript (`src/api/schema.d.ts`, committed). Never write by hand a type that is already in the contract: regenerate after the API changes and commit the diff.

Requests go through `openapi-fetch`, typed with those paths (`src/api/client.ts`). `callApi` (`src/api/errors.ts`) turns every failure into an `ApiError` with `status`, `code` (English, for the code) and `message` (Spanish, for the person): the API's `{ "error": { "code", "message" } }` body, a network failure (`network_error`) or an unexpected response (`unexpected_response`).

## Conventions

- Reads are retried once; actions (mutations) are never retried on their own (`src/app/queryClient.ts`).
- Plain text only: no `dangerouslySetInnerHTML` and no Markdown renderers (RNF-24). ESLint rejects both.
- Until authentication arrives (iteration 1), the role is picked with a temporary switch shown in development; it drives the bottom tabs of each role.
