# PRP: Reelify

> Implementation blueprint for parallel agent execution

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | Reelify |
| **Type** | SaaS (Software as a Service) |
| **Version** | 1.0 |
| **Created** | 2026-08-29 |
| **Complexity** | High (async media pipeline + 3rd-party publishing + billing) |

---

## PRODUCT OVERVIEW

**Description:** Reelify ingests long-form video (uploaded files or YouTube URL imports),
transcribes and analyzes it, then automatically produces short, vertical, caption-ready
clips of the most important moments. Editors refine captions, reframe to 9:16, trim in/out
points, apply brand presets, export in platform-specific formats, and publish or schedule
clips to social platforms and internal channels.

**Value Proposition:** A non-video-expert on a corporate L&D / internal-comms team turns a
90-minute all-hands or training recording into a batch of polished, on-brand short clips in
minutes — and pushes them straight to the channels their audience already uses.

**MVP Scope:**
- [ ] User registration and login (email/password, JWT + refresh, password reset)
- [ ] Create a project and upload a source video (file upload + YouTube URL import)
- [ ] Automatic pipeline: transcribe → analyze → generate ranked clip candidates
- [ ] Processing status tracker with clear states and failure handling
- [ ] Clip editor: preview player, manual trim, auto 9:16 reframe, editable captions
- [ ] Export a clip to a vertical preset (Shorts/Reels/TikTok) and download it
- [ ] Library with transcript keyword search and tag/project filtering
- [ ] Dashboard with usage stats and recent activity
- [ ] Email notification when processing completes
- [ ] Stripe subscription with a monthly minutes limit
- [ ] Brand Kit: colors, font, logo/watermark, and reusable caption style presets
- [ ] Publishing: connect a destination, publish now or schedule, calendar view, share links

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Backend | FastAPI + Python 3.11+ | skills/BACKEND.md |
| Frontend | React + TypeScript + Vite | skills/FRONTEND.md |
| Database | PostgreSQL + SQLAlchemy + Alembic | skills/DATABASE.md |
| Auth | JWT (access + refresh) + bcrypt | skills/BACKEND.md |
| UI | Tailwind CSS + shadcn/ui + Framer Motion | skills/FRONTEND.md |
| Async | Redis + Celery (worker + beat scheduler) | skills/BACKEND.md |
| Media | S3-compatible object storage, ffmpeg for render | skills/DEPLOYMENT.md |
| Payments | Stripe (Checkout + Customer Portal + webhooks) | skills/BACKEND.md |
| Testing | pytest + pytest-cov + React Testing Library | skills/TESTING.md |
| Deployment | Docker + docker-compose + GitHub Actions | skills/DEPLOYMENT.md |

**External services:** speech-to-text provider, transactional email provider, YouTube
ingestion (yt-dlp), TikTok / Instagram Graph / YouTube Data OAuth apps, Slack & Teams
incoming webhooks.

---

## DATABASE MODELS

> 21 models. Owner: DATABASE-AGENT. Skill: skills/DATABASE.md

### Auth
- **User** — id, email (unique), hashed_password, full_name, is_active, is_verified,
  is_admin, plan, created_at, updated_at
- **RefreshToken** — id, user_id → User, token_hash, expires_at, revoked, created_at
- **PasswordResetToken** — id, user_id → User, token_hash, expires_at, used

### Projects / Uploads
- **Project** — id, user_id → User, title, description, campaign, created_at, updated_at
- **SourceVideo** — id, project_id → Project, user_id → User, source_type
  (upload | youtube_url), original_url, storage_key, filename, duration_seconds, language,
  status (queued | transcribing | analyzing | clipping | ready | failed), error_message,
  created_at, updated_at
- **Transcript** — id, source_video_id → SourceVideo, language, full_text,
  segments (JSONB: [{start, end, text, speaker}]), created_at
- **BatchUpload** — id, user_id → User, project_id → Project, status, total_items,
  completed_items, created_at

