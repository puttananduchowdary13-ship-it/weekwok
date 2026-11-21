/* WeekWok frontend. All data lives in SQLite behind the Express API:
   this file only signs in, fetches, renders and sends changes back. */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SESSIONS = ["Breakfast", "11 AM snack", "Lunch", "4 PM snack", "Dinner"];
const SESSION_LABEL = { "Breakfast": "🌅 Breakfast", "11 AM snack": "🍵 11 AM snack", "Lunch": "☀️ Lunch", "4 PM snack": "🍿 4 PM snack", "Dinner": "🌙 Dinner" };
const CATS = { T: "Tiffin", M: "Rice & mains", C: "Curries & sides", S: "Snacks & drinks", D: "Desserts" };
const TOKEN_KEY = "weekwok-token";

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const state = { recipes: [], pantry: [], plan: [], shopping: { items: [], total: 0 }, checked: {}, extras: [], user: "" };
try { state.extras = JSON.parse(sessionStorage.getItem("weekwok-extras") || "[]"); } catch { state.extras = []; }
const saveExtras = () => { try { sessionStorage.setItem("weekwok-extras", JSON.stringify(state.extras)); } catch { /* ignore */ } };

/* ---------- API ---------- */
async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch("/api" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/auth/")) showAuth();
  if (!res.ok) throw new Error((data && data.error) || "Request failed");
  return data;
}

async function refresh() {
  [state.recipes, state.pantry, state.plan, state.shopping] = await Promise.all([
    api("/recipes"), api("/pantry"), api("/plan"), api("/shopping"),
  ]);
  renderAll();
}

// Runs an API action, reloads everything, shows a toast. Returns undefined if it failed.
async function run(action, success) {
  try {
    const result = await action();
    await refresh();
    if (success) toast(typeof success === "function" ? success(result) : success);
    return result === undefined || result === null ? true : result;
  } catch (e) {
    toast(e.message, true);
    return undefined;
  }
}

/* ---------- helpers ---------- */
const recipeById = (id) => state.recipes.find((r) => r.id === Number(id));
const pantryItem = (name) => state.pantry.find((i) => i.name.toLowerCase() === name.toLowerCase());
const canCook = (r) => Object.entries(r.ingredients).every(([n, q]) => ((pantryItem(n) || {}).qty || 0) >= q);
const step = (unit) => (unit === "pcs" ? 1 : 100);
function fmt(q, u) {
  if (u === "g" && q >= 1000) return +(q / 1000).toFixed(2) + " kg";
  if (u === "ml" && q >= 1000) return +(q / 1000).toFixed(2) + " L";
  return Math.round(q * 10) / 10 + " " + u;
}
const RECIPE_EMOJI = [
  [/biryani|pulao|pulav|khichdi|rice/i, "🍛"], [/idli|dosa|ponganalu|pancake|waffle/i, "🥞"], [/puri|chapati|parota|paratha|roti/i, "🫓"],
  [/sambar|dal|curry/i, "🍲"], [/paneer/i, "🧀"], [/egg|omelette/i, "🍳"], [/pickle/i, "🫙"], [/samosa/i, "🥟"],
  [/tea|coffee|buttermilk/i, "☕"], [/noodle/i, "🍜"], [/popcorn/i, "🍿"], [/halwa|jamun|payasam|kesari|laddu|sweet/i, "🍮"],
  [/chips|murukulu|chekkalu|mixture|pakodi|bajji|bonda|vada|fritters|manchuria/i, "🥨"],
];
const CAT_EMOJI = { T: "🥞", M: "🍛", C: "🍲", S: "🍿", D: "🍮" };
const recipeEmoji = (r) => (RECIPE_EMOJI.find(([re]) => re.test(r.name)) || [0, CAT_EMOJI[r.category] || "🍽️"])[1];
const ITEM_EMOJI = [
  [/rice/i, "🍚"], [/flour|maida|besan|sooji|semiya/i, "🌾"], [/dal/i, "🫘"], [/oil/i, "🛢️"], [/onion/i, "🧅"], [/tomato/i, "🍅"],
  [/potato/i, "🥔"], [/egg/i, "🥚"], [/milk/i, "🥛"], [/paneer/i, "🧀"], [/butter|ghee/i, "🧈"], [/curd/i, "🍶"], [/chicken/i, "🍗"],
  [/carrot/i, "🥕"], [/peas|beans/i, "🫛"], [/cabbage|cauliflower|gongura/i, "🥬"], [/brinjal/i, "🍆"], [/capsicum/i, "🫑"],
  [/chilli|masala|turmeric|powder/i, "🌶️"], [/lemon/i, "🍋"], [/sugar|jaggery/i, "🍬"], [/tea|coffee/i, "☕"], [/peanut/i, "🥜"],
  [/noodle/i, "🍜"], [/corn/i, "🌽"], [/banana/i, "🍌"], [/pickle|tamarind/i, "🫙"], [/garlic/i, "🧄"], [/bread/i, "🍞"],
];
const itemEmoji = (name) => (ITEM_EMOJI.find(([re]) => re.test(name)) || [0, "🛍️"])[1];

