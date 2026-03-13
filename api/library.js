import { listLibrary } from "../lib/blob.js";

export async function GET() {
  try {
    const library = await listLibrary();
    return json(library);
  } catch (error) {
    console.error(error);
    return json(
      {
        error: "讀取雲端資料失敗，請確認 Vercel Blob 已經綁定到專案。",
      },
      500,
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
