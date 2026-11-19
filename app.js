/*
 * Preencha a URL do projeto Supabase e a chave publicável (anon) abaixo.
 * A chave anon é pública por definição; a segurança dos dados depende das
 * políticas RLS em supabase/schema.sql. Nunca coloque a service_role key aqui.
 */
const SITE_CONFIG = {
  whatsappNumber: "5548999132017",
  whatsappMessage: "Olá! Tenho interesse em conhecer a GODOI CT e fazer uma aula experimental.",
  supabaseUrl: "",
  supabaseAnonKey: ""
};

const SESSION_KEY = "godoict.supabase.session.v1";
const WEEKDAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");
const scheduleBody = document.querySelector("#schedule-body");
const scheduleEmpty = document.querySelector("#schedule-empty");
const scheduleDialog = document.querySelector("#admin-dialog");
const scheduleForm = document.querySelector("#schedule-form");
const adminList = document.querySelector("#admin-schedule-list");
const toast = document.querySelector(".toast");
let toastTimer;
let schedulesCache = [];
let adminSession = loadSession();
let isAdmin = false;

function isSupabaseConfigured() {
  return Boolean(SITE_CONFIG.supabaseUrl.trim() && SITE_CONFIG.supabaseAnonKey.trim());
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function storeSession(value) {
  adminSession = value;
  if (value) localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(SESSION_KEY);
}

function supabaseBaseUrl() {
  return SITE_CONFIG.supabaseUrl.trim().replace(/\/+$/, "");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 4200);
}

async function authRequest(path, body) {
  const response = await fetch(`${supabaseBaseUrl()}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SITE_CONFIG.supabaseAnonKey.trim(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || result.error_description || "Falha ao autenticar.");
  return result;
}

async function refreshSession() {
  if (!adminSession?.refresh_token) return false;
  try {
    const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: adminSession.refresh_token });
    storeSession({ ...refreshed, expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in });
    return true;
  } catch {
    storeSession(null);
    isAdmin = false;
    return false;
  }
}

async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured()) throw new Error("Configure a URL e a chave publicável do Supabase em app.js.");
  if (adminSession && Number(adminSession.expires_at) < Math.floor(Date.now() / 1000) + 30) await refreshSession();
  const headers = { apikey: SITE_CONFIG.supabaseAnonKey.trim(), ...(options.headers || {}) };
  if (adminSession?.access_token) headers.Authorization = `Bearer ${adminSession.access_token}`;
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${supabaseBaseUrl()}/rest/v1/${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 401 && adminSession) {
      storeSession(null);
      isAdmin = false;
      updateAdminView();
    }
    throw new Error(error.message || error.details || "Não foi possível acessar a grade de horários.");
  }
  return response.status === 204 ? null : response.json();
}

async function loadSchedules() {
  const rows = await supabaseRequest("schedules?select=id,modality,day,time&order=day.asc,time.asc");
  schedulesCache = rows.map((row) => ({ ...row, time: String(row.time).slice(0, 5) }));
  return sortedSchedules(schedulesCache);
}

async function saveSchedule(entry) {
  const payload = { modality: entry.modality, day: entry.day, time: `${entry.time}:00` };
  if (entry.id) {
    await supabaseRequest(`schedules?id=eq.${encodeURIComponent(entry.id)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload)
    });
  } else {
    await supabaseRequest("schedules", {
      method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(payload)
    });
  }
}

