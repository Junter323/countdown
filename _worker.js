// _worker.js
import { CountdownManager } from "./src/CountdownManager.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API 的都走 Durable Object
    if (url.pathname.startsWith("/api")) {
      // 我們固定用一個名字叫 "global"，這樣所有人都打到同一顆 DO
      const id = env.COUNTDOWN_DO.idFromName("global");
      const stub = env.COUNTDOWN_DO.get(id);
      // 直接把原本的 request 丟進去，裡面自己會分 GET / POST
      return stub.fetch(request);
    }

    // 其他就當成靜態檔
    return env.ASSETS.fetch(request);
  },
};

// 告訴 Cloudflare 這個 repo 裡有一個 Durable Object class
export { CountdownManager };
