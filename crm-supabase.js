/* ==========================================================================
 * CRM – Conexión a Supabase
 * ========================================================================== */
const SUPABASE_URL = "https://mdzhmkavrruiaacohspn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_NcVRaPwfSKvTdw9WZcJzEw_YA3iQ3b1";
const SUPABASE_TABLE = "clientes";

let supabaseClient = null;
let clients = [];
let connectionOk = false;

function getClientId(obj) {
  if (!obj) return "";
  return String(obj.idCliente ?? obj.idcliente ?? obj.id ?? "");
}

function matchesClientId(obj, id) {
  return getClientId(obj) === String(id);
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  try {
    if (typeof supabase !== "undefined") {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (e) {
    console.error("[CRM] Error al crear cliente Supabase:", e);
    supabaseClient = null;
  }
  return supabaseClient;
}

function isConfigured() {
  const client = getSupabaseClient();
  return !!client && SUPABASE_URL && SUPABASE_URL.indexOf("TU_PROYECTO") === -1;
}

/* ---------------------------------------------------------------------------
 * API Supabase
 * ------------------------------------------------------------------------- */

async function apiGetClientes() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data, error } = await client.from(SUPABASE_TABLE).select("*");
  if (error) throw new Error(error.message || "Error al obtener clientes.");
  return { success: true, data: data || [] };
}

async function apiCrearCliente(data) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data: row, error } = await client.from(SUPABASE_TABLE).insert([data]).select().single();
  if (error) throw new Error(error.message || "Error al crear cliente.");
  return row;
}

async function apiActualizarCliente(id, data) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data: row, error } = await client.from(SUPABASE_TABLE).update(data).eq("idcliente", id).select().single();
  if (error) throw new Error(error.message || "Error al actualizar cliente.");
  return row;
}

async function apiEliminarCliente(id) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { error } = await client.from(SUPABASE_TABLE).delete().eq("idcliente", id);
  if (error) throw new Error(error.message || "Error al eliminar cliente.");
  return { success: true };
}

/* ---------------------------------------------------------------------------
 * API Compras
 * ------------------------------------------------------------------------- */

async function apiGetCompras(idCliente) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data, error } = await client.from("compras").select("*").eq("idcliente", idCliente).order("fecha", { ascending: false });
  if (error) throw new Error(error.message || "Error al obtener compras.");
  return data || [];
}

async function apiCrearCompra(idCliente, data) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data: row, error } = await client.from("compras").insert([{ ...data, idcliente: idCliente }]).select().single();
  if (error) throw new Error(error.message || "Error al crear compra.");
  return row;
}

async function apiActualizarCompra(idCompra, data) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data: row, error } = await client.from("compras").update(data).eq("idcompra", idCompra).select().single();
  if (error) throw new Error(error.message || "Error al actualizar compra.");
  return row;
}

async function apiEliminarCompra(idCompra) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { error } = await client.from("compras").delete().eq("idcompra", idCompra);
  if (error) throw new Error(error.message || "Error al eliminar compra.");
  return { success: true };
}

async function updateClientAfterPurchaseChange(idCliente) {
  const compras = await apiGetCompras(idCliente);
  
  let clientData;
  if (compras.length === 0) {
    clientData = {
      monto_gastado: 0,
      producto_comprado: null,
      fechaultima_compra: null
    };
  } else {
    const totalMonto = compras.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
    const ultimaCompra = compras[0];
    clientData = {
      monto_gastado: totalMonto,
      producto_comprado: ultimaCompra.producto,
      fechaultima_compra: ultimaCompra.fecha
    };
  }
  
  await apiActualizarCliente(idCliente, clientData);
  
  const clientIdx = clients.findIndex(c => matchesClientId(c, idCliente));
  if (clientIdx > -1) {
    clients[clientIdx] = { ...clients[clientIdx], ...clientData };
  }
}

/* ---------------------------------------------------------------------------
 * Estado / Banners
 * ------------------------------------------------------------------------- */

function setConnectionState(state, text) {
  const el = document.getElementById("connStatus");
  if (!el) return;
  el.className = "conn-status " + state;
  const txt = document.getElementById("connStatusText");
  if (txt) txt.textContent = text;
}

function renderBanner(html) {
  const area = document.getElementById("bannerArea");
  if (area) area.innerHTML = html || "";
}

function setupBanner() {
  return `
    <div class="banner warn">
      <div class="glyph">⚙️</div>
      <div>
        <b>Falta configurar Supabase</b>
        Reemplazá <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> en <code>crm-supabase.js</code> por tus credenciales.
      </div>
    </div>`;
}

function connectionErrorBanner(message) {
  return `
    <div class="banner bad">
      <div class="glyph">⚠️</div>
      <div>
        <b>No se pudo conectar con Supabase</b>
        ${escapeHtml(message)}<br>
        Verificá que la tabla <code>${SUPABASE_TABLE}</code> exista, tenga RLS activado y politicas correctas.
        <div class="banner-actions">
          <button class="btn btn-ghost btn-sm" id="retryConnBtn" type="button">Reintentar</button>
        </div>
      </div>
    </div>`;
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[s]));
}

/* ---------------------------------------------------------------------------
 * Carga inicial
 * ------------------------------------------------------------------------- */

async function loadClients() {
  const urlNote = document.getElementById("apiUrlNote");
  if (urlNote) urlNote.textContent = isConfigured() ? SUPABASE_URL : "(sin configurar)";

  if (!isConfigured()) {
    connectionOk = false;
    clients = [];
    setConnectionState("error", "Sin configurar");
    renderBanner(setupBanner());
    renderAll();
    return;
  }

  setConnectionState("loading", "Conectando…");
  try {
    const json = await apiGetClientes();
    clients = json.data || [];
    console.log("[CRM] Clientes cargados:", clients.length, clients.slice(0, 2));
    connectionOk = true;
    setConnectionState("ok", "Conectado");
    renderBanner("");
  } catch (err) {
    connectionOk = false;
    clients = [];
    setConnectionState("error", "Sin conexión");
    renderBanner(connectionErrorBanner(err.message));
    const retryBtn = document.getElementById("retryConnBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", async () => {
        await loadClients();
      });
    }
  }
  renderAll();
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function calcAge(dateStr) {
  if (!dateStr) return null;
  const b = new Date(dateStr + "T00:00:00");
  if (isNaN(b)) return null;
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age >= 0 ? age : null;
}

