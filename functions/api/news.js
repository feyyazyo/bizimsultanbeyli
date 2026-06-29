// Cloudflare Pages Function — /api/news
// Sultanbeyli haberlerini Google Haberler RSS aramasından çeker. Dış bağımlılık yok.
// Sadece başlık + kaynak + kısa alıntı + kaynağa link. Tam metin kopyalanmaz.

const G = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=tr&gl=TR&ceid=TR:tr`;

const FEEDS = [
  { cat: "Gündem",   url: G('"Sultanbeyli"') },
  { cat: "Belediye", url: G('"Sultanbeyli Belediyesi" OR "Ali Tombaş"') },
  { cat: "Hizmet",   url: G('Sultanbeyli (su kesintisi OR İSKİ OR elektrik OR doğalgaz OR okul OR kar)') },
  { cat: "Ulaşım",   url: G('Sultanbeyli (metro OR M5 OR trafik OR yol OR İETT)') },
  { cat: "Spor",     url: G('"Sultanbeyli Belediyespor"') },
];

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
    out.push({
      title: clean(get("title")),
      link: clean(get("link")),
      pub: clean(get("pubDate")),
      source: clean(get("source")),
      desc: clean(get("description")),
    });
  }
  return out;
}

function cleanTitle(t, source) {
  if (source && t.toLowerCase().endsWith(" - " + source.toLowerCase()))
    return t.slice(0, t.length - (source.length + 3)).trim();
  return t;
}
function usefulSummary(desc, title) {
  if (!desc) return "";
  const extra = desc.replace(title, "").trim();
  return extra.length > 60 ? desc.slice(0, 280) : "";
}

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (SultanbeyliGundem/1.0)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml).slice(0, 20).map((it) => {
      const source = it.source || "Haber Kaynağı";
      const title = cleanTitle(it.title, source);
      return {
        type: "feed",
        category: feed.cat,
        source,
        title,
        link: it.link,
        summary: usefulSummary(it.desc, title),
        image: null,
        date: it.pub ? new Date(it.pub).toISOString() : null,
      };
    }).filter((x) => x.title && x.link);
  } catch {
    return [];
  }
}

export async function onRequest() {
  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  let items = [];
  for (const r of results) if (r.status === "fulfilled") items = items.concat(r.value);

  const seen = new Set();
  items = items.filter((x) => {
    const k = x.title.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/gi, "").slice(0, 70);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  return new Response(JSON.stringify({ updated: new Date().toISOString(), items }), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
    },
  });
}
