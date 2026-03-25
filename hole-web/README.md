# hole-web (Phaser + TS + Vite)

Hole.io-like **endless** web prototype.

## Dev

```bash
cd hole-web
npm i
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

1. Create a GitHub repo named **hole-web** (or rename and adjust base).
2. In `vite.config.ts`, set:

```ts
const BASE = '/<repo>/'
```

3. Deploy:

```bash
npm run deploy
```

This publishes `dist/` to the `gh-pages` branch.

## Controls

- Desktop: move mouse (or hold click to drag)
- Mobile/tablet: drag to move
- HUD: `SFX: ON/OFF`

## Notes

- No time limit (endless). Objects respawn.
- SFX uses WebAudio oscillator (no audio files yet). Replace later with real SFX if needed.
