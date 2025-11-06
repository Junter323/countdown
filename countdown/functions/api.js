// GET /api?room=xxx
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get("room") || "no-room";
  return new Response(
    JSON.stringify({ state: "idle", room }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}

// POST /api
export async function onRequestPost(context) {
  const body = await context.request.json();
  const { room, action, targetTime } = body;

  return new Response(
    JSON.stringify({
      ok: true,
      received: { room, action, targetTime }
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" }
    }
  );
}
