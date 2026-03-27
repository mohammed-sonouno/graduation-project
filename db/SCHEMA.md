# هيكل قاعدة البيانات — Database Schema

توثيق منظم لجداول وقاعدة البيانات وعلاقاتها.

---

## 1. نظرة عامة (Overview)

| النوع | الجداول |
|--------|----------|
| **مرجعية (Reference)** | `colleges`, `majors`, `communities` |
| **المستخدمون والمصادقة** | `app_users`, `login_codes` |
| **الفعاليات والتسجيل** | `events`, `event_registrations` |
| **الملفات الشخصية والإشعارات** | `student_profiles`, `notifications` |
| **عام (للموديولات المستقبلية)** | `app_module_data` |

---

## 2. ترتيب الجداول والعلاقات (من الأب إلى الابن)

```
colleges (الكليات)
    │
    ├── majors (التخصصات) ← college_id
    │
    └── communities (الجمعيات/النوادي) ← college_id
            │
            └── events (الفعاليات) ← community_id, created_by → app_users

app_users (المستخدمون)
    │
    ├── college_id → colleges (عميد الكلية)
    ├── community_id → communities (مشرف/قائد جمعية)
    │
    ├── login_codes (أكواد تسجيل الدخول) ← email يطابق app_users
    ├── student_profiles (الملف الأكاديمي) ← user_id
    ├── notifications (الإشعارات) ← user_id
    └── event_registrations (تسجيل في فعاليات) ← user_id

events (الفعاليات)
    └── event_registrations ← event_id, user_id
```

---

## 3. الجداول بالتفصيل

### 3.1 جداول مرجعية (Reference)

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|--------|-------------------|
| **colleges** | الكليات | `id`, `name` |
| **majors** | التخصصات (مرتبطة بكلية) | `id`, `name`, `college_id` → colleges |
| **communities** | الجمعيات/النوادي (مرتبطة بكلية) | `id`, `name`, `college_id` → colleges |

---

### 3.2 المستخدمون والمصادقة

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|--------|-------------------|
| **app_users** | كل الحسابات (طلاب، أدمن، عميد، مشرف، قائد جمعية) | `id`, `email` (فريد), `password_hash` (اختياري)، `role`, `first_name`, `middle_name`, `last_name`, `student_number`, `college`, `major`, `phone`, `college_id`, `community_id`, `must_complete_profile`, `must_change_password`, `created_at` |
| **login_codes** | أكواد الدخول لمرة واحدة (6 أرقام) | `id`, `email`, `code`, `expires_at`, `created_at` |

**أدوار المستخدم (role):** `admin`, `student`, `dean`, `supervisor`, `community_leader`

- **dean:** مرتبط بـ `college_id` (كلية واحدة).
- **supervisor / community_leader:** مرتبط بـ `community_id` (جمعية واحدة).

---

### 3.3 الفعاليات والتسجيل

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|--------|-------------------|
| **events** | الفعاليات | `id`, `title`, `description`, `category`, `club_name`, `location`, `start_date`, `start_time`, `end_date`, `end_time`, `available_seats`, `price`, `price_member`, `featured`, `status`, `feedback`, `approval_step`, `custom_sections`, `community_id` → communities, `created_by` → app_users, `created_at`, `updated_at` |
| **event_registrations** | تسجيل مستخدم في فعالية | `id`, `user_id` → app_users, `event_id` → events, `student_id`, `college`, `major`, `association_member`, `name`, `email`, `created_at`. فريد: `(user_id, event_id)` |

**حالات الفعالية (status):** `draft`, `pending`, `approved`, `rejected`, `needs_changes`, `upcoming`, `past`

---

### 3.4 الملف الشخصي والإشعارات

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|--------|-------------------|
| **student_profiles** | ملف أكاديمي للطالب (واحد لكل مستخدم) | `user_id` (PK, FK → app_users), `college`, `major`, `gpa`, `credits_earned`, `credits_total`, `picture`, `created_at`, `updated_at` |
| **notifications** | إشعارات للمستخدم | `id`, `user_id` → app_users, `title`, `message`, `read`, `created_at` |

