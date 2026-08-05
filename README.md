# Bot License: Admin + Broker

## 1. Run migration

Run:

supabase/migrations/202607290001_bot_license_admin_broker.sql

in Supabase SQL Editor.

## 2. Replace Admin API

Copy:

app/api/admin/bot/route.ts

to the same path in batdongsan-web.

## 3. Add broker-scoped API

Copy:

app/api/bot/dashboard/route.ts

A broker account must call this route, not `/api/admin/bot`.

## 4. Add the license creation UI

Copy:

app/admin/bot/CreateBotLicenseCard.tsx

Then render it inside the current BotAdminClient and provide brokerOptions:

<CreateBotLicenseCard
  brokerOptions={brokers.map((item) => ({
    id: item.id,
    label: item.full_name || item.email || item.id,
  }))}
  onCreated={loadDashboard}
/>

## 5. Important behavior

- Full license key is never stored.
- Only SHA-256 hash is stored.
- Full key is returned once by POST `/api/admin/bot`.
- The old "License test" full key cannot be recovered.
- Create a new Admin license, copy the key, and paste it into facebook-worker/.env:

LICENSE_KEY=KTB-XXXXXXXX-XXXXXXXX
DEVICE_UID=admin-pc-01
DEVICE_NAME=PC DELL

## 6. Broker separation

Broker dashboard calls `/api/bot/dashboard`.
It only returns licenses where:

owner_user_id = current profile id

Devices and Facebook accounts are filtered by those license IDs.
Groups and jobs are filtered by those Facebook account IDs.
