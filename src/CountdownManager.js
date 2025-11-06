// src/CountdownManager.js

export class CountdownManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.rooms = null; // 之後 lazy load
    this.CHECK_ROOM = "__check__";
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

    // GET /api?rooms=1 → 列出所有房間
    if (request.method === "GET" && url.searchParams.get("rooms") === "1") {
      const list = Object.keys(this.rooms).filter(
        (r) => r !== this.CHECK_ROOM
      );
      return new Response(JSON.stringify({ rooms: list }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /api?room=xxx → 拿單一房的狀態
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

    // POST → 控制
    if (request.method === "POST") {
      const body = await request.json();
      const { room, action, targetTime, token } = body;

      if (!room) {
        return new Response("room required", { status: 400 });
      }

      // 從 Cloudflare 環境變數拿 token
      const validToken = this.env.CONTROL_TOKEN;
      if (!validToken) {
        return new Response("server token not configured", { status: 500 });
      }
      if (token !== validToken) {
        return new Response("unauthorized", { status: 401 });
      }

      // 登入測試用的房名，不要存
      if (room === this.CHECK_ROOM) {
        return new Response(JSON.stringify({ ok: true, room, action }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 確保有這個房間
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

      // 開始 / 暫停 / 重設
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
