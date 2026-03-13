import { uploadImage } from "../lib/blob.js";

const MAX_FILE_SIZE = Math.floor(4.5 * 1024 * 1024);

export async function POST(request) {
  try {
    const formData = await request.formData();
    const folderId = String(formData.get("folderId") || "").trim();
    const file = formData.get("file");

    if (!file) {
      return json({ error: "沒有收到圖片檔案。" }, 400);
    }

    if (!(file instanceof File)) {
      return json({ error: "上傳內容格式不正確。" }, 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return json({ error: "單張圖片請控制在 4.5 MB 內。" }, 400);
    }

    const result = await uploadImage(file, folderId);
    return json({ ok: true, image: result }, 201);
  } catch (error) {
    console.error(error);
    return json(
      {
        error: error.message || "上傳失敗。",
      },
      400,
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
