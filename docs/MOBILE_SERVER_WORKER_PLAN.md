# Mobile Server Worker Plan

Last updated: 2026-06-06

## Decision

Mobile support will be implemented later as a lightweight companion app, not as a full Electron replacement.

The stable target is:

```text
PC app sets up account/API/platform settings
-> PC app syncs encrypted settings by license account
-> Mobile app logs in with the same license
-> Server worker runs publishing jobs even when the phone is closed
-> Mobile app shows queue/progress/completion results
```

## Why This Direction

The current desktop app depends on Electron IPC, local files, OAuth tokens, Playwright/Puppeteer, browser sessions, and local user settings. Those are not a good fit for direct mobile execution.

For mobile users, the app should focus on:

- starting publishing jobs
- checking queue status
- checking progress
- seeing success/failure results
- running simple mobile-friendly workflows

Heavy work should run in a backend worker.

## Required Mobile Modes

The mobile app must support these modes:

1. Sequential publishing mode
   - Load default publishing settings from the user's synced PC profile.
   - Accept one or more keywords.
   - Process jobs one by one.
   - Show progress for article generation, image generation, CTA/linking, platform publishing, and completion.

2. Web/spider linking mode
   - Load saved published posts from the user's account.
   - Select related posts.
   - Generate a hub/summary article.
   - Publish the hub article.
   - If enabled, update the selected child posts with a backlink CTA to the hub article.

3. External traffic text mode
   - Select a published post.
   - Select target channel.
   - Generate channel-specific traffic text.
   - Provide copy/open-platform actions.
   - No risky automated posting to third-party platforms unless explicitly supported and allowed.

## Account And Settings Sync

The server must identify users by license account.

The PC app should upload encrypted settings after license login:

- API keys
- Blogger OAuth token
- Blogger blog ID
- WordPress URL
- WordPress username/application password or JWT token
- image engine preferences
- CTA settings
- default publishing settings
- saved platform/profile settings

The mobile app must not receive raw secrets unless absolutely necessary.

Preferred flow:

```text
Mobile asks server to start a job
Server decrypts settings internally
Server worker runs the job
Mobile receives progress and final result
```

Do not store:

- plain license passwords
- plain API keys
- plain OAuth tokens
- raw `.env` text

Store:

- password hashes
- encrypted API keys
- encrypted platform tokens
- encrypted user settings
- job logs and status records

## Server Worker Scope

The worker should handle:

- article generation
- API-based image generation
- Blogger publishing
- WordPress publishing
- queue processing
- progress updates
- retries for temporary network/rate-limit errors
- fail-fast for authentication/configuration errors

The worker should process publishing jobs sequentially by default.

```text
concurrency: 1 per user
concurrency: 1 for unstable image engines
```

This avoids the repeated errors caused by parallel generation/publishing.

## Progress States

Minimum mobile progress states:

```text
queued
preparing settings
generating article
generating image
building CTA/internal links
publishing to Blogger/WordPress
verifying published URL
completed
failed
```

For spider linking:

```text
loading selected posts
generating hub article
publishing hub article
updating child posts
completed
failed
```

For external traffic:

```text
loading source post
generating channel copy
completed
failed
```

## Recommended Architecture

```text
apps/desktop
  Existing Electron app
  Adds encrypted settings sync

apps/mobile
  React Native or Expo companion app
  License login, job start, queue/progress/result UI

services/api
  License auth
  settings sync
  job creation
  progress stream

services/worker
  sequential publishing worker
  image worker
  spider linking worker
  external traffic worker

packages/orbit-core
  shared generation/publishing logic extracted from current src/core
```

## Cost Target

Stable server-worker target:

- Early stable operation: about 60,000-120,000 KRW/month
- With heavier browser automation: 150,000 KRW/month or more

Do not start this work until mobile demand is clear.

## Later Implementation Order

1. Extract shared core logic from Electron-specific code.
2. Add encrypted settings sync to the PC app.
3. Build license-based API server.
4. Build job database and progress records.
5. Build sequential worker.
6. Add Blogger/WordPress publish worker.
7. Add image generation worker.
8. Add external traffic worker.
9. Add spider linking worker and child-post backlink update.
10. Build mobile app login/dashboard/progress UI.
11. Test with real Blogger and WordPress accounts.
12. Release mobile app as a companion app.

## Important Product Positioning

Mobile is not the full expert desktop interface.

Mobile should feel like:

```text
I already configured everything on PC.
Now I can publish, monitor, and finish jobs from my phone.
```

That is enough for users who occasionally need phone-based control.
