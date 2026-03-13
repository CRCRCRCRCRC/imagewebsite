# Image Space

可部署到 GitHub 與 Vercel 的圖片上傳站。

## 本機開發

1. `npm install`
2. 第一次使用 Vercel CLI 時先執行 `vercel login`
3. 建立 Vercel Blob，並把 `BLOB_READ_WRITE_TOKEN` 放進 `.env.local`
4. `npm run dev:vercel`

## 部署到 Vercel

1. 把這個資料夾推到 GitHub
2. 在 Vercel 匯入這個 repo
3. 在 Vercel 專案裡建立並綁定一個 Public Blob Store
4. 重新部署

## 備註

- 目前這版走 Vercel Function 轉存到 Blob，前端限制單張圖片 4.5 MB 內
- 如果你之後要支援更大的圖片，可以再改成 Vercel Blob client uploads
