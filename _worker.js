// _worker.js

// 我們用這個房名來測 token，不要真的存
const CHECK_ROOM = "__check__";

// 這就是我們的 Durable Object，所有房間都存在這裡
export class CountdownManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rooms = null; // lazy load
  }

  async load() {
    if (this.rooms === null) {
      const stored = await this.state.storage.get("rooms");
      this.rooms = stored || {};
    }
  }

  async save() {
    await this.state.storage.put("rooms", this.rooms);
  }

  async fetch(request) {
    const url = new URL(request.url);
    await this.load();

    // 1) 列出所有房間：GET /api?rooms=1
    if (request.method === "GET" && url.searchParams.get("rooms") === "1") {
      const list = Object.keys(this.rooms).filter((r) => r !== CHECK_ROOM);
      return new Response(JSON.stringify({ rooms: list }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) 取得單一房：GET /api?room=xxx
    if (request.method === "GET" && url.searchParams.get("room")) {
      const room = url.searchParams.get("room");
      const data =
        this.rooms[room] || {
          state: "idle",
          targetTime: null,
          remaining: null,
        };

      if (data.state === "running" && data.targetTime) {
        const now = Date.now();
        data.remaining = Math.max(0, data.targetTime - now);
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3) 控制：POST /api
    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (e) {
        return new Response("invalid json", { status: 400 });
      }

      const { room, action, targetTime, token } = body || {};

      if (!room) {
        return new Response("room required", { status: 400 });
      }

      const validToken = this.env.CONTROL_TOKEN;
      if (!validToken) {
        // 這個錯你會在前端看到 "server token not configured"
        return new Response("server token not configured", { status: 500 });
      }
      if (token !== validToken) {
        return new Response("unauthorized", { status: 401 });
      }

      // 登入測試用，不要寫進資料
      if (room === CHECK_ROOM) {
        return new Response(JSON.stringify({ ok: true, room, action }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 確保這個房間存在
      if (!this.rooms[room]) {
        this.rooms[room] = {
          state: "idle",
          targetTime: null,
          remaining: null,
        };
      }

      // 刪除
      if (action === "delete") {
        delete this.rooms[room];
        await this.save();
        return new Response(JSON.stringify({ ok: true, room, action }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 其他動作
      const r = this.rooms[room];

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

      await this.save();

      return new Response(JSON.stringify({ ok: true, room, action }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  }
}

// 這裡是整個站的入口
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API 的走 DO
    if (url.pathname.startsWith("/api")) {
      // 用同一個名字，大家就打到同一顆
      const id = env.COUNTDOWN_DO.idFromName("global");
      const stub = env.COUNTDOWN_DO.get(id);
      return stub.fetch(request);
    }

    // 其他走 Pages 靜態檔
    return env.ASSETS.fetch(request);
  },
};

// 這行是關鍵：把 DO 綁到名字 COUNTDOWN_DO
export const durable_objects = {
  COUNTDOWN_DO: CountdownManager,
};
