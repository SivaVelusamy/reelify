import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, parseISO } from 'date-fns';

/** Merge Tailwind class names, resolving conflicts. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a number of seconds as `H:MM:SS` or `M:SS`. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '0:00';
  }
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number): string => value.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Format a byte count as a human-readable size. */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(exponent === 0 ? 0 : decimals)} ${units[exponent]}`;
}

type DateInput = string | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null || input === '') {
    return null;
  }
  const date = typeof input === 'string' ? parseISO(input) : input;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format an ISO date string (or Date) as a readable date. Empty string for null/invalid. */
export function formatDate(input: DateInput, pattern = 'MMM d, yyyy'): string {
  const date = toDate(input);
  return date ? format(date, pattern) : '';
}

/** Format an ISO date string (or Date) as a relative time, e.g. "3 hours ago". */
export function formatRelative(input: DateInput): string {
  const date = toDate(input);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : '';
}
