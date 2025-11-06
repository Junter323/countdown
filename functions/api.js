// 簡單記憶體狀態
const rooms = {};
// 換成你自己的 token
const VALID_TOKEN = "CHANGE_ME";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get("room");
  if (!room) {
    return new Response("room required", { status: 400 });
  }
  const data = rooms[room] || { state: "idle", targetTime: null, remaining: null };

  if (data.state === "running" && data.targetTime) {
    const now = Date.now();
    data.remaining = Math.max(0, data.targetTime - now);
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  const body = await context.request.json();
  const { room, action, targetTime, token } = body;

  if (!room) {
    return new Response("room required", { status: 400 });
  }

  // 簡單 token 驗證
  if (token !== VALID_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!rooms[room]) {
    rooms[room] = { state: "idle", targetTime: null, remaining: null };
  }

  const r = rooms[room];

  if (action === "start") {
    r.state = "running";
    r.targetTime = targetTime;
    r.remaining = null;
  } else if (action === "pause") {
    if (r.state === "running" && r.targetTime) {
      const now = Date.now();
      r.remaining = Math.max(0, r.targetTime - now);
    }
    r.state = "paused";
    r.targetTime = null;
  } else if (action === "reset") {
    r.state = "idle";
    r.targetTime = null;
    r.remaining = null;
  }

  return new Response(
    JSON.stringify({ ok: true, room, action }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
