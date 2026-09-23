# Workspace access

Super admins manage role-scoped staff access at [Workspace](http://127.0.0.1:3100/admin/settings). The in-app [Workspace tutorial](http://127.0.0.1:3100/admin/how-to#workspace) is the user-facing guide and matches the current labels and behavior.

## Workflow

1. Choose **Create invitation**, enter a normalized email, select **Accounting** or **Legal**, and optionally add a note.
2. Share sign-in instructions through the normal business communication channel. The platform records an invitation; it does not send email from this screen.
3. The invitee creates their own Firebase account, verifies the same email, and signs in. A transaction claims the pending invitation and creates the membership with the assigned role. Until then, the invitation grants no access.
4. On a pending invitation, **Record resend** records that instructions were sent again; **Revoke invitation** prevents it from being claimed. Claimed or revoked invitations cannot be reused.
5. On an active legal/accounting membership, **Revoke membership** records a reason, increments its revision, and revokes Firebase refresh tokens. The next protected request rejects existing sessions. **Reactivate membership** restores the same user and role after a revision check.

Super-admin memberships remain managed through the approved bootstrap/deployment process. The UI cannot revoke or change a super admin, and every workspace must retain an active super admin.

## Security and consistency

- The page and API require staff mode, an active super-admin membership, exact origin/CSRF proof for mutations, strict role/email/reason schemas, and membership checks inside the transaction.
- Requests cannot assign `super_admin`, inject business/user fields, reuse an operation ID for different input, or overwrite a changed invite/membership revision.
- Directory projections tolerate the original bootstrap records that predate `updatedAt` and default missing revisions to one; no migration is required.
- Invitation, membership, audit, and idempotency records are server-owned beneath `businesses/sadboi`. Directory display is capped at 100 invites and 100 memberships until pagination is added.
- `workspaceAudit` stores before/after state, actor, reason, and server time. `workspaceOperations` prevents duplicate effects on retries. Membership revocation calls Firebase's refresh-token revocation service after the transaction.

## Limits and recovery

This slice does not send invitation email, manage passwords, modify Firebase Auth profile email, or change super-admin bootstrap records. If an invitee uses a different email or has not verified their email, sign-in cannot claim the invitation. If a save is uncertain, keep the form open and retry the same entry; after reloading, refresh Workspace and inspect the directory/audit history before repeating it. A stale revision requires refreshing and reviewing the latest record.

## Validation

```powershell
pnpm typecheck
pnpm test:workspace
```

The workspace suite uses disposable Auth/Firestore emulators and covers permission boundaries, CSRF/origin enforcement, invitations, duplicate/retry behavior, role and email validation, claims, revocation/session invalidation, reactivation, stale revisions, and audit records. Browser visual/form verification remains outstanding while no browser is connected.
