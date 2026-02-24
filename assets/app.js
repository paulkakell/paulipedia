/* Static Wikipedia-like personal page loader
   - Data comes from ./data/data.json
   - Builds: title, lead, infobox, sections, TOC, references, external links
   - Adds: theme toggle, quick search within page, download JSON, print
*/

const els = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const el = (sel, root=document) => root.querySelector(sel);

function slugify(text){
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function setTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
  try{ localStorage.setItem("theme", theme); }catch(_){}
  const btn = el("#toggleTheme");
  if(btn){
    const pressed = theme === "dark";
    btn.setAttribute("aria-pressed", pressed ? "true" : "false");
    btn.textContent = pressed ? "Toggle light mode" : "Toggle dark mode";
  }
}

function toast(msg){
  const t = el("#toast");
  if(!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { t.hidden = true; }, 2200);
}

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function linkify(item){
  if(!item) return "";
  const text = escapeHtml(item.text || item.url || "");
  if(item.url){
    const url = escapeHtml(item.url);
    return `<a href="${url}" rel="noopener noreferrer" target="_blank">${text}</a>`;
  }
  return text;
}

function renderInfobox(data){
  el("#infoTitle").textContent = data.infobox?.title || data.person?.name || "";
  const fieldsWrap = el("#infoboxFields");
  fieldsWrap.innerHTML = "";

  const img = data.infobox?.image;
  const imgWrap = el("#infoImageWrap");
  if(img && img.src){
    el("#infoImage").src = img.src;
    el("#infoImage").alt = img.alt || (data.person?.name ? `Photo of ${data.person.name}` : "Photo");
    el("#infoImageCaption").textContent = img.caption || "";
    imgWrap.hidden = false;
  }else{
    imgWrap.hidden = true;
  }

  const fields = data.infobox?.fields || [];
  for(const f of fields){
    const row = document.createElement("div");
    row.className = "infobox__row";

    const dt = document.createElement("div");
    dt.className = "infobox__dt";
    dt.textContent = f.label || "";

    const dd = document.createElement("div");
    dd.className = "infobox__dd";

    if(Array.isArray(f.value)){
      dd.innerHTML = f.value.map(v => linkify(typeof v === "string" ? {text:v} : v)).join("<br />");
    }else if(typeof f.value === "object" && f.value){
      dd.innerHTML = linkify(f.value);
    }else{
      dd.textContent = f.value ?? "";
    }

    row.appendChild(dt);
    row.appendChild(dd);
    fieldsWrap.appendChild(row);
  }
}

function renderLead(data){
  const title = data.person?.name || data.article?.title || "Personal Page";
  el("#articleTitle").textContent = title;
  document.title = title;

  const desc = data.article?.description || "";
  const metaBits = [];
  if(data.article?.lastUpdated) metaBits.push(`Last updated: ${data.article.lastUpdated}`);
  if(data.article?.readTimeMinutes) metaBits.push(`${data.article.readTimeMinutes} min read`);
  el("#articleMeta").textContent = metaBits.join(" • ");

  const metaDesc = el("#metaDescription");
  if(metaDesc && desc) metaDesc.setAttribute("content", desc);

  const lead = data.article?.lead || "";
  el("#leadText").innerHTML = lead
    .split("\n\n")
    .map(p => `<p>${escapeHtml(p)}</p>`)
    .join("");

  const siteName = el("#siteName");
  if(siteName) siteName.textContent = data.site?.name || "Wikipedia";
  const siteTagline = el("#siteTagline");
  if(siteTagline) siteTagline.textContent = data.site?.tagline || "The free encyclopedia";
}

function renderCardsSection(section){
  const wrap = document.createElement("div");
  wrap.className = "kv";
  const title = document.createElement("div");
  title.className = "kv__title";
  title.textContent = section.subtitle || "Highlights";
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "kv__grid";

  for(const item of (section.items || [])){
    const card = document.createElement("div");
    card.className = "card";

    const head = document.createElement("div");
    head.className = "card__title";

    const name = document.createElement("div");
    name.textContent = item.title || item.name || "Untitled";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = item.badge || item.type || "";

    head.appendChild(name);
    if(badge.textContent.trim()) head.appendChild(badge);

    const meta = document.createElement("div");
    meta.className = "card__meta";
    const metaParts = [];
    if(item.role) metaParts.push(item.role);
    if(item.org) metaParts.push(item.org);
    if(item.dateRange) metaParts.push(item.dateRange);
    if(item.location) metaParts.push(item.location);
    meta.textContent = metaParts.join(" • ");

    const body = document.createElement("div");
    if(item.summary){
      body.innerHTML = `<p>${escapeHtml(item.summary)}</p>`;
    }

    const links = document.createElement("div");
    links.className = "card__links";
    const linkParts = [];
    if(item.links){
      for(const l of item.links){
        if(l && (l.url || l.text)){
          linkParts.push(`<a href="${escapeHtml(l.url || "#")}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.text || l.url)}</a>`);
        }
      }
    }
    links.innerHTML = linkParts.join("");

    card.appendChild(head);
    if(meta.textContent.trim()) card.appendChild(meta);
    if(item.summary) card.appendChild(body);
    if(linkParts.length) card.appendChild(links);

    grid.appendChild(card);
  }

  wrap.appendChild(grid);
  return wrap;
}

