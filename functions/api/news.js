// Cloudflare Pages Function — /api/news
// Bing Haberler (paralel, kategori başına) + haber sayfasından kapak görseli (og:image).
// Teşhis: /api/news?debug=1

const BING = (q) =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&setmkt=tr-TR&count=20`;

const FEEDS = [
  { cat: "Gündem",   q: "Sultanbeyli" },
  { cat: "Belediye", q: "Sultanbeyli Belediyesi" },
  { cat: "Hizmet",   q: "Sultanbeyli su kesintisi OR İSKİ OR okul OR elektrik" },
  { cat: "Ulaşım",   q: "Sultanbeyli metro OR M5 OR trafik OR yol" },
  { cat: "Spor",     q: "Sultanbeyli Belediyespor" },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function decodeEntities(s) {
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/gi, " ").replace(/&(?:apos|#39);/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}
const clean = (s = "") =>
  decodeEntities(String(s)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function host(link) {
  try {
    let h = new URL(link).hostname.replace(/^www\./, "");
    return h;
  } catch { return ""; }
}

function parseItems(xml) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml))) {
    const blk = m[1];
    const get = (tag) => {
      const r = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i");
      const x = r.exec(blk);
      return x ? x[1] : "";
    };
    // görsel: media:content / enclosure / açıklamadaki img
    let img = "";
    const mc = blk.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
               blk.match(/<enclosure[^>]+url=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i);
    if (mc) img = mc[1];
    out.push({
      title: clean(get("title")),
      link: clean(get("link")),
      pub: clean(get("pubDate")),
      source: clean(get("source")) || clean(get("News:Source")),
      desc: clean(get("description")),
      image: img && /^https?:\/\//i.test(img) ? img : null,
    });
  }
  return out;
}

function safeDate(s) { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); }
function usefulSummary(desc, title) {
  if (!desc) return "";
  const extra = desc.replace(title, "").trim();
  return extra.length > 50 ? desc.slice(0, 400) : "";
}

async function fetchText(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
      signal: ctrl.signal, redirect: "follow",
    });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: "", err: String(e) };
  } finally { clearTimeout(t); }
}

// Haber sayfasından hem kapak görseli hem de daha dolu özet (og/meta description) çeker
async function ogMeta(link) {
  const r = await fetchText(link, 4500);
  if (!r.ok) return { image: null, desc: "" };
  const html = r.text.slice(0, 250000);
  const pick = (re) => { const m = html.match(re); return m ? clean(m[1]) : ""; };
  let image =
    pick(/<meta[^>]+(?:property|name)=["']og:image(?::url)?["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i) ||
    pick(/<meta[^>]+(?:name|property)=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
  if (image && !/^https?:\/\//i.test(image)) image = "";
  let desc =
    pick(/<meta[^>]+(?:property|name)=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+(?:name|property)=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:description["']/i);
  return { image: image || null, desc: desc.slice(0, 400) };
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const debug = url.searchParams.get("debug");
  const report = [];

  // 1) Tüm kategorileri PARALEL çek
  const results = await Promise.allSettled(
    FEEDS.map(async (f) => {
      const r = await fetchText(BING(f.q), 6500);
      const parsed = r.ok ? parseItems(r.text) : [];
      report.push({ cat: f.cat, status: r.status, bytes: r.text.length, items: parsed.length, sample: r.text.slice(0, 90) });
      return parsed.map((it) => {
        const source = it.source || host(it.link) || "Haber";
        return {
          type: "feed", category: f.cat, source,
          title: it.title, link: it.link,
          summary: usefulSummary(it.desc, it.title),
          image: it.image, date: it.pub ? safeDate(it.pub) : null,
        };
      }).filter((x) => x.title && x.link);
    })
  );
  let items = [];
  for (const r of results) if (r.status === "fulfilled") items = items.concat(r.value);

  // tekrarları temizle + tarihe göre sırala
  const seen = new Set();
  items = items.filter((x) => {
    const k = x.title.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/gi, "").slice(0, 70);
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  // 2) İlk 18 haber için kapak görseli + daha dolu özet (paralel)
  const top = items.slice(0, 18);
  await Promise.allSettled(top.map(async (it) => {
    const meta = await ogMeta(it.link);
    if (!it.image && meta.image) it.image = meta.image;
    if (meta.desc && meta.desc.length > 80 && meta.desc.length > (it.summary || "").length)
      it.summary = meta.desc;
  }));

  const body = debug
    ? { updated: new Date().toISOString(), total: items.length, withImage: items.filter(i => i.image).length, feeds: report }
    : { updated: new Date().toISOString(), items };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": debug ? "no-store" : "s-maxage=600, stale-while-revalidate=1200",
    },
  });
}
