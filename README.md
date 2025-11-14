# Pixel Garden

Pixel Garden is a cozy incremental gardening game built with React + Vite. Plant trees, gather seeds, unlock upgrades, and now keep tending your grove even when you're offline.

## Features

- 🌱 **Chill incremental gameplay** – grow trees, harvest seeds, and manage seasonal events.
- 🧪 **Upgrade system** – invest in tools, cultivation, expansion, and automation paths.
- 📱 **Offline-ready PWA** – install the game on mobile or desktop and play without a network connection.

## Getting Started

```bash
npm install
npm run dev
```

The site deploys to GitHub Pages at `https://xzelleiv.github.io/pixel-garden/`.

## Offline / Mobile Installation

1. Visit the live site (or your local dev server) in a modern browser.
2. Wait for the "Install"/"Add to Home Screen" prompt, or open the browser menu and choose **Install App** (Chrome) or **Add to Home Screen** (Safari).
3. The app installs with a native-like icon (matching the tree sprite) and runs standalone, caching assets, audio, and game code.
4. Progress still saves locally, and the service worker keeps assets fresh the next time you're online.

## Building for Production

```bash
npm run build
```

This runs `vite build`, emits the PWA service worker + manifest, and outputs files to `dist/` ready for deployment.

## Tech Stack

- React 19 with functional components
- Vite 6 for bundling + `vite-plugin-pwa` for offline support
- TypeScript for type safety
- GitHub Pages for hosting

Happy gardening! 🌿
