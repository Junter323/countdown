// 簡單記憶體：rooms 存各房間狀態，roomNames 存有哪些房間
const rooms = {};
const roomNames = new Set();

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // 如果是要列出所有房間
  if (url.searchParams.get("rooms") === "1") {
    return new Response(
      JSON.stringify({ rooms: Array.from(roomNames) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 否則就是拿單一 room 的狀態
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
  const env = context.env;
  const body = await context.request.json();
  const { room, action, targetTime, token } = body;

  if (!room) {
    return new Response("room required", { status: 400 });
  }

  // 從環境變數拿 token
  const validToken = env?.CONTROL_TOKEN;
  if (!validToken) {
    return new Response("server token not configured", { status: 500 });
  }
  if (token !== validToken) {
    return new Response("unauthorized", { status: 401 });
  }

  // 沒有就初始化
  if (!rooms[room]) {
    rooms[room] = { state: "idle", targetTime: null, remaining: null };
  }
  // 有操作這個 room，就放進清單
  roomNames.add(room);

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
