import { deleteImage, renameImage, replaceImage } from "../lib/blob.js";

export async function PATCH(request) {
  try {
    const body = await request.json();
    const imageId = String(body?.imageId || "").trim();
    const name = String(body?.name || "").trim();

    if (!imageId) {
      return json({ error: "缺少圖片 ID。" }, 400);
    }

    if (!name) {
      return json({ error: "圖片名稱不能是空的。" }, 400);
    }

    const image = await renameImage(imageId, name);
    return json({ image });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "重新命名失敗。" }, 400);
  }
}

export async function PUT(request) {
  try {
    const formData = await request.formData();
    const imageId = String(formData.get("imageId") || "").trim();
    const file = formData.get("file");

    if (!imageId) {
      return json({ error: "缺少圖片 ID。" }, 400);
    }

    if (!(file instanceof File)) {
      return json({ error: "缺少編輯後的圖片檔案。" }, 400);
    }

    const image = await replaceImage(imageId, file);
    return json({ image });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "更新圖片失敗。" }, 400);
  }
}

export async function DELETE(request) {
  try {
    const body = await request.json();
    const imageId = String(body?.imageId || "").trim();

    if (!imageId) {
      return json({ error: "Missing image ID." }, 400);
    }

    await deleteImage(imageId);
    return json({ imageId });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Failed to delete image." }, 400);
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
