# INITIAL.md - Reelify Product Definition

> Turn any long video into short, share-ready clips — without losing the story.

---

## PRODUCT

### Name
Reelify

### Description
Reelify ingests long-form video (uploaded files or YouTube URL imports), transcribes
and analyzes it, then automatically produces short, vertical, caption-ready clips of
the most important moments. Editors can refine captions, reframe to 9:16, trim in/out
points, apply brand presets, and export in platform-specific formats. It is built so
non-video-experts can produce a batch of polished clips from a single source in minutes.

### Target User
Corporate Learning & Development and internal communications teams who need to turn
webinars, all-hands recordings, training sessions, and executive talks into short,
on-brand clips for internal channels (LMS, intranet, Slack/Teams, digital signage).

### Type
- [x] SaaS (Software as a Service)

---

## TECH STACK

### Backend
- [x] FastAPI + Python 3.11+

### Frontend
- [x] React + Vite + TypeScript

### Database
- [x] PostgreSQL + SQLAlchemy

### Authentication
- [x] Email / Password (JWT access + refresh tokens)

### UI Framework
- [x] Tailwind CSS + shadcn/ui + Framer Motion

### Payments
- [x] Stripe (subscription plans + usage limits)

### Storage / Media
- [x] Object storage (S3-compatible) for source video and rendered clips
- [x] Background worker queue for transcription / analysis / rendering jobs

---

## MODULES

### Module 1: Authentication (Required)

**Description:** User authentication and authorization.

**Models:**
- User: id, email, hashed_password, full_name, is_active, is_verified, is_admin, plan, created_at, updated_at
- RefreshToken: id, user_id, token, expires_at, revoked, created_at
- PasswordResetToken: id, user_id, token, expires_at, used

**API Endpoints:**
- POST /api/v1/auth/register - Create new account
- POST /api/v1/auth/login - Login with email/password
- POST /api/v1/auth/refresh - Refresh access token
- POST /api/v1/auth/logout - Revoke refresh token
- POST /api/v1/auth/forgot-password - Request password reset email
- POST /api/v1/auth/reset-password - Reset password with token
- GET /api/v1/auth/me - Get current user profile
- PUT /api/v1/auth/me - Update profile

**Frontend Pages:**
- /login - Login page
- /register - Registration page
- /forgot-password - Request reset
- /reset-password - Set new password
- /profile - User profile page (protected)

---

### Module 2: Projects / Uploads

**Description:** Ingest source video and track it through the processing pipeline.

**Models:**
- Project: id, user_id, title, description, campaign, created_at, updated_at
- SourceVideo: id, project_id, user_id, source_type (upload | youtube_url), original_url,
  storage_key, filename, duration_seconds, language, status
  (queued | transcribing | analyzing | clipping | ready | failed), error_message,
  created_at, updated_at
- Transcript: id, source_video_id, language, full_text, segments (JSON: [{start, end, text, speaker}]), created_at
- BatchUpload: id, user_id, project_id, status, total_items, completed_items, created_at

**API Endpoints:**
- GET /api/v1/projects - List projects
- POST /api/v1/projects - Create project
- GET /api/v1/projects/{id} - Project detail
- PUT /api/v1/projects/{id} - Update project
- DELETE /api/v1/projects/{id} - Delete project
- POST /api/v1/projects/{id}/videos - Upload video file (multipart) or submit YouTube URL
- POST /api/v1/projects/{id}/videos/batch - Batch upload multiple videos
- GET /api/v1/videos/{id} - Source video detail + processing status
- GET /api/v1/videos/{id}/status - Poll processing status
- GET /api/v1/videos/{id}/transcript - Get transcript + segments
- POST /api/v1/videos/{id}/reprocess - Re-run the pipeline
- DELETE /api/v1/videos/{id} - Delete source video

**Frontend Pages:**
- /projects - Project list
- /projects/:id - Project detail with source videos and status
- /projects/:id/upload - Upload / URL import / batch upload flow
- /videos/:id - Source video detail, status tracker, transcript preview

---

### Module 3: Clips

**Description:** AI-suggested best moments plus a lightweight editor to finalize clips.

**Models:**
- Clip: id, source_video_id, user_id, project_id, title, start_seconds, end_seconds,
  score (float, AI virality/context ranking), rank, status (suggested | draft | rendered | archived),
  aspect_ratio (9:16 | 1:1 | 16:9), reframe_mode (auto | manual), crop_config (JSON),
  render_storage_key, created_at, updated_at
