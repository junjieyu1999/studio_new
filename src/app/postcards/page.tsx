// app/postcards/page.tsx — public page for the monthly snail mail postcards.
// Server component: reads the issues marked "published" in the admin and passes
// only the public-safe fields (month, city, artwork) to the page.

import type { Metadata } from 'next';
import PostcardsPage from './PostcardsPage';
import { getAdminClient } from '@/lib/supabase-admin';
import type { PublicIssue } from '@/lib/mail';

// Read live on every request, like the home and /browse pages, so a newly
// published issue shows up immediately.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Postcards by post — Yu Jun Jie',
  description:
    'Every month, an original print of my artwork lands in your mailbox: a postcard from a city I have travelled to, with trip highlights and a personal story.',
};

type IssueRow = {
  id: string;
  issue_month: string;
  city: string;
  country: string | null;
  title: string | null;
  artwork_id: string | null;
};
type ArtworkRow = { id: string; title: string; image_url: string | null; gradient_bg: string | null };

async function getPublishedIssues(): Promise<PublicIssue[]> {
  try {
    const admin = getAdminClient();

    // Explicit column list: highlights, story and costs are never selected here.
    const { data, error } = await admin
      .from('mail_issues')
      .select('id, issue_month, city, country, title, artwork_id')
      .eq('is_published', true)
      .order('issue_month', { ascending: true });

    if (error || !data) {
      if (error) console.error('postcards: could not load issues:', error.message);
      return [];
    }
    const issues = data as IssueRow[];

    const artworkIds = Array.from(new Set(issues.map((i) => i.artwork_id).filter((x): x is string => !!x)));
    const artworks = new Map<string, ArtworkRow>();
    if (artworkIds.length > 0) {
      const { data: rows, error: artErr } = await admin
        .from('artworks')
        .select('id, title, image_url, gradient_bg')
        .in('id', artworkIds);
      if (artErr) console.error('postcards: could not load artworks:', artErr.message);
      for (const a of (rows ?? []) as ArtworkRow[]) artworks.set(a.id, a);
    }

    return issues.map((i) => {
      const art = i.artwork_id ? artworks.get(i.artwork_id) : undefined;
      return {
        id: i.id,
        issue_month: i.issue_month,
        city: i.city,
        country: i.country,
        title: i.title,
        artwork: art ? { title: art.title, image_url: art.image_url, gradient_bg: art.gradient_bg } : null,
      };
    });
  } catch (err) {
    // Missing env vars or tables must never take the public page down.
    console.error('postcards: falling back to no issues:', err);
    return [];
  }
}

export default async function Postcards() {
  const issues = await getPublishedIssues();
  return <PostcardsPage issues={issues} />;
}
