# SkillSwap

SkillSwap helps students teach each other. Add skills you can teach, list skills you want to learn, find other students, and ask for a skill exchange.

## What you can do

- Create an account and sign in.
- Add a profile photo, a short bio, and your skills.
- Search for students by skill, skill group, and experience level.
- Send and manage connection requests.
- Ask for skill exchanges and mark them complete.
- Receive notifications about requests.
- Keep your email and phone private unless you choose to show them.

## Tools used

React, Vite, React Router, Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs, and Axios.

## Important files

```text
backend/app.js       API routes and error messages
backend/db.js        MongoDB connection
backend/models.js    MongoDB data models
backend/server.js    API server for local use and Render
src/api.js           Website connection to the API
src/main.jsx         Website pages and actions
src/styles.css       Website design
render.yaml          Render setup for the API and website
```

The code has short comments to explain important parts.

## Run SkillSwap on your computer

You need Node.js 20 or newer and MongoDB. You can use MongoDB on your computer or MongoDB Atlas.

1. Open a terminal in this project folder.
2. Install the packages:

   ```powershell
   npm install
   ```

3. Copy the example settings file and open it:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

4. Keep the local MongoDB address shown in `.env`, or replace it with your Atlas connection string. Change `JWT_SECRET` to a long, private value.
5. Start the website and API:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:5173](http://localhost:5173).

Keep the terminal open while you use the site. Press **Ctrl+C** in the terminal to stop it. The API uses port 5000. Vite sends `/api` requests to it while you work locally.

### Use local MongoDB

Make sure the MongoDB service is running. In `.env`, use:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/skillswap
```

MongoDB creates the `skillswap` database when the app first saves an account.

### Use MongoDB Atlas

1. Create or open a cluster in MongoDB Atlas.
2. Create a **database user** and keep its password safe. This is different from your Atlas website login.
3. In **Connect → Drivers**, copy the connection string.
4. Put it in `.env` as `MONGODB_URI`. Use `skillswap` as the database name. If the password has special characters, URL-encode them.
5. Add your computer's IP address to the Atlas project's **Network Access** list.

An Atlas string looks like this. Replace the example user, password, and cluster with the values Atlas gives you:

```env
MONGODB_URI=mongodb+srv://DB_USER:DB_PASSWORD@cluster0.example.mongodb.net/skillswap?retryWrites=true&w=majority
```

Local MongoDB and Atlas use the same app. Only `MONGODB_URI` changes. Never commit `.env` to GitHub.

## Deploy on Render

Render uses two services for this project:

- A **Web Service** runs the Express API.
- A **Static Site** serves the React website.

The `render.yaml` file sets up both services, connects the website to the API, and sends website page links such as `/app` back to React.

### Before you start

1. Put this project in a GitHub repository. Do not upload `.env`; `.gitignore` excludes it.
2. Make sure your MongoDB Atlas cluster is running and you have its connection string.
3. In the Atlas database user's roles, allow read and write access to the `skillswap` database.

If the project is not on GitHub yet, make an empty repository on GitHub, then use GitHub Desktop's **Add an Existing Repository** and **Publish repository** steps for this project folder. You can also push it with Git commands if Git is installed:

```sh
git init
git add .
git commit -m "Prepare SkillSwap for Render"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/skillswap.git
git push -u origin main
```

Replace the example GitHub address with your repository address. If this folder is already connected to GitHub, just commit and push the changes.

### Create the Render services

1. Sign in to Render and choose **New → Blueprint**.
2. Connect your GitHub account, then select this project repository.
3. Render reads `render.yaml`. It will show the `skillswap-api` Web Service and the `skillswap-site` Static Site.
4. When Render asks for `MONGODB_URI`, paste your Atlas connection string. Render creates a private `JWT_SECRET` for you.
5. Choose **Apply** and wait for both services to finish deploying.

The website gets the API's public Render URL from the Blueprint. You do not need to add `VITE_API_URL` by hand. The website adds `/api` to that address when it makes API calls.

### Let Render reach Atlas

Atlas only accepts connections from IP addresses on its Network Access list. After the API service is created:

1. Open the `skillswap-api` service in Render.
2. Choose **Connect → Outbound** and copy the service's outbound IP ranges.
3. In Atlas, open **Network Access** and add those ranges.
4. If you change the Render service's region, update the Atlas list with its new outbound ranges.

The Atlas connection string, database user, and network access list all need to be correct for the API to start.

### Check that the site works

1. Open the `skillswap-api` service URL and add `/api/health` to the end. It should show:

   ```json
   { "ok": true, "service": "SkillSwap API" }
   ```

2. Open the `skillswap-site` URL shown in Render.
3. Create an account, sign in, add skills, and try searching for another student.
4. If a page such as `/app` shows a not-found message after refresh, check that the Static Site has a rewrite from `/*` to `/index.html`. The Blueprint adds this rule automatically.

When you push new commits to the connected GitHub branch, Render can deploy the updates automatically.

### If you create the services by hand

Use these settings for the API Web Service:

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Add `MONGODB_URI` and `JWT_SECRET` in the API service's **Environment** settings.

Use these settings for the Static Site:

| Setting | Value |
| --- | --- |
| Root Directory | Leave empty |
| Build Command | `npm ci && npm run build` |
| Publish Directory | `dist` |
| `VITE_API_URL` | The API Web Service URL, such as `https://skillswap-api.onrender.com` |

Add a Static Site rewrite from `/*` to `/index.html`. If you change `VITE_API_URL`, rebuild and deploy the Static Site so the new value is included.

### Free Render service note

Render's free Web Services go to sleep after 15 minutes without traffic. The first visit after that can take about a minute while the API starts again. The Static Site stays available. [Render explains free service limits here](https://render.com/docs/free).

## API routes

All API routes start with `/api`. Private routes need an `Authorization: Bearer <token>` header.

| Area | Routes |
| --- | --- |
| Sign in | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Profile | `GET /users/profile`, `PUT /users/profile`, `GET /users/:id`, `GET /users/search` |
| Skills | `GET /skills`, `POST /skills`, `PUT /skills/:id`, `DELETE /skills/:id` |
| Connections | `POST /connections`, `GET /connections/friends`, `GET /connections/received`, `GET /connections/sent`, `GET /connections/status/:id`, `PUT /connections/:id/accept`, `PUT /connections/:id/reject`, `DELETE /connections/:id` |
| Exchanges | `POST /exchanges`, `GET /exchanges/sent`, `GET /exchanges/received`, `PUT /exchanges/:id/status`, `DELETE /exchanges/:id` |
| Notifications | `GET /notifications`, `PUT /notifications/:id/read` |
| Dashboard | `GET /dashboard/stats` |

## Team

Replace these sample fields before submitting the project.

| Team member | Registration number |
| --- | --- |
| Team member 1 | Registration number 1 |
| Team member 2 | Registration number 2 |
| Team member 3 | Registration number 3 |

## Deployment links

- Website: **Add the `skillswap-site` Render URL here.**
- API: **Add the `skillswap-api` Render URL here.**
