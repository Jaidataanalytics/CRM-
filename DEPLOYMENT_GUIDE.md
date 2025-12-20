# Frontend Deployment Guide - Sharda Lead Management Dashboard

## Production Setup (IMPORTANT!)

The frontend is now configured to run in **production mode** for reliable deployments.

### What Changed:

1. **`yarn start` now serves production build** instead of development server
2. **`yarn start:dev`** is available if you need development mode with hot-reload
3. **`prebuild`** script automatically clears caches before each build

### Why This Matters:

| Mode | Command | Use Case | Caching |
|------|---------|----------|---------|
| **Production** | `yarn start` | Deployment, Production | Static files, no issues |
| Development | `yarn start:dev` | Local development | Hot-reload, can cache |

### How Deployments Work Now:

1. When you make code changes, run `yarn build` to create production bundle
2. The `yarn start` command serves the static `build/` folder
3. No development server caching issues

### If You Ever See Old Code:

```bash
# 1. Rebuild the frontend
cd /app/frontend
yarn build

# 2. Restart the server
sudo supervisorctl restart frontend
```

### Package.json Scripts:

```json
{
  "scripts": {
    "start": "npx serve -s build -l 3000 -n",  // Production server
    "start:dev": "craco start",                 // Development server  
    "build": "craco build",                     // Build production
    "prebuild": "rm -rf node_modules/.cache .cache 2>/dev/null || true"
  }
}
```

### Important Files:

- `/app/frontend/build/` - Production bundle (served to users)
- `/app/frontend/src/` - Source code (edit these files)
- `/app/frontend/package.json` - Scripts configuration

### Deployment Checklist:

- [ ] Made code changes in `/app/frontend/src/`
- [ ] Run `yarn build` to create production bundle
- [ ] Run `sudo supervisorctl restart frontend`
- [ ] Verify changes at deployed URL

---

## Troubleshooting

### Changes not appearing after deployment:

1. Check if build folder has latest timestamp:
   ```bash
   ls -la /app/frontend/build/
   ```

2. Rebuild if needed:
   ```bash
   cd /app/frontend && yarn build
   ```

3. Restart frontend:
   ```bash
   sudo supervisorctl restart frontend
   ```

4. Check logs:
   ```bash
   tail -20 /var/log/supervisor/frontend.out.log
   ```

Expected log output for production mode:
```
$ npx serve -s build -l 3000 -n
INFO  Accepting connections at http://localhost:3000
```

If you see `webpack compiled` or `Starting the development server`, something is wrong.
