import { Platform as PlatformSource } from '@/types';

const PATTERNS: Array<[RegExp, PlatformSource]> = [
  [/instagram\.com/i, 'instagram'],
  [/(tiktok\.com|vm\.tiktok\.com)/i, 'tiktok'],
  [/(facebook\.com|fb\.watch)/i, 'facebook'],
  [/(youtube\.com|youtu\.be)/i, 'youtube'],
];

export function detectPlatform(url: string | null | undefined): PlatformSource {
  if (!url) return 'manual';
  const match = PATTERNS.find(([regex]) => regex.test(url));
  return match ? match[1] : 'web';
}

export function platformLabel(platform: PlatformSource): string {
  switch (platform) {
    case 'instagram':
      return 'Instagram';
    case 'tiktok':
      return 'TikTok';
    case 'facebook':
      return 'Facebook';
    case 'youtube':
      return 'YouTube';
    case 'web':
      return 'Web';
    case 'manual':
      return 'Manual upload';
    default:
      return 'Other';
  }
}