function getAge(c) {
  return (c.edad !== undefined && c.edad !== "" && c.edad !== null) ? c.edad : calcAge(c.fechanacimiento);
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function estadoFor(dateStr) {
  const days = daysSince(dateStr);
  if (days === null) return "Inactivo";
  if (days <= 30) return "Activo";
  if (days <= 90) return "En seguimiento";
  return "Inactivo";
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("es-AR");
}

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function waLink(phone) {
  const digits = (phone || "").replace(/[^\d]/g, "");
  return digits ? "https://wa.me/" + digits : null;
}

let toastTimer = null;
function showToast(msg, isError) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  if (!toast || !toastMsg) return;
  toastMsg.textContent = msg;
  toast.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function updateAgeReadout() {
  const input = document.getElementById("f_nacimiento");
  const readout = document.getElementById("ageReadout");
  if (!input || !readout) return;
  const age = calcAge(input.value);
  readout.textContent = age !== null ? "Edad: " + age + " años" : "Edad: —";
}

/* ---------------------------------------------------------------------------
 * Render
 * ------------------------------------------------------------------------- */

function renderKpis() {
  const total = clients.length;
  const ingresos = clients.reduce((s, c) => s + (Number(c.monto_gastado) || 0), 0);
  const ticket = total ? ingresos / total : 0;
  const activos = clients.filter(c => estadoFor(c.fechaultima_compra) === "Activo").length;

  const kpis = document.getElementById("kpis");
  if (!kpis) return;
  kpis.innerHTML = `
    <div class="kpi">
      <div class="label">Total de clientes</div>
      <div class="value">${total}</div>
      <div class="sub">Registros en Supabase</div>
    </div>
    <div class="kpi">
      <div class="label">Ingresos totales</div>
      <div class="value">${fmtMoney(ingresos)}</div>
      <div class="sub">Suma de montos gastados</div>
    </div>
    <div class="kpi">
      <div class="label">Ticket promedio</div>
      <div class="value">${fmtMoney(ticket)}</div>
      <div class="sub">Por cliente</div>
    </div>
    <div class="kpi accent">
      <div class="label">Clientes activos</div>
      <div class="value">${activos}</div>
      <div class="sub">Compraron en los últimos 30 días</div>
    </div>`;
}

function renderFilterOptions() {
  const localidadSel = document.getElementById("filterLocalidad");
  const canalSel = document.getElementById("filterCanal");
  if (!localidadSel || !canalSel) return;
  const prevLoc = localidadSel.value;
  const prevCanal = canalSel.value;

  const localidades = Array.from(new Set(clients.map(c => c.localidad).filter(Boolean))).sort();
  const canales = Array.from(new Set(clients.map(c => c.canal_contacto).filter(Boolean))).sort();

  localidadSel.innerHTML = `<option value="">Todas las localidades</option>` +
    localidades.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");
  canalSel.innerHTML = `<option value="">Todos los canales</option>` +
    canales.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  if (localidades.includes(prevLoc)) localidadSel.value = prevLoc;
  if (canales.includes(prevCanal)) canalSel.value = prevCanal;

  const dl = document.getElementById("localidadOptions");
  if (dl) dl.innerHTML = localidades.map(l => `<option value="${escapeHtml(l)}">`).join("");
}

function renderTable() {
  const resultCount = document.getElementById("resultCount");
  const tableArea = document.getElementById("tableArea");
  if (!tableArea) return;

  if (!connectionOk) {
    if (resultCount) resultCount.textContent = "";
    tableArea.innerHTML = `
      <div class="empty-state">
        <div class="glyph">🔌</div>
        <h3>Sin conexión con Supabase</h3>
        <p>Revisá el mensaje de arriba para configurar la conexión.</p>
      </div>`;
    return;
  }

  const list = getFilteredSorted();
  if (resultCount) resultCount.textContent = list.length + " de " + clients.length + " cliente" + (clients.length === 1 ? "" : "s");

  if (clients.length === 0) {
    tableArea.innerHTML = `
      <div class="empty-state">
        <div class="glyph">🗂️</div>
        <h3>Todavía no hay clientes</h3>
        <p>Agregá el primero para empezar a construir tu base.</p>
        <button class="btn btn-primary" id="emptyNewBtn" type="button">+ Nuevo cliente</button>
      </div>`;
    const emptyBtn = document.getElementById("emptyNewBtn");
    if (emptyBtn) emptyBtn.addEventListener("click", openNewForm);
    return;
  }
  if (list.length === 0) {
    tableArea.innerHTML = `
      <div class="empty-state">
        <div class="glyph">🔍</div>
        <h3>Sin resultados</h3>
        <p>Probá ajustar la búsqueda o los filtros.</p>
      </div>`;
    return;
  }

  const columns = [
    { key: "nombreapellido", label: "Cliente", sortable: true },
    { key: "edad", label: "Edad", sortable: true },
    { key: "contacto", label: "Contacto" },
    { key: "fechaultima_compra", label: "Última compra", sortable: true },
    { key: "producto_comprado", label: "Producto" },
    { key: "monto_gastado", label: "Monto", sortable: true },
    { key: "estado", label: "Estado" },
    { key: "acciones", label: "" },
  ];

  const thead = columns.map((c) => {
    if (!c.sortable) return "<th>" + c.label + "</th>";
    const arrow = sortState.key === c.key ? (sortState.dir === 1 ? "▲" : "▼") : "";
    return `<th class="sortable" data-key="${c.key}">${c.label}<span class="arrow">${arrow}</span></th>`;
  }).join("");

  const rows = list.map((c) => {
    const age = getAge(c);
    const estado = estadoFor(c.fechaultima_compra);
    const estadoClass = estado.replace(" ", "-");
    const wa = waLink(c.telefono);
    const idStr = getClientId(c);
    return `
      <tr class="state-${estadoClass}">
        <td>
          <div class="cell-name">${escapeHtml(c.nombreapellido)}</div>
          <div class="cell-sub"><span class="id-pill">${escapeHtml(idStr)}</span> ${escapeHtml(c.localidad || "—")}</div>
        </td>
        <td>${age ?? "—"}</td>
        <td>
          <div class="cell-sub">${escapeHtml(c.telefono || "—")}</div>
          <div class="cell-sub">${escapeHtml(c.correo || "")}</div>
        </td>
        <td>
          <div>${fmtDate(c.fechaultima_compra)}</div>
          <div class="cell-sub">${escapeHtml(c.frecuencia_compra || "")}</div>
        </td>
        <td>${escapeHtml(c.producto_comprado || "—")}</td>
        <td class="amount">${fmtMoney(c.monto_gastado)}</td>
        <td>
          <select class="estado-select" data-action="set-estado" data-id="${escapeHtml(idStr)}" title="Cambiar estado">
            <option value="Activo" ${estado === "Activo" ? "selected" : ""}>Activo</option>
            <option value="En seguimiento" ${estado === "En seguimiento" ? "selected" : ""}>En seguimiento</option>
            <option value="Inactivo" ${estado === "Inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </td>
        <td>
          <div class="row-actions">
            ${wa ? `<a class="icon-btn whatsapp" href="${wa}" target="_blank" rel="noopener" title="Abrir WhatsApp" aria-label="Abrir WhatsApp">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.45 1.33 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.5 0 9.96-4.46 9.96-9.96S17.54 2 12.04 2zm0 18.2h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.23 8.23 0 0 1-1.26-4.38c0-4.55 3.7-8.25 8.25-8.25 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.42 5.83c0 4.55-3.71 8.24-8.26 8.24zm4.52-6.16c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.13-.16.25-.64.8-.78.96-.14.16-.29.18-.54.06-.25-.12-1.04-.38-1.99-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.16.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43-.14 0-.31-.01-.47-.01-.16 0-.43.06-.66.31-.23.25-.86.84-.86 2.04 0 1.2.88 2.37 1 2.53.12.16 1.73 2.64 4.2 3.7.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.46-.6 1.66-1.17.21-.58.21-1.07.14-1.17-.06-.11-.22-.17-.47-.29z"/></svg>
            </a>` : ""}
            <button class="icon-btn purchases" data-action="purchases" data-id="${escapeHtml(idStr)}" title="Compras" aria-label="Ver compras">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            </button>
            <button class="icon-btn" data-action="edit" data-id="${escapeHtml(idStr)}" title="Editar" aria-label="Editar cliente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger" data-action="delete" data-id="${escapeHtml(idStr)}" title="Eliminar" aria-label="Eliminar cliente">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join("");

  const headHtml = `<thead><tr>${thead}</tr></thead>`;
  tableArea.innerHTML = `<div class="table-scroll"><table>${headHtml}<tbody>${rows}</tbody></table></div>`;

  tableArea.querySelectorAll("thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (sortState.key === key) sortState.dir *= -1;
      else { sortState.key = key; sortState.dir = 1; }
      renderTable();
    });
  });
  // Fallback: add per-button listeners in case delegated listener doesn't catch some events
  try {
    tableArea.querySelectorAll("[data-action='edit']").forEach((btn) => {
      btn.removeEventListener("click", btn._crm_edit_handler);
      const handler = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!id) console.warn("[CRM] Edit button without id", btn);
        console.log("[CRM] Per-button EDIT click, id=", id);
        openEditForm(id);
      };
      btn._crm_edit_handler = handler;
      btn.addEventListener("click", handler);
    });
    tableArea.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.removeEventListener("click", btn._crm_delete_handler);
      const handler = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (!id) console.warn("[CRM] Delete button without id", btn);
        console.log("[CRM] Per-button DELETE click, id=", id);
        openDeleteConfirm(id);
      };
      btn._crm_delete_handler = handler;
      btn.addEventListener("click", handler);
    });
  } catch (err) {
    console.warn("[CRM] Error al vincular handlers por botón:", err);
  }

}

function renderAll() {
  renderKpis();
  renderFilterOptions();
  renderTable();
}

/* ---------------------------------------------------------------------------
 * Filtros / orden
 * ------------------------------------------------------------------------- */

let sortState = { key: "nombreapellido", dir: 1 };
let editingId = null;
let deletingId = null;

function currentFilters() {
  const searchInput = document.getElementById("searchInput");
  const filterLocalidad = document.getElementById("filterLocalidad");
  const filterCanal = document.getElementById("filterCanal");
  const filterEstado = document.getElementById("filterEstado");
  return {
    q: searchInput ? searchInput.value.trim().toLowerCase() : "",
    localidad: filterLocalidad ? filterLocalidad.value : "",
    canal: filterCanal ? filterCanal.value : "",
    estado: filterEstado ? filterEstado.value : "",
  };
}

function getFilteredSorted() {
  const f = currentFilters();
  let list = clients.filter((c) => {
    const estado = estadoFor(c.fechaultima_compra);
    if (f.localidad && c.localidad !== f.localidad) return false;
    if (f.canal && c.canal_contacto !== f.canal) return false;
    if (f.estado && estado !== f.estado) return false;
    if (f.q) {
      const hay = `${c.nombreapellido || ""} ${c.correo || ""} ${c.telefono || ""} ${c.localidad || ""} ${c.producto_comprado || ""}`.toLowerCase();
      if (!hay.includes(f.q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    let va, vb;
    switch (sortState.key) {
      case "nombreapellido": va = (a.nombreapellido || "").toLowerCase(); vb = (b.nombreapellido || "").toLowerCase(); break;
      case "edad": va = getAge(a) ?? -1; vb = getAge(b) ?? -1; break;
      case "fechaultima_compra": va = a.fechaultima_compra || ""; vb = b.fechaultima_compra || ""; break;
      case "monto_gastado": va = Number(a.monto_gastado) || 0; vb = Number(b.monto_gastado) || 0; break;
      default: va = ""; vb = "";
    }
    if (va < vb) return -1 * sortState.dir;
    if (va > vb) return 1 * sortState.dir;
    return 0;
  });
  return list;
}

/* ---------------------------------------------------------------------------
 * Modal: alta / edicion
 * ------------------------------------------------------------------------- */

function clearFormErrors() {
  document.querySelectorAll("#clientForm .field").forEach((f) => f.classList.remove("error"));
  const formError = document.getElementById("formError");
  if (formError) formError.textContent = "";
}

function fillForm(c) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
  set("f_nombreApellido", c?.nombreapellido);
  set("f_nacimiento", c?.fechanacimiento);
  set("f_genero", c?.genero);
  set("f_localidad", c?.localidad);
  set("f_telefono", c?.telefono);
  set("f_correo", c?.correo);
  set("f_ultimaCompra", c?.fechaultima_compra);
  set("f_producto", c?.producto_comprado);
  set("f_monto", c?.monto_gastado);
  set("f_frecuencia", c?.frecuencia_compra);
  set("f_canal", c?.canal_contacto);
  set("f_observaciones", c?.observaciones);
  updateAgeReadout();
}

function openNewForm() {
  if (!connectionOk) { showToast("No hay conexión con Supabase todavía.", true); return; }
  editingId = null;
  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.textContent = "Nuevo cliente";
  clearFormErrors();
  fillForm(null);
  const overlay = document.getElementById("formOverlay");
  if (overlay) overlay.classList.add("open");
  setTimeout(() => {
    const nombreInput = document.getElementById("f_nombreApellido");
    if (nombreInput) nombreInput.focus();
  }, 50);
}

function openEditForm(id) {
  console.log("[CRM] openEditForm llamado con id=", id, "tipo=", typeof id);
  const idStr = String(id);
  console.log("[CRM] Buscando cliente con idStr=", idStr, "en", clients.length, "clientes");
  const c = clients.find((c) => matchesClientId(c, idStr));
  console.log("[CRM] Cliente encontrado=", !!c, c);
  if (!c) {
    console.warn("[CRM] No se encontro cliente para editar.");
    return;
  }
  editingId = idStr;
  const formTitle = document.getElementById("formTitle");
  if (formTitle) formTitle.textContent = "Editar cliente";
  clearFormErrors();
  fillForm(c);
  const overlay = document.getElementById("formOverlay");
  if (overlay) overlay.classList.add("open");
}

function closeForm() {
  const overlay = document.getElementById("formOverlay");
  if (overlay) overlay.classList.remove("open");
}

function setSaving(isSaving) {
  const btn = document.getElementById("formSubmitBtn");
  if (!btn) return;
  btn.disabled = isSaving;
  btn.innerHTML = isSaving ? `<span class="spinner sm"></span> Guardando…` : "Guardar cliente";
}

async function handleFormSubmit(e) {
  if (e) e.preventDefault();
  clearFormErrors();
  let ok = true;
  const fNombre = document.getElementById("f_nombreApellido");
  const fTel = document.getElementById("f_telefono");
  if (fNombre && !fNombre.value.trim()) { fNombre.closest(".field").classList.add("error"); ok = false; }
  if (fTel && !fTel.value.trim()) { fTel.closest(".field").classList.add("error"); ok = false; }
  if (!ok) return;

  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  const data = {
    nombreapellido: getVal("f_nombreApellido").trim(),
    fechanacimiento: getVal("f_nacimiento"),
    genero: getVal("f_genero"),
    localidad: getVal("f_localidad").trim(),
    telefono: getVal("f_telefono").trim(),
    correo: getVal("f_correo").trim(),
    fechaultima_compra: getVal("f_ultimaCompra"),
    producto_comprado: getVal("f_producto").trim(),
    monto_gastado: getVal("f_monto") === "" ? 0 : Number(getVal("f_monto")),
    frecuencia_compra: getVal("f_frecuencia"),
    canal_contacto: getVal("f_canal"),
    observaciones: getVal("f_observaciones").trim(),
  };

  setSaving(true);
  try {
    if (editingId) {
      const updated = await apiActualizarCliente(editingId, data);
      const idx = clients.findIndex((c) => matchesClientId(c, editingId));
      if (idx > -1) clients[idx] = updated;
      showToast("Cliente actualizado.");
    } else {
      const created = await apiCrearCliente(data);
      clients.push(created);
      
      // Si el cliente tiene datos de compra, crear el registro en la tabla compras
      if (data.producto_comprado && data.fechaultima_compra && data.monto_gastado > 0) {
        try {
          await apiCrearCompra(created.idcliente, {
            producto: data.producto_comprado,
            fecha: data.fechaultima_compra,
            monto: data.monto_gastado,
            observaciones: ""
          });
        } catch (purchaseErr) {
          console.warn("[CRM] No se pudo crear compra para el cliente:", purchaseErr);
        }
      }
      
      showToast("Cliente agregado.");
    }
    closeForm();
    renderAll();
  } catch (err) {
    const formError = document.getElementById("formError");
    if (formError) formError.textContent = err.message;
    console.error("[CRM] Error al guardar:", err);
  } finally {
    setSaving(false);
  }
}

/* ---------------------------------------------------------------------------
 * Modal: eliminar
 * ------------------------------------------------------------------------- */

function openDeleteConfirm(id) {
  const idStr = String(id);
  const c = clients.find((c) => matchesClientId(c, idStr));
  if (!c) {
    console.warn("[CRM] Cliente no encontrado para eliminar, id=", idStr);
    return;
  }
  deletingId = idStr;
  const deleteName = document.getElementById("deleteName");
  if (deleteName) deleteName.textContent = c.nombreapellido;
  const overlay = document.getElementById("deleteOverlay");
  if (overlay) overlay.classList.add("open");
}

function closeDeleteConfirm() {
  deletingId = null;
  const overlay = document.getElementById("deleteOverlay");
  if (overlay) overlay.classList.remove("open");
}

async function confirmDelete() {
  if (!deletingId) return;
  const btn = document.getElementById("deleteConfirm");
  if (!btn) return;
  btn.disabled = true;
  try {
    await apiEliminarCliente(deletingId);
    clients = clients.filter((c) => !matchesClientId(c, deletingId));
    closeDeleteConfirm();
    renderAll();
    showToast("Cliente eliminado.");
  } catch (err) {
    showToast("No se pudo eliminar: " + err.message, true);
    console.error("[CRM] Error al eliminar:", err);
  } finally {
    btn.disabled = false;
  }
}

function estadoToFecha(estado) {
  const d = new Date();
  if (estado === "Activo") {
    return d.toISOString().slice(0, 10);
  }
  if (estado === "En seguimiento") {
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }
  // Inactivo
  d.setDate(d.getDate() - 400);
  return d.toISOString().slice(0, 10);
}

async function quickChangeEstado(id, estado, selectEl) {
  if (!id) {
    console.warn("[CRM] quickChangeEstado llamado sin id", selectEl);
    showToast("No se pudo cambiar el estado: id vacío", true);
    return;
  }
  const fecha = estadoToFecha(estado);
  try {
    if (selectEl) selectEl.disabled = true;
    const updated = await apiActualizarCliente(id, { fechaultima_compra: fecha });
    const idx = clients.findIndex((c) => matchesClientId(c, id));
    if (idx > -1) clients[idx] = updated;
    showToast("Estado actualizado.");
    renderAll();
  } catch (err) {
    showToast("No se pudo cambiar estado: " + err.message, true);
    console.error("[CRM] quickChangeEstado error:", err);
  } finally {
    if (selectEl) selectEl.disabled = false;
  }
}

/* ---------------------------------------------------------------------------
 * Modal / Gestión de Compras
 * ------------------------------------------------------------------------- */

let currentClientForPurchases = null;
let clientPurchases = [];
let editingPurchaseId = null;
let deletingPurchaseId = null;

async function openPurchasesModal(idCliente) {
  if (!connectionOk) { showToast("No hay conexión con Supabase.", true); return; }
  currentClientForPurchases = idCliente;
  const c = clients.find((cl) => matchesClientId(cl, idCliente));
  if (!c) { showToast("Cliente no encontrado.", true); return; }
  
  const title = document.getElementById("purchasesTitle");
  if (title) title.textContent = `Compras de ${c.nombreapellido}`;
  
  try {
    clientPurchases = await apiGetCompras(idCliente);
    renderPurchasesList();
    const overlay = document.getElementById("purchasesOverlay");
    if (overlay) overlay.classList.add("open");
  } catch (err) {
    showToast("Error al cargar compras: " + err.message, true);
    console.error("[CRM] Error al cargar compras:", err);
  }
}

function closePurchasesModal() {
  const overlay = document.getElementById("purchasesOverlay");
  if (overlay) overlay.classList.remove("open");
  currentClientForPurchases = null;
  clientPurchases = [];
}

function renderPurchasesList() {
  const listArea = document.getElementById("purchasesList");
  if (!listArea) return;
  
  if (clientPurchases.length === 0) {
    listArea.innerHTML = `<div style="text-align:center;color:var(--ink-soft);padding:20px 0;">
      <p>Sin compras registradas para este cliente.</p>
    </div>`;
    return;
  }
  
  const total = clientPurchases.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  let html = `<div style="margin-bottom:16px;padding:12px;background:var(--surface-2);border-radius:9px;border-left:3px solid var(--ochre-500);">
    <div style="font-size:12px;color:var(--ink-faint);margin-bottom:4px;">Total en compras</div>
    <div style="font-size:18px;font-weight:600;color:var(--petrol-900);">${fmtMoney(total)}</div>
  </div>
  <div style="margin-bottom:12px;border:1px solid var(--line);border-radius:9px;overflow:hidden;">`;
  
  clientPurchases.forEach((p) => {
    html += `
      <div style="padding:12px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:600;color:var(--ink);">${escapeHtml(p.producto)}</div>
          <div style="font-size:12px;color:var(--ink-soft);">${fmtDate(p.fecha)}</div>
          ${p.observaciones ? `<div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">${escapeHtml(p.observaciones)}</div>` : ""}
        </div>
        <div style="text-align:right;margin:0 12px;">
          <div style="font-weight:600;font-family:var(--font-mono);">${fmtMoney(p.monto)}</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="icon-btn" data-action="edit-purchase" data-id="${escapeHtml(p.idcompra)}" title="Editar" style="width:28px;height:28px;font-size:12px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" data-action="delete-purchase" data-id="${escapeHtml(p.idcompra)}" title="Eliminar" style="width:28px;height:28px;font-size:12px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>`;
  });
  html += `</div>`;
  listArea.innerHTML = html;
  
  // Attach event listeners to purchase action buttons
  listArea.querySelectorAll("[data-action='edit-purchase']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      openEditPurchaseForm(id);
    });
  });
  listArea.querySelectorAll("[data-action='delete-purchase']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      openDeletePurchaseConfirm(id);
    });
  });
}

