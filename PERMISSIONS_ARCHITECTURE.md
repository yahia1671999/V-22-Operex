# Enterprise Permissions Security Architecture

This document provides a detailed overview of the core security architecture, authentication flow, authorization engine, server-side data scoping, and the real-time active audit logging system.

## 1. Authentication & Session Lifespan
- **Strategy**: JWT (JSON Web Tokens) with asymmetrical/symmetric cryptographic validation.
- **Access Tokens**: Expires in **2 hours** to restrict hijack opportunities.
- **Refresh Tokens**: Cryptographically isolated, expiring in **7 days** to authorize long-lived sessions safely.
- **Session Revocation**: Logouts automatically blacklist the active access token and refresh token via a global `revokedTokens` set in memory, instantly rendering them invalid.

---

## 2. Dynamic Hierarchy Resolution
To enforce absolute runtime safety, user claims are not stale. For every incoming API check:
1. `authenticateJWT` middleware extracts the active user ID.
2. It executes a database read from the `appUsers` table to fetch the most up-to-date **Role**, **Direct Permissions Map**, and **Linked Employee Profile Link** (`employeeId`).
3. This fresh data is injected into `req.user` in real-time, preventing bypasses if roles are changed or revoked while a user is logged in.

---

## 3. Server-Side Data Containing & Scoping
Data containment is implemented directly at the database layer (Express `/api/*`), rather than relying only on client-side hiding.

| Entity | Permission | Self-Service Scope (Normal User) | Enterprise Operations Scope (Managers) |
| :--- | :--- | :--- | :--- |
| **Employees** | `hr.employees` | Retransmits **only** the logged-in user's profile record. | Authorized HR Managers/Officers get the complete personnel directory. |
| **Projects** | `operations.projects` | User must be PM, TL, assigned to any task in it, or mentioned in project chat Comments. | Operations Directors and Admin view all project files globally. |
| **Project-Tasks** | `operations.tasks` | User must be creator, assigned member of the task list, or mentioned in task comments. | PMs and TLs of the host project get full task view visibility. |
| **Transactions/Payroll**| `payroll.transactions`| Employee sees only their private salary slips and allowances. | Payroll managers and officers can fetch salary runs and adjust variables. |

---

## 4. Advanced Audit Logging Event Matrix
All security-relevant actions are audited, writing directly to the `system_logs` collection.

- **Identity Access Loops**:
  - `login_success` / `login_failure`: Track browser IP and failure reasoning.
  - `logout`: Immediate invalidation.
- **Account Modifications**:
  - `password_change`: Audits of password modifications.
  - `password_change_failure`: Audits of complexity policy rejections.
- **Administrative Events**:
  - `update_entity` on `users`: Captures user role changed values, direct permission updates, or changes to the linked employee profile.
  - `delete_entity` on `users`: Audits of revoked personnel or deleted profile credentials.

---

## 5. Unified Wildcard Evaluation
Rules are specified in modern hierarchical strings: `module.resource.action` (e.g. `operations.projects.create`).
The system evaluates these hierarchically using a wildcard matching parser:
- `*` authorizes any capability globally.
- `operations.*` matches any resource and action under the Operations umbrella.
- `operations.tasks.*` matches both `view`, `create`, `edit` and `delete` nodes for task subkeys specifically.
- Matches are evaluated with fallback support, ensuring seamless backward compatibility with legacy screen maps.
