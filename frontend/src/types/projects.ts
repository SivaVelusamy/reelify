// Module-local types for the Projects / Uploads module.
// Extends the shared contracts in ./index.ts without modifying that file.

import type { Project, SourceVideo, SourceVideoStatus } from './index';

/** Project detail payload — the backend nests its source videos and a count. */
export interface ProjectDetail extends Project {
  videos?: SourceVideo[];
  video_count?: number;
}

/** Payload for creating a project. */
export interface ProjectCreateInput {
  title: string;
  description?: string | null;
  campaign?: string | null;
}

/** Payload for updating a project (all fields optional). */
export type ProjectUpdateInput = Partial<ProjectCreateInput>;

/** Response of GET /videos/{id}/status — a lightweight polling shape. */
export interface SourceVideoStatusResponse {
  id: number;
  status: SourceVideoStatus;
  error_message: string | null;
}

/** A single file queued in the batch-upload tab, with client-side validation state. */
export interface PendingUploadFile {
  id: string;
  file: File;
  error: string | null;
}
