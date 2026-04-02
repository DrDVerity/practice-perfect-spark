

# Plan: Admin Dashboard Enhancements

## Summary
Enhance the admin dashboard with improved stats cards, campaign actions, variances tracking, password management for office members, and role-based login redirects.

---

## Changes

### 1. Update overview cards on Admin Dashboard

Current state: 3 cards (Practices, Campaigns Running, KB Docs). The KB card shows all client docs.

Changes:
- **Campaigns Running** card: show count of ALL campaigns (not just active), label as "All Campaigns"
- **Knowledge Base** card: filter to show only the admin's own KB docs (the admin's `user_id`), since this KB holds platform-level AI instructions/prompts
- **Add "Variances" card**: new 4th tile showing count of issues:
  - Accounts not assigned to an owner
  - Office members not assigned to a client
  - Clients not assigned to a manager
  - Clicking opens a variances detail view listing each issue with action buttons to resolve (assign)

### 2. Campaign table "Actions" column

In the `campaigns` activeView, add an **Actions** column to each campaign row with a dropdown menu:
- **Edit** — navigates to `/campaign/:id`
- **Copy** — duplicates the campaign (insert new row with same data, "Copy of" prefix)
- **Delete** — confirmation dialog, then deletes campaign

### 3. Password management for office members

When admin is viewing a client or manager account (via the Edit Account dialog or a new section):
- Add ability to **change password** for users attached to the practice
- This requires a backend function (edge function) that uses the Supabase Admin API to update a user's password, since client-side cannot change another user's password
- Create edge function `admin-reset-password` that accepts `{ user_id, new_password }`, verifies the caller is admin via JWT, then calls `supabase.auth.admin.updateUserById()`
- Add a "Reset Password" button in the accounts table actions and in the Edit Account dialog

### 4. Role-based login redirect

In `Login.tsx`, after successful login, check the user's role:
- **Admin** or **Manager** → redirect to `/admin`
- **User** → redirect to `/dashboard`

Update `useAuth.tsx` or Login page to wait for role data before redirecting.

### 5. Admin self-assignment to clients

In the Manager Assignment dialog (and the accounts view), allow the admin to assign clients to themselves — currently the filter excludes admins. Modify the assignment logic so the admin user can also appear as an assignable "manager" for client accounts.

---

## Technical Details

### New edge function: `admin-reset-password`
```typescript
// supabase/functions/admin-reset-password/index.ts
// Accepts POST { user_id, new_password }
// Verifies caller is admin via JWT + is_admin() check
// Calls supabase.auth.admin.updateUserById(user_id, { password })
```

### Files to edit:
- **`src/pages/AdminDashboard.tsx`** — add Variances card, Actions column on campaigns, password reset button, admin self-assignment
- **`src/pages/Login.tsx`** — role-based redirect after login
- **`src/hooks/useAuth.tsx`** — expose a method or flag for login redirect logic
- **`supabase/functions/admin-reset-password/index.ts`** — new edge function for password resets

### Variances logic (computed client-side from existing queries):
- Accounts without a manager: profiles where no `manager_assignments.client_user_id` matches and user is not admin/manager
- Members not assigned to a practice: profiles with no `practice_name` and no admin/manager role
- The variances view lists each with an "Assign" action button

