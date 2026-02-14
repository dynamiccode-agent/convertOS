# Vercel Environment Variables

Add these environment variables to your Vercel project:

## Database

**DATABASE_URL**
```
postgresql://neondb_owner:npg_X4Y0DTgjbyir@ep-summer-base-a7lgpbvv-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
```

## NextAuth

**NEXTAUTH_URL**
```
https://convertos.cloud
```

**NEXTAUTH_SECRET**
```
Generate with: openssl rand -base64 32
Or use: convertos-2024-secret-key-change-this-in-production-abc123xyz
```

## Meta Ads API

**META_ACCESS_TOKEN**
```
EAAM9UQSZCXocBQlEvggUfuYxt5nHV1zJIje3pnZB9W3QtPJwEeZANpCeedORLJomgCEH4asFXuZBxkC3KjEDrkThL3pghqMrtqwe886gXQfVzDzrpKzwLIR774h6i0MlDzAKUDv4GS6OKNsPiJaTYwC4vvRdAXg0qZBsulq80PpYfZBcuYqXyBFX6PEqgkJZAYf5QZDZD
```

**META_API_VERSION**
```
v24.0
```

**META_APP_SECRET**
```
b17315311057f48f2241c2d0d8d9d8ae
```

**META_APP_ID**
```
(Leave empty if not using)
```

---

## How to Add to Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add each variable above
4. Set for: **Production**, **Preview**, and **Development**
5. Click **Save**
6. Redeploy your application

---

## Generate NEXTAUTH_SECRET

Run this command:
```bash
openssl rand -base64 32
```

Or use the suggested value above.
