import { loadNotebookState, saveNotebookState } from "../lib/blob.js";

export async function GET() {
  try {
    const notebook = await loadNotebookState();
    return json({ notebook });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Failed to load notebook." }, 500);
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const notebook = await saveNotebookState(body);
    return json({ notebook });
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Failed to save notebook." }, 400);
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
