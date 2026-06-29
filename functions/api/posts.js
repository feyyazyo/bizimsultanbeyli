// Cloudflare Pages Function — /api/posts
// Senin yazdığın ÖZGÜN yazılar. Cloudflare KV'de saklanır.
// GET: yayınlanmış yazıları döner (herkese açık)
// POST/DELETE: panelden, ADMIN_TOKEN ile korumalı

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const authed = (request, env) =>
  env.ADMIN_TOKEN && request.headers.get("x-admin-token") === env.ADMIN_TOKEN;

// Yayınlanmış yazılar — KV bağlı değilse boş döner (site yine çalışır)
export async function onRequestGet({ env }) {
  try {
    if (!env.POSTS) return json({ items: [] });
    const list = await env.POSTS.list({ prefix: "post:" });
    const items = [];
    for (const k of list.keys) {
      const v = await env.POSTS.get(k.name);
      if (v) items.push(JSON.parse(v));
    }
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return json({ items });
  } catch (e) {
    return json({ items: [], error: String(e) });
  }
}

export async function onRequestPost({ request, env }) {
  if (!authed(request, env)) return json({ error: "Yetkisiz" }, 401);
  if (!env.POSTS) return json({ error: "KV deposu (POSTS) bağlı değil. README'ye bak." }, 500);
  let b;
  try { b = await request.json(); } catch { return json({ error: "Geçersiz veri" }, 400); }
  if (!b.title || !b.body) return json({ error: "Başlık ve metin zorunlu" }, 400);
  const id = "post:" + Date.now();
  const post = {
    id, type: "original",
    title: String(b.title).slice(0, 200),
    body: String(b.body).slice(0, 20000),
    image: b.image ? String(b.image).slice(0, 600) : null,
    category: b.category || "Yerel",
    author: (b.author || "Editör").slice(0, 80),
    date: new Date().toISOString(),
  };
  await env.POSTS.put(id, JSON.stringify(post));
  return json({ ok: true, post });
}

export async function onRequestDelete({ request, env }) {
  if (!authed(request, env)) return json({ error: "Yetkisiz" }, 401);
  if (!env.POSTS) return json({ error: "KV bağlı değil" }, 500);
  const id = new URL(request.url).searchParams.get("id");
  if (id) await env.POSTS.delete(id);
  return json({ ok: true });
}
