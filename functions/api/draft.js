// Cloudflare Pages Function — /api/draft  (OPSİYONEL)
// Bir konudan ÖZGÜN yazı TASLAĞI üretir. Sen düzenleyip yayınlarsın (insan kontrolü şart).
// Sadece ANTHROPIC_API_KEY ortam değişkeni tanımlıysa çalışır. Kullanım başına ufak ücret.

const json = (d, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json; charset=utf-8" } });

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_TOKEN || request.headers.get("x-admin-token") !== env.ADMIN_TOKEN)
    return json({ error: "Yetkisiz" }, 401);
  if (!env.ANTHROPIC_API_KEY)
    return json({ error: "AI taslak kapalı. (İstersen ANTHROPIC_API_KEY ekle — opsiyonel, ücretli.)" }, 501);

  let topic = "";
  try { topic = (await request.json()).topic || ""; } catch {}
  if (!topic.trim()) return json({ error: "Konu gir" }, 400);

  const system =
    "Sen Sultanbeyli (İstanbul) için yerel bir haber sitesinin editör yardımcısısın. " +
    "Verilen konuda ÖZGÜN, Sultanbeyli'ye özel, somut ve okuyucuya faydalı kısa bir yazı TASLAĞI yaz (250-400 kelime). " +
    "Başkasının haberini kopyalama; genel geçer doldurma cümlelerden kaçın; mahalle/ilçe gerçeğine değin. " +
    "Yanıtı SADECE şu JSON olarak ver, başka hiçbir şey yazma: {\"title\":\"...\",\"body\":\"...\"}. " +
    "body düz metin olsun, paragraflar \\n\\n ile ayrılsın.";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        system,
        messages: [{ role: "user", content: "Konu: " + topic }],
      }),
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) return json({ error: "AI servisi hata verdi (" + r.status + ")" }, 502);
    const data = await r.json();
    const text = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("").trim();
    let draft;
    try { draft = JSON.parse(text.replace(/^```json|```$/g, "").trim()); }
    catch { draft = { title: topic, body: text }; }
    return json({ ok: true, draft, note: "Bu bir taslaktır — yayınlamadan önce mutlaka oku ve düzenle." });
  } catch (e) {
    return json({ error: "İstek başarısız: " + e }, 502);
  }
}
