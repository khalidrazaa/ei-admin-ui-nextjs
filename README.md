# ExplainIt admin

Next.js dashboard for topics, research, drafts, articles, trends, and backend settings.

## Setup

Use Node.js 24 (matching Docker):

```bash
npm ci
```

Create `.env.local`:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/v1
```

```bash
npm run dev -- --port 3001
```

Open http://localhost:3001 and sign in through backend OTP authentication. Requests include cookies; backend CORS/cookie settings must support the admin origin. `src/proxy.ts` redirects using the `access_token` cookie; the backend validates API access.

`NEXT_PUBLIC_API_BASE_URL` is public and embedded at build time: set it before building, restart development after changes, and rebuild production when it changes. Never include secrets.

Docker caveat: the Dockerfile declares `NEXT_PUBLIC_API_URL`, but the client reads `NEXT_PUBLIC_API_BASE_URL`. Supply the latter during the build; the declared argument alone does not configure the client.

## Checks and production

```bash
npm test
npx eslint src
npm run build
npm run start
```

`npm run lint` still invokes `next lint`, absent in Next.js 16; use ESLint directly. Docker runs the standalone build with `node server.js` on port 3000.

## Content and shared components

Topics → brief → Begin research → Generate article → review versions/QA in Drafts → Save to Drafts → article editor → status `published` → Publish Changes. Backend content workers execute queued jobs. Publishing is manual; QA is advisory, with no separate approval state. Manage reusable source groups and research rules in **Settings -> Research Sources**; per-topic source links are optional extras, and saved settings apply to new research runs.

To write an article manually, open **Drafts -> New draft**, enter its title and content, and use **Next Step** to edit metadata. The slug follows the title until you edit it. **Save Draft** creates an unpublished article and keeps its editor open in Drafts; publishing is available after the draft is saved. An unfinished draft may have empty content.

The Drafts list sidebar contains category filters. Open **Topics** to manage research and generated versions/QA.

Articles and Drafts show a **Category** column in the table and category labels on mobile cards. In the editor's metadata step, choose an existing category or **Custom category…** to enter a new name. Existing options come from all drafts and published articles, independently of pagination and filters. **Uncategorized** clears the category. Imported or previously saved custom names remain editable, and a category-list loading failure still allows custom entry and retry.

Articles and Drafts load 20 articles per page by default. Use Previous/Next or Per page to browse larger collections. Category filters and search run on the backend across every matching article; category totals cover the full status list. Selecting all selects only the current page, and changing the page, category, search, or page size clears the selection. Saving or deleting refreshes the list and its totals, including returning to the last available page after deletion.

Per page is the maximum number of matching articles to display. For example, 15 matches with 50 per page show all 15 on page 1 of 1, with Previous/Next disabled; choose 10 per page to browse those articles over two pages. Scrolling is needed only when the displayed rows exceed the available height.

The list uses `GET /v1/admin/articles?page=1&size=20&status=published` (or `status=draft`), with optional `category` and `search`. It requires the backend's paginated response with `items`, pagination fields, `categories`, and `category_total`; deploy the backend pagination support before this frontend.

Editor category options use the protected `GET /v1/admin/articles/categories` endpoint, which returns category names without loading article bodies. Deploy that backend endpoint before this frontend update.

### Import an article and its diagrams

Use **Upload article files** in **Drafts** or **New draft** to select or drop one `.md`/`.markdown` file together with its `.svg`/`.png` diagrams. Files may also be added to the same area in separate selections. Markdown must use UTF-8 and be at most 2 MiB; each diagram may be up to 5 MiB, with at most 10 diagrams and 50 MiB total. Download the [complete draft template](public/examples/draft-template.md), also available from **Download template** in the importer.

The file can contain plain Markdown, or YAML front matter between `---` lines at the beginning followed by the Markdown body. Selection fills a new draft form and opens its content in Markdown source mode. Review the article preview and image matches, use **Next Step** to review metadata, then choose **Save Draft**. The reviewed Markdown and diagrams upload together in one request; file selection alone does not save or publish an article.

Reference a diagram using `![Architecture](diagrams/architecture.svg)` or a reference-style image. Exact path and filename matches take priority. If only the format differs, `architecture.png` also matches an uploaded `architecture.svg` (and vice versa) when the diagram name has a single match. Use the per-reference dropdown when a file has a different name or the match is ambiguous. For a diagram without a Markdown reference, choose **Insert image** to append it to the article and edit its alt text/position in the source. Resolve missing files and insert or remove unused files before saving. Existing absolute HTTP(S) and site-relative media URLs are preserved unless explicitly mapped to a replacement. Duplicate selected filenames must be renamed. Failed saves retain the selection and content for retry.

Saved articles reopen in Markdown source mode so metadata edits preserve images, lists, blockquotes, and other Markdown formatting. Articles containing image references stay in Markdown mode because the rich-text converter cannot preserve them. The same upload area in a saved article accepts additional/replacement SVG/PNG diagrams; save its changes to persist them.

Supported front-matter fields:

| Purpose | Fields |
| --- | --- |
| Identity and classification | `title`, `seo_title`, `slug`, `category`, `subcategory`, `tags`, `keywords`, `host_site`, `language` |
| Summary and SEO | `excerpt`, `meta_description`, `canonical_url`, `schema_type` |
| Sharing | `open_graph_title`, `open_graph_description`, `open_graph_image` |
| Media and display | `featured_image_url`, `image_alt_text`, `is_featured`, `reading_time` |

Use YAML lists for `tags` and `keywords`, a boolean for `is_featured`, and a non-negative integer in minutes for `reading_time`. Omit `reading_time` to let the backend estimate it when saving. If `title` is missing, the importer uses the first Markdown H1, then the filename. If `slug` is missing, it is generated from the title. Review the slug before saving; it must be unique.

Place article content after the closing `---`, rather than in a `content` front-matter field. IDs, timestamps, status, and private generation/review fields are ignored with a warning. A Markdown import starts a new unpublished draft; it does not recreate a topic's research history. Featured/Open Graph image metadata remains separate from inline diagrams.

Combined saves use protected multipart `POST /v1/admin/articles/import` and `PUT /v1/admin/articles/{id}/import`. Deploy backend media migrations, persistent VPS storage and `MEDIA_PUBLIC_BASE_URL` configuration before this frontend. Uploaded SVG is validated by the backend; unsupported active/embedded content is rejected with an explanation. Diagram previews use image elements and never insert SVG markup into the page. Images remain on the VPS across application deployments. Public article content still comes from a build-time snapshot: after publishing or replacing a diagram, rebuild and deploy `ei-ui-nextjs` to update the live article.

[`apiFetch`](src/lib/api.ts) defaults to 30-second timeouts and reports unreachable APIs/invalid responses. Long-running service calls opt out with `timeoutMs: 0`.

**Settings -> YouTube Scans** provides three slider switches: **Disable popular YouTube scan**, **Disable all niche scans**, and **Disable all YouTube video scans**. Switch on to disable scanning, then save. Disabling all YouTube videos overrides the individual switches while retaining their preferences. Scan Now uses the saved settings; existing videos remain available to browse.

[`Table`](src/components/ui/Table.tsx) serves Articles, Drafts, and Trends. Pass `data` to infer columns, or explicit typed columns:

```tsx
import Table, { type TableColumn } from "@/components/ui/Table";

type Row = { id: number; title: string; status: string };
const columns: TableColumn<Row>[] = [
  { id: "title", header: "Title", accessor: "title" },
  { id: "status", header: "Status", render: row => row.status.toUpperCase() },
];
// With rows: Row[] inside a component:
<Table data={rows} columns={columns} getRowKey={row => row.id} />;
```

Use `onRowClick` for navigation and `stopRowClick: true` for action/checkbox columns. Default keys use `id`/`_id`; supply `getRowKey` otherwise. Loading/empty messages, disabled rows, keyboard navigation, alignment, and custom classes are supported.