### Clips
- **Clip** — id, source_video_id → SourceVideo, user_id → User, project_id → Project,
  title, start_seconds, end_seconds, score (float), rank,
  status (suggested | draft | rendered | archived),
  aspect_ratio (9:16 | 1:1 | 16:9), reframe_mode (auto | manual), crop_config (JSONB),
  render_storage_key, created_at, updated_at
- **Caption** — id, clip_id → Clip, segments (JSONB: [{start, end, text}]),
  style_preset_id → CaptionStylePreset (nullable), style_overrides (JSONB)
- **ClipExport** — id, clip_id → Clip, preset (tiktok | reels | shorts | custom),
  resolution, format, storage_key, status (queued | rendering | ready | failed), created_at

### Library
- **Tag** — id, user_id → User, name, color
- **ClipTag** — clip_id → Clip, tag_id → Tag (composite PK)
- **ClipVersion** — id, clip_id → Clip, version_number, snapshot (JSONB),
  render_storage_key, created_at, created_by → User
- **DownloadBundle** — id, user_id → User, clip_ids (JSONB), status, storage_key, created_at

### Brand Kit
- **BrandKit** — id, user_id → User, name, is_default, primary_color, secondary_color,
  font_family, logo_storage_key, watermark_position, created_at, updated_at
- **CaptionStylePreset** — id, user_id → User, brand_kit_id → BrandKit, name, font_family,
  font_size, text_color, highlight_color, background_style,
  animation (none | pop | karaoke | fade), position, created_at

### Billing
- **Subscription** — id, user_id → User, stripe_customer_id, stripe_subscription_id, plan,
  status, current_period_end, created_at, updated_at
- **UsageRecord** — id, user_id → User, period_start, period_end, minutes_processed,
  clips_generated, storage_bytes

### Publishing
- **SocialAccount** — id, user_id → User, platform (tiktok | instagram | youtube | slack | teams),
  external_account_id, display_name, access_token_encrypted, refresh_token_encrypted,
  token_expires_at, status (connected | expired | revoked), created_at
- **PublishJob** — id, clip_id → Clip, user_id → User, social_account_id → SocialAccount,
  destination_type (social | slack | teams | link), caption_text, scheduled_at, published_at,
  status (draft | scheduled | publishing | published | failed), external_post_id,
  error_message, created_at, updated_at
- **ShareLink** — id, clip_id → Clip, user_id → User, slug (unique), is_active, expires_at,
  view_count, created_at

**Constraints & rules:**
- All user-owned rows scoped by `user_id` on every query (except `/admin/*`, `/s/{slug}`).
- `Clip`: `start_seconds < end_seconds`, both within `SourceVideo.duration_seconds`.
- Exactly one `BrandKit` per user with `is_default = true`.
- `SocialAccount` tokens encrypted at rest (`OAUTH_TOKEN_ENCRYPTION_KEY`).
- `Subscription` + `UsageRecord` drive limit enforcement.

---

## MODULES

### Module 1: Authentication
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Create account |
| POST | /api/v1/auth/login | Get access + refresh tokens |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Revoke refresh token |
| POST | /api/v1/auth/forgot-password | Email reset token |
| POST | /api/v1/auth/reset-password | Set new password with token |
| GET | /api/v1/auth/me | Current user profile |
| PUT | /api/v1/auth/me | Update profile |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /login | LoginPage | LoginForm, GradientButton |
| /register | RegisterPage | RegisterForm |
| /forgot-password | ForgotPasswordPage | RequestResetForm |
| /reset-password | ResetPasswordPage | ResetPasswordForm |
| /profile | ProfilePage | ProfileForm (protected) |

---

