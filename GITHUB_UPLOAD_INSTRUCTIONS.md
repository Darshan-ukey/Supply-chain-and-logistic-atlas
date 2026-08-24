# GitHub upload — exact folder level

The **repository root** should contain `index.html`, `package.json`, `vercel.json`, `api/`, `assets/`, `data/`, `engine/`, `governance/`, `migrations/`, `production/`, `reference/`, `release/`, `tests/` and `README.md`.

Do **not** upload only `index.html` or only the two reference HTML pages.

If creating a fresh repository:

```bash
git init
git add .
git commit -m "Supply Chain Operations Intelligence Platform Pilot V1.0"
git branch -M main
git remote add origin <your-repository-url>
git push -u origin main
```

Then connect that repository to Vercel. Use the repository root as the Vercel Root Directory.
