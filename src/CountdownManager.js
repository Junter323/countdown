// src/CountdownManager.js

export class CountdownManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rooms = null;
  }

  // 讀一次 storage，確保有資料
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

    // GET /api?rooms=1
    if (request.method === "GET" && url.searchParams.get("rooms") === "1") {
      // 回所有房間（排除 __check__）
      const list = Object.keys(this.rooms).filter(r => r !== "__check__");
      return new Response(JSON.stringify({ rooms: list }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /api?room=xxx
    if (request.method === "GET" && url.searchParams.get("room")) {
      const room = url.searchParams.get("room");
      const data = this.rooms[room] || {
        state: "idle",
        targetTime: null,
        remaining: null,
      };

      // running 的話算一下剩餘
      if (data.state === "running" && data.targetTime) {
        const now = Date.now();
        data.remaining = Math.max(0, data.targetTime - now);
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // POST /api ...
    if (request.method === "POST") {
      const body = await request.json();
      const { room, action, targetTime, token } = body;

      if (!room) {
        return new Response("room required", { status: 400 });
      }

      // 從環境變數拿 token
      const validToken = this.env.CONTROL_TOKEN;
      if (!validToken) {
        return new Response("server token not configured", { status: 500 });
      }
      if (token !== validToken) {
        return new Response("unauthorized", { status: 401 });
      }

      // 如果是登入時的測試，就直接回，不存
      if (room === "__check__") {
        return new Response(JSON.stringify({ ok: true, room, action }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 確保有這個 room
      if (!this.rooms[room]) {
        this.rooms[room] = {
          state: "idle",
          targetTime: null,
          remaining: null,
        };
      }

      const r = this.rooms[room];

      if (action === "delete") {
        delete this.rooms[room];
        await this.save();
        return new Response(JSON.stringify({ ok: true, room, action }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

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
