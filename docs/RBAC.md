# RBAC — Role/Action/Resource matrix

Source of truth: `lib/permissions/matrix.ts`. Use `can(role, action, resource)` everywhere instead of inline role arrays.

Roles defined in `prisma.Role`:

- **SUPERADMIN** — SaaS operator, can access every tenant. Should always be paired with audit-log writes when crossing tenant boundaries (Wave 5).
- **ADMIN** — School admin: full access within their tenant.
- **DIRECTOR** — Pedagogical leadership: students, teachers, classes, grades, report-card approval. Read-only on financials.
- **SECRETARY** — Administrative staff: students, parents, payments, invoices, documents. No grade write access.
- **TEACHER** — Class operations: lessons, attendance, grades, homework, materials for own classes.
- **STUDENT** — Read own class/lesson/grade/homework data; submit homework.
- **PARENT** — Read child's data; book parent meetings; view payments/invoices.

## Action vocabulary

`read | create | update | delete | manage | export`

`manage` is shorthand: granting `manage` on a resource implies all other actions.

## Resource matrix (high-level)

|                    | SUPER | ADMIN | DIRECT | SECRET | TEACH | STUD | PARENT |
| ------------------ | :---: | :---: | :----: | :----: | :---: | :--: | :----: |
| tenant             |   ✓   |   —   |   —    |   —    |   —   |  —   |   —    |
| subscription, plan |   ✓   |   ~   |   r    |   r    |   —   |  —   |   —    |
| user               |   ✓   |   ✓   |   ✓    |   —    |   —   |  —   |   —    |
| student            |   ✓   |   ✓   |   ✓    |   ✓    |   r   |  —   |   r    |
| teacher            |   ✓   |   ✓   |   ✓    |  cru   |   r   |  r   |   r    |
| parent             |   ✓   |   ✓   |   ✓    |   ✓    |   r   |  —   |   —    |
| class, course      |   ✓   |   ✓   |   ✓    |  cru   |   r   |  r   |   r    |
| subject            |   ✓   |   ✓   |   ✓    |   r    |   r   |  r   |   —    |
| lesson             |   ✓   |   ✓   |   ✓    |  cru   |  cru  |  r   |   r    |
| attendance         |   ✓   |   ✓   |   ✓    |  r,e   | crue  |  r   |   r    |
| grade              |   ✓   |   ✓   |   ✓    |   r    | crud  |  r   |   r    |
| reportCard         |   ✓   |   ✓   |   ✓    |  r,e   |  cru  |  r   |   r    |
| homework           |   ✓   |   ✓   |   ✓    |   r    | crud  |  r   |   r    |
| homeworkSubmission |   ✓   |   ✓   |   —    |   —    |  ru   | cru  |   —    |
| disciplinaryNote   |   ✓   |   ✓   |   ✓    |   —    |  cru  |  r   |   r    |
| parentMeeting      |   ✓   |   ✓   |   ✓    |   ✓    |  cru  |  r   |  cru   |
| payment            |   ✓   |   ✓   |   r    |   ✓    |   —   |  r   |   r    |
| invoice            |   ✓   |   ✓   |   r    |   ✓    |   —   |  —   |   r    |
| payroll            |   ✓   |   ✓   |   r    |   —    |   —   |  —   |   —    |
| accounting         |   ✓   |   ✓   |   r    |   r    |   —   |  —   |   —    |
| analytics          |   ✓   |   ✓   |   ✓    |   r    |   —   |  —   |   —    |
| notice             |   ✓   |   ✓   |   ✓    |   ✓    |  cr   |  r   |   r    |
| message            |   ✓   |   ✓   |   ✓    |   ✓    |  cru  |  cr  |   cr   |
| notification       |   ✓   |   ✓   |   ✓    |   ✓    |  ru   |  ru  |   ru   |
| document           |   ✓   |   ✓   |   ✓    |   ✓    |   r   |  r   |   r    |
| material           |   ✓   |   ✓   |   ✓    |   r    | crud  |  r   |   r    |
| auditLog           |   ✓   |   ✓   |   r    |   —    |   —   |  —   |   —    |
| settings           |   ✓   |   ✓   |   r    |   —    |   —   |  —   |   —    |
| schedule           |   ✓   |   ✓   |   ✓    |   r    |   r   |  r   |   r    |
| academicYear       |   ✓   |   ✓   |   ✓    |   r    |   r   |  r   |   r    |
| holiday            |   ✓   |   ✓   |   ✓    |   r    |   r   |  r   |   r    |

Legend: `✓` = manage (all actions), `cru` = create+read+update, `crud` = +delete, `crue` = +export, `r` = read only, `r,e` = read+export, `~` = partial, `—` = denied.

## Operational rules

1. **Tenant scoping is enforced separately**, in addition to RBAC. Even an ADMIN can only act on their own tenant — see `tenantScope()` in `lib/api-auth.ts`.
2. **TEACHER row-level scoping**: a teacher with `read` on `lesson` only sees their own lessons. Resolution goes through `getTeacherIdForUser(ctx)` which is also tenant-scoped (do **not** use `session.user.id` as `Lesson.teacherId` — they reference different models).
3. **PARENT row-level scoping**: filter via `Student.parentUserId === ctx.userId`. Never use `parentEmail` (substring leak risk).
4. **STUDENT row-level scoping**: filter via `Student.userId === ctx.userId` (use `getStudentIdForUser(ctx)`).
5. **SUPERADMIN cross-tenant access** must produce an `AuditLog` entry (planned in Wave 0.5 / Wave 5).

## Adding a new resource

1. Add the resource string literal to `Resource` union in `lib/permissions/matrix.ts`.
2. Add it to `allResources` so SUPERADMIN/ADMIN inherit `manage`.
3. Add explicit entries in the role-specific maps where the default isn't `—`.
4. Update this table.
