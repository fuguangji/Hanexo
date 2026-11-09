# HANEXO

HANEXO is built in this repository. Its production build is published to the
[website repository](https://github.com/fuguangji/fuguangji.github.io) at
`game/Hanexo/`.

## Deployment workflow

The deployment workflow is maintained in the website repository:

`.github/workflows/deploy-hanexo.yml`

It checks this repository's `main` branch every five minutes and can also be
started manually from the website repository's **Actions** tab.

When a new source commit is detected, the workflow:

1. Checks out HANEXO.
2. Installs dependencies with `npm ci` (or `npm install` if no lockfile exists).
3. Runs `npm run build`.
4. Publishes the contents of `dist/` to `game/Hanexo/` in the website repository.
5. Commits and pushes the deployment using the website repository's
   `GITHUB_TOKEN`.

The workflow skips deployment until a `package.json` exists and a valid
`HANEXO_TOKEN` secret has been configured. Missing configuration does not
cause the scheduled run to fail.

## One-time configuration

A maintainer must configure the following secret in the **website repository**:

1. Open [fuguangji.github.io → Settings → Secrets and variables → Actions](https://github.com/fuguangji/fuguangji.github.io/settings/secrets/actions).
2. Select **New repository secret**.
3. Set the name to `HANEXO_TOKEN`.
4. Set the value to a fine-grained personal access token that can access
   `fuguangji/Hanexo` with **Contents: Read-only** permission.
5. Save the secret.

The token is only used to read this private source repository. The website
workflow uses its own `GITHUB_TOKEN` to write the generated files to the
website repository; its workflow permissions include `contents: write`.

Do not commit the token, paste it into source files, or put it in this README.

## Build requirements

When the application is ready for deployment, this repository must contain:

- `package.json` with a `build` script (for example, `vite build`).
- A lockfile (`package-lock.json`) recommended for reproducible installs.
- A build that outputs the production site to `dist/`.

For Vite, configure the public base path as:

```js
export default {
  base: '/game/Hanexo/'
}
```

The workflow does not create the application scaffold or modify its source
configuration. It only installs, builds, and publishes the existing project.

## Deployment destination

- Source: `fuguangji/Hanexo`, branch `main`
- Destination: `fuguangji/fuguangji.github.io/game/Hanexo/`
- Published URL: https://fuguangji.github.io/game/Hanexo/

The workflow replaces the contents of the HANEXO deployment directory on each
successful deployment. It does not replace the rest of the website.
