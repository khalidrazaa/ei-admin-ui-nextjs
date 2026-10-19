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

### Import a Markdown draft

Use **Upload Markdown** in **Drafts** or **New draft** to load a local `.md` or `.markdown` file. Files must use UTF-8 and be at most 2 MiB. Download the [complete draft template](public/examples/draft-template.md), also available from **Download template** in the importer.

The file can contain plain Markdown, or YAML front matter between `---` lines at the beginning followed by the Markdown body. Import fills a new draft form and opens its content in Markdown source mode. Use **Next Step** to review the metadata, then **Save Draft** to persist it. Uploading alone does not save or publish an article.

Saved articles reopen in Markdown source mode so metadata edits preserve images, lists, blockquotes, and other Markdown formatting. The editor can still switch to rich text when needed.

Supported front-matter fields:

| Purpose | Fields |
| --- | --- |
| Identity and classification | `title`, `seo_title`, `slug`, `category`, `subcategory`, `tags`, `keywords`, `host_site`, `language` |
| Summary and SEO | `excerpt`, `meta_description`, `canonical_url`, `schema_type` |
| Sharing | `open_graph_title`, `open_graph_description`, `open_graph_image` |
| Media and display | `featured_image_url`, `image_alt_text`, `is_featured`, `reading_time` |

Use YAML lists for `tags` and `keywords`, a boolean for `is_featured`, and a non-negative integer in minutes for `reading_time`. Omit `reading_time` to let the backend estimate it when saving. If `title` is missing, the importer uses the first Markdown H1, then the filename. If `slug` is missing, it is generated from the title. Review the slug before saving; it must be unique.

Place article content after the closing `---`, rather than in a `content` front-matter field. IDs, timestamps, status, and private generation/review fields are ignored with a warning. Every import starts a new unpublished draft; it does not update an existing article or recreate a topic's research history. Image URLs reference existing media; the Markdown upload does not upload images.

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
