# Joy-Matrix

An extension of the Eisenhower matrix that scores each task against every team
member's **pleasure**, **talent**, and current **capacity** (each on a -3 to +3
scale) — then assigns work to move from A to B as fast as possible while
eliminating burnout and maximizing joy.

## Live site

[joy-matrix.com](https://joy-matrix.com)

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Deploy

The repo is configured to deploy from `main` to GitHub Pages with the custom
apex domain `joy-matrix.com`:

- `vite.config.js` serves at the root path (`base: '/'`)
- `public/CNAME` declares the custom domain to GitHub Pages
- `.github/workflows/deploy.yml` builds and publishes on every push to `main`

To deploy your own fork at a different domain, edit `public/CNAME` (or delete
it for a `username.github.io/repo-name/` subpath deploy and set `base` in
`vite.config.js` accordingly).

## Stack

- React 18 + Vite
- `localStorage` for persistence (no backend, no signup, your data stays in
  your browser)
- `lucide-react` for icons
- Inline styles, no CSS framework

## License

Joy-Matrix is released into the **public domain** via the [Unlicense](./LICENSE).

Use it. Fork it. Sell it. Strip the name off and ship it as your own. No
attribution required, no permission needed, no strings.

## Dedication

Dedicated to Terry A. Davis. See [DEDICATION.md](./DEDICATION.md).

## Contributing

Pull requests welcome. By submitting code, you agree that your contribution
is also released into the public domain.
