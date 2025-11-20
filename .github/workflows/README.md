# GitHub Actions for Juno Deployment

This directory contains GitHub Actions workflows for deploying the NFT Studio application to Juno.

## Deployment Workflow

The `deploy.yml` workflow automatically deploys the application to Juno when changes are pushed to the `main` branch.

### Required Secrets

For the deployment to work, you need to set up the following secrets in your GitHub repository:

1. `JUNO_TOKEN` - A controller token generated from the Juno Console with appropriate permissions

### How It Works

1. The workflow checks out the repository
2. Sets up Node.js and pnpm environments
3. Installs dependencies using pnpm
4. Uses the official Juno GitHub Action to deploy the application
5. The Juno Action automatically runs the `predeploy` command (`pnpm build`) defined in `juno.config.ts`
6. Deploys the built assets from the `build` directory to your Juno satellite

### Manual Deployment

You can also trigger the deployment manually through the GitHub Actions interface.

## CI Workflow

The `ci.yml` workflow runs on every push and pull request to ensure code quality:

1. Runs linting checks
2. Performs type checking
3. Executes tests

## Publish Workflow

The `publish.yml` workflow publishes serverless functions to Juno when a new release is created.

Note: This workflow will only run if you have implemented serverless functions in the `src/satellite` directory.
