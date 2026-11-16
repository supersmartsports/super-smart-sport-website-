# Frontend to backend integration map

"Connected" means the page reads or writes through the database when `NEXT_PUBLIC_SUPABASE_URL` and the anon key are set.
Before that, public pages fall back to the catalogue bundled with the site (`src/data/products`), so the website keeps working.

| Frontend feature | Backend object | How | Status |
| --- | --- | --- | --- |
| Homepage: featured footballs, collection counts, construction showcase | `public_products` view (published products only) | `src/server/catalog.ts`, rebuilt at most every 5 minutes | Connected |
| Homepage and Reviews page: customer reviews | `public_reviews` view (approved only) | `getApprovedReviews`, with pagination | Connected |
| Football collection: search, category filter, sort, pages, ratings | `public_products`, `public_reviews` | Catalogue loaded on the server, filtered in the browser (12 per page) | Connected |
| Football page: name, SKU, material, construction, panels, model, images, reviews, related | `public_products`, `public_reviews` | Static params from the catalogue; new products render on first request | Connected |
| 3D viewers and models | `products.model_path`, `products.poster_path` (files stay in `public/models`) | Paths come from the database; the original GLB files are untouched | Connected (needs product rows seeded) |
| Customization studio | Catalogue for design choices; the brief goes to the quote form | Choices travel in the URL and are saved with the inquiry (`inquiries.requirements`) | Connected through the quote form |
| Request a Quote | `submit_inquiry_v2` (database function), `customers`, `inquiries`, `attachments`, private storage | Validation, duplicate key, customer match or create, artwork upload, real reference shown | Connected |
| Review submission (Reviews and football pages) | `submit_review` (stored as pending) | Hidden until staff approve it in Admin > Reviews | Connected |
| WhatsApp widget and product messages | None (a link to wa.me) | Opens WhatsApp with a prepared message; football pages add a message about that football | Working; nothing is sent automatically |
| Admin sign-in, sign-out, password reset | Supabase Auth + `profiles` | Server-side session checks, rate limits, emailed reset link | Built; needs a live project to test |
| Admin overview with date filters | `dashboard_summary_range`, `report_profit_loss` | Figures computed in the database, per permission | Connected |
| Admin modules (customers ... activity logs, reviews) | One table (or more) per module | Generic list, form, detail, action and file screens (`src/features/admin`) | Connected |
| Quotation and invoice PDFs, CSV export | `quotations`, `invoices`, items, ledger views | Route handlers read as the signed-in user | Connected |
| Profit and Loss, Reports | `report_*` functions | Server-side, explicit exchange rates | Connected |

## Gaps and notes

- No table or function was duplicated; migration 0012 adds only what the public site needs (reviews, two views, `submit_inquiry_v2`, `dashboard_summary_range`).
- The earlier anonymous `submit_inquiry` function is closed to the public because it bypassed the duplicate guard.
- Studio colour choices are saved as text in the inquiry; there is no separate "customization request" table because an inquiry already is one.
- Customer artwork is stored with the service key on the server, because a visitor has no database access. Without that key the inquiry still saves and the form says the files were not attached.
- Reviews and the catalogue refresh within five minutes of a change, not instantly.
