# Website Performance, SEO & Security Audit — Issues & Fix Plan

> Generated from deep analysis of NFT Studio web app
> Last updated: 2026-04-04

---

## Tech Stack Overview

| Layer     | Technology                                |
| --------- | ----------------------------------------- |
| Framework | SvelteKit 2 (SPA mode, static)            |
| UI        | Svelte 5 + Tailwind CSS 4 + shadcn-svelte |
| Build     | Vite 8 + vite-plus                        |
| Hosting   | Internet Computer (ICP) via Juno          |
| PWA       | @vite-pwa/sveltekit + Workbox             |
| Analytics | Juno Orbiter                              |

---

## 🔴 HIGH Severity

### 1. No Server-Side Rendering (`ssr = false`)

**File:** `src/routes/+layout.ts:1`

**Issue:** Search engines must execute JavaScript to see any content. Poor First Contentful Paint, no content visible until full JS bundle downloads and executes.

**Plan:**

1. Enable SSR for public pages (`/`, `/about`) by removing `ssr = false` or setting `ssr = true` for those routes
2. Keep `ssr = false` only for `/app` and `/app/gallery` if they require client-side-only features
3. Verify public pages render correctly with SSR enabled
4. Test that client hydration works without errors

---

### 2. Fake Security Headers via `<meta http-equiv>`

**File:** `src/app.html`

**Issue:** HSTS via `<meta>` is **ignored by browsers**. The strict-transport-security header in `app.html` does nothing. Meta-based security headers are not real HTTP response headers.

**Plan:**

1. Investigate ICP/Juno hosting capabilities for setting real HTTP response headers
2. If ICP supports header configuration, add proper headers:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
3. If ICP does not support custom headers, document this limitation and consider a CDN proxy
4. Remove ineffective `<meta http-equiv>` tags for headers that don't work via meta

---

### 3. No Content-Security-Policy

**File:** `src/app.html`

**Issue:** XSS protection relies solely on DOMPurify + Trusted Types — no defense-in-depth layer. Missing CSP leaves the app vulnerable to injection attacks if sanitization fails.

**Plan:**

1. Add a CSP meta tag or HTTP header with strict directives:
   - `default-src 'self'`
   - `script-src 'self' 'wasm-unsafe-eval'` (needed for Web Workers/WASM)
   - `style-src 'self' 'unsafe-inline'` (required for Tailwind)
   - `img-src 'self' data: blob:`
   - `font-src 'self'`
   - `connect-src 'self'` (for API calls and analytics)
   - `frame-ancestors 'none'`
   - `base-uri 'self'`
   - `form-action 'self'`
2. Test that all functionality works with CSP enabled (workers, fonts, images)
3. Adjust directives as needed based on console CSP violations

---

## 🟡 MEDIUM Severity

### SEO Issues

#### 4. Sitemap Uses Raw ICP Domain

**File:** `static/sitemap.xml`, `static/robots.txt`

**Issue:** Sitemap and robots.txt reference `dpl4s-kqaaa-aaaal-asg3a-cai.icp0.io` — unprofessional and may confuse search engines.

**Plan:**

1. If a custom domain is configured, update all URLs to use it
2. If no custom domain, consider adding one via ICP custom domain setup
3. Update `static/robots.txt` sitemap URL
4. Update `static/sitemap.xml` URLs

---

#### 5. Sitemap Missing `/about` Page

**File:** `static/sitemap.xml`

**Issue:** Only `/` and `/app` are listed. The `/about` page won't be discovered via sitemap.

**Plan:**

1. Add `<url><loc>https://.../about</loc></url>` entry to `static/sitemap.xml`
2. Update `<lastmod>` date to current date
3. Consider generating sitemap dynamically at build time

---

#### 6. No Custom Domain Configured

**Issue:** All SEO/social sharing URLs are raw ICP satellite IDs. Unprofessional for branding and search engine trust.

**Plan:**

1. Register a custom domain
2. Configure ICP custom domain via Juno or boundary node
3. Update all meta tags, sitemap, robots.txt to use custom domain
4. Set up redirects from ICP domain to custom domain if possible

---

#### 7. No Structured Data (JSON-LD)

**Issue:** Missing rich snippets in search results. No SoftwareApplication or WebApplication schema markup.

**Plan:**

1. Add JSON-LD structured data to `app.html` or root layout:
   ```json
   {
   	"@context": "https://schema.org",
   	"@type": "SoftwareApplication",
   	"name": "NFT Studio",
   	"description": "Create stunning NFT collections with ease",
   	"url": "https://your-domain.com",
   	"applicationCategory": "DesignApplication",
   	"operatingSystem": "Web",
   	"offers": {
   		"@type": "Offer",
   		"price": "0",
   		"priceCurrency": "USD"
   	}
   }
   ```
2. Add BreadcrumbList schema to `/about` page
3. Validate with Google Rich Results Test

---

#### 8. Missing Per-Page Meta Tags