function renderArticle(data){
  const article = el("#article");
  article.innerHTML = "";

  const tocItems = [];
  const addToc = (level, id, label) => tocItems.push({level, id, label});

  const sections = data.sections || [];
  for(const s of sections){
    const secId = s.id || slugify(s.title);
    const sec = document.createElement("section");
    sec.className = "section";
    sec.id = secId;

    const h2 = document.createElement("h2");
    h2.textContent = s.title || "Section";
    sec.appendChild(h2);
    addToc(2, secId, s.title || "Section");

    if(s.paragraphs && s.paragraphs.length){
      for(const p of s.paragraphs){
        const para = document.createElement("p");
        para.textContent = p;
        sec.appendChild(para);
      }
    }

    if(s.bullets && s.bullets.length){
      const ul = document.createElement("ul");
      for(const b of s.bullets){
        const li = document.createElement("li");
        li.textContent = b;
        ul.appendChild(li);
      }
      sec.appendChild(ul);
    }

    if(s.cards){
      sec.appendChild(renderCardsSection(s.cards));
    }

    if(s.subsections && s.subsections.length){
      for(const sub of s.subsections){
        const subId = sub.id || `${secId}-${slugify(sub.title)}`;
        const h3 = document.createElement("h3");
        h3.id = subId;
        h3.textContent = sub.title || "Subsection";
        sec.appendChild(h3);
        addToc(3, subId, sub.title || "Subsection");

        if(sub.paragraphs){
          for(const p of sub.paragraphs){
            const para = document.createElement("p");
            para.textContent = p;
            sec.appendChild(para);
          }
        }
        if(sub.bullets && sub.bullets.length){
          const ul = document.createElement("ul");
          for(const b of sub.bullets){
            const li = document.createElement("li");
            li.textContent = b;
            ul.appendChild(li);
          }
          sec.appendChild(ul);
        }
        if(sub.cards){
          sec.appendChild(renderCardsSection(sub.cards));
        }
      }
    }

    article.appendChild(sec);
  }

  renderToc(tocItems);
}

function renderToc(items){
  const ol = el("#tocList");
  ol.innerHTML = "";
  for(const it of items){
    const li = document.createElement("li");
    li.style.marginLeft = it.level === 3 ? "14px" : "0";
    li.innerHTML = `<a href="#${escapeHtml(it.id)}">${escapeHtml(it.label)}</a>`;
    ol.appendChild(li);
  }
}

function renderReferences(data){
  const list = el("#refsList");
  list.innerHTML = "";
  for(const r of (data.references || [])){
    const li = document.createElement("li");
    li.innerHTML = `${escapeHtml(r.label || "")} ${r.url ? `(<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">link</a>)` : ""}`;
    list.appendChild(li);
  }
}

function renderExternalLinks(data){
  const list = el("#externalLinks");
  list.innerHTML = "";
  for(const l of (data.externalLinks || [])){
    const li = document.createElement("li");
    li.innerHTML = linkify(l);
    list.appendChild(li);
  }
}

function setupSearch(){
  const input = el("#searchInput");
  const clear = el("#searchClear");
  if(!input) return;

  function setClear(){
    clear.hidden = !input.value;
  }

  function highlight(query){
    els("mark.search-hit").forEach(m => {
      const parent = m.parentNode;
      if(!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });

    if(!query) return;

    const q = query.trim();
    if(q.length < 2) return;

    const walker = document.createTreeWalker(el("#article"), NodeFilter.SHOW_TEXT);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig");

    let count = 0;
    const max = 30;

    while(walker.nextNode()){
      const node = walker.currentNode;
      if(!node.nodeValue || !re.test(node.nodeValue)) continue;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      node.nodeValue.replace(re, (match, idx) => {
        frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex, idx)));
        const mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.textContent = match;
        frag.appendChild(mark);
        lastIndex = idx + match.length;
        count++;
        return match;
      });
      frag.appendChild(document.createTextNode(node.nodeValue.slice(lastIndex)));
      node.parentNode.replaceChild(frag, node);
      if(count >= max) break;
    }
    if(count) toast(`Found ${count} match${count === 1 ? "" : "es"}.`);
    else toast("No matches found.");
  }

  input.addEventListener("input", () => {
    setClear();
    highlight(input.value);
  });

  clear.addEventListener("click", () => {
    input.value = "";
    setClear();
    highlight("");
    input.focus();
  });

  setClear();
}

function setupDownloads(){
  const dl = el("#downloadJson");
  if(dl){
    dl.addEventListener("click", async (e) => {
      e.preventDefault();
      const res = await fetch("./data/data.json", {cache:"no-store"});
      const text = await res.text();
      const blob = new Blob([text], {type:"application/json"});
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "data.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("Downloaded data.json");
    });
  }

  const printBtn = el("#printPage");
  if(printBtn){
    printBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.print();
    });
  }
}

async function init(){
  // Theme
  const saved = (() => { try { return localStorage.getItem("theme"); } catch(_) { return null; } })();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  setTheme(saved || (prefersDark ? "dark" : "light"));

  el("#toggleTheme")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    setTheme(current === "dark" ? "light" : "dark");
    toast("Theme updated.");
  });

  setupDownloads();
  setupSearch();

  // Load data
  const res = await fetch("./data/data.json", {cache:"no-store"});
  const data = await res.json();

  renderLead(data);
  renderInfobox(data);
  renderArticle(data);
  renderReferences(data);
  renderExternalLinks(data);
}

init().catch(err => {
  console.error(err);
  el("#articleTitle").textContent = "Failed to load data.json";
  el("#leadText").innerHTML = "<p>Check that <code>./data/data.json</code> exists and is valid JSON.</p>";
});