### Module 2: Projects / Uploads
**Agents:** BACKEND-AGENT + FRONTEND-AGENT + DEVOPS-AGENT (storage + worker)

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/projects | List projects |
| POST | /api/v1/projects | Create project |
| GET | /api/v1/projects/{id} | Project detail |
| PUT | /api/v1/projects/{id} | Update project |
| DELETE | /api/v1/projects/{id} | Delete project |
| POST | /api/v1/projects/{id}/videos | Upload file (multipart) or submit YouTube URL |
| POST | /api/v1/projects/{id}/videos/batch | Batch upload |
| GET | /api/v1/videos/{id} | Source video detail + status |
| GET | /api/v1/videos/{id}/status | Poll processing status |
| GET | /api/v1/videos/{id}/transcript | Transcript + segments |
| POST | /api/v1/videos/{id}/reprocess | Re-run pipeline |
| DELETE | /api/v1/videos/{id} | Delete source video |

**Pipeline (Celery tasks):** `ingest` → `transcribe` → `analyze` (rank moments) →
`generate_clips` → mark `ready`; any failure → `failed` + `error_message`; emits
`processing_complete` email.

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /projects | ProjectListPage | ProjectCard, NewProjectDialog |
| /projects/:id | ProjectDetailPage | SourceVideoRow, StatusBadge |
| /projects/:id/upload | UploadPage | FileDropzone, UrlImportForm, BatchUploadList |
| /videos/:id | SourceVideoPage | StatusTracker, TranscriptPreview |

---

### Module 3: Clips
**Agents:** BACKEND-AGENT + FRONTEND-AGENT + DEVOPS-AGENT (ffmpeg render worker)

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/videos/{id}/clips | Ranked clip candidates |
| POST | /api/v1/videos/{id}/clips | Create a manual clip |
| GET | /api/v1/clips/{id} | Clip detail |
| PUT | /api/v1/clips/{id} | Update trim / reframe / crop / title / status |
| PUT | /api/v1/clips/{id}/captions | Update caption text + styling |
| POST | /api/v1/clips/{id}/render | Render clip (returns job) |
| GET | /api/v1/clips/{id}/preview | Preview URL (low-res proxy) |
| POST | /api/v1/clips/{id}/export | Export in target preset/resolution (returns job) |
| GET | /api/v1/exports/{id} | Export job status + signed download URL |
| DELETE | /api/v1/clips/{id} | Delete / archive clip |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /videos/:id/clips | ClipCandidatesPage | ClipCard, ScoreBadge |
| /clips/:id/edit | ClipEditorPage | PreviewPlayer, TrimBar, ReframeControl, CaptionEditor, BrandPresetPicker |
| /clips/:id/export | ClipExportPage | PresetSelector, ExportProgress, DownloadButton |

---

### Module 4: Library / Assets
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/library/clips | List/filter clips (project, tag, campaign, status) |
| GET | /api/v1/library/search?q= | Full-text search over transcripts + titles |
| POST | /api/v1/tags | Create tag |
| GET | /api/v1/tags | List tags |
| POST | /api/v1/clips/{id}/tags | Attach / detach tags |
| GET | /api/v1/clips/{id}/versions | Version history |
| POST | /api/v1/clips/{id}/restore/{version} | Restore a previous version |
| POST | /api/v1/library/bundles | Create bulk-download bundle (returns job) |
| GET | /api/v1/library/bundles/{id} | Bundle status + download URL |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /library | LibraryPage | ClipGrid, FilterBar, TagFilter |
| /library/clips/:id | LibraryClipPage | VersionHistoryList, DownloadButton |
| /library/search | SearchResultsPage | SearchInput, TranscriptHitCard |

**Note:** PostgreSQL full-text search (`tsvector` on `Transcript.full_text` + `Clip.title`).

---

### Module 5: Templates / Brand Kit
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/brand-kits | List brand kits |
| POST | /api/v1/brand-kits | Create brand kit |
| GET | /api/v1/brand-kits/{id} | Brand kit detail |
| PUT | /api/v1/brand-kits/{id} | Update brand kit |
| DELETE | /api/v1/brand-kits/{id} | Delete brand kit |
| POST | /api/v1/brand-kits/{id}/logo | Upload logo / watermark asset |
| GET | /api/v1/caption-presets | List caption style presets |
| POST | /api/v1/caption-presets | Create caption style preset |
| PUT | /api/v1/caption-presets/{id} | Update preset |
| DELETE | /api/v1/caption-presets/{id} | Delete preset |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /settings/brand | BrandKitPage | ColorPicker, FontPicker, LogoUploader |
| /settings/brand/presets | CaptionPresetPage | PresetForm, LiveCaptionPreview |

