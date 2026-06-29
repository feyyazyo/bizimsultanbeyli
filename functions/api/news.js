// Cloudflare Pages Function — /api/news
// Sultanbeyli haberleri. Google Haberler RSS + (boş dönerse) Bing Haberler yedeği.
// Teşhis için: /api/news?debug=1

const GQ = (q) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=tr&gl=TR&ceid=TR:tr`;
const BING = (q) =>
  `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=RSS&setmkt=tr-TR`;

const FEEDS = [
  { cat: "Gündem",   q: '"Sultanbeyli"' },
  { cat: "Belediye", q: '"Sultanbeyli Belediyesi" OR "Ali Tombaş"' },
  { cat: "Hizmet",   q: 'Sultanbeyli (su kesintisi OR İSKİ OR elektrik OR doğalgaz OR okul OR kar)' },
  { cat: "Ulaşım",   q: 'Sultanbeyli (metro OR M5 OR trafik OR yol OR İETT)' },
  { cat: "Spor",     q: '"Sultanbeyli Belediyespor"' },
];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  "Accept": "application/rss+xml, application/xml, text/xml; q=0.9, */*; q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  // Google'ın AB onay (consent) duvarını atlamak için:
  "Cookie": "CONSENT=YES+cb.20210720-07-p0.en+FX+410",
};

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

async function fetchUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal, redirect: "follow" });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (e) {
    return { ok: false, status: 0, text: "", err: String(e) };
  } finally {
    clearTimeout(t);
  }
}

function toItems(parsed, cat, fallbackSource) {
  return parsed.map((it) => {
    const source = it.source || fallbackSource || "Haber Kaynağı";
    const title = cleanTitle(it.title, source);
    return {
      type: "feed", category: cat, source, title, link: it.link,
      summary: usefulSummary(it.desc, title),
      image: null,
      date: it.pub ? safeDate(it.pub) : null,
    };
  }).filter((x) => x.title && x.link);
}
function safeDate(s) { const d = new Date(s); return isNaN(d) ? null : d.toISOString(); }

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const debug = url.searchParams.get("debug");
  const report = [];
  let items = [];

  // 1) Google Haberler
  for (const f of FEEDS) {
    const r = await fetchUrl(GQ(f.q));
    const parsed = r.ok ? parseItems(r.text) : [];
    const mapped = toItems(parsed, f.cat);
    items = items.concat(mapped);
    report.push({ src: "google", cat: f.cat, status: r.status, bytes: r.text.length, items: mapped.length, sample: r.text.slice(0, 120) });
  }

  // 2) Google boş döndüyse Bing Haberler yedeği
  if (items.length === 0) {
    const r = await fetchUrl(BING("Sultanbeyli"));
    const parsed = r.ok ? parseItems(r.text) : [];
    const mapped = toItems(parsed, "Gündem", "Bing Haber");
    items = items.concat(mapped);
    report.push({ src: "bing", cat: "Gündem", status: r.status, bytes: r.text.length, items: mapped.length, sample: r.text.slice(0, 120) });
  }

  // tekrarları temizle + sırala
  const seen = new Set();
  items = items.filter((x) => {
    const k = x.title.toLowerCase().replace(/[^a-zçğıöşü0-9 ]/gi, "").slice(0, 70);
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const body = debug
    ? { updated: new Date().toISOString(), total: items.length, feeds: report }
    : { updated: new Date().toISOString(), items };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": debug ? "no-store" : "s-maxage=300, stale-while-revalidate=600",
    },
  });
}
