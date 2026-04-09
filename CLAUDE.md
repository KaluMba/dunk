# Dunk

Immersive 3D art space. React Three Fiber + Vite, deployed on Railway.

## After every task
After pushing to main, verify the deployment fully completed before finishing:

1. Wait for the new deployment to trigger (give it ~10 seconds after push)
2. Check the build completed successfully:
   ```
   railway logs --build 2>&1 | tail -5
   ```
3. Check the deployment is running without errors:
   ```
   railway logs 2>&1 | tail -10
   ```
4. Look for `Build time:` in build logs and `server running` in runtime logs as confirmation
5. If either step shows errors, diagnose and fix before finishing the task

## Stack
- React Three Fiber + Drei for 3D
- Vite for bundling
- Railway for hosting (auto-deploys on push to main)
- Playwright for E2E tests

## Rules
- Single source of truth for colours: `src/theme.js`
- Keep code minimal — no abstractions until needed
- Run `npm test` before pushing if changing anything structural
