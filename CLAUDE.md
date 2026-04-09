# Dunk

Immersive 3D art space. React Three Fiber + Vite, deployed on Railway.

## After every task
Before considering a task complete, verify the Railway deployment succeeded:
```
railway logs --build | tail -5
railway logs | tail -5
```
If the deployment failed, diagnose and fix it before finishing.

## Stack
- React Three Fiber + Drei for 3D
- Vite for bundling
- Railway for hosting (auto-deploys on push to main)
- Playwright for E2E tests

## Rules
- Single source of truth for colours: `src/theme.js`
- Keep code minimal — no abstractions until needed
- Run `npm test` before pushing if changing anything structural