---

### Module 6: Dashboard
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/dashboard/summary | Usage + limits + recent activity |
| GET | /api/v1/dashboard/activity | Paginated activity feed |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /dashboard | DashboardPage | UsageStatCard, LimitMeter, ActivityFeed, QuickUploadButton |
| /settings | SettingsPage | AccountSettingsForm |

---

### Module 7: Billing (Stripe)
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/billing/checkout-session | Create Stripe Checkout session |
| POST | /api/v1/billing/portal-session | Create Stripe Customer Portal session |
| GET | /api/v1/billing/subscription | Current subscription + usage |
| POST | /api/v1/billing/webhook | Stripe webhook (signature-verified, idempotent) |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /billing | BillingPage | PlanCard, UsageMeter, ManageSubscriptionButton |

**Limit enforcement:** middleware/service checks period `UsageRecord` vs `Subscription.plan`
limit before enqueuing pipeline jobs → `402` with clear message when exceeded.

---

### Module 8: Publishing / Distribution
**Agents:** BACKEND-AGENT + FRONTEND-AGENT + DEVOPS-AGENT (scheduler)

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/social-accounts | List connected accounts |
| POST | /api/v1/social-accounts/connect/{platform} | Start OAuth connect (returns auth URL + state) |
| GET | /api/v1/social-accounts/callback/{platform} | OAuth callback (verifies state) |
| DELETE | /api/v1/social-accounts/{id} | Disconnect account |
| POST | /api/v1/clips/{id}/publish | Publish now or schedule to a destination |
| GET | /api/v1/publish-jobs | List publish jobs (filter status/date) |
| PUT | /api/v1/publish-jobs/{id} | Reschedule / edit a scheduled job |
| DELETE | /api/v1/publish-jobs/{id} | Cancel a scheduled job |
| GET | /api/v1/publish/calendar?from=&to= | Calendar view of jobs |
| POST | /api/v1/clips/{id}/share-link | Create a public share link |
| GET | /api/v1/s/{slug} | Public clip view (unauthenticated) |

**Publish adapters:** `services/publishing/{tiktok,instagram,youtube,slack,teams,link}.py`,
common interface `publish(clip, job) -> external_post_id`. Celery beat scans due
`scheduled` jobs each minute; retries with backoff, marks `failed` + `error_message`.

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /publish | PublishQueuePage | PublishJobRow, StatusFilter |
| /publish/calendar | PublishCalendarPage | CalendarGrid, ScheduledJobChip |
| /clips/:id/publish | PublishComposePage | DestinationPicker, PerPlatformCaption, SchedulePicker |
| /settings/connections | ConnectionsPage | ConnectAccountButton, AccountStatusRow |

---

