# Joy-Matrix

An extension of the Eisenhower matrix that scores each task against every team
member's **pleasure**, **talent**, and current **capacity** (each on a -3 to +3
scale) — then assigns work to move from A to B as fast as possible while
eliminating burnout and maximizing joy.

## Live demo

After deploying (instructions below), your app will live at
`https://YOUR-USERNAME.github.io/joy-matrix/`.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Deploy to GitHub Pages

1. **Create a new GitHub repo** named `joy-matrix` (or whatever you prefer — see
   step 4 if you rename).
2. **Push this code** to the repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/joy-matrix.git
   git push -u origin main
   ```
3. **Enable GitHub Pages**: in your repo go to *Settings → Pages*, and under
   *Source* select **GitHub Actions**.
4. **If you used a different repo name**, edit `vite.config.js` and change
   `repoName` to match. Push the change.
5. The included workflow (`.github/workflows/deploy.yml`) builds and deploys
   automatically on every push to `main`. First deploy takes about a minute.

For a **user/organization site** (`username.github.io`), set `base: '/'` in
`vite.config.js` instead.

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
