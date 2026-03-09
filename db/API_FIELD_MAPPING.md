# API ↔ DB Field Mapping

خريطة توضح تطابق أسماء الحقول بين **قاعدة البيانات (snake_case)** و **الـ API / الـ frontend (camelCase)**.

استخدمها عندما تقرأ الكود في `server/index.js` أو `src/api.js` حتى تربط بين الكود وجداول الـ DB بسهولة.

---

## 1. app_users

| DB column        | JSON / frontend field | ملاحظة |
|------------------|-----------------------|--------|
| `id`             | `id`                  |        |
| `email`          | `email`               | حساب الطالب / الإداري |
| `role`           | `role`                | `admin`, `student`, `dean`, `supervisor`, `community_leader` |
| `first_name`     | `first_name`          | يظهر أيضًا داخل `name` المدموج |
| `middle_name`    | `middle_name`         | اسم الأب + الجد (نص واحد) |
| `last_name`      | `last_name`           | `family_name` في الـ UI |
| `student_number` | `student_number`      | رقم الطالب المستخرج من الإيميل غالبًا |
| `college`        | `college`             | اسم الكلية (نص) |
| `major`          | `major`               | اسم التخصص (نص) |
| `phone`          | `phone`               | رقم الجوال بصيغة `+970 5xxxxxxxx` |
| `college_id`     | `college_id` + `collegeName` | ID + الاسم من جدول `colleges` |
| `community_id`   | `community_id` + `communityName` | ID + الاسم من جدول `communities` |
| `must_complete_profile` | `must_complete_profile` | يجبر المستخدم على إكمال ملفه |
| `must_change_password`  | `must_change_password`  | يجبر المستخدم على تغيير كلمة السر |
| `created_at`     | `created_at`          | وقت إنشاء الحساب |

---

## 2. login_codes

| DB column  | JSON field | ملاحظة |
|-----------|------------|--------|
| `email`   | يمر من/إلى الـ API كـ `email` | نفس الإيميل الموجود في `app_users.email` |
| `code`    | `code`      | 6 أرقام مستخدمة في تسجيل الدخول |
| `expires_at` | غير معروض مباشرة | يستخدم داخل السيرفر فقط لفحص صلاحية الكود |

Endpoints:  
- `POST /api/auth/request-login-code` ← يأخذ `{ email }` ويدخل صفًا في `login_codes`.  
- `POST /api/auth/verify-login-code` ← يقرأ من `login_codes` ثم يحذف الصف.

---

## 3. colleges / majors / communities

### colleges

| DB column | JSON field | ملاحظة |
|-----------|-----------|--------|
| `id`      | `id`      |        |
| `name`    | `name`    | اسم الكلية |

### majors

| DB column   | JSON field    | ملاحظة |
|-------------|---------------|--------|
| `id`        | `id`          | كود التخصص (مثل `eng-mis`) |
| `name`      | `name`        | اسم التخصص |
| `college_id`| `collegeId`   | ID الكلية المالكة للتخصص |

### communities

API يعيد الحقول بهذا الشكل (انظر `/api/communities`):

| DB column    | JSON field    |
|--------------|---------------|
| `id`         | `id`          |
| `name`       | `name`        |
| `college_id` | `collegeId`   |
| `colleges.name` | `collegeName` (JOIN) |
| `leader.id`  | `leaderId`    |
| `leader.email` | `leaderEmail` |
| (مبني من `leader.first_name` + `leader.last_name`) | `leaderName` |

---

## 4. events

في SQL (`EVENTS_SELECT` في `server/index.js`) يتم عمل mapping بهذا الشكل:

| DB column         | JSON field      |
|-------------------|-----------------|
| `id`              | `id`            |
| `title`           | `title`         |
| `description`     | `description`   |
| `category`        | `category`      |
| `image`           | `image`         |
| `club_name`       | `clubName`      |
| `location`        | `location`      |
| `start_date`      | `startDate`     |
| `start_time`      | `startTime`     |
| `end_date`        | `endDate`       |
| `end_time`        | `endTime`       |
| `available_seats` | `availableSeats`|
| `price`           | `price`         |
| `price_member`    | `priceMember`   |
| `featured`        | `featured`      |
| `status`          | `status`        |
| `feedback`        | `feedback`      |
| `approval_step`   | `approvalStep`  |
| `custom_sections` | `customSections`|
| `community_id`    | `communityId`   |
| `communities.name`| `communityName` |
| `colleges.id`     | `collegeId`     |
| `colleges.name`   | `collegeName`   |

وفي الـ frontend (`Events.jsx`، `ManageEvents.jsx`) يتم إعادة تغليفها أحيانًا في كائنات أبسط (`mapEventFromApi` مثلاً).

---

## 5. event_registrations

| DB column        | JSON field     | ملاحظة |
|------------------|----------------|--------|
| `id`             | `id`           |        |
| `user_id`        | `userId`       | عندما تحتاجه واجهات الأدمن |
| `event_id`       | `eventId`      | في `/api/event-registrations` |
| `student_id`     | `student_id`   | رقم الطالب وقت التسجيل |
| `college`        | `college`      | نص |
| `major`          | `major`        | نص |
| `association_member` | `association_member` | `member` أو `non-member` |
| `name`           | `name`         | اسم الطالب وقت التسجيل (من ملفه) |
| `email`          | `email`        | إيميل الطالب وقت التسجيل |
| `created_at`     | `created_at` / `createdAt` | حسب الـ SELECT |

---

## 6. student_profiles

| DB column       | JSON field      |
|-----------------|-----------------|
| `user_id`       | غير معروض عادة (يستخدم داخليًا فقط) |
| `college`       | `college`       |
| `major`         | `major`         |
| `gpa`           | `gpa`           |
| `credits_earned`| `creditsEarned` |
| `credits_total` | `creditsTotal`  |
| `picture`       | `picture`       |

---

## 7. notifications

| DB column  | JSON field  |
|------------|-------------|
| `id`       | `id`        |
| `user_id`  | `userId`    |
| `title`    | `title`     |
| `message`  | `message`   |
| `read`     | `read`      |
| `created_at` | `createdAt` |

---

بهذه الخريطة يمكنك فتح أي استعلام في `server/index.js` (SELECT، INSERT، UPDATE) وربطه مباشرة بالحقول التي تراها في الـ frontend / الـ API.