**Files:** `src/routes/app/+page.svelte`, `src/routes/app/gallery/+page.svelte`

**Issue:** No custom `<title>` or meta descriptions for `/app` and `/app/gallery` — they inherit defaults from `app.html`.

**Plan:**

1. Add `<svelte:head>` with unique title and description to `/app/+page.svelte`
2. Add `<svelte:head>` with unique title and description to `/app/gallery/+page.svelte`
3. Ensure each page has a unique, descriptive title

---

### Performance Issues

#### 9. `enhancedImages()` Plugin Configured But Unused

**File:** `vite.config.ts`

**Issue:** The `@sveltejs/enhanced-img` plugin is loaded but no `<enhanced:img>` imports exist. Missed automatic WebP/AVIF conversion and responsive image generation.

**Plan:**

1. Audit all `<img>` tags in the codebase
2. Replace critical images with `<enhanced:img src="..." />` imports
3. Keep `loading="lazy"` for below-the-fold images
4. Verify image optimization is working in production build

---

#### 10. No Font Preloading

**File:** `src/app.html`

**Issue:** JetBrains Mono font is not preloaded, causing potential font loading delay on first visit.

**Plan:**

1. Add `<link rel="preload" href="/fonts/JetBrainsMono.woff2" as="font" type="font/woff2" crossorigin>` to `app.html`
2. Ensure `font-display: swap` is set (already configured in `app.css`)
3. Verify font loads without blocking render

---

#### 11. No Bundle Size Budgets

**File:** `vite.config.ts`

**Issue:** Bundle bloat can go unnoticed without automated size limits.

**Plan:**

1. Add bundle size budgets to `vite.config.ts`:
   ```ts
   build: {
     chunkSizeWarningLimit: 500, // KB
   }
   ```
2. Consider adding `rollup-plugin-visualizer` for bundle analysis
3. Set up CI check to fail if bundle exceeds threshold

---

#### 12. Images Missing `width`/`height` Attributes

**Issue:** Most `<img>` tags lack explicit dimensions, causing Cumulative Layout Shift (CLS) issues.

**Plan:**

1. Add `width` and `height` attributes to all static images
2. For dynamic images, use CSS `aspect-ratio` to reserve space
3. Verify CLS score improves with Lighthouse

---

### Security Issues

#### 13. No `X-Frame-Options` / `frame-ancestors`

**File:** `src/app.html`

**Issue:** The app can be embedded in iframes on other sites, enabling clickjacking attacks.

**Plan:**

1. Add `frame-ancestors 'none'` to CSP header/meta
2. Or add `<meta http-equiv="X-Frame-Options" content="DENY">`
3. Verify the app cannot be embedded in external iframes

---

#### 14. No COOP/COEP Headers

**Issue:** Missing Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers, leaving the app vulnerable to Spectre-style side-channel attacks.

**Plan:**

