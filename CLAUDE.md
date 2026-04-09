# Dunk

Immersive 3D art space. React Three Fiber + Vite, deployed on Railway.

## After every task
After pushing to main, verify CI and deployment both completed before finishing:

1. Wait for CI to pass (Railway will not deploy until it does):
   ```
   gh run watch --exit-status
   ```
2. Once CI passes, check the Railway build succeeded:
   ```
   railway logs --build 2>&1 | tail -5
   ```
3. Check the deployment is running without errors:
   ```
   railway logs 2>&1 | tail -5
   ```
4. Look for `Build time:` in build logs and `server running` in runtime logs
5. If anything fails, diagnose and fix before finishing the task

## Stack
- React Three Fiber + Drei for 3D
- Vite for bundling
- Railway for hosting (auto-deploys on push to main, waits for CI)
- Playwright for E2E tests — CI runs on every push

## Rules
- Single source of truth for colours: `src/theme.js`
- Keep code minimal — no abstractions until needed
- Run `npm test` before pushing if changing anything structural
