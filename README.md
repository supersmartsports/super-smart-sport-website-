# SUPER SMART SPORTS

Website for SUPER SMART SPORTS, a football manufacturer and exporter based in Pakistan.

The company is a **manufacturer, not a retailer**. Nothing is sold from stock: every football is made to the customer's specification (logos, colours, panel design, materials, construction, match / training / futsal). The site therefore has no cart or checkout. Every product leads to **Request a Custom Quote**.

## Stack

- Next.js (App Router), React, TypeScript
- Tailwind CSS
- Three.js, React Three Fiber and Drei for the 3D footballs
- Motion for animation, Lucide and React Icons for icons

## Status

- **Public website** (Phases 1 and 2): complete.
- **Business platform** (Phase 3): the database foundation, access control, sign-in, the admin console, reports, quotation and invoice PDFs, CSV export and the quote-form connection are built and tested against a real Postgres engine. It has **not** been run against a Supabase project yet: that needs your credentials. See `docs/development/backend-setup.md`.
- Financial rules: `docs/architecture/financial-methodology.md`. Plan and stage status: `docs/architecture/phase-3-plan.md`.

```bash
npm install
npm run dev
npm test
npm run build
```

Set `NEXT_PUBLIC_SITE_URL` (see `.env.example`) once the domain is confirmed.

## 3D models

The originals in `ALL FOOTBALL/` are never modified. `npm run models:optimize` writes compressed, web-ready copies (WebP textures up to 2048px, Meshopt geometry) to `public/models/footballs`, using the slug list in `src/data/products/models.json`. `npm run models:inspect` prints an inventory of the originals. Each model also has a still render in `public/images/footballs`, used as the poster and fallback.

To add a football: put the GLB in `ALL FOOTBALL/`, add it to `models.json`, add an entry in `src/data/products/index.ts`, run `npm run models:optimize`, and add a poster image.

## Content rules

- `src/config/site.ts` holds confirmed company details only.
- `src/data/reviews/index.ts` is empty on purpose. Add genuine reviews only; ratings appear automatically once reviews exist.
- Product facts come from the 3D model files. Unconfirmed specifications stay `null` and display as specified per order.
- The quote form does not send anything. It prepares a message that the customer sends through WhatsApp or email.

## Structure

| Path | Purpose |
| --- | --- |
| `public/brand` | Logo files and brand assets |
| `public/images` | Photography: hero, footballs, manufacturing, materials, quality control |
| `public/models` | Web-ready GLB/GLTF 3D models: footballs, materials, components |
| `public/textures` | Texture maps for 3D: leather, panels, football surfaces |
| `public/videos` | Manufacturing and product showcase video |
| `public/icons` | Favicons and UI icons |
| `src/app/(website)` | Public pages. The route group shares one layout without adding a URL segment |
| `src/app/admin` | Admin dashboard: products, reviews, inquiries, settings |
| `src/app/api` | Route handlers: products, reviews, inquiries, upload |
| `src/components` | Reusable presentational components, grouped by area |
| `src/features` | Self-contained feature modules (logic, state and feature-specific components) |
| `src/data` | Static content: products, categories, reviews, navigation |
| `src/lib` | Infrastructure: database, validations, SEO, email, storage, utilities |
| `src/hooks`, `src/types`, `src/config`, `src/constants`, `src/styles` | Shared hooks, TypeScript types, site config, constants, extra styles |
| `database` | Migrations, schemas and seed scripts |
| `docs` | Architecture, database and development notes |
| `tests` | Unit, integration and end-to-end tests |

`components` holds UI pieces with no knowledge of the business; `features` holds the business behaviour that composes them. Pages in `src/app` stay thin and assemble features.

Import from `src` with the `@/` alias, for example `@/components/ui`.

## Product model

A product is a customisable manufacturing option, not an inventory item. Each one will carry: name, unique SKU, multiple images, a 3D model, construction type, material specifications, panel design, customisation options, reviews with an average rating, manufacturing information, and a Request a Custom Quote action. There is no price, stock level or cart.

## Raw assets

`ALL FOOTBALL/`, `LOGO/` and `OUR COMPANY FACTORY/` hold the original source files and are excluded from git. Optimised, web-ready copies go into `public/`.
