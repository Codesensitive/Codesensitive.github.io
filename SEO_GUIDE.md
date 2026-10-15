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

## Google Search Console: setup completed on 15 October 2026

- Added and verified the URL-prefix property `https://codesensitive.github.io/` using Google's HTML tag.
- The exact verification tag is deployed in `dist/index.html`. Keep it in the homepage head when editing or rebuilding the site so ownership verification remains valid.
- Google's live URL tests passed for the homepage and `https://codesensitive.github.io/evidence-lab.html`: both were available to Google and could be indexed. Google detected a valid ProfilePage item on the homepage and a valid Breadcrumbs item on the case study.
- Requested indexing for both URLs; Search Console confirmed **Indexing requested** for each. This confirms submission, not completed indexing or rankings.
- Submitted `https://codesensitive.github.io/sitemap.xml`. Search Console still reported **Couldn't fetch** after resubmission. The public file returned HTTP 200 with valid XML containing both URLs, and `robots.txt` allowed crawling and declared the sitemap. The reason for Google's fetch failure was not provided; sitemap processing remains unresolved.

Next account check: open Sitemaps and see whether Google has read the file successfully. If the error persists, inspect its latest details and recheck the public sitemap response before another submission. Both pages already have direct indexing requests. Monitor Page indexing and Search results for Google's eventual decisions, impressions, clicks and search queries. New properties may initially have no performance data. Do not interpret an accepted request as a guarantee of indexing.

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
