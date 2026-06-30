# 🎯 HEALTH PREDICTION SYSTEM - FINAL DEPLOYMENT GUIDE

## YOUR CREDENTIALS (KEEP THESE SAFE)

```
MongoDB Atlas:
- Username: ssanjay31431_db_user
- Password: KtqZrDb77VraZMXQ
- Cluster: cluster0.9mpfe4n.mongodb.net
- Database: health_prediction_db

Email:
- Address: healthpredicts@gmail.com
- Password: fqetuglhnmphwcwq

MongoDB URI (for Render):
mongodb+srv://ssanjay31431_db_user:KtqZrDb77VraZMXQ@cluster0.9mpfe4n.mongodb.net/health_prediction_db?retryWrites=true&w=majority
```

---

## ✅ DO THIS TODAY - 30 MINUTE DEPLOYMENT

### Step 1: Allow Render to Access MongoDB (5 MIN)

1. Go to https://cloud.mongodb.com
2. Login
3. **Network Access** → **ADD IP ADDRESS**
4. Choose **Allow Access from Anywhere** (0.0.0.0/0)
5. **Confirm**

### Step 2: Deploy Backend to Render (10 MIN)

1. Go to https://render.com
2. **New +** → **Web Service**
3. Connect GitHub
4. Fill exactly as below:

```
Name: health-prediction-backend
Environment: Node
Build Command: cd backend && npm install
Start Command: node backend/server.js
Plan: Free
```

5. Click **Advanced**
6. **Add Environment Variables:**

```
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://ssanjay31431_db_user:KtqZrDb77VraZMXQ@cluster0.9mpfe4n.mongodb.net/health_prediction_db?retryWrites=true&w=majority
JWT_SECRET=your-secret-key-change-in-production
RESEND_API_KEY=your_resend_api_key
RESEND_FROM_EMAIL=onboarding@resend.dev
```

7. **Create Web Service**
8. Wait for "MongoDB connected successfully" in logs (5 minutes)

**⚠️ COPY YOUR BACKEND URL** - e.g., `https://health-prediction-backend-xxxxx.onrender.com`

### Step 3: Deploy Frontend to Render (10 MIN)

1. **New +** → **Static Site**
2. Connect GitHub
3. Fill exactly as below:

```
Name: health-prediction-frontend
Build Command: cd frontend && npm install && npm run build
Publish Directory: frontend/dist
```

4. Click **Create Static Site**
5. Wait for deployment (3-5 minutes)

**⚠️ COPY YOUR FRONTEND URL** - e.g., `https://health-prediction-frontend-xxxxx.onrender.com`

### Step 4: Connect Frontend to Backend (5 MIN)

Update your backend URL in one of these files:

**Option A: frontend/.env.production**
```
VITE_API_URL=https://your-backend-url.onrender.com/api
```

**Option B: frontend/src/services/api.js**
Replace:
```javascript
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
```

With:
```javascript
baseURL: 'https://your-backend-url.onrender.com/api',
```

Then push to GitHub (Render auto-rebuilds).

---

## ✅ VERIFY IT WORKS

1. Open your frontend URL
2. Try to login or register
3. Open DevTools (F12) → Network tab
4. Check that API calls go to your backend URL
5. No CORS errors in console

---

## 🔧 IF YOU GET ERRORS

### Error: "MongoDB connection error"
- ✅ Check: Did you add 0.0.0.0/0 to MongoDB Network Access?
- ✅ Check: Are ALL environment variables set in Render?
- ✅ Copy/paste the full MONGO_URI again

### Error: "CORS error" or "Cannot reach API"
- ✅ Update frontend with correct backend URL
- ✅ Make sure URL ends with `/api`
- ✅ Rebuild frontend after URL change

### Error: "Cannot login"
- ✅ Check MongoDB logs in Render
- ✅ Verify email credentials are correct
- ✅ Check browser DevTools Network tab

---

## 📋 QUICK CHECKLIST

- [ ] MongoDB Network Access: 0.0.0.0/0 whitelisted
- [ ] Backend environment variables: ALL 8 variables set
- [ ] Backend deployed: "MongoDB connected" in logs
- [ ] Backend URL copied
- [ ] Frontend deployed
- [ ] Frontend API URL updated with backend URL
- [ ] Frontend pushed to GitHub
- [ ] Can access frontend URL
- [ ] Login page loads
- [ ] No console errors in browser

---

## 🎉 FINAL RESULT

Your application is LIVE and deployed:
- ✅ Backend: https://your-backend.onrender.com
- ✅ Frontend: https://your-frontend.onrender.com
- ✅ Database: MongoDB Atlas
- ✅ Email: Gmail integrated
- ✅ Ready for production

---

## 📞 TROUBLESHOOTING LINKS

- [MongoDB Atlas Documentation](https://docs.mongodb.com/atlas/)
- [Render Documentation](https://render.com/docs)
- [GitHub Integration](https://render.com/docs/github)

---

**You can do this! Follow the steps exactly and you'll be live in 30 minutes.** 🚀
