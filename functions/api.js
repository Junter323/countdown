// functions/api.js

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // 我們所有的狀態都放在同一個 DO，名字就固定叫 "global"
  const id = env.COUNTDOWN_DO.idFromName("global");
  const stub = env.COUNTDOWN_DO.get(id);

  // 只要是 websocket、get、post 都丟給 DO
  if (request.method === "GET") {
    // 保留原本的查詢參數
    return stub.fetch(new Request(url.toString(), { method: "GET" }));
  }

  if (request.method === "POST") {
    const body = await request.text();
    return stub.fetch(new Request(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }));
  }

  return new Response("Method not allowed", { status: 405 });
}