let toastTimer;
function toast(msg, warn) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast show" + (warn ? " warn" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3800);
}

/* ---------- plan actions ---------- */
async function assign(day, session, recipeId) {
  const before = Object.fromEntries(state.shopping.items.map((i) => [i.name, i.quantity]));
  const ok = await run(() => api("/plan", { method: "POST", body: { day, session, recipeId: Number(recipeId) } }));
  if (!ok) return null;
  const added = state.shopping.items.filter((i) => !(i.name in before) || i.quantity > before[i.name]);
  const msg = added.length
    ? "🛒 Added to grocery list: " + added.map((i) => fmt(i.quantity - (before[i.name] || 0), i.unit) + " " + i.name).join(", ")
    : "✅ " + recipeById(recipeId).name + " added — everything in stock!";
  toast(msg);
  return msg;
}
const moveMeal = (id, day, session) => run(() => api("/plan/" + id, { method: "PATCH", body: { day, session } }));
const cookMeal = (id) => run(() => api("/plan/" + id + "/cook", { method: "POST" }), (r) => "🍳 Cooked " + r.recipe + " — pantry updated");
const removeMeal = (id) => run(() => api("/plan/" + id, { method: "DELETE" }), "↩️ Meal removed — nothing was deducted");

/* ---------- render ---------- */
function renderStats() {
  $("#stMeals").textContent = state.plan.filter((m) => !m.done).length;
  $("#stLow").textContent = state.pantry.filter((i) => i.status !== "ok" || i.afterPlan <= i.low).length;
  $("#stExp").textContent = state.pantry.filter((i) => i.daysLeft !== null && i.daysLeft <= 3).length;
  $("#stCost").textContent = "₹" + Math.round(state.shopping.total);
  $("#gBadge").textContent = state.shopping.items.length + state.extras.length;
}

function recipeCard(r) {
  return `<div class="rc tilt" draggable="true" data-rid="${r.id}">
    ${canCook(r) ? '<span class="badge">✨ Cook now</span>' : ""}<span class="em">${recipeEmoji(r)}</span>
    <b>${esc(r.name)}</b><small>⏱ ${r.minutes} min · 👥 ${r.serves}</small>
    <button class="btn sm" data-act="assign" data-rid="${r.id}">＋ Add to…</button></div>`;
}
function renderTray() {
  const q = $("#tSearch").value.toLowerCase(), c = $("#tCat").value;
  const list = state.recipes.filter((r) => (!c || r.category === c) &&
    (r.name.toLowerCase().includes(q) || Object.keys(r.ingredients).some((n) => n.toLowerCase().includes(q))));
  $("#tray").innerHTML = list.map(recipeCard).join("") || '<div class="empty">No recipes match.</div>';
}

function renderBoard() {
  let html = "<div></div>" + DAYS.map((d) => `<div class="hd">${d.slice(0, 3)}</div>`).join("");
  for (const s of SESSIONS) {
    html += `<div class="rowlab">${SESSION_LABEL[s]}</div>`;
    for (const d of DAYS) {
      const meals = state.plan.filter((m) => m.day === d && m.session === s);
      html += `<div class="slot" data-day="${d}" data-session="${s}">` + meals.map((m) => {
        const r = recipeById(m.recipeId);
        const flagged = m.short && !m.done;
        return `<div class="chip ${flagged ? "short" : ""} ${m.done ? "done" : ""}" draggable="${!m.done}" data-meal="${m.id}" title="${flagged ? "Missing ingredients" : ""}">
          <span class="em">${recipeEmoji(r)}</span><span class="nm">${flagged ? "⚠ " : ""}${esc(r.name)}</span>
          <span class="acts">${m.done ? "" : `<button data-act="cook" data-id="${m.id}" title="Mark cooked (deducts stock)">✓</button>`}<button data-act="rm" data-id="${m.id}" title="Remove">✕</button></span></div>`;
      }).join("") + `<button class="add" data-act="add" data-day="${d}" data-session="${s}">＋ Add</button></div>`;
    }
  }
  $("#board").innerHTML = html;
}