1. Add headers if hosting supports them:
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`
2. Test that Web Workers and cross-origin resources still work
3. Note: COEP may break some third-party resources without proper CORS headers

---

#### 15. `style` Attribute Allowed in DOMPurify

**File:** `src/lib/utils/sanitization.ts`

**Issue:** The `style` attribute is in DOMPurify's allowed attributes list, which could be a vector for CSS-based attacks (e.g., `expression()` in older browsers, CSS injection).

**Plan:**

1. Review if `style` attribute is actually needed for any user input
2. If not needed, remove `style` from `ALLOWED_ATTR` in DOMPurify config
3. If needed, consider using a CSS sanitizer or restricting allowed CSS properties
4. Test that UI still renders correctly without inline styles

---

#### 16. `console.error` in Production Hooks

**File:** `src/hooks.client.ts`

**Issue:** Error details could be leaked to the browser console in production, exposing internal implementation details.

**Plan:**

1. Add environment check before logging:
   ```ts
   if (import.meta.env.DEV) {
   	console.error(error);
   }
   ```
2. In production, log to a secure error tracking service instead
3. Return a generic error message to the user

---

## 🟢 LOW Severity

### 17. No `og:image:width`/`og:image:height`

**File:** `src/app.html`

**Issue:** Social sharing may have suboptimal image rendering without explicit dimensions.

**Plan:**

1. Add `<meta property="og:image:width" content="1200">`
2. Add `<meta property="og:image:height" content="630">`
3. Ensure `nft-studio-preview.webp` matches these dimensions

---

### 18. No `twitter:site` / `twitter:creator`

**File:** `src/app.html`

**Issue:** Missing Twitter attribution on shared cards.

**Plan:**

1. Add `<meta name="twitter:site" content="@yourhandle">`
2. Add `<meta name="twitter:creator" content="@yourhandle">`
3. Replace with actual Twitter handle or remove if not applicable

---

### 19. No E2E Testing

**Issue:** UX quality gaps may go undetected without end-to-end tests.

**Plan:**

1. Set up Playwright for E2E testing
2. Write tests for critical user flows:
   - Create project
   - Add layers and traits
   - Generate collection
   - Export NFTs
3. Integrate E2E tests into CI pipeline

---

### 20. No Accessibility Testing

**Issue:** A11y issues may go unnoticed without automated testing.

**Plan:**

1. Add `@axe-core/playwright` or `jest-axe` for accessibility testing
2. Run accessibility audits on key pages
3. Fix any critical A11y violations (contrast, ARIA labels, keyboard navigation)

---

### 21. No Lighthouse CI

**Issue:** No automated performance regression tracking.

**Plan:**

1. Add `@lhci/cli` to dev dependencies
2. Configure Lighthouse CI in CI pipeline
3. Set performance budgets (FCP, LCP, CLS, TTI)
4. Fail CI if scores drop below thresholds

---

## Implementation Plan

### Phase 1 — Quick Wins (1-2 hours)

| #   | Task                                                | Effort |
| --- | --------------------------------------------------- | ------ |
| 5   | Add `/about` to `static/sitemap.xml`                | 5 min  |
| 12  | Add `width`/`height` attributes to all `<img>` tags | 30 min |
| 10  | Add `<link rel="preload">` for JetBrains Mono font  | 5 min  |
| 17  | Add `og:image:width`/`height` to meta tags          | 5 min  |
| 16  | Remove `console.error` from production hooks        | 5 min  |

### Phase 2 — Security Hardening (2-4 hours)

| #   | Task                                               | Effort    |
| --- | -------------------------------------------------- | --------- |
| 3   | Add CSP meta tag or configure headers              | 1-2 hours |
| 13  | Add `frame-ancestors 'none'` to Permissions-Policy | 5 min     |
| 15  | Remove `style` from DOMPurify allowed attributes   | 15 min    |
| 14  | Add COOP/COEP headers (if hosting supports)        | 30 min    |
| 2   | Investigate real HTTP headers for ICP hosting      | 30 min    |

### Phase 3 — SEO Improvements (2-4 hours)

| #   | Task                                          | Effort    |
| --- | --------------------------------------------- | --------- |
| 7   | Add JSON-LD structured data                   | 30 min    |
| 4   | Update sitemap/robots.txt with correct domain | 15 min    |
| 8   | Add per-page `<title>` and meta descriptions  | 30 min    |
| 18  | Add `twitter:site` handle                     | 5 min     |
| 6   | Configure custom domain (if possible)         | 1-2 hours |

### Phase 4 — Performance (4-8 hours)

| #   | Task                                                 | Effort    |
| --- | ---------------------------------------------------- | --------- |
| 1   | Enable SSR for public pages                          | 2-4 hours |
| 9   | Use `enhancedImages()` with `<enhanced:img>` imports | 1-2 hours |
| 11  | Add bundle size budgets to `vite.config.ts`          | 30 min    |
| 21  | Set up Lighthouse CI                                 | 1-2 hours |

### Phase 5 — Testing & Quality (4-8 hours)

| #   | Task                            | Effort    |
| --- | ------------------------------- | --------- |
| 19  | Set up Playwright E2E testing   | 2-4 hours |
| 20  | Add accessibility testing       | 1-2 hours |
| 21  | Configure Lighthouse CI budgets | 1 hour    |

---

## Verification Checklist

After each fix:

- [ ] `vp check` — Format + lint + type check passes
- [ ] `vp build` — Production build succeeds
- [ ] Lighthouse audit — Performance score maintained or improved
- [ ] Lighthouse audit — SEO score maintained or improved
- [ ] Lighthouse audit — Best Practices score maintained or improved
- [ ] Browser console — No CSP violations or errors
- [ ] Social sharing — Open Graph and Twitter cards render correctly
- [ ] Search console — Sitemap validates without errors

---

## Fix Status

- [ ] #1 — Enable SSR for public pages
- [ ] #2 — Real HTTP security headers
- [ ] #3 — Content-Security-Policy
- [ ] #4 — Update sitemap domain
- [x] #5 — Add `/about` to sitemap
- [ ] #6 — Custom domain configuration
- [ ] #7 — JSON-LD structured data
- [ ] #8 — Per-page meta tags for `/app` and `/app/gallery`
- [ ] #9 — Use `enhancedImages()` plugin
- [x] #10 — Font preloading
- [ ] #11 — Bundle size budgets
- [ ] #12 — Image `width`/`height` attributes (dynamic images use CSS aspect-ratio)
- [ ] #13 — `frame-ancestors` protection
- [ ] #14 — COOP/COEP headers
- [ ] #15 — Remove `style` from DOMPurify
- [x] #16 — Remove production `console.error`
- [x] #17 — `og:image:width`/`height`
- [ ] #18 — `twitter:site` / `twitter:creator`
- [ ] #19 — E2E testing setup
- [ ] #20 — Accessibility testing
- [ ] #21 — Lighthouse CI
