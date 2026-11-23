This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Snail mail postcards

A monthly postcard service: a public page for sign-ups, and an admin to run it.

- **`/postcards`** (public): what subscribers get, the route so far, and "Add your address" buttons that open the sign-up Google Form. The form URL is `POSTCARD_FORM_URL` in `src/lib/mail.ts`. A "Monthly postcards" button on the 3D gallery and a "Postcards" link on `/browse` lead here.
- **`/admin`** (password protected, same login as before): now has three tabs. **Overview** shows the artwork and postcard pipelines side by side with things that need attention, **Artworks** is the existing oil-painting manager, and **Snail mail** manages subscribers, monthly issues, shipments, costs and profit.

### One-time setup
1. In the Supabase **SQL Editor**, run `supabase/migration_snail_mail.sql` (safe to re-run). It creates `mail_subscribers`, `mail_issues` and `mail_shipments`. They hold home addresses, so Row Level Security is on with no public access: only the server (service role key) can read them.
2. To track payment plans, then run `supabase/migration_payments.sql` (also safe to re-run, and it must come after the first one). It adds the 1, 3, 6 and 12 month plans, a payment ledger, and a unique reference code (`PC0001`, `PC0002`, ...) for every subscriber. Until you run it the admin still works; the Payments features just show a notice asking you to run it.
3. No new environment variables. It uses the existing `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_PASSWORD` (and optional `ADMIN_USER`). If `ADMIN_PASSWORD` is unset in production, all admin pages and APIs refuse every request.

### Payment plans (PayNow and Revolut)
Money never passes through the site. Subscribers pay you directly, and you record it in *Snail mail → Payments*.
- **Plans and prices**: set what you charge for 1, 3, 6 and 12 months (in S$, for the whole plan). Prices start blank. They only prefill the amount when you record a payment, and untick *Offered* to stop offering a plan.
- **Reference code**: every subscriber has a code like `PC0001` (shown on their record with a Copy button). Ask them to put it in the PayNow or Revolut transfer reference so you can match the payment in your bank app.
- **Recording a payment**: use *Record a payment* (Payments tab, or on a subscriber). Pick the plan, the first month it covers, how they paid and the date you received it. For a foreign currency (Revolut), enter the amount and currency plus what it was worth in S$, so profit and totals stay in S$. Recording a plan that overlaps months they already paid for asks you to confirm.
- **Status**: each subscriber shows *Paid*, *Renewal due* (covered this month but not next), *Lapsed* (covered before, not now), *Not paid yet* or *Free* (price per issue 0). The Payments tab lists everyone who needs a payment, and Overview flags them too.
- **Refunds**: *Refund* keeps the record but stops it covering any months and removes it from the totals. Payments cannot be edited into a different plan or period; delete and re-record instead.
- **Mailing only paid subscribers**: when generating shipments, tick *Leave them out when I generate shipments* to skip active subscribers who have not paid for that month.

### Running it
- **Subscribers**: when someone fills in the Google Form, add them under *Snail mail → Subscribers*. Only *Active* subscribers get a postcard.
- **Monthly issues**: create one per month (city, postcard design image, what goes on the card, cost per postcard). Tick *Show on the public Postcards page* to publish the month, city and design image on `/postcards`. Highlights, story and costs are never shown publicly.
- **Shipments**: open an issue and click *Generate shipments*. Each active subscriber gets a row with price and costs copied in (Singapore addresses use local postage, anywhere else overseas postage). Mark them printed or mailed one by one or all at once, and use *Copy addresses to mail* for labels.
- **Money**: revenue counts for mailed or delivered postcards, costs for mailed, delivered or returned ones. Dates use Singapore time.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Postcard designs are a separate collection

Postcard designs are **not** stored in the `artworks` table, so they never appear in your oil-painting gallery, and your paintings never appear on `/postcards`. Each issue has its own design image: open the issue in *Snail mail*, save it, then use **Upload design** (JPG, PNG or WebP, up to 4 MB). Files are kept under `postcards/` in the same storage bucket. If you ran an earlier version of `supabase/migration_snail_mail.sql`, run the updated file again; it is safe to repeat and only adds the two new image columns.