function renderPantry() {
  $("#pantryGrid").innerHTML = state.pantry.map((i) => {
    const reserved = i.qty - i.afterPlan;
    let tags = i.status === "out" ? '<span class="tag out">Out of stock</span>'
      : i.status === "low" ? '<span class="tag low">⚠ Low stock</span>' : '<span class="tag ok">In stock</span>';
    if (i.daysLeft !== null && i.daysLeft <= 3) {
      tags += `<span class="tag exp">⏰ ${i.daysLeft < 0 ? "Expired" : i.daysLeft === 0 ? "Expires today" : "Expires in " + i.daysLeft + "d"}</span>`;
    }
    if (i.afterPlan < 0) tags += `<span class="tag out">Short ${fmt(-i.afterPlan, i.unit)}</span>`;
    const pct = i.qty <= 0 ? 4 : Math.max(4, Math.min(100, (i.qty / Math.max(i.low * 4, i.qty, 1)) * 100));
    return `<div class="card tilt"><button class="rm" data-act="del" data-id="${i.id}" title="Remove item">✕</button>
      <h3><span class="em">${itemEmoji(i.name)}</span>${esc(i.name)}</h3>${tags}
      <div class="qty"><button data-act="dec" data-id="${i.id}">−</button><b>${fmt(i.qty, i.unit)}</b><button data-act="inc" data-id="${i.id}">+</button></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="meta">Reserved by plan: ${fmt(Math.max(0, reserved), i.unit)} · After plan: ${i.afterPlan < 0 ? "−" + fmt(-i.afterPlan, i.unit) : fmt(i.afterPlan, i.unit)}</div></div>`;
  }).join("");
}

function renderRecipes() {
  const c = $("#rCat").value;
  $("#recipeGrid").innerHTML = state.recipes.filter((r) => !c || r.category === c).map((r) => `
    <div class="card tilt"><h3><span class="em">${recipeEmoji(r)}</span>${esc(r.name)}</h3>
      <div class="meta"><span class="tag cat">${CATS[r.category]}</span>⏱ ${r.minutes} min · 👥 serves ${r.serves} ${canCook(r) ? '<span class="tag ok">Cook now</span>' : ""}</div>
      <div class="ing">${Object.entries(r.ingredients).map(([n, q]) => `${itemEmoji(n)} ${esc(n)} <b>${fmt(q, (pantryItem(n) || {}).unit || "g")}</b>`).join("<br>")}</div>
      <button class="btn sm" style="margin-top:12px" data-act="assign" data-rid="${r.id}">＋ Add to planner</button></div>`).join("");
}

function renderGrocery() {
  const l = $("#groceryList");
  let html = "";
  if (!state.shopping.items.length && !state.extras.length) html = '<div class="empty">🎉 Nothing to buy — plan a meal to see missing ingredients here.</div>';
  for (const g of state.shopping.items) {
    const done = state.checked[g.name];
    html += `<div class="gi tilt ${done ? "done" : ""}"><input type="checkbox" data-act="tick" data-name="${esc(g.name)}" ${done ? "checked" : ""}>
      <span>${itemEmoji(g.name)} ${esc(g.name)} — <b>${fmt(g.quantity, g.unit)}</b></span><i class="p">₹${Math.round(g.cost)}</i></div>`;
  }
  state.extras.forEach((x, idx) => {
    html += `<div class="gi ${x.done ? "done" : ""}"><input type="checkbox" data-act="xtick" data-idx="${idx}" ${x.done ? "checked" : ""}>
      <span>🍿 ${esc(x.name)} <small>(snack)</small></span><button class="del" data-act="xdel" data-idx="${idx}">✕</button></div>`;
  });
  l.innerHTML = html;
  $("#gTotal").textContent = "₹" + Math.round(state.shopping.total);
}

function renderAll() { renderStats(); renderTray(); renderBoard(); renderPantry(); renderRecipes(); renderGrocery(); bindTilt(); }

/* ---------- modals ---------- */
const openModal = (html) => { $("#modalCard").innerHTML = html; $("#modal").classList.add("open"); };
const closeModal = () => $("#modal").classList.remove("open");
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });

