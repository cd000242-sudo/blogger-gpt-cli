# LeadersPro Blogspot/WordPress/Tistory Detail Page

This folder contains a ready-to-integrate detail page section for the Leaders Orbit product page on leaderspro.kr.

The page has been renewed to present Leaders Orbit as a 3-platform publishing product:

- Blogspot / Blogger
- WordPress
- Tistory

It also includes the current all-in-one event price notice:

- Current event conditions are valid through July 31, 2026.
- From August 1, 2026, the all-in-one package uses the new pricing table:
  - 1 month: 100,000 KRW
  - 3 months: 240,000 KRW
  - 1 year: 800,000 KRW
  - Lifetime: 3,300,000 KRW

## Files

- `index.html`
  - Standalone preview page.
  - Can also be copied into an existing site section.

- `styles.css`
  - Namespaced under `.lp-bw-detail` to reduce conflicts with the existing site.

- `copy.md`
  - Plain Korean copy for CMS or manual editing.

- `assets/`
  - Real product screenshots and public article result captures.
  - Newly added Tistory/public-result captures:
    - `23-tistory-public-article-hero.png`
    - `24-tistory-public-toc.png`
    - `25-tistory-public-cta.png`

## Recommended Integration

1. Upload the images in `assets/` to the website media folder or CDN.
2. Copy the contents inside `<main class="lp-bw-detail">...</main>` into the Leaders Orbit detail page.
3. Include `styles.css`, or merge it into the site stylesheet.
4. Replace `./assets/...` paths with the final uploaded image URLs.

## Notes

- The page intentionally uses real product screenshots rather than generated mockups.
- The pricing section clearly states the current event period and the August 1, 2026 new pricing table.
- The final sections include no-guarantee notices for search ranking, revenue, AdSense approval, and platform security flows.
