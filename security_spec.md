# Horizonte OS — Firestore Security Specification

## Data Invariants
1. **Strict Tenant Isolation**: Every document under `/users/{userId}`, `/users/{userId}/missions/{missionId}`, and `/users/{userId}/workspaceItems/{itemId}` belongs exclusively to the verified Firebase Auth user whose `uid == userId` and `email_verified == true`.
2. **Parent Existence & Ownership**: Subcollection records (`missions`, `workspaceItems`) can only be created if `/users/{userId}` exists and `ownerId == request.auth.uid`.
3. **Immutable Audit & Identity Fields**: `uid`, `ownerId`, `id`, `kind`, `externalId`, and `createdAt` can never change after creation.
4. **Server Timestamp Enforcement**: `createdAt` on create and `updatedAt` on create/update must equal `request.time`.
5. **Terminal Mission Lock**: Missions in terminal state `Cancelada` cannot be modified afterward.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read** on `/users/u1/missions/m1` -> denied by `isVerifiedOwner`.
2. **Unverified email write** (`email_verified: false`) on `/users/u1` -> denied by `isVerifiedUser()`.
3. **Cross-user impersonation** (`u2` writing `/users/u1/missions/m1` with `ownerId: "u2"`) -> denied by `request.auth.uid == userId`.
4. **OwnerId spoofing** (`u1` creating `/users/u1/missions/m1` with `ownerId: "u2"`) -> denied by `data.ownerId == request.auth.uid`.
5. **Ghost/shadow field injection** (`isAdmin: true` in `/users/u1`) -> denied by `keys().hasOnly(...)`.
6. **ID poisoning** (`missionId` with invalid chars `../hack` or >128 chars) -> denied by `isValidId(missionId)`.
7. **Payload exhaustion** (`objetivo` > 2000 chars or `titulo` > 200 chars) -> denied by `.size()` bounds.
8. **Type mismatch** (`prioridad: 999` or `estado: "InvalidEnum"`) -> denied by type & enum checks.
9. **Timestamp forgery** (`createdAt` set to past client timestamp instead of `request.time`) -> denied by `incoming().createdAt == request.time`.
10. **Immutable field mutation** (updating `ownerId` or `createdAt` on `/users/u1/missions/m1`) -> denied by `affectedKeys().hasOnly(...)` and equality check.
11. **Terminal state mutation** (updating a mission whose existing `estado == 'Cancelada'`) -> denied by `existing().estado != 'Cancelada'`.
12. **Blanket list scraping** (`u2` listing `/users/u1/missions`) -> denied by `isVerifiedOwner(userId) && resource.data.ownerId == request.auth.uid`.