function openNewPurchaseForm() {
  if (!currentClientForPurchases) { showToast("Cliente no seleccionado.", true); return; }
  editingPurchaseId = null;
  const title = document.getElementById("purchaseFormTitle");
  if (title) title.textContent = "Nueva compra";
  clearPurchaseFormErrors();
  fillPurchaseForm(null);
  const today = new Date().toISOString().slice(0, 10);
  const fFecha = document.getElementById("pf_fecha");
  if (fFecha) fFecha.value = today;
  const overlay = document.getElementById("purchaseFormOverlay");
  if (overlay) overlay.classList.add("open");
}

function openEditPurchaseForm(idPurchase) {
  const p = clientPurchases.find((cp) => cp.idcompra === idPurchase);
  if (!p) { showToast("Compra no encontrada.", true); return; }
  editingPurchaseId = idPurchase;
  const title = document.getElementById("purchaseFormTitle");
  if (title) title.textContent = "Editar compra";
  clearPurchaseFormErrors();
  fillPurchaseForm(p);
  const overlay = document.getElementById("purchaseFormOverlay");
  if (overlay) overlay.classList.add("open");
}

function closePurchaseForm() {
  const overlay = document.getElementById("purchaseFormOverlay");
  if (overlay) overlay.classList.remove("open");
  editingPurchaseId = null;
}