- Caption: id, clip_id, segments (JSON: [{start, end, text}]), style_preset_id, style_overrides (JSON)
- ClipExport: id, clip_id, preset (tiktok | reels | shorts | custom), resolution, format,
  storage_key, status (queued | rendering | ready | failed), created_at

**API Endpoints:**
- GET /api/v1/videos/{id}/clips - List clip candidates for a source video (ranked)
- POST /api/v1/videos/{id}/clips - Create a manual clip
- GET /api/v1/clips/{id} - Clip detail
- PUT /api/v1/clips/{id} - Update trim points, reframe, crop, title, status
- PUT /api/v1/clips/{id}/captions - Update caption text and styling
- POST /api/v1/clips/{id}/render - Render the clip with current settings
- GET /api/v1/clips/{id}/preview - Preview URL (low-res proxy)
- POST /api/v1/clips/{id}/export - Export in a target preset/resolution
- GET /api/v1/exports/{id} - Export job status + download URL
- DELETE /api/v1/clips/{id} - Delete / archive clip

**Frontend Pages:**
- /videos/:id/clips - Ranked clip candidates grid
- /clips/:id/edit - Editor: preview player, trim, reframe/crop, caption styling, brand preset
- /clips/:id/export - Export options and download

---

### Module 4: Library / Assets

**Description:** Find, organize, and distribute finished clips.

**Models:**
- Tag: id, user_id, name, color
- ClipTag: clip_id, tag_id
- ClipVersion: id, clip_id, version_number, snapshot (JSON of clip + caption + crop config),
  render_storage_key, created_at, created_by
- DownloadBundle: id, user_id, clip_ids (JSON), status, storage_key, created_at

**API Endpoints:**
- GET /api/v1/library/clips - List/filter clips by project, tag, campaign, status
- GET /api/v1/library/search?q= - Full-text search across transcripts and clip titles
- POST /api/v1/tags - Create tag
- GET /api/v1/tags - List tags
- POST /api/v1/clips/{id}/tags - Attach/detach tags
- GET /api/v1/clips/{id}/versions - Version history
- POST /api/v1/clips/{id}/restore/{version} - Restore a previous version
- POST /api/v1/library/bundles - Create a bulk-download bundle
- GET /api/v1/library/bundles/{id} - Bundle status + download URL

**Frontend Pages:**
- /library - Grid/list of all clips with filters and transcript search
- /library/clips/:id - Clip asset detail, version history, download
- /library/search - Search results view

---

### Module 5: Templates / Brand Kit

**Description:** Reusable brand presets so clips stay consistent across teams and campaigns.

**Models:**
- BrandKit: id, user_id, name, is_default, primary_color, secondary_color,
  font_family, logo_storage_key, watermark_position, created_at, updated_at
- CaptionStylePreset: id, user_id, brand_kit_id, name, font_family, font_size,
  text_color, highlight_color, background_style, animation (none | pop | karaoke | fade),
  position, created_at

**API Endpoints:**
- GET /api/v1/brand-kits - List brand kits
- POST /api/v1/brand-kits - Create brand kit
- GET /api/v1/brand-kits/{id} - Brand kit detail
- PUT /api/v1/brand-kits/{id} - Update brand kit
- DELETE /api/v1/brand-kits/{id} - Delete brand kit
- POST /api/v1/brand-kits/{id}/logo - Upload logo / watermark asset
- GET /api/v1/caption-presets - List caption style presets
- POST /api/v1/caption-presets - Create caption style preset
- PUT /api/v1/caption-presets/{id} - Update preset
- DELETE /api/v1/caption-presets/{id} - Delete preset

**Frontend Pages:**
- /settings/brand - Brand kit manager (colors, fonts, logo, watermark)
- /settings/brand/presets - Caption style preset editor with live preview

---

### Module 6: Dashboard

**Description:** Overview, usage, and account status.

**Frontend Pages:**
- /dashboard - Usage stats (minutes processed, clips generated, storage used),
  plan/limit status, recent activity feed, quick re-upload shortcut
- /settings - Account settings and preferences
- /billing - Plan, invoices, usage against limits (Stripe)

**API Endpoints:**
- GET /api/v1/dashboard/summary - Aggregate usage + limits + recent activity
- GET /api/v1/dashboard/activity - Paginated activity feed

---

### Module 7: Billing (Stripe)

**Description:** Subscription plans and usage-limit enforcement.