---

### 3.5 بيانات الموديولات (عام)

| الجدول | الوصف | الأعمدة الرئيسية |
|--------|--------|-------------------|
| **app_module_data** | تخزين مفتاح–قيمة (JSON) لكل موديول ومستخدم اختياري | `id`, `module_name`, `user_id` (اختياري), `key`, `value` (JSONB), `created_at`, `updated_at` |

---

## 4. ترتيب تشغيل المايجريشن (Migrations)

يتم تشغيل الملفات بهذا الترتيب في `server/run-migrations.js`:

| # | الملف | الغرض |
|---|--------|--------|
| 1 | 002_app_users.sql | إنشاء جدول المستخدمين |
| 2 | 003_student_fields.sql | حقول الطالب وmust_change_password |
| 3 | 003_colleges_majors.sql | الكليات والتخصصات + بيانات أولية |
| 4 | 004_rename_role_user_to_student.sql | تغيير دور user → student |
| 5 | 004_events.sql | جدول الفعاليات |
| 6 | 005_event_registrations.sql | تسجيل المستخدمين بالفعاليات |
| 7 | 005_must_complete_profile.sql | إكمال الملف بعد تسجيل الدخول لأول مرة |
| 8 | 006_student_profiles.sql | الملف الأكاديمي للطالب |
| 9 | 007_notifications.sql | الإشعارات |
| 10 | 008_seed_events.sql | بيانات أولية للفعاليات (إن وجدت) |
| 11 | 010_module_data.sql | جدول بيانات الموديولات |
| 12 | 011_communities_and_role_assignments.sql | الجمعيات وربط العميد/المشرف |
| 13 | 012_ensure_app_users_full_schema.sql | التأكد من كل أعمدة app_users |
| 14 | 013_events_community_college.sql | ربط الفعالية بالجمعية |
| 15 | 014_backfill_event_community.sql | تعبئة community_id قديمة |
| 16 | 016_db_checkup_improvements.sql | تعليقات PII وفهارس إضافية |
| 17 | 017_drop_chatbot.sql | إزالة أي شيء متعلق بالشات بوت |
| 18 | 018_login_codes.sql | أكواد الدخول 6 أرقام |
| 19 | 019_password_hash_nullable.sql | السماح بعدم وجود كلمة مرور (دخول بكود/جوجل) |

---

## 5. حساسية البيانات (PII vs مرجعية)

| النوع | الجداول |
|--------|----------|
| **تحتوي PII (بيانات شخصية)** | `app_users`, `student_profiles`, `event_registrations`, `notifications`, `login_codes` |
| **مرجعية / عامة** | `colleges`, `majors`, `communities`, `events` |
| **مراقبة حسب الصلاحيات** | `app_module_data` (حسب module_name والمستخدم) |

---

## 6. الفهارس المهمة (Indexes)

- **app_users:** `email`, `role`, `student_number`, `college_id`, `community_id`
- **login_codes:** `email`, `expires_at`
- **events:** `status`, `created_by`, `start_date`, `community_id`
- **event_registrations:** `user_id`, `event_id`, `(user_id, created_at DESC)`
- **notifications:** `user_id`, `(user_id, read)`, `(user_id, read, created_at DESC)` لغير المقروءة
- **communities:** `college_id`
- **majors:** `college_id`

---

## 7. أوامر مفيدة

```bash
# تشغيل كل المايجريشن
node server/run-migrations.js

# التحقق من وجود الجداول والأعمدة
node server/check-db.js

# التحقق من حفظ وقراءة أكواد الدخول
node server/check-login-codes.js
```

اتصال افتراضي (من `.env` أو الافتراضي في الكود):  
`postgresql://postgres:***@10.20.10.20:5433/graduation%20Project`
