// app/postcards/page.tsx — public page for the monthly snail mail postcards.
// Server component: reads the issues marked "published" in the admin and passes
// only the public-safe fields (month, city, design image) to the page.

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

async function getPublishedIssues(): Promise<PublicIssue[]> {
  try {
    // Explicit column list: highlights, story and costs are never selected here.
    // Postcard designs come from the issue itself, not from the artworks table, so
    // the oil paintings never appear on this page (and the postcards never in the gallery).
    const { data, error } = await getAdminClient()
      .from('mail_issues')
      .select('id, issue_month, city, country, title, image_url')
      .eq('is_published', true)
      .order('issue_month', { ascending: true });

    if (error || !data) {
      if (error) console.error('postcards: could not load issues:', error.message);
      return [];
    }
    return data as PublicIssue[];
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
