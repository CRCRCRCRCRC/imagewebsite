import { renameImage } from "../lib/blob.js";

export async function PATCH(request) {
  try {
    const body = await request.json();
    const imageId = String(body?.imageId || "").trim();
    const name = String(body?.name || "").trim();

    if (!imageId) {
      return json({ error: "缺少圖片識別資料。" }, 400);
    }

    if (!name) {
      return json({ error: "圖片名稱不能是空的。" }, 400);
    }

    const image = await renameImage(imageId, name);
    return json({ image });
  } catch (error) {
    console.error(error);
    return json(
      {
        error: error.message || "重新命名失敗。",
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
