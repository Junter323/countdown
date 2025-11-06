// functions/api.js

// 記憶體版：同一台機器會記得，但不同節點可能不會
const rooms = {};
const roomNames = new Set();
const CHECK_ROOM = "__check__";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);

  // 列出所有房間
  if (url.searchParams.get("rooms") === "1") {
    const list = Array.from(roomNames).filter((r) => r !== CHECK_ROOM);
    return new Response(JSON.stringify({ rooms: list }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 單一房間
  const room = url.searchParams.get("room");
  if (!room) {
    return new Response("room required", { status: 400 });
  }

  const data =
    rooms[room] || { state: "idle", targetTime: null, remaining: null };

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

  const validToken = env?.CONTROL_TOKEN;
  if (!validToken) {
    return new Response("server token not configured", { status: 500 });
  }
  if (token !== validToken) {
    return new Response("unauthorized", { status: 401 });
  }

  // 登入測試用，不要存
  if (room === CHECK_ROOM) {
    return new Response(JSON.stringify({ ok: true, room, action }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 刪除
  if (action === "delete") {
    roomNames.delete(room);
    delete rooms[room];
    return new Response(JSON.stringify({ ok: true, room, action }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 其他動作
  if (!rooms[room]) {
    rooms[room] = { state: "idle", targetTime: null, remaining: null };
  }
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

  return new Response(JSON.stringify({ ok: true, room, action }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