async function removeSchedule(id) {
  await supabaseRequest(`schedules?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

function sortedSchedules(schedules) {
  return [...schedules].sort((a, b) => {
    const dayDifference = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
    return dayDifference || a.time.localeCompare(b.time) || a.modality.localeCompare(b.modality, "pt-BR");
  });
}

async function renderPublicSchedule() {
  let schedules = [];
  try {
    schedules = await loadSchedules();
  } catch (error) {
    scheduleEmpty.querySelector("strong").textContent = isSupabaseConfigured() ? "Horários indisponíveis" : "Horários em configuração";
    scheduleEmpty.querySelector("p").textContent = isSupabaseConfigured()
      ? "Não foi possível carregar a grade agora. Entre em contato para consultar a disponibilidade."
      : "A grade oficial será exibida assim que o painel Supabase for configurado.";
    scheduleBody.replaceChildren();
    scheduleEmpty.hidden = false;
    scheduleBody.closest("table").hidden = true;
    renderAdminList();
    return;
  }
  scheduleBody.replaceChildren();
  scheduleEmpty.hidden = schedules.length > 0;
  scheduleBody.closest("table").hidden = schedules.length === 0;

  schedules.forEach((schedule) => {
    const row = document.createElement("tr");
    [schedule.modality, schedule.day, schedule.time].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const contactLink = document.createElement("a");
    contactLink.href = "#contato";
    contactLink.dataset.whatsapp = "";
    contactLink.textContent = "CONSULTAR ↗";
    contactLink.setAttribute("aria-label", `Consultar turma ${schedule.modality} de ${schedule.day} às ${schedule.time}`);
    contactLink.className = "schedule-contact-link";
    actionCell.append(contactLink);
    row.append(actionCell);
    scheduleBody.append(row);
  });
  renderAdminList(schedules);
}

function renderAdminList(schedules = sortedSchedules(schedulesCache)) {
  adminList.replaceChildren();
  if (!schedules.length) {
    const empty = document.createElement("li");
    empty.className = "admin-empty";
    empty.textContent = "Nenhum horário cadastrado. Adicione a grade oficial acima.";
    adminList.append(empty);
    return;
  }

  schedules.forEach((schedule) => {
    const item = document.createElement("li");
    const description = document.createElement("span");
    const modality = document.createElement("strong");
    modality.textContent = schedule.modality;
    description.append(modality, document.createTextNode(` · ${schedule.day} às ${schedule.time}`));
    const actions = document.createElement("div");
    actions.className = "schedule-row-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.dataset.id = schedule.id;
    edit.textContent = "EDITAR";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "remove";
    remove.dataset.id = schedule.id;
    remove.textContent = "REMOVER";
    actions.append(edit, remove);
    item.append(description, actions);
    adminList.append(item);
  });
}

function resetScheduleForm() {
  scheduleForm.reset();
  document.querySelector("#schedule-id").value = "";
  document.querySelector("#schedule-submit").innerHTML = "ADICIONAR HORÁRIO <span>＋</span>";
  document.querySelector("#schedule-cancel").hidden = true;
}

function openWhatsApp(event) {
  event.preventDefault();
  const number = SITE_CONFIG.whatsappNumber.replace(/\D/g, "");
  const message = encodeURIComponent(SITE_CONFIG.whatsappMessage);
  window.open(`https://wa.me/${number}?text=${message}`, "_blank", "noopener,noreferrer");
}

function updateAdminView() {
  const configured = isSupabaseConfigured();
  document.querySelector("#admin-setup-notice").hidden = configured;
  document.querySelector("#admin-login-form").hidden = !configured || isAdmin;
  document.querySelector("#admin-session").hidden = !isAdmin;
  document.querySelector("#schedule-form").hidden = !isAdmin;
  document.querySelector(".admin-list-heading").hidden = !isAdmin;
  adminList.hidden = !isAdmin;
  document.querySelector("#admin-session-email").textContent = adminSession?.user?.email || "Sessão autorizada";
}

async function verifyAdminMembership() {
  if (!adminSession?.user?.id) return false;
  const membership = await supabaseRequest(`admin_users?select=user_id&user_id=eq.${encodeURIComponent(adminSession.user.id)}&limit=1`);
  return membership.length > 0;
}

function setLoginError(message = "") {
  const error = document.querySelector("#admin-login-error");
  error.textContent = message;
  error.hidden = !message;
}

async function openAdminDialog() {
  updateAdminView();
  scheduleDialog.showModal();
  if (!isSupabaseConfigured() || !adminSession) return;
  try {
    isAdmin = await verifyAdminMembership();
    if (!isAdmin) storeSession(null);
    updateAdminView();
    if (isAdmin) await renderAdminData();
  } catch (error) {
    showToast(error.message);
  }
}

async function renderAdminData() {
  await renderPublicSchedule();
  renderAdminList();
}

document.addEventListener("click", (event) => {
  const whatsappLink = event.target.closest("[data-whatsapp]");
  if (whatsappLink) openWhatsApp(event);
});

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Abrir menu" : "Fechar menu");
  mainNav.classList.toggle("open", !isOpen);
});
mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Abrir menu");
  mainNav.classList.remove("open");
}));

document.querySelectorAll(".admin-open").forEach((button) => button.addEventListener("click", () => {
  openAdminDialog();
}));
document.querySelector(".dialog-close").addEventListener("click", () => scheduleDialog.close());
scheduleDialog.addEventListener("click", (event) => {
  if (event.target === scheduleDialog) scheduleDialog.close();
});
scheduleDialog.addEventListener("close", resetScheduleForm);
document.querySelector("#schedule-cancel").addEventListener("click", resetScheduleForm);

