# Search visibility for Anuj Yadav’s portfolio

The public site is https://codesensitive.github.io/. SEO work makes it easier for search engines to discover and understand these pages; it cannot guarantee indexing, a position or a particular result appearance.

## Implemented

- Distinct page titles and descriptions focused on Anuj Yadav, AI engineering, RAG development and the actual Evidence Lab project.
- Visible name/role heading, accurate skills and descriptive internal links.
- A static, readable engineering case study at `/evidence-lab.html`, including architecture, reproducible evaluation evidence and limitations. Its content works without JavaScript.
- Self-referencing canonical URLs, crawlable HTML, `robots.txt`, a two-page XML sitemap and a noindex custom 404 page. CSS, JavaScript and model resources remain crawlable.
- JSON-LD for Person, WebSite, ProfilePage, TechArticle, SoftwareApplication and breadcrumbs, using real identity/project facts. Structured data does not guarantee rich results; the app has no invented ratings or reviews.
- Open Graph/Twitter metadata, a 1200×630 social preview and a favicon. These improve sharing presentation, not a guaranteed ranking signal.
- Font stylesheets discovered directly from HTML with preconnects, replacing a CSS import waterfall. Existing `display=swap`, on-demand model loading and fingerprinted homepage assets remain in place. No Core Web Vitals score is claimed without field measurements.
- Regression checks for metadata, structured-data identity, internal links, sitemap URLs, robots rules, 404 indexing and preview dimensions.

## Google Search Console: account setup still needed

1. Open https://search.google.com/search-console/ using your Google account.
2. Add a **URL-prefix property** for `https://codesensitive.github.io/`. You do not control DNS for `github.io`, so do not choose a Domain property for that shared domain.
3. Choose HTML-tag or HTML-file verification. Copy the exact verification tag or download the provided verification file. Add that exact tag to the homepage head, or the provided file to `dist/`, then deploy and click Verify. Do not invent a token. Leave the verification in place afterward.
4. Submit `https://codesensitive.github.io/sitemap.xml` in Sitemaps.
5. Inspect the homepage and case-study URLs. Use Test Live URL, confirm the canonical and crawl result, and request indexing for each if appropriate. Requests do not guarantee indexing.
6. Monitor Page indexing and Search results. Compare impressions, clicks, search queries and average position over time; small-sample position changes are noisy. Search Console data and indexing submission have not been verified in this implementation.

## Useful follow-through

Link this portfolio from your GitHub profile website field, relevant repository README and LinkedIn profile if you have one. Keep the name, role and destination consistent. These account changes have not been made. Publish further case studies when there is real engineering work and evidence to discuss; do not generate thin pages just to cover keyword variants. Seek relevant references and mentions through useful work, rather than bought links or mass submissions.

Initial search themes are “Anuj Yadav AI engineer”, “Anuj Yadav RAG developer”, “Codesensitive portfolio” and “Evidence Lab browser RAG”. These are content themes, not claims of search volume or verified rankings. Broad “AI engineer” rankings face much wider competition.

The historical ChatGPT Sites URL may still exist. This deployment cannot set its server redirects or canonical tags. If that old site remains public, use its hosting controls to redirect it to the GitHub Pages site where supported, or retire the duplicate. No old site was changed during this work.

## Sources and maintenance

- [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Search Console setup](https://developers.google.com/search/docs/monitor-debug/search-console-start)
- [Structured profile pages](https://developers.google.com/search/docs/appearance/structured-data/profile-page)

When adding a substantive public page, give it a unique title, description, canonical URL, internal link and sitemap entry, and extend the metadata/link tests. Keep schema aligned with visible content. Do not add fake credentials, copied content, keyword stuffing, hidden text or fabricated popularity. Update the case study when implementation or measured results materially change; do not change publication dates merely to appear fresh.
