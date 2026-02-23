# Files Needed For This Site

## Active app type
- The active app is a single-page app rooted at `index.html` (not `src/` React source in this folder).
- `npm run dev` / `npm run build` works through Vite with `index.html` as entry.

## Required to run the site (runtime)
- `index.html`
- `sw.js`
- `site.webmanifest`
- `icon-bigger.png`
- `analytics.svg`
- `cat.svg`
- `notebook-nav.svg`
- `flower-new.svg`
- `heart.svg`
- `bastard.svg`
- `bastard2.svg`
- `bastard3.svg`
- `star1.svg`
- `star2.svg`
- `star3.svg`
- `background/styles2.css`
- `background/script2.js`
- `trackers/sleep.css`
- `trackers/sleep.js`
- `trackers/caffeine.js`
- `analytics/analytics.css`
- `analytics/analytics.js`
- `analytics/charts.js`
- `analytics/insights.js`
- `analytics/utils.js`

## Required for local development/build tooling
- `package.json`
- `package-lock.json`
- `vite.config.js`
- `node_modules/` (generated from `npm install`, can be deleted and reinstalled)

## Build output (generated, can be recreated)
- `dist/`

## Optional / not needed for the current runtime path
- `firestore.rules` (deployment/security rules file, not loaded by browser runtime)
- `backups/` (snapshot/history only)
- `.vscode/` (editor settings only)
- `.claude/` (assistant/tool metadata only)

## Currently unused by the active runtime (safe to archive if you do not plan to use them)
- `ghost/ghost-anxious.svg`
- `ghost/ghost-happy.svg`
- `ghost/ghost-numb.svg`
- `ghost/ghost-sad.svg`
- `ghost/ghost-unhappy.svg`
- `ghost/ghost-yay.svg`
- `ghost/ghost-friend.txt`
- `trackers/caffeine.html`
- `trackers/mug-filled.svg`
- `trackers/mug-outline.svg`
- `analytics/patterns-counted.txt`
- `background/bg.html`

## Notes
- Your IDE tab `src/App.jsx` appears to come from backup content, not this active root app.
- If you still deploy from `dist/`, keep it; if you only build during deploy, it can stay untracked.