### Module 9: Admin Panel
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:** (all require `is_admin`, else `403`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/v1/admin/users | List / search users (filter plan/status) |
| GET | /api/v1/admin/users/{id} | User detail + usage |
| PUT | /api/v1/admin/users/{id} | Update status / plan / limits |
| GET | /api/v1/admin/stats | Platform stats (users, minutes, clips, revenue) |
| GET | /api/v1/admin/jobs | Processing job queue health |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /admin | AdminDashboardPage | StatTile, RevenueChart |
| /admin/users | AdminUsersPage | UserTable, EditUserDialog |
| /admin/jobs | AdminJobsPage | QueueHealthPanel, FailedJobList |

---

## PHASE EXECUTION PLAN

### Phase 1: Foundation (parallel)
- **DATABASE-AGENT:** all 21 models, relationships, `database.py`, initial Alembic migration,
  `tsvector` search columns/indexes, seed script (admin user, default plan).
- **BACKEND-AGENT:** `main.py`, `config.py` (pydantic-settings), router/service/schema
  skeleton, auth dependency (`get_current_user`, `require_admin`), error handlers,
  rate-limit setup, `/health`.
- **FRONTEND-AGENT:** Vite + TS + Tailwind + shadcn init, folder structure, `AuthContext`,
  API client with refresh-interceptor, `ProtectedRoute`, base layout/nav, `types/`.
- **DEVOPS-AGENT:** `docker-compose.yml` (api, worker, beat, postgres, redis, minio),
  Dockerfiles, `.env.example`, GitHub Actions (lint + test + build), ffmpeg in image.

**Validation Gate 1:** `pip install -r backend/requirements.txt` · `alembic upgrade head` ·
`npm install` · `npm run build` · `docker-compose config`

### Phase 2: Modules (backend + frontend paired, parallel across module groups)
1. **Auth** (Module 1)
2. **Projects/Uploads + pipeline** (Module 2) — depends on storage + worker from Phase 1
3. **Clips + render** (Module 3) — depends on Module 2
4. **Library** (Module 4) — depends on Module 3
5. **Brand Kit** (Module 5) — parallel with 3/4
6. **Dashboard** (Module 6) — depends on 2/3/7 data
7. **Billing** (Module 7) — parallel after Auth
8. **Publishing** (Module 8) — depends on Module 3 (rendered clips)
9. **Admin** (Module 9) — depends on Auth; last

**Validation Gate 2:** `ruff check backend/` · `pytest -q` (smoke) · `npm run lint` ·
`npm run type-check`

### Phase 3: Quality (parallel)
- **TEST-AGENT:** pytest unit + integration (auth, ownership scoping, limit enforcement,
  pipeline state machine, stripe webhook idempotency, publish scheduler, OAuth state);
  RTL tests for forms and editor; coverage ≥ 80%.
- **REVIEW-AGENT:** security audit (token encryption, signed URLs, share-link slugs,
  webhook verification, admin guards, upload validation), N+1 queries, blocking calls in
  request path.

**Final Validation:** `pytest --cov --cov-fail-under=80` · `npm test` · `npm run build` ·
`docker-compose up -d` · `curl -f localhost:8000/health`

---

## VALIDATION GATES

| Gate | Commands |
|------|----------|
| 1 | `alembic upgrade head` · `npm install` · `npm run build` · `docker-compose config` |
| 2 | `ruff check backend/` · `pytest -q` · `npm run lint` · `npm run type-check` |
| 3 | `pytest --cov --cov-fail-under=80` · `npm test` |
| Final | `docker-compose up -d` · `curl -f localhost:8000/health` |

---

## ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/reelify

# Auth
SECRET_KEY=your-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Redis / workers
REDIS_URL=redis://localhost:6379/0

# Object storage (S3-compatible)
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=reelify-media
STORAGE_ACCESS_KEY=xxx
STORAGE_SECRET_KEY=xxx
SIGNED_URL_TTL_SECONDS=3600

# Transcription
TRANSCRIPTION_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...

# Email
EMAIL_API_KEY=xxx
EMAIL_FROM=notifications@reelify.app

# Social publishing OAuth
TIKTOK_CLIENT_KEY=xxx
TIKTOK_CLIENT_SECRET=xxx
INSTAGRAM_CLIENT_ID=xxx
INSTAGRAM_CLIENT_SECRET=xxx
YOUTUBE_CLIENT_ID=xxx
YOUTUBE_CLIENT_SECRET=xxx
OAUTH_TOKEN_ENCRYPTION_KEY=xxx
OAUTH_REDIRECT_BASE_URL=http://localhost:8000/api/v1/social-accounts/callback

# Frontend
VITE_API_URL=http://localhost:8000
```

---

## NEXT STEP

Execute with parallel agents:

```bash
/execute-prp PRPs/reelify-prp.md
```