**Models:**
- Subscription: id, user_id, stripe_customer_id, stripe_subscription_id, plan,
  status, current_period_end, created_at, updated_at
- UsageRecord: id, user_id, period_start, period_end, minutes_processed,
  clips_generated, storage_bytes

**API Endpoints:**
- POST /api/v1/billing/checkout-session - Create Stripe Checkout session
- POST /api/v1/billing/portal-session - Create Stripe customer portal session
- GET /api/v1/billing/subscription - Current subscription + usage
- POST /api/v1/billing/webhook - Stripe webhook handler

**Frontend Pages:**
- /billing - Plan selection, current usage, manage subscription

---

### Module 8: Publishing / Distribution

**Description:** Publish and schedule finished clips to destinations, with a calendar view.
Corporate destinations (Slack/Teams webhook, shared link/embed) plus public social
platforms (TikTok, Instagram Reels, YouTube Shorts).

**Models:**
- SocialAccount: id, user_id, platform (tiktok | instagram | youtube | slack | teams),
  external_account_id, display_name, access_token (encrypted), refresh_token (encrypted),
  token_expires_at, status (connected | expired | revoked), created_at
- PublishJob: id, clip_id, user_id, social_account_id, destination_type
  (social | slack | teams | link), caption_text, scheduled_at, published_at,
  status (draft | scheduled | publishing | published | failed), external_post_id,
  error_message, created_at, updated_at
- ShareLink: id, clip_id, user_id, slug, is_active, expires_at, view_count, created_at

**API Endpoints:**
- GET /api/v1/social-accounts - List connected accounts
- POST /api/v1/social-accounts/connect/{platform} - Start OAuth connect flow
- GET /api/v1/social-accounts/callback/{platform} - OAuth callback
- DELETE /api/v1/social-accounts/{id} - Disconnect account
- POST /api/v1/clips/{id}/publish - Publish now or schedule to a destination
- GET /api/v1/publish-jobs - List publish jobs (filter by status/date)
- PUT /api/v1/publish-jobs/{id} - Reschedule or edit a scheduled job
- DELETE /api/v1/publish-jobs/{id} - Cancel a scheduled job
- GET /api/v1/publish/calendar?from=&to= - Calendar view of scheduled/published jobs
- POST /api/v1/clips/{id}/share-link - Create a public share link
- GET /api/v1/s/{slug} - Public clip view (unauthenticated)

**Frontend Pages:**
- /publish - Publishing queue (list of draft/scheduled/published)
- /publish/calendar - Calendar view of the content schedule
- /clips/:id/publish - Compose: choose destinations, caption per platform, schedule
- /settings/connections - Connect / manage social and channel accounts

---

### Module 9: Admin Panel

**Description:** Admin-only management interface.

**API Endpoints:**
- GET /api/v1/admin/users - List all users (search, filter by plan/status)
- GET /api/v1/admin/users/{id} - User detail + usage
- PUT /api/v1/admin/users/{id} - Update user status / plan / limits
- GET /api/v1/admin/stats - Platform statistics (users, minutes, clips, revenue)
- GET /api/v1/admin/jobs - Processing job queue health

**Frontend Pages:**
- /admin - Admin dashboard (protected, admin only)
- /admin/users - User management
- /admin/jobs - Job queue monitor

---

## MVP SCOPE

### Must Have (MVP)
- [x] User registration and login (email/password, JWT + refresh, password reset)
- [x] Create a project and upload a source video (file upload + YouTube URL import)
- [x] Automatic pipeline: transcribe → analyze → generate ranked clip candidates
- [x] Processing status tracker with clear states and failure handling
- [x] Clip editor: preview player, manual trim, auto 9:16 reframe, editable captions
- [x] Export a clip to a vertical preset (Shorts/Reels/TikTok) and download it
- [x] Library with transcript keyword search and tag/project filtering
- [x] Dashboard with usage stats and recent activity
- [x] Email notification when processing completes
- [x] Stripe subscription with a monthly minutes limit
- [x] Brand Kit: colors, font, logo/watermark, and reusable caption style presets
- [x] Publishing: connect at least one destination, publish now or schedule a clip,
      calendar view of scheduled/published content, public share links

### Nice to Have (Post-MVP)
- [ ] Batch upload of many videos at once
- [ ] Advanced caption animations (karaoke, word-level highlight)
- [ ] Smart auto-crop that tracks the active speaker
- [ ] Clip version history and restore
- [ ] Bulk download bundles / bulk export
- [ ] Multi-seat team accounts with shared libraries and roles
- [ ] LMS / SharePoint / Slack / Teams export integrations