function openPicker(day, session) {            // tap "+ Add" on a slot: pick one or several recipes
  const defaultCat = session === "Breakfast" ? "T" : session.includes("snack") ? "S" : "M";
  openModal(`<h2>${day} · ${SESSION_LABEL[session]}</h2>
    <div class="inline-form"><select id="pCat"><option value="">All</option>${Object.entries(CATS).map(([c, t]) => `<option value="${c}">${t}</option>`).join("")}</select>
    <input id="pQ" placeholder="Search…" /></div><div id="pList"></div><p class="meta" id="pMsg">Tap items to add them — you can add several.</p>
    <button class="btn" id="pDone">Done</button>`);
  $("#pCat").value = defaultCat;
  const draw = () => {
    const c = $("#pCat").value, q = $("#pQ").value.toLowerCase();
    $("#pList").innerHTML = state.recipes.filter((r) => (!c || r.category === c) && r.name.toLowerCase().includes(q)).map((r) =>
      `<button class="pick" data-rid="${r.id}"><span class="em">${recipeEmoji(r)}</span><span><b>${esc(r.name)}</b><br><small>⏱ ${r.minutes} min${canCook(r) ? " · ✨ cook now" : ""}</small></span></button>`).join("") || '<div class="empty">No match.</div>';
  };
  draw();
  $("#pCat").onchange = draw; $("#pQ").oninput = draw;
  $("#pList").onclick = async (e) => {
    const b = e.target.closest(".pick"); if (!b) return;
    const msg = await assign(day, session, b.dataset.rid);
    if (msg) { $("#pMsg").textContent = msg; draw(); }
  };
  $("#pDone").onclick = closeModal;
}

function openAssign(rid) {                     // "Add to Tuesday Lunch" for touch screens
  const r = recipeById(rid);
  openModal(`<h2>${recipeEmoji(r)} ${esc(r.name)}</h2>
    <p class="meta">Needs: ${Object.entries(r.ingredients).map(([n, q]) => fmt(q, (pantryItem(n) || {}).unit || "g") + " " + esc(n)).join(", ")}</p>
    <div class="inline-form" style="margin-top:14px"><select id="aDay">${DAYS.map((d) => `<option>${d}</option>`).join("")}</select>
    <select id="aSes">${SESSIONS.map((s) => `<option value="${s}">${SESSION_LABEL[s]}</option>`).join("")}</select><button class="btn" id="aGo">Add</button></div>`);
  $("#aGo").onclick = async () => { const d = $("#aDay").value, s = $("#aSes").value; closeModal(); await assign(d, s, rid); };
}

/* ---------- events (delegated, so re-rendering never loses them) ---------- */
let drag = null;
document.addEventListener("dragstart", (e) => {
  const chip = e.target.closest && e.target.closest(".chip"), rc = e.target.closest && e.target.closest(".rc");
  drag = chip ? { meal: chip.dataset.meal } : rc ? { rid: rc.dataset.rid } : null;
  if (drag) e.dataTransfer.setData("text/plain", "weekwok");
});
document.addEventListener("dragover", (e) => { const s = e.target.closest && e.target.closest(".slot"); if (s) { e.preventDefault(); s.classList.add("over"); } });
document.addEventListener("dragleave", (e) => { const s = e.target.closest && e.target.closest(".slot"); if (s) s.classList.remove("over"); });
document.addEventListener("drop", async (e) => {
  const s = e.target.closest && e.target.closest(".slot");
  if (!s || !drag) return;
  e.preventDefault(); s.classList.remove("over");
  const d = drag; drag = null;
  if (d.meal) await moveMeal(d.meal, s.dataset.day, s.dataset.session);
  else await assign(s.dataset.day, s.dataset.session, d.rid);
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (b) {
    const { act, id, rid, day, session } = b.dataset;
    if (act === "cook") return cookMeal(id);
    if (act === "rm") return removeMeal(id);
    if (act === "add") return openPicker(day, session);
    if (act === "assign") return openAssign(rid);
    if (act === "inc" || act === "dec") {
      const item = state.pantry.find((i) => i.id === Number(id));
      return run(() => api("/pantry/" + id, { method: "PATCH", body: { delta: (act === "inc" ? 1 : -1) * step(item.unit) } }));
    }
    if (act === "del") return run(() => api("/pantry/" + id, { method: "DELETE" }), "🗑️ Item removed");
    if (act === "tick") { state.checked[b.dataset.name] = b.checked; return renderGrocery(); }
    if (act === "xtick") { state.extras[b.dataset.idx].done = b.checked; saveExtras(); return renderGrocery(); }
    if (act === "xdel") { state.extras.splice(b.dataset.idx, 1); saveExtras(); return renderAll(); }
  }
  const slot = e.target.closest(".slot");               // tap an empty slot
  if (slot && !e.target.closest(".chip") && !slot.querySelector(".chip")) openPicker(slot.dataset.day, slot.dataset.session);
});

