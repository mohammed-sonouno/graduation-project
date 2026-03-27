# Communities: DB schema and connections

## Table: `communities`

| Column      | Type         | Required | Description                    |
|------------|--------------|----------|--------------------------------|
| id         | SERIAL       | (PK)     | Auto-generated.                |
| name       | VARCHAR(255) | Yes      | Community name.                |
| college_id | INTEGER      | Yes      | FK → `colleges(id)`.           |

- **Unique:** `(name, college_id)` — same name allowed in different colleges only.
- **To create a community:** only `name` and `college_id` are required (admin only via POST /api/communities).

---

## Connections (by data)

### 1. Community → College (required)

- `communities.college_id` → `colleges.id`
- Each community belongs to **one** college.
- College has many communities.

### 2. Community ← Leader / Supervisor (optional, one per community)

- Stored on **users**, not on `communities`: `app_users.community_id` → `communities.id`
- **Roles:** `supervisor` or `community_leader` (both act as “community leader”).
- **Constraint:** At most one user per community (`app_users.community_id` unique when not null).
- Assigned by admin via **PATCH /api/admin/users/:id/assign-community** (Admin → Assignments → Community leaders).
- A community can exist with **no** leader assigned.

### 3. College ← Dean (one dean per college)

- `app_users.college_id` for users with `role = 'dean'`.
- One dean per college; dean sees only communities of their college.

### 4. Events → Community

- `events.community_id` → `communities.id`
- Each event is linked to one community (and thus to that community’s college).
- Community leaders can create/edit/delete only events for their community.

---

## Roles summary

| Role             | Stored link     | Meaning                                      |
|------------------|-----------------|----------------------------------------------|
| admin            | —               | Full access; only role that can create communities. |
| dean             | college_id      | One college; sees/manages communities of that college. |
| supervisor       | community_id     | One community; leader of that community.     |
| community_leader| community_id     | One community; same as supervisor for assignments. |
| student          | (college/major in profile) | No community/college assignment.    |

---

## API summary

- **GET /api/communities** — Returns communities with `collegeId`, `collegeName`, and when available `leaderId`, `leaderEmail`, `leaderName`.
- **POST /api/communities** — Admin only. Body: `{ name, collegeId }`.
- **PATCH /api/communities/:id** — Admin / dean / community leader. Body: `{ name }`.
- **PATCH /api/admin/users/:id/assign-community** — Admin only. Assigns a supervisor or community_leader to a community (one leader per community).