document.querySelector("#admin-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isSupabaseConfigured()) return;
  const submit = event.currentTarget.querySelector("button[type='submit']");
  submit.disabled = true;
  setLoginError();
  try {
    const result = await authRequest("token?grant_type=password", {
      email: document.querySelector("#admin-email").value.trim(),
      password: document.querySelector("#admin-password").value
    });
    storeSession({ ...result, expires_at: Math.floor(Date.now() / 1000) + result.expires_in });
    isAdmin = await verifyAdminMembership();
    if (!isAdmin) {
      storeSession(null);
      throw new Error("Esta conta ainda não foi autorizada como administradora do GODOI CT.");
    }
    document.querySelector("#admin-password").value = "";
    updateAdminView();
    await renderAdminData();
    showToast("Acesso autorizado. A grade já está sincronizada.");
  } catch (error) {
    storeSession(null);
    isAdmin = false;
    updateAdminView();
    setLoginError(error.message || "Não foi possível entrar. Confira seus dados e tente novamente.");
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("#admin-logout").addEventListener("click", () => {
  storeSession(null);
  isAdmin = false;
  updateAdminView();
  resetScheduleForm();
  showToast("Você saiu do painel.");
});

scheduleForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin) return;
  const id = document.querySelector("#schedule-id").value;
  const entry = {
    id,
    modality: document.querySelector("#schedule-modality").value,
    day: document.querySelector("#schedule-day").value,
    time: document.querySelector("#schedule-time").value
  };
  try {
    await saveSchedule(entry);
    resetScheduleForm();
    await renderPublicSchedule();
    showToast(id ? "Horário atualizado e sincronizado." : "Horário adicionado e sincronizado.");
  } catch (error) {
    showToast(error.message);
  }
});

adminList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const selected = schedulesCache.find((item) => item.id === button.dataset.id);
  if (!selected) return;

  if (button.dataset.action === "edit") {
    document.querySelector("#schedule-id").value = selected.id;
    document.querySelector("#schedule-modality").value = selected.modality;
    document.querySelector("#schedule-day").value = selected.day;
    document.querySelector("#schedule-time").value = selected.time;
    document.querySelector("#schedule-submit").innerHTML = "SALVAR ALTERAÇÕES <span>↗</span>";
    document.querySelector("#schedule-cancel").hidden = false;
    document.querySelector("#schedule-modality").focus();
  } else if (button.dataset.action === "remove" && window.confirm(`Remover o horário ${selected.modality} — ${selected.day} às ${selected.time}?`)) {
    removeSchedule(selected.id).then(async () => {
      await renderPublicSchedule();
      showToast("Horário removido.");
    }).catch((error) => showToast(error.message));
  }
});

document.querySelector(".clear-schedules").addEventListener("click", async () => {
  if (!schedulesCache.length) {
    showToast("Não há horários para remover.");
    return;
  }
  if (isAdmin && window.confirm("Remover todos os horários publicados? Esta ação não pode ser desfeita.")) {
    try {
      await supabaseRequest("schedules?id=not.is.null", { method: "DELETE", headers: { Prefer: "return=minimal" } });
      resetScheduleForm();
      await renderPublicSchedule();
      showToast("Todos os horários foram removidos da grade publicada.");
    } catch (error) {
      showToast(error.message);
    }
  }
});

const lightbox = document.querySelector("#lightbox");
const lightboxImage = lightbox.querySelector("img");
document.querySelectorAll(".gallery-item").forEach((item) => item.addEventListener("click", () => {
  lightboxImage.src = item.dataset.image;
  lightboxImage.alt = item.querySelector("span").textContent.replace("↗", "").trim();
  lightbox.showModal();
}));
lightbox.querySelector(".lightbox-close").addEventListener("click", () => lightbox.close());
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) lightbox.close();
});
lightbox.addEventListener("close", () => { lightboxImage.src = ""; });

document.querySelector("#current-year").textContent = new Date().getFullYear();
updateAdminView();
renderPublicSchedule();

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll(".about-copy, .class-card, .instructor-copy, .schedule-board, .gallery-item, .contact-content").forEach((element) => {
    element.dataset.reveal = "";
    revealObserver.observe(element);
  });
}
