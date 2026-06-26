# Tistory Platform Integration Plan

## Goal

Add Tistory to LEADERNAM Orbit as a third publishing platform without breaking the existing Blogger and WordPress flows.

## Core Decision

Tistory must be implemented as browser automation, not as API publishing. Tistory Open API write/upload behavior is not a reliable production path, so the app should treat Tistory like a browser-driven publisher similar to the Naver automation flow.

## Product Shape

```text
LEADERNAM Orbit
├─ Blogger: Google Blogger API
├─ WordPress: WordPress REST API
└─ Tistory: Browser automation publisher
```

Common systems remain shared:

- Content generation
- Image generation
- CTA generation
- FAQ/table/mobile HTML
- Sequential queue
- Spider web posting
- External traffic post generation

Only the final publishing adapter changes by platform.

## Architecture

```text
src/core/index.ts
└─ publishGeneratedContent()
   ├─ publishToBlogger()
   ├─ WordPressPublisher.publish()
   └─ publishToTistory()

src/tistory/
├─ tistory-types.ts
├─ tistory-selectors.ts
├─ tistory-session.ts
└─ tistory-publisher.ts
```

## Phase 1: Foundation

1. Add Tistory env keys.
2. Add Tistory profile/session helpers.
3. Add Tistory selector registry.
4. Add `publishToTistory()` MVP entry point.
5. Connect `platform === "tistory"` to `publishGeneratedContent()`.
6. Add IPC methods for session check and login/editor opening.

## Phase 2: Beginner Setup UX

1. Add a Tistory card in platform settings.
2. Split user intent:
   - Connect existing Tistory blog
   - Create a new Tistory blog
3. Open a visible browser window.
4. Guide the user step by step:
   - Login
   - Select or create blog
   - Open editor
   - Detect categories
   - Run private test publish
5. Mark each step green when completed.

## Phase 3: Publishing MVP

1. Open `https://<blogName>.tistory.com/manage/newpost`.
2. Detect login state.
3. Switch to HTML editor mode where possible.
4. Insert title.
5. Insert generated HTML.
6. Add tags.
7. Select category if configured.
8. Save draft/private post first.
9. Return final URL or recovery payload.

## Phase 4: Image Handling

1. Keep URL-based images as a fallback.
2. Add local image upload through the editor.
3. Wait for upload completion.
4. Replace generated image URLs with Tistory-hosted URLs where possible.

## Phase 5: Queue, Spider, External Traffic

1. Force serial publishing for Tistory.
2. Keep a longer delay than API platforms.
3. Clear image previews per post.
4. Store Tistory post URL/postId for spider web posts.
5. Add optional advanced flow to edit old posts and insert a hub-return CTA marker.

## Phase 6: Reliability

1. Add selector health checks.
2. Add screenshots/log artifacts on failure.
3. Add recovery mode:
   - Open editor
   - Copy title
   - Copy HTML
   - Copy tags
4. Never continue the queue after a Tistory publish failure unless the user explicitly retries.

## Release Gate

Tistory should ship as beta only after these pass:

- Existing blog session check succeeds.
- Editor page opens.
- Private test publish succeeds.
- Generated HTML renders without major breakage.
- At least one image path works.
- Three sequential posts complete without parallelism.

