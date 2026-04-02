

# Plan: Multi-Practice Platform with Manager Role & Email/Password Auth

## Summary

Transform the app from a single-admin setup into a multi-tenant dental marketing platform with three roles (admin, manager, user), email/password authentication, and scoped account management.

---

## Current State

- Auth is Google OAuth only, admin is hardcoded to `strategicaigroup@gmail.com`
- `app_role` enum has `admin` and `user` values
- `user_roles` table exists with proper RLS
- Admin check in `useAuth.tsx` uses email string comparison (insecure)

---

## Changes

### 1. Add `manager` role and manager-account assignments

**Database migration:**
- Add `manager` to `app_role` enum
- Create `manager_assignments` table: `id`, `manager_user_id`, `client_user_id`, `assigned_by`, `created_at` — with RLS so admins can CRUD all rows, managers can SELECT their own assignments
- Update `handle_new_user()` trigger to also grant admin role for `admin@test.com`

### 2. Enable email/password authentication

- Use `cloud--configure_auth` to enable email auth (with auto-confirm enabled so the admin account works immediately)
- Create an admin account `admin@test.com` / `Admin2026$` by adding a login page with email/password form alongside existing Google OAuth
- Add a `/login` route with email + password fields and a "Sign in with Google" button
- Update `Index.tsx` to redirect to `/login` or show login options

### 3. Refactor `useAuth.tsx` for role-based access

- Replace hardcoded email check with a database query to `user_roles` table using the `is_admin()` function
- Add `isManager` boolean and `managedClientIds` array to auth context
- Query `manager_assignments` for manager users to get their scoped client list
- Expose `userRole: 'admin' | 'manager' | 'user'` in context

### 4. Update Admin Dashboard for manager promotion

- Add a "Promote to Manager" / "Demote" action on client rows (admin only)
- Add a "Manage Assignments" UI: when a user has the manager role, admin can assign/unassign client accounts to them
- Show manager badge on accounts table

### 5. Scope manager access

- Update `Dashboard.tsx`: managers see only their assigned clients' data (filter by `manager_assignments`)
- Update RLS policies on `campaigns`, `profiles`, `knowledge_base`, `channel_posts`, `campaign_channels`, `channel_credentials` to allow managers access to their assigned clients' data via a `is_manager_of(_user_id, _client_id)` security definer function
- Manager can do everything admin can, but only for assigned accounts

### 6. Create Manager Dashboard

- Add `/manager` route that shows the same layout as admin dashboard but filtered to assigned accounts only
- Reuse existing admin components with a `scopedClientIds` filter

---

## Technical Details

**New database function:**
```sql
CREATE FUNCTION public.is_manager_of(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM manager_assignments
    WHERE manager_user_id = _user_id AND client_user_id = _client_id
  )
$$;
```

**Updated RLS pattern** (example for campaigns):
```sql
-- Existing: (auth.uid() = user_id) OR is_admin(auth.uid())
-- New:      (auth.uid() = user_id) OR is_admin(auth.uid()) OR is_manager_of(auth.uid(), user_id)
```

**New table: `manager_assignments`**
```sql
CREATE TABLE manager_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_user_id uuid NOT NULL,
  client_user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(manager_user_id, client_user_id)
);
```

**Files to create/edit:**
- `src/pages/Login.tsx` — new email/password + Google OAuth login page
- `src/hooks/useAuth.tsx` — role-based auth context with DB queries
- `src/pages/AdminDashboard.tsx` — manager promotion UI, assignment UI
- `src/pages/Dashboard.tsx` — manager-scoped client viewing
- `src/App.tsx` — add `/login` route
- `src/pages/Index.tsx` — update to use new login flow
- Database migration for enum, table, functions, RLS updates

