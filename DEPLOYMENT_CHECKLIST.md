# DEPLOYMENT CHECKLIST
# Go through this top to bottom before sharing the app with guests

## ── STEP 1: Final local test ────────────────────────────────

[ ] npm run dev starts without errors
[ ] localhost:3000 shows the selfie upload page
[ ] localhost:3000/admin/upload works with your ADMIN_SECRET
[ ] localhost:3000/admin/dashboard loads stats
[ ] End-to-end test:
    1. Upload 5+ face photos via /admin/upload
    2. Upload a selfie via the homepage
    3. Results page shows matched photos
    4. Download All button works
[ ] npm run build completes with no errors
    (Run: npm run build)


## ── STEP 2: Push to GitHub ──────────────────────────────────

[ ] git init (if not already done)
[ ] Create .gitignore with:
      node_modules/
      .env.local
      .next/
      out/
[ ] git add .
[ ] git commit -m "Initial commit"
[ ] Create new repo on github.com (private recommended)
[ ] git remote add origin https://github.com/YOUR_USERNAME/eventphotos.git
[ ] git push -u origin main


## ── STEP 3: Deploy to Vercel ────────────────────────────────

[ ] Go to vercel.com → sign in with GitHub
[ ] Click "Add New Project" → import your GitHub repo
[ ] Framework preset: Next.js (auto-detected)
[ ] Click "Deploy" (first deploy will fail — env vars missing)
[ ] Go to Project Settings → Environment Variables
    Add ALL variables from .env.local:
    [ ] NEXT_PUBLIC_SUPABASE_URL
    [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
    [ ] SUPABASE_SERVICE_ROLE_KEY
    [ ] AWS_ACCESS_KEY_ID
    [ ] AWS_SECRET_ACCESS_KEY
    [ ] AWS_REGION
    [ ] REKOGNITION_COLLECTION_ID
    [ ] ADMIN_SECRET
    [ ] CRON_SECRET
    [ ] NEXT_PUBLIC_APP_URL  ← set to your Vercel URL
[ ] Trigger a new deploy (Deployments → Redeploy)
[ ] Verify deployment URL loads correctly


## ── STEP 4: Verify Vercel Cron Job ─────────────────────────

[ ] Go to Vercel Dashboard → your project → Cron Jobs tab
[ ] Verify one cron job appears:
      Path: /api/cron/cleanup
      Schedule: 30 20 * * * (= 2am IST daily)
[ ] Click "Run" to manually trigger once
[ ] Check logs — should return { success: true }
    (Note: Cron Jobs require Vercel Pro OR Hobby plan supports
     1 cron job for free)


## ── STEP 5: Production smoke test ──────────────────────────

[ ] Visit your-app.vercel.app — upload page loads
[ ] Visit your-app.vercel.app/admin/upload — login works
[ ] Upload 3 test event photos
[ ] Upload a selfie → results page shows matches
[ ] Download a photo — file downloads correctly
[ ] Visit your-app.vercel.app/admin/dashboard — stats show


## ── STEP 6: Custom domain (optional) ───────────────────────

[ ] Go to Vercel → Project → Settings → Domains
[ ] Add your domain (e.g. photos.yourevent.com)
[ ] Update DNS at your registrar:
      Type: CNAME
      Name: photos (or @)
      Value: cname.vercel-dns.com
[ ] Wait 5–30 minutes for DNS propagation
[ ] SSL certificate is automatic on Vercel


## ── STEP 7: Pre-event checklist ────────────────────────────

[ ] Upload all event photos to /admin/upload BEFORE the event
[ ] Test with 2–3 selfies to verify matching accuracy
[ ] Note the event URL to share with guests
[ ] Confirm Supabase storage has enough space (500MB free)
[ ] Check AWS Rekognition free tier: 5000 faces/month


## ── GDPR COMPLIANCE FINAL CHECK ────────────────────────────

[ ] Consent checkbox is visible and required on upload page
[ ] Privacy policy page exists (create pages/privacy.js)
[ ] Selfies are deleted after matching (check match.js)
[ ] Cron job is running (deletes old data automatically)
[ ] Admin can manually purge Rekognition data via dashboard
[ ] No selfies or face vectors stored longer than 30 days
[ ] .env.local is NOT in git (check .gitignore)
[ ] Service role key is NOT exposed in client-side code
