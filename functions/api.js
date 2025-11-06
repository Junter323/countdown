// 很簡單的記憶體資料庫（同一個執行環境會記得）
// { roomId: { state, targetTime, remaining } }
const rooms = {};

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const room = url.searchParams.get("room");
  if (!room) {
    return new Response("room required", { status: 400 });
    }
  const data = rooms[room] || { state: "idle", targetTime: null, remaining: null };

  // 如果在跑，就順便算一下現在剩多少給前端
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
  const { room, action, targetTime } = body;
  if (!room) {
    return new Response("room required", { status: 400 });
  }

  // 如果這個 room 還沒建立，就先給一個初始值
  if (!rooms[room]) {
    rooms[room] = { state: "idle", targetTime: null, remaining: null };
  }

  const r = rooms[room];

  if (action === "start") {
    // 控制頁已經幫我們算好 targetTime 了
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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
