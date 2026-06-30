# Render Deployment Guide - Health Prediction System

## Prerequisites
1. GitHub account with your code repository
2. MongoDB Atlas account with active cluster
3. Render.com account
4. Gmail account with App Password for email functionality

## Step 1: Prepare MongoDB Atlas for Render

### Add Render's IP to MongoDB Atlas Whitelist
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Navigate to **Network Access** → **IP Whitelist**
3. Click **Add IP Address**
4. Select **Allow Access from Anywhere** (0.0.0.0/0) or add Render's IP ranges:
   - 34.192.0.0/10
   - 35.192.0.0/11

### Get Your MongoDB URI
1. Go to **Clusters** → **Connect**
2. Copy the connection string in this format:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority
   ```

## Step 2: Deploy Backend to Render

1. **Go to [Render.com](https://render.com)**

2. **Create New Web Service:**
   - Click **New +** → **Web Service**
   - Connect your GitHub repository
   - Select the repository branch

3. **Configure Build & Deploy:**
   - **Name:** health-prediction-backend
   - **Environment:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `node backend/server.js`

4. **Set Environment Variables:**
   - Click **Advanced** → **Add Environment Variable**
   - Add each variable from backend/.env:

   ```
   PORT=5000
   NODE_ENV=production
   MONGO_URI=mongodb+srv://ssanjay31431_db_user:KtqZrDb77VraZMXQ@cluster0.9mpfe4n.mongodb.net/health_prediction_db?retryWrites=true&w=majority
   JWT_SECRET=your-secret-key-change-in-production
   RESEND_API_KEY=your_resend_api_key
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```

5. **Click Create Web Service**

## Step 3: Deploy Frontend to Render

1. **Go to [Render.com](https://render.com)**

2. **Create New Static Site:**
   - Click **New +** → **Static Site**
   - Connect your GitHub repository

3. **Configure Frontend:**
   - **Name:** health-prediction-frontend
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Publish Directory:** `frontend/dist`

4. **Add Environment Variable:**
   - `VITE_API_URL=https://your-backend-service.onrender.com/api`
   - (Replace with your actual backend URL from Render)

5. **Click Create Static Site**

## Step 4: Configure Frontend API URL

After deploying the backend:
1. Update frontend/.env or pass via build variables
2. Set API URL to your Render backend service URL
3. Rebuild frontend on Render

## Step 5: Verify Deployment

1. **Test Backend API:**
   ```
   curl https://your-backend-service.onrender.com/
   ```

2. **Test Frontend:**
   - Visit `https://your-frontend-site.onrender.com`
   - Try logging in

3. **Check Logs:**
   - Render Dashboard → Logs section
   - Check for any connection errors

## Troubleshooting

### MongoDB Connection Errors
- Verify IP whitelist includes 0.0.0.0/0
- Check credentials in MONGO_URI
- Confirm MongoDB Atlas cluster is running

### CORS Errors
- Ensure backend URL matches frontend API_URL
- Check Render backend logs for errors

### Email Not Sending
- Verify Gmail App Password is correct
- Ensure 2FA is enabled on Gmail account
- Check email service in backend logs

### Port Already in Use
- Render auto-assigns port 5000
- Use `process.env.PORT || 5000` in code (already configured)

## Production Checklist

- [ ] MongoDB Atlas cluster created and accessible
- [ ] IP whitelist configured in MongoDB Atlas
- [ ] All environment variables set in Render
- [ ] Backend deployed and running
- [ ] Frontend deployed and running
- [ ] Frontend API URL points to backend
- [ ] Login/register tested
- [ ] Email functionality tested

## Support

For issues:
1. Check Render dashboard logs
2. Verify environment variables
3. Confirm MongoDB Atlas connectivity
4. Check browser console for frontend errors
