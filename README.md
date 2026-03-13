# Image Space

This project is ready to push to GitHub and deploy on Vercel.

## Structure

- `index.html`, `styles.css`, `app.js`: static frontend
- `api/*.js`: Vercel Functions
- `lib/blob.js`: Vercel Blob folder and image logic
- `vercel.json`: Vercel project config

## Local Development

1. `npm install`
2. `vercel login`
3. Create a Blob Store in your Vercel project
4. Pull project settings and env vars with `vercel pull`
5. Run `npm run dev:vercel`

## Deploy To Vercel

1. Push this folder to GitHub
2. In Vercel, click `Add New Project`
3. Select this GitHub repo
4. Keep the root directory as this project root
5. In the Vercel project `Storage` tab, create and connect a Public Blob Store
6. Redeploy

## Notes

- Uploads are handled by Vercel Functions and stored in Vercel Blob
- Current upload limit is 4.5 MB per image
- If the Blob Store is connected to the same Vercel project, `BLOB_READ_WRITE_TOKEN` is provided automatically in deployment
