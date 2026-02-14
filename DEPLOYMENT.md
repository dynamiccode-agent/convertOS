# ConvertOS Deployment Guide

## ✅ What's Been Completed

1. ✅ Next.js application created with TypeScript & Tailwind
2. ✅ NextAuth configured with credentials provider
3. ✅ Prisma configured with Neon PostgreSQL database
4. ✅ Database schema pushed and seeded
5. ✅ User account created: `tyler@dynamiccode.com.au` / `Dynamic`
6. ✅ Sign-in page with beautiful UI
7. ✅ Basic dashboard placeholder
8. ✅ GitHub repository created: https://github.com/dynamiccode-agent/convertOS

---

## 🚀 Deploy to Vercel

### Step 1: Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import from GitHub: `dynamiccode-agent/convertOS`
4. Configure Project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### Step 2: Add Environment Variables

Click **Environment Variables** and add these:

#### Database
```
DATABASE_URL
postgresql://neondb_owner:npg_X4Y0DTgjbyir@ep-summer-base-a7lgpbvv-pooler.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
```

#### NextAuth
```
NEXTAUTH_URL
https://convertos.cloud
```

```
NEXTAUTH_SECRET
```
Generate with: `openssl rand -base64 32`
Or use: `convertos-secret-key-2024-prod-xyz789`

#### Meta Ads API
```
META_ACCESS_TOKEN
EAAM9UQSZCXocBQlEvggUfuYxt5nHV1zJIje3pnZB9W3QtPJwEeZANpCeedORLJomgCEH4asFXuZBxkC3KjEDrkThL3pghqMrtqwe886gXQfVzDzrpKzwLIR774h6i0MlDzAKUDv4GS6OKNsPiJaTYwC4vvRdAXg0qZBsulq80PpYfZBcuYqXyBFX6PEqgkJZAYf5QZDZD
```

```
META_API_VERSION
v24.0
```

```
META_APP_SECRET
b17315311057f48f2241c2d0d8d9d8ae
```

**Important**: Set these for **Production**, **Preview**, and **Development**

### Step 3: Deploy

1. Click **Deploy**
2. Wait for deployment to complete (~2-3 minutes)
3. You'll get a deployment URL like: `https://convert-os-xyz.vercel.app`

### Step 4: Connect Custom Domain

1. In Vercel project dashboard, go to **Settings** → **Domains**
2. Add domain: `convertos.cloud`
3. Vercel will provide DNS records
4. Go to your domain registrar (where you bought convertos.cloud)
5. Add the DNS records Vercel provides:
   - Type: `CNAME`
   - Name: `@` or `www`
   - Value: `cname.vercel-dns.com`
6. Wait 5-30 minutes for DNS propagation
7. Vercel will automatically provision SSL certificate

---

## 🔐 Login Credentials

**Email**: tyler@dynamiccode.com.au  
**Password**: Dynamic

---

## 📊 What Works Now

✅ Sign-in page with beautiful UI
✅ Authentication with NextAuth
✅ Protected dashboard route
✅ Basic dashboard with summary cards
✅ Database connection via Neon
✅ User session management

---

## 🚧 Next Steps (Phase 2)

The original Meta Ads Intelligence dashboard needs to be migrated:

1. **Migrate Data Collection**
   - Copy `meta-ads-intelligence/api/*` to `/src/lib/meta/`
   - Create API routes for data collection

2. **Migrate Dashboard Components**
   - Convert vanilla JS to React components
   - Integrate tab system
   - Add table controls

3. **Add Real-Time Data**
   - Set up cron jobs or webhook for automatic data refresh
   - Connect Meta API to dashboard

4. **User Management**
   - Add user registration
   - Add password reset
   - Add profile settings

---

## 🧪 Local Development

```bash
cd /Users/dynamiccode/clawd/convertos

# Install dependencies
npm install

# Push database schema
npx prisma db push

# Seed database
npx prisma db seed

# Run dev server
npm run dev

# Open http://localhost:3000
```

---

## 📁 Project Structure

```
convertos/
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Seed script
├── src/
│   ├── app/
│   │   ├── api/auth/       # NextAuth routes
│   │   ├── auth/signin/    # Sign-in page
│   │   ├── dashboard/      # Protected dashboard
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Homepage (redirects)
│   ├── components/ui/
│   │   └── sign-in.tsx     # Sign-in component
│   └── lib/
│       └── auth.ts         # NextAuth config
├── .env                    # Environment variables (local)
├── .env.example            # Template
└── VERCEL_ENV.md          # Vercel env vars guide
```

---

## 🔧 Troubleshooting

### Database connection fails
- Check DATABASE_URL is correct
- Verify Neon database is active
- Test connection: `npx prisma db pull`

### NextAuth errors
- Ensure NEXTAUTH_SECRET is set
- Verify NEXTAUTH_URL matches deployment URL
- Check user exists: `npx prisma studio`

### Can't sign in
- Password: `Dynamic` (capital D)
- Email: `tyler@dynamiccode.com.au`
- Check database was seeded: `npx prisma studio`

---

## 📞 Support

- GitHub Repo: https://github.com/dynamiccode-agent/convertOS
- Environment Variables: See `VERCEL_ENV.md`
- Database: Neon PostgreSQL (connection in .env)

---

**Ready to deploy!** 🚀

Follow Step 1-4 above to go live on convertos.cloud.