---

## ACCEPTANCE CRITERIA

### Authentication
- [ ] User can register with email/password
- [ ] User can login with email/password and receive access + refresh tokens
- [ ] User can request a password reset and set a new password via emailed token
- [ ] Access token refresh works; expired/revoked refresh tokens are rejected
- [ ] Protected routes redirect unauthenticated users to /login

### Projects / Uploads
- [ ] User can create, edit, and delete a project
- [ ] User can upload a video file or submit a YouTube URL
- [ ] Source video moves through queued → transcribing → analyzing → clipping → ready
- [ ] A failed job shows a clear error and can be re-run
- [ ] Transcript with time-coded segments is viewable

### Clips
- [ ] After processing, ranked clip candidates appear with scores
- [ ] User can adjust trim in/out points and see the change in preview
- [ ] User can switch aspect ratio to 9:16 with auto-reframe
- [ ] User can edit caption text and apply a style preset
- [ ] User can render and export a clip and download the file

### Library / Assets
- [ ] User can filter clips by project, tag, and campaign
- [ ] Keyword search returns clips whose transcript contains the term
- [ ] User can create tags and attach them to clips

### Templates / Brand Kit
- [ ] User can create a brand kit (colors, font, logo)
- [ ] User can create a caption style preset and apply it in the clip editor

### Publishing / Distribution
- [ ] User can connect a destination account via OAuth and see its status
- [ ] User can publish a clip immediately to a connected destination
- [ ] User can schedule a clip for a future date/time and see it on the calendar
- [ ] A scheduled job can be rescheduled or cancelled before it runs
- [ ] A failed publish shows a clear error and can be retried
- [ ] User can generate a public share link that plays the clip without login

### Dashboard & Billing
- [ ] Dashboard shows minutes processed, clips generated, and storage used for the period
- [ ] User can start a Stripe checkout and see an active subscription
- [ ] Usage that exceeds the plan limit blocks new processing with a clear message

### Admin Panel
- [ ] Admin can list and search users and change a user's plan/status
- [ ] Admin can view platform stats and job queue health
- [ ] Non-admin users get 403 on all /admin endpoints

### Quality
- [ ] All API endpoints documented in OpenAPI
- [ ] Backend test coverage 80%+
- [ ] Frontend TypeScript strict mode passes
- [ ] Docker builds and runs successfully

---

## SPECIAL REQUIREMENTS

### Security
- [x] Rate limiting on auth endpoints
- [x] Input validation on all endpoints (Pydantic schemas)
- [x] SQL injection prevention (parameterized queries / ORM)
- [x] XSS prevention (escaped output, sanitized caption text)
- [x] Signed, time-limited URLs for media download
- [x] File-type and size validation on uploads
- [x] Stripe webhook signature verification
- [x] OAuth state-parameter verification on all social connect flows (CSRF)
- [x] Public share links use unguessable slugs and optional expiry

### Integrations
- [x] Email service for transactional notifications
- [x] Stripe for subscription billing
- [x] S3-compatible object storage for media
- [x] YouTube URL ingestion (download / import of source video)
- [x] Speech-to-text service for transcription
- [x] Background job queue (e.g. Celery/RQ + Redis) for the processing pipeline
- [x] Scheduler for time-based publish jobs
- [x] Social platform APIs: TikTok, Instagram Reels, YouTube Shorts (OAuth + publish)
- [x] Slack / Microsoft Teams incoming webhooks for internal distribution
- [x] Token encryption at rest for connected social accounts

### Performance
- [x] Uploads and renders run asynchronously; the UI never blocks on them
- [x] Status endpoints are cheap to poll
- [x] Large file uploads use multipart / resumable upload

---

## AGENTS

> These agents will build the product in parallel:

| Agent | Role | Works On |
|-------|------|----------|
| DATABASE-AGENT | Creates all models and migrations | All database models |
| BACKEND-AGENT | Builds API endpoints, services, and the job pipeline | All modules' backends |
| FRONTEND-AGENT | Creates UI pages and components | All modules' frontends |
| DEVOPS-AGENT | Sets up Docker, worker/queue, storage, CI/CD | Infrastructure |
| TEST-AGENT | Writes unit and integration tests | All code |
| REVIEW-AGENT | Security and code quality audit | All code |

---

# READY?

```bash
/generate-prp INITIAL.md
```

Then:

```bash
/execute-prp PRPs/reelify-prp.md
```
