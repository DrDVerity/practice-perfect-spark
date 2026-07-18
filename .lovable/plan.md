## 1. Contact page — message form to David@Archerdental.marketing.com
`src/pages/archer/SubPages.tsx` → `ContactPage`:
- Replace the `hello@digitaldentalfusion.com` link with `David@Archerdental.marketing.com`.
- Add a proper contact form (Name, Email, Practice, Message) beneath the email block.
- Submit builds a `mailto:David@Archerdental.marketing.com` link with the subject and body prefilled from the form and opens it in the user's mail client (no backend/RLS/edge-function dependency, works immediately). Success toast on submit.

## 2. Bulk delete of prospect leads actually deletes
Root cause (verified via `pg_policies`): `public.prospect_accounts` has only a SELECT policy for admins — no DELETE or UPDATE policy — so RLS silently drops the delete/update. The toast reports success because Supabase returns `error: null` when 0 rows match.

Migration adds admin-scoped policies:
```sql
CREATE POLICY "Admins can delete prospects" ON public.prospect_accounts
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update prospects" ON public.prospect_accounts
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
```
(Insert stays server-side via service role — unchanged.)

Also harden `ProspectLeadsPanel.doDelete` to request `.select('id')` back and warn if 0 rows were actually removed, so a future RLS regression is visible instead of silent.

## 3. Site-wide: every Archer logo links to `/`
- `src/components/icons/Logo.tsx`: change the root wrapper from `<div>` to `<Link to="/">` so every consumer (Dashboard, AdminDashboard, ManagerDashboard, CampaignEditNew, ChannelEdit, KnowledgeBase, Schedule, Login) becomes clickable without touching each page.
- `src/pages/Index.tsx` line 106: unwrap the existing outer `<Link to="/">` around `<Logo />` to avoid nested anchors.
- `src/components/archer/Footer.tsx`: wrap the `<img>` logo in `<Link to="/">`.
- `Header.tsx` logo is already inside a `Link to="/"` — no change.

## 4. Admin Dashboard label
`src/pages/AdminDashboard.tsx` lines 838 and 1636: replace `"All Practices/Accounts"` with `"All Accounts"`.

## Technical notes
- No changes to campaign, agent, or business-logic code.
- Migration only adds two RLS policies; no schema changes and no new tables (so no GRANT block required — table grants are already in place).
- Contact form uses `mailto:` to avoid needing a new edge function, secret, or verified sending domain.