function clearPurchaseFormErrors() {
  document.querySelectorAll("#purchaseForm .field").forEach((f) => f.classList.remove("error"));
  const formError = document.getElementById("purchaseFormError");
  if (formError) formError.textContent = "";
}

function fillPurchaseForm(p) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ""; };
  set("pf_producto", p?.producto);
  set("pf_fecha", p?.fecha);
  set("pf_monto", p?.monto);
  set("pf_observaciones", p?.observaciones);
}

async function handlePurchaseFormSubmit(e) {
  if (e) e.preventDefault();
  clearPurchaseFormErrors();
  let ok = true;
  const fProducto = document.getElementById("pf_producto");
  const fFecha = document.getElementById("pf_fecha");
  const fMonto = document.getElementById("pf_monto");
  if (fProducto && !fProducto.value.trim()) { fProducto.closest(".field").classList.add("error"); ok = false; }
  if (fFecha && !fFecha.value) { fFecha.closest(".field").classList.add("error"); ok = false; }
  if (fMonto && !fMonto.value) { fMonto.closest(".field").classList.add("error"); ok = false; }
  if (!ok) return;

  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  const data = {
    producto: getVal("pf_producto").trim(),
    fecha: getVal("pf_fecha"),
    monto: Number(getVal("pf_monto")) || 0,
    observaciones: getVal("pf_observaciones").trim(),
  };

  const btn = document.getElementById("purchaseFormSubmitBtn");
  if (btn) btn.disabled = true;
  try {
    if (editingPurchaseId) {
      const updated = await apiActualizarCompra(editingPurchaseId, data);
      const idx = clientPurchases.findIndex((p) => p.idcompra === editingPurchaseId);
      if (idx > -1) clientPurchases[idx] = updated;
      showToast("Compra actualizada.");
    } else {
      const created = await apiCrearCompra(currentClientForPurchases, data);
      clientPurchases.push(created);
      clientPurchases.sort((a, b) => b.fecha.localeCompare(a.fecha));
      showToast("Compra agregada.");
    }
    
    await updateClientAfterPurchaseChange(currentClientForPurchases);
    renderAll();
    
    closePurchaseForm();
    renderPurchasesList();
  } catch (err) {
    const formError = document.getElementById("purchaseFormError");
    if (formError) formError.textContent = err.message;
    console.error("[CRM] Error al guardar compra:", err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openDeletePurchaseConfirm(id) {
  deletingPurchaseId = id;
  const overlay = document.getElementById("deletePurchaseOverlay");
  if (overlay) overlay.classList.add("open");
}

function closeDeletePurchaseConfirm() {
  deletingPurchaseId = null;
  const overlay = document.getElementById("deletePurchaseOverlay");
  if (overlay) overlay.classList.remove("open");
}

async function confirmDeletePurchase() {
  if (!deletingPurchaseId) return;
  const btn = document.getElementById("deletePurchaseConfirm");
  if (btn) btn.disabled = true;
  try {
    await apiEliminarCompra(deletingPurchaseId);
    clientPurchases = clientPurchases.filter((p) => p.idcompra !== deletingPurchaseId);
    
    await updateClientAfterPurchaseChange(currentClientForPurchases);
    renderAll();
    
    closeDeletePurchaseConfirm();
    renderPurchasesList();
    showToast("Compra eliminada.");
  } catch (err) {
    showToast("No se pudo eliminar: " + err.message, true);
    console.error("[CRM] Error al eliminar compra:", err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------------------------------------------------------------------------
 * Exportar CSV
 * ------------------------------------------------------------------------- */

function exportCsv() {
  const headers = ["ID Cliente","Nombre y Apellido","Fecha de nacimiento","Edad","Género","Localidad","Teléfono/WhatsApp","Correo electrónico","Fecha última compra","Producto comprado","Monto gastado","Frecuencia de compra","Canal de contacto","Estado","Observaciones"];
  const lines = [headers.join(",")];
  clients.forEach((c) => {
    const row = [
      getClientId(c), c.nombreapellido, c.fechanacimiento || "", getAge(c) ?? "",
      c.genero || "", c.localidad || "", c.telefono || "", c.correo || "", c.fechaultima_compra || "",
      c.producto_comprado || "", c.monto_gastado || 0, c.frecuencia_compra || "", c.canal_contacto || "",
      estadoFor(c.fechaultima_compra), c.observaciones || "",
    ].map((v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    });
    lines.push(row.join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clientes_crm_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV exportado.");
}

/* ---------------------------------------------------------------------------
 * Resumen Semanal
 * ------------------------------------------------------------------------- */

function getWeekDateRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today.setDate(diff));
  const sunday = new Date(today.setDate(diff + 6));
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    monday: fmtDate(monday.toISOString().slice(0, 10)),
    sunday: fmtDate(sunday.toISOString().slice(0, 10))
  };
}

async function apiGetWeeklyPurchases(startDate, endDate) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no inicializado.");
  const { data, error } = await client.from("compras")
    .select("*, clientes(nombreapellido)")
    .gte("fecha", startDate)
    .lte("fecha", endDate)
    .order("fecha", { ascending: false });
  if (error) throw new Error(error.message || "Error al obtener compras semanales.");
  return data || [];
}

async function openWeeklyReportModal() {
  if (!connectionOk) { showToast("No hay conexión con Supabase.", true); return; }
  const overlay = document.getElementById("weeklyReportOverlay");
  if (!overlay) return;
  overlay.classList.add("open");
  
  try {
    const range = getWeekDateRange();
    const purchases = await apiGetWeeklyPurchases(range.start, range.end);
    renderWeeklyReport(purchases, range);
  } catch (err) {
    const content = document.getElementById("weeklyReportContent");
    if (content) content.innerHTML = `<div class="banner bad"><span class="glyph">⚠</span><b>Error:</b> ${err.message}</div>`;
    console.error("[CRM] Error al obtener resumen semanal:", err);
  }
}

function closeWeeklyReportModal() {
  const overlay = document.getElementById("weeklyReportOverlay");
  if (overlay) overlay.classList.remove("open");
}

function renderWeeklyReport(purchases, range) {
  const content = document.getElementById("weeklyReportContent");
  if (!content) return;
  
  const totalVentas = purchases.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const totalProductos = purchases.length;
  
  const clienteMap = {};
  purchases.forEach((p) => {
    const clientName = p.clientes?.nombreapellido || "Desconocido";
    if (!clienteMap[clientName]) {
      clienteMap[clientName] = { total: 0, items: [] };
    }
    clienteMap[clientName].total += Number(p.monto) || 0;
    clienteMap[clientName].items.push(p);
  });
  
  let html = `
    <div style="margin-bottom:20px;">
      <div style="font-size:12px;color:var(--ink-faint);margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em;">Período</div>
      <div style="font-size:14px;color:var(--ink);margin-bottom:16px;">${range.monday} a ${range.sunday}</div>
      
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:var(--surface-2);padding:14px;border-radius:9px;border-left:3px solid var(--ochre-500);">
          <div style="font-size:11px;color:var(--ink-faint);margin-bottom:4px;text-transform:uppercase;">Total Ventas</div>
          <div style="font-size:20px;font-weight:600;color:var(--petrol-900);">${fmtMoney(totalVentas)}</div>
        </div>
        <div style="background:var(--surface-2);padding:14px;border-radius:9px;border-left:3px solid var(--petrol-500);">
          <div style="font-size:11px;color:var(--ink-faint);margin-bottom:4px;text-transform:uppercase;">Productos</div>
          <div style="font-size:20px;font-weight:600;color:var(--petrol-900);">${totalProductos}</div>
        </div>
        <div style="background:var(--surface-2);padding:14px;border-radius:9px;border-left:3px solid var(--good);">
          <div style="font-size:11px;color:var(--ink-faint);margin-bottom:4px;text-transform:uppercase;">Clientes</div>
          <div style="font-size:20px;font-weight:600;color:var(--petrol-900);">${Object.keys(clienteMap).length}</div>
        </div>
      </div>
    </div>
    
    <div style="border-top:1px solid var(--line);padding-top:16px;">
      <h3 style="font-family:var(--font-display);font-size:14px;font-weight:600;margin:0 0 12px;color:var(--petrol-900);">Desglose por cliente</h3>
  `;
  
  if (Object.keys(clienteMap).length === 0) {
    html += `<p style="color:var(--ink-soft);font-size:13px;text-align:center;padding:20px 0;">Sin ventas en esta semana.</p>`;
  } else {
    Object.entries(clienteMap).forEach(([clientName, data]) => {
      html += `
        <div style="margin-bottom:12px;padding:12px;background:var(--surface-2);border-radius:9px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-weight:600;color:var(--ink);">${escapeHtml(clientName)}</div>
            <div style="font-weight:600;font-family:var(--font-mono);color:var(--ochre-500);">${fmtMoney(data.total)}</div>
          </div>
          <div style="font-size:12px;color:var(--ink-soft);">${data.items.length} compra${data.items.length === 1 ? '' : 's'}:</div>
          <div style="margin-top:6px;font-size:12px;">
      `;
      data.items.forEach((item) => {
        html += `<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--ink-faint);">
          <span>${escapeHtml(item.producto)} (${fmtDate(item.fecha)})</span>
          <span>${fmtMoney(item.monto)}</span>
        </div>`;
      });
      html += `</div></div>`;
    });
  }
  
  html += `</div>`;
  content.innerHTML = html;
}

/* ---------------------------------------------------------------------------
 * Bindings
 * ------------------------------------------------------------------------- */

function bindEvents() {
  const btnNew = document.getElementById("btnNew");
  if (btnNew) btnNew.addEventListener("click", openNewForm);
  const btnWeeklyReport = document.getElementById("btnWeeklyReport");
  if (btnWeeklyReport) btnWeeklyReport.addEventListener("click", openWeeklyReportModal);
  const weeklyReportClose = document.getElementById("weeklyReportClose");
  if (weeklyReportClose) weeklyReportClose.addEventListener("click", closeWeeklyReportModal);
  const weeklyReportOverlay = document.getElementById("weeklyReportOverlay");
  if (weeklyReportOverlay) weeklyReportOverlay.addEventListener("click", (e) => { if (e.target.id === "weeklyReportOverlay") closeWeeklyReportModal(); });
  const formClose = document.getElementById("formClose");
  if (formClose) formClose.addEventListener("click", closeForm);
  const formCancel = document.getElementById("formCancel");
  if (formCancel) formCancel.addEventListener("click", closeForm);
  const formOverlay = document.getElementById("formOverlay");
  if (formOverlay) formOverlay.addEventListener("click", (e) => { if (e.target.id === "formOverlay") closeForm(); });
  const clientForm = document.getElementById("clientForm");
  if (clientForm) clientForm.addEventListener("submit", handleFormSubmit);
  const fNac = document.getElementById("f_nacimiento");
  if (fNac) fNac.addEventListener("input", updateAgeReadout);

  const deleteClose = document.getElementById("deleteClose");
  if (deleteClose) deleteClose.addEventListener("click", closeDeleteConfirm);
  const deleteCancel = document.getElementById("deleteCancel");
  if (deleteCancel) deleteCancel.addEventListener("click", closeDeleteConfirm);
  const deleteOverlay = document.getElementById("deleteOverlay");
  if (deleteOverlay) deleteOverlay.addEventListener("click", (e) => { if (e.target.id === "deleteOverlay") closeDeleteConfirm(); });
  const deleteConfirm = document.getElementById("deleteConfirm");
  if (deleteConfirm) deleteConfirm.addEventListener("click", confirmDelete);

  // Purchases modal events
  const purchasesClose = document.getElementById("purchasesClose");
  if (purchasesClose) purchasesClose.addEventListener("click", closePurchasesModal);
  const purchasesOverlay = document.getElementById("purchasesOverlay");
  if (purchasesOverlay) purchasesOverlay.addEventListener("click", (e) => { if (e.target.id === "purchasesOverlay") closePurchasesModal(); });
  const btnAddPurchase = document.getElementById("btnAddPurchase");
  if (btnAddPurchase) btnAddPurchase.addEventListener("click", openNewPurchaseForm);

  // Purchase form modal events
  const purchaseFormClose = document.getElementById("purchaseFormClose");
  if (purchaseFormClose) purchaseFormClose.addEventListener("click", closePurchaseForm);
  const purchaseFormCancel = document.getElementById("purchaseFormCancel");
  if (purchaseFormCancel) purchaseFormCancel.addEventListener("click", closePurchaseForm);
  const purchaseFormOverlay = document.getElementById("purchaseFormOverlay");
  if (purchaseFormOverlay) purchaseFormOverlay.addEventListener("click", (e) => { if (e.target.id === "purchaseFormOverlay") closePurchaseForm(); });
  const purchaseForm = document.getElementById("purchaseForm");
  if (purchaseForm) purchaseForm.addEventListener("submit", handlePurchaseFormSubmit);

  // Delete purchase modal events
  const deletePurchaseClose = document.getElementById("deletePurchaseClose");
  if (deletePurchaseClose) deletePurchaseClose.addEventListener("click", closeDeletePurchaseConfirm);
  const deletePurchaseCancel = document.getElementById("deletePurchaseCancel");
  if (deletePurchaseCancel) deletePurchaseCancel.addEventListener("click", closeDeletePurchaseConfirm);
  const deletePurchaseOverlay = document.getElementById("deletePurchaseOverlay");
  if (deletePurchaseOverlay) deletePurchaseOverlay.addEventListener("click", (e) => { if (e.target.id === "deletePurchaseOverlay") closeDeletePurchaseConfirm(); });
  const deletePurchaseConfirm = document.getElementById("deletePurchaseConfirm");
  if (deletePurchaseConfirm) deletePurchaseConfirm.addEventListener("click", confirmDeletePurchase);

  const btnExport = document.getElementById("btnExport");
  if (btnExport) btnExport.addEventListener("click", exportCsv);

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.addEventListener("input", renderTable);
  const filterLocalidad = document.getElementById("filterLocalidad");
  if (filterLocalidad) filterLocalidad.addEventListener("change", renderTable);
  const filterCanal = document.getElementById("filterCanal");
  if (filterCanal) filterCanal.addEventListener("change", renderTable);
  const filterEstado = document.getElementById("filterEstado");
  if (filterEstado) filterEstado.addEventListener("change", renderTable);

  const tableArea = document.getElementById("tableArea");
  if (tableArea) {
    tableArea.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "edit") {
        console.log("[CRM] Delegated EDIT, id=", id);
        openEditForm(id);
      } else if (action === "delete") {
        console.log("[CRM] Delegated DELETE, id=", id);
        openDeleteConfirm(id);
      } else if (action === "purchases") {
        console.log("[CRM] Delegated PURCHASES, id=", id);
        openPurchasesModal(id);
      }
    });
    tableArea.addEventListener("change", (e) => {
      const sel = e.target.closest("[data-action='set-estado']");
      if (!sel) return;
      const id = sel.dataset.id;
      const val = sel.value;
      console.log("[CRM] Cambio rápido de estado, id=", id, "->", val);
      quickChangeEstado(id, val, sel);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeForm();
      closeDeleteConfirm();
      closePurchasesModal();
      closePurchaseForm();
      closeDeletePurchaseConfirm();
      closeWeeklyReportModal();
    }
  });
}

/* ---------------------------------------------------------------------------
 * Funciones globales (fallback onclick inline)
 * ------------------------------------------------------------------------- */

window._crm_edit = function(id) {
  console.log("[CRM] _crm_edit llamado con id=", id);
  openEditForm(id);
};

window._crm_delete = function(id) {
  console.log("[CRM] _crm_delete llamado con id=", id);
  openDeleteConfirm(id);
};

/* ---------------------------------------------------------------------------
 * Init
 * ------------------------------------------------------------------------- */

async function init() {
  bindEvents();
  await loadClients();
}

document.addEventListener("DOMContentLoaded", init);
