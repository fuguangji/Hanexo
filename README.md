# HANEXO

HANEXO is developed in this repository. Its production build is published to
the [website repository](https://github.com/fuguangji/fuguangji.github.io) at
`game/Hanexo/`.

## Deployment

The GitHub Actions workflow is stored **in this repository**:

`.github/workflows/deploy.yml`

It runs automatically whenever commits are pushed to the `main` branch, and
can also be started manually from this repository's **Actions** tab.

The workflow:

1. Checks out HANEXO source.
2. Installs dependencies with `npm ci` when a lockfile exists (otherwise
   `npm install`).
3. Runs `npm run build`.
4. Verifies that `dist/index.html` exists.
5. Checks out the website repository.
6. Publishes the contents of `dist/` to
   `fuguangji.github.io/game/Hanexo/`.
7. Commits and pushes the generated files to the website repository.

If `package.json` does not exist yet, the workflow safely skips the build.

## One-time configuration

The workflow needs a token that can write to the separate website repository.

1. Create a fine-grained personal access token for
   [fuguangji.github.io](https://github.com/fuguangji/fuguangji.github.io).
2. Grant it **Contents: Read and write** permission for that repository.
3. In this HANEXO repository, open
   [Settings → Secrets and variables → Actions](https://github.com/fuguangji/Hanexo/settings/secrets/actions).
4. Create a repository secret named `WEBSITE_DEPLOY_TOKEN`.
5. Paste the token as its value.

The token is used only by GitHub Actions to publish the build to the website
repository. Never put it in source code or commit it to Git.

## Build requirements

When the application is ready for deployment, this repository must contain:

- `package.json` with a `build` script (for example, `vite build`).
- Preferably `package-lock.json` for reproducible dependency installation.
- A production build that outputs the website to `dist/`.

For Vite, configure the public base path as:

```js
export default {
  base: '/game/Hanexo/'
}
```

The workflow does not create or modify the application scaffold or its source
configuration. It only installs, builds, and publishes the existing project.

## Deployment destination

- Source: `fuguangji/Hanexo`, branch `main`
- Workflow: `fuguangji/Hanexo/.github/workflows/deploy.yml`
- Destination: `fuguangji/fuguangji.github.io/game/Hanexo/`
- Published URL: https://fuguangji.github.io/game/Hanexo/

Only the HANEXO deployment directory is updated; the rest of the website is
left untouched.
