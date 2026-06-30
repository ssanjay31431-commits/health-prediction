# COMPLETE RENDER DEPLOYMENT CHECKLIST - DO THIS NOW

## ⚡ STEP 1: MongoDB Atlas Setup (5 minutes)
1. Go to https://cloud.mongodb.com
2. Login to your account
3. Click "Network Access" in left sidebar
4. Click "ADD IP ADDRESS"
5. Select "Allow Access from Anywhere" (0.0.0.0/0)
6. Click "Confirm"

✅ **DONE** - MongoDB is now accessible from Render

---

## ⚡ STEP 2: Go to Render.com Dashboard

### Deploy Backend First:

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Fill in these settings:

   **Name:** health-prediction-backend
   
   **Environment:** Node
   
   **Build Command:** 
   ```
   cd backend && npm install
   ```
   
   **Start Command:**
   ```
   node backend/server.js
   ```
   
   **Plan:** Free

4. Click **"Advanced"** (important!)

5. **ADD THESE ENVIRONMENT VARIABLES** (copy exactly):

   | Key | Value |
   |-----|-------|
   | PORT | 5000 |
   | NODE_ENV | production |
   | MONGO_URI | mongodb+srv://ssanjay31431_db_user:KtqZrDb77VraZMXQ@cluster0.9mpfe4n.mongodb.net/health_prediction_db?retryWrites=true&w=majority |
   | JWT_SECRET | your-secret-key-change-in-production |
| RESEND_API_KEY | your_resend_api_key |
| RESEND_FROM_EMAIL | onboarding@resend.dev |

6. Click **"Create Web Service"**

7. **Wait for deployment** (5-10 minutes) - watch the logs
   - Should see: "MongoDB connected successfully"
   - Should see: "Server running on port 5000"

✅ **NOTE YOUR BACKEND URL** - you'll need it for frontend (will look like: https://health-prediction-backend-xxxx.onrender.com)

---

### Deploy Frontend Second:

1. Click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Fill in:

   **Name:** health-prediction-frontend
   
   **Build Command:**
   ```
   cd frontend && npm install && npm run build
   ```
   
   **Publish Directory:** `frontend/dist`

4. Click **"Create Static Site"**

5. **Wait for deployment** (3-5 minutes)

✅ **NOTE YOUR FRONTEND URL** - (will look like: https://health-prediction-frontend-xxxx.onrender.com)

---

## ⚡ STEP 3: Update Frontend API URL

After backend is deployed, update the frontend to use your backend URL:

**In your code, update [frontend/src/services/api.js](frontend/src/services/api.js):**

Replace:
```javascript
baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
```

With your actual Render backend URL:
```javascript
baseURL: 'https://your-backend-url.onrender.com/api'
```

Then push to GitHub - Render will auto-rebuild the frontend.

---

## ⚡ VERIFICATION CHECKLIST

- [ ] MongoDB Atlas whitelist includes 0.0.0.0/0
- [ ] Backend environment variables all set in Render
- [ ] Backend deployed and showing "MongoDB connected"
- [ ] Frontend deployed
- [ ] Frontend API URL updated with backend URL
- [ ] Frontend pushed to GitHub (auto-rebuild)
- [ ] Can open frontend URL in browser
- [ ] Login page loads without errors
- [ ] Browser console has no CORS errors

---

## 🔍 TESTING

1. Open your frontend URL in browser
2. Try to login or register
3. Check browser DevTools (F12) → Network tab
4. Verify API calls go to your backend URL

If errors:
- Check Render backend logs
- Verify all environment variables are set
- Confirm MONGO_URI is correct

---

## EXACT MONGODB URI (Copy/Paste):

```
mongodb+srv://ssanjay31431_db_user:KtqZrDb77VraZMXQ@cluster0.9mpfe4n.mongodb.net/health_prediction_db?retryWrites=true&w=majority
```

---

## 🎉 FINAL RESULT:

✅ Full-stack application deployed on Render
✅ Connected to MongoDB Atlas database
✅ Email functionality working with Gmail
✅ Ready for production use

**Total time: ~30 minutes**
