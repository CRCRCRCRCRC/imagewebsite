import { createFolder } from "../lib/blob.js";

export async function POST(request) {
  try {
    const body = await request.json();
    const name = body?.name?.trim();

    if (!name) {
      return json({ error: "資料夾名稱不能是空的。" }, 400);
    }

    const folder = await createFolder(name);
    return json({ folder }, 201);
  } catch (error) {
    console.error(error);
    return json(
      {
        error: error.message || "建立資料夾失敗。",
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