document.querySelectorAll(".tab").forEach((t) => (t.onclick = () => {
  document.querySelectorAll(".tab,.view").forEach((x) => x.classList.remove("active"));
  t.classList.add("active"); $("#" + t.dataset.view).classList.add("active");
}));

$("#tSearch").oninput = renderTray; $("#tCat").onchange = renderTray; $("#rCat").onchange = renderRecipes;
const catOptions = '<option value="">All categories</option>' + Object.entries(CATS).map(([c, t]) => `<option value="${c}">${t}</option>`).join("");
$("#tCat").innerHTML = catOptions; $("#rCat").innerHTML = catOptions;

$("#btnClear").onclick = () => run(() => api("/plan", { method: "DELETE" }), "🧹 Plan cleared");
$("#btnReset").onclick = () => run(() => api("/demo/reset", { method: "POST" }), "♻️ Demo data restored");

$("#addIngForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#newIngName").value.trim();
  const ok = await run(() => api("/pantry", { method: "POST", body: {
    name, quantity: $("#newIngQty").value, unit: $("#newIngUnit").value, expiry: $("#newIngExp").value, price: $("#newIngPrice").value } }),
    "➕ " + name + " added to pantry");
  if (ok) e.target.reset();
};
$("#snackForm").onsubmit = (e) => {
  e.preventDefault();
  state.extras.push({ name: $("#snackName").value.trim(), done: false }); saveExtras();
  e.target.reset(); renderAll();
};
$("#btnRestock").onclick = () => {
  const items = state.shopping.items.filter((g) => state.checked[g.name]);
  if (!items.length) return toast("Tick some items first ☑️", true);
  run(async () => {
    for (const g of items) await api("/pantry", { method: "POST", body: { name: g.name, quantity: g.quantity, unit: g.unit } });
    state.checked = {};
  }, "📦 " + items.length + " item(s) added to pantry");
};
$("#btnWA").onclick = () => {
  let txt = "🛒 *WeekWok Grocery List*\n━━━━━━━━━━━━━━\n" +
    state.shopping.items.map((g) => `${itemEmoji(g.name)} ${g.name} — ${fmt(g.quantity, g.unit)}`).join("\n");
  if (state.extras.length) txt += "\n\n🍿 *Snacks*\n" + state.extras.map((x) => "• " + x.name).join("\n");
  txt += `\n━━━━━━━━━━━━━━\n💰 Est. total: ₹${Math.round(state.shopping.total)}`;
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("💬 Copied! Paste it in WhatsApp"), () => {});
  window.open("https://wa.me/?text=" + encodeURIComponent(txt), "_blank");
};

/* ---------- sign in / out ---------- */
const showAuth = () => { $("#auth").hidden = false; $("#user").focus(); };
async function authenticate(path) {
  $("#authErr").textContent = "";
  try {
    const data = await api(path, { method: "POST", body: { username: $("#user").value, password: $("#pass").value } });
    localStorage.setItem(TOKEN_KEY, data.token);
    $("#pass").value = "";
    await enterApp(data.username);
  } catch (e) { $("#authErr").textContent = e.message; }
}
async function enterApp(username) {
  state.user = username; $("#who").textContent = username; $("#auth").hidden = true;
  try { await refresh(); } catch (e) { toast(e.message, true); }
}
$("#btnLogin").onclick = () => authenticate("/auth/login");
$("#btnRegister").onclick = () => authenticate("/auth/register");
$("#pass").addEventListener("keydown", (e) => { if (e.key === "Enter") authenticate("/auth/login"); });
$("#btnLogout").onclick = async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch { /* token may already be invalid */ }
  localStorage.removeItem(TOKEN_KEY);
  Object.assign(state, { recipes: [], pantry: [], plan: [], shopping: { items: [], total: 0 }, checked: {}, user: "" });
  renderAll(); showAuth();
};
(async () => {
  if (!localStorage.getItem(TOKEN_KEY)) return showAuth();
  try { const me = await api("/auth/me"); await enterApp(me.username); } catch { showAuth(); }
})();

/* ---------- 3D tilt + parallax ---------- */
function bindTilt() {
  document.querySelectorAll(".tilt").forEach((el) => {
    if (el._t) return; el._t = 1;
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${-y * 14}deg) rotateY(${x * 14}deg) translateZ(14px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
}
document.addEventListener("pointermove", (e) => {
  const x = (e.clientX / innerWidth - 0.5) * 30, y = (e.clientY / innerHeight - 0.5) * 30;
  $(".orbs").style.transform = `translate(${x}px,${y}px)`;
});
