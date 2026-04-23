const START_HOUR = 8;
const END_HOUR = 20;
const STORAGE_KEY = "fluxoPorHora";
const SYNC_QUEUE_KEY = "fluxoSyncQueue";
const SHEET_ENDPOINT_KEY = "sheetEndpointUrl";
const META_KEY = "fluxoMetaPesquisa";
const COLLABORATORS_KEY = "fluxoCollaborators";
const HISTORY_KEY = "fluxoHistorico";

const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");
const tabPainelEl = document.getElementById("tabPainel");
const tabColaboradoresEl = document.getElementById("tabColaboradores");
const tabHistoricoEl = document.getElementById("tabHistorico");
const painelSectionEl = document.getElementById("painel");
const colaboradoresSectionEl = document.getElementById("colaboradores");
const authContainerEl = document.getElementById("authContainer");
const appContainerEl = document.getElementById("appContainer");
const loginEmailEl = document.getElementById("loginEmail");
const loginSenhaEl = document.getElementById("loginSenha");
const btnLoginEl = document.getElementById("btnLogin");
const authFeedbackEl = document.getElementById("authFeedback");
const usuarioAtualEl = document.getElementById("usuarioAtual");
const btnLogoutEl = document.getElementById("btnLogout");

const inputsContainer = document.getElementById("inputs-container");
const tabelaBody = document.getElementById("tabelaBody");
const totalPessoasEl = document.getElementById("totalPessoas");
const mediaHoraEl = document.getElementById("mediaHora");
const dataAtualEl = document.getElementById("dataAtual");
const horarioPicoEl = document.getElementById("horarioPico");
const menorFluxoEl = document.getElementById("menorFluxo");
const comparativoResumoEl = document.getElementById("comparativoResumo");
const rankingHorariosEl = document.getElementById("rankingHorarios");
const btnExportar = document.getElementById("btnExportar");
const statusConexaoEl = document.getElementById("statusConexao");
const statusFilaEl = document.getElementById("statusFila");
const syncFeedbackEl = document.getElementById("syncFeedback");
const btnSyncNow = document.getElementById("btnSyncNow");

const dataPesquisaEl = document.getElementById("dataPesquisa");
const filialPesquisaEl = document.getElementById("filialPesquisa");
const colaboradorPesquisaEl = document.getElementById("colaboradorPesquisa");
const cpfPesquisadorEl = document.getElementById("cpfPesquisador");
const cidadePesquisaEl = document.getElementById("cidadePesquisa");
const periodoPesquisaEl = document.getElementById("periodoPesquisa");
const refFilialEl = document.getElementById("refFilial");
const refDataEl = document.getElementById("refData");
const refCidadeEl = document.getElementById("refCidade");
const refPesquisadorEl = document.getElementById("refPesquisador");
const refCpfEl = document.getElementById("refCpf");
const refPeriodoEl = document.getElementById("refPeriodo");
const tituloTabelaEl = document.getElementById("tituloTabela");
const adminNomeColaboradorEl = document.getElementById("adminNomeColaborador");
const adminCpfColaboradorEl = document.getElementById("adminCpfColaborador");
const adminCidadeColaboradorEl = document.getElementById("adminCidadeColaborador");
const adminDataPesquisaColaboradorEl = document.getElementById("adminDataPesquisaColaborador");
const adminFilialColaboradorEl = document.getElementById("adminFilialColaborador");
const adminPeriodoColaboradorEl = document.getElementById("adminPeriodoColaborador");
const btnSalvarColaboradorEl = document.getElementById("btnSalvarColaborador");
const btnLimparColaboradorEl = document.getElementById("btnLimparColaborador");
const filtroCidadeColaboradorEl = document.getElementById("filtroCidadeColaborador");
const listaColaboradoresEl = document.getElementById("listaColaboradores");
const adminFeedbackEl = document.getElementById("adminFeedback");
const listaHistoricoEl = document.getElementById("listaHistorico");
const historicoFeedbackEl = document.getElementById("historicoFeedback");
const btnLimparHistoricoEl = document.getElementById("btnLimparHistorico");
const mesReferenciaMesEl = document.getElementById("mesReferenciaMes");
const mesReferenciaAnoEl = document.getElementById("mesReferenciaAno");
const adminMesReferenciaMesEl = document.getElementById("adminMesReferenciaMes");
const adminMesReferenciaAnoEl = document.getElementById("adminMesReferenciaAno");

const hourlySlots = buildHourlySlots(START_HOUR, END_HOUR);
let fluxoData = loadData();
let syncQueue = loadSyncQueue();
let sheetEndpointUrl = "";

let chartInstance = null;
let syncInProgress = false;
let lastSyncSuccessAt = null;
let pesquisaMeta = loadPesquisaMeta();
let collaborators = loadCollaborators();
let historico = loadHistory();
let editingCollaboratorId = null;
let previousDataPesquisa = pesquisaMeta.dataPesquisa;

let supabaseClient = null;
let currentSession = null;
let currentProfile = null;
const authBypass = Boolean(window.SUPABASE_CONFIG?.authBypass);

initTabs();
renderInputs();
renderAll();
initActions();

populateReferenceSelectors();
populateCollaboratorSelect();
hydrateMetaInputs();
renderCollaboratorList();
renderHistoricoList();
limitDateFuture();
updateSyncUI();
registerServiceWorker();
bootstrapAuth();

function limitDateFuture() {
  const today = new Date().toISOString().split("T")[0];
  dataPesquisaEl.setAttribute("max", today);
}

function initTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const restricted = tab.dataset.tab === "painel" || tab.dataset.tab === "colaboradores";
      if (restricted && !canViewPanel()) return;
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "painel") {
        renderAll();
      }
      if (tab.dataset.tab === "colaboradores") {
        carregarListaUsuarios();
      }
    });
  });
}

async function bootstrapAuth() {
  if (authBypass) {
    currentSession = { user: { email: "modo.teste@local" } };
    currentProfile = { full_name: "Modo Teste (Sem Login)", role: "manager" };
    updateAuthUI();
    return;
  }

  supabaseClient = createSupabaseClient();
  if (!supabaseClient) {
    setAuthFeedback("Configure o arquivo supabase-config.js para habilitar login.", "error");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();
  currentSession = data.session;
  await refreshProfile();
  updateAuthUI();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    currentSession = session;
    await refreshProfile();
    updateAuthUI();
    if (session) {
      await loadHistoryFromSupabase();
      await loadCollaboratorsFromSupabase();
    }

  });
}

function createSupabaseClient() {
  if (window.SUPABASE_CLIENT) return window.SUPABASE_CLIENT;

  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey || !window.supabase) {
    console.warn("Supabase config incompleta ou biblioteca não carregada.");
    return null;
  }
  try {
    return window.supabase.createClient(cfg.url, cfg.anonKey);
  } catch (e) {
    console.error("Erro fatal ao criar cliente Supabase:", e);
    return null;
  }
}

async function refreshProfile() {
  if (!supabaseClient || !currentSession?.user) {
    currentProfile = null;
    return;
  }

  const user = currentSession.user;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    currentProfile = {
      full_name: user.email || "Usuário",
      role: "collaborator",
    };
    return;
  }
  currentProfile = data;
}

function buildHourlySlots(start, end) {
  const slots = [];
  for (let hour = start; hour < end; hour += 1) {
    slots.push(`${pad2(hour)}:00 - ${pad2(hour + 1)}:00`);
  }
  return slots;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function isSlotLocked(index) {
  if (canViewPanel()) return false; // gestores e admins ficam livres
  const today = new Date().toISOString().split("T")[0];
  const selectedDate = pesquisaMeta.dataPesquisa;
  if (!selectedDate) return false;
  if (selectedDate !== today) return true;
  // For today: lock slots whose start hour hasn't been reached yet
  const slotStartHour = START_HOUR + index;
  const currentHour = new Date().getHours();
  return slotStartHour > currentHour;
}

function renderInputs() {
  inputsContainer.innerHTML = "";
  hourlySlots.forEach((slot, index) => {
    const row = document.createElement("div");
    row.className = "input-row";

    const label = document.createElement("label");
    label.setAttribute("for", `slot-${index}`);
    label.textContent = slot;

    const input = document.createElement("input");
    input.id = `slot-${index}`;
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = String(fluxoData[index] ?? 0);

    if (isSlotLocked(index)) {
      input.disabled = true;
      input.title = "Horário ainda não disponível ou data diferente de hoje";
      row.classList.add("input-row-locked");
    } else {
      input.addEventListener("input", (event) => {
        const num = Number.parseInt(event.target.value, 10);
        fluxoData[index] = Number.isNaN(num) || num < 0 ? 0 : num;
        saveData();
        enqueueSync("hour_update");
        renderAll();
      });
      input.addEventListener("focus", () => {
        if (input.value === "0") input.value = "";
      });
      input.addEventListener("blur", () => {
        if (input.value === "") input.value = "0";
      });
    }

    row.appendChild(label);
    row.appendChild(input);
    inputsContainer.appendChild(row);
  });
}

function renderAll() {
  updateResearchHeader();
  updateHeaderStats();
  updateTable();
  updateChart();
  updateComparativeReport();
}

function updateHeaderStats() {
  const total = fluxoData.reduce((sum, value) => sum + value, 0);
  const average = total / fluxoData.length;
  const highest = getHighestHour();
  const lowest = getLowestHour();

  totalPessoasEl.textContent = String(total);
  mediaHoraEl.textContent = average.toFixed(1);
  dataAtualEl.textContent = pesquisaMeta.dataPesquisa
    ? formatDatePtBr(pesquisaMeta.dataPesquisa)
    : new Date().toLocaleDateString("pt-BR");
  horarioPicoEl.textContent = highest ? `${highest.slot} (${highest.value})` : "--";
  menorFluxoEl.textContent = lowest ? `${lowest.slot} (${lowest.value})` : "--";
}

function updateTable() {
  tabelaBody.innerHTML = "";
  const total = fluxoData.reduce((sum, value) => sum + value, 0);

  hourlySlots.forEach((slot, index) => {
    const qtd = fluxoData[index] ?? 0;
    const percentage = total > 0 ? (qtd / total) * 100 : 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${slot}</td>
      <td>${qtd}</td>
      <td>${percentage.toFixed(1)}%</td>
    `;
    tabelaBody.appendChild(tr);
  });
}

function updateChart() {
  const ctx = document.getElementById("fluxoChart");
  const chartData = {
    labels: hourlySlots,
    datasets: [
      {
        label: "Pessoas por Hora",
        data: fluxoData,
        borderWidth: 2,
        borderColor: "#1f6feb",
        backgroundColor: "rgba(31, 111, 235, 0.15)",
        fill: true,
        tension: 0.25,
      },
    ],
  };

  if (chartInstance) {
    chartInstance.data = chartData;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: chartData,
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      plugins: { legend: { display: true } },
    },
  });
}

function initActions() {
  btnLoginEl.addEventListener("click", handleLogin);
  loginSenhaEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleLogin();
  });

  const btnCriarUsuarioEl = document.getElementById("btnCriarUsuario");
  if (btnCriarUsuarioEl) btnCriarUsuarioEl.addEventListener("click", handleCriarUsuario);

  const btnAtualizarUsuariosEl = document.getElementById("btnAtualizarUsuarios");
  if (btnAtualizarUsuariosEl) btnAtualizarUsuariosEl.addEventListener("click", carregarListaUsuarios);

  document.getElementById("btnCancelarEdicao")?.addEventListener("click", () => {
    document.getElementById("modalEditarUsuario").classList.add("hidden");
  });
  document.getElementById("btnSalvarEdicao")?.addEventListener("click", handleSalvarEdicao);

  btnLogoutEl.addEventListener("click", async () => {
    if (authBypass) {
      setAuthFeedback("Modo sem login ativo. Para reativar, defina authBypass=false.", "info");
      return;
    }
    if (supabaseClient) await supabaseClient.auth.signOut();
  });

  btnExportar.addEventListener("click", () => {
    window.print();
  });





  colaboradorPesquisaEl.addEventListener("change", onCollaboratorSelected);
  btnSalvarColaboradorEl.addEventListener("click", saveCollaboratorFromAdminForm);
  btnLimparColaboradorEl.addEventListener("click", resetAdminCollaboratorForm);
  filtroCidadeColaboradorEl.addEventListener("input", renderCollaboratorList);

  dataPesquisaEl.addEventListener("change", () => {
    const newDate = dataPesquisaEl.value;
    if (newDate && newDate !== previousDataPesquisa) {
      const hasData = fluxoData.some((v) => v > 0);
      if (hasData && previousDataPesquisa) {
        addToHistory(previousDataPesquisa, pesquisaMeta, [...fluxoData]);
      }
      fluxoData = Array(hourlySlots.length).fill(0);
      saveData();
      renderInputs();
    }
    previousDataPesquisa = newDate;
  });

  btnLimparHistoricoEl.addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja apagar todo o histórico?")) return;
    if (supabaseClient && currentSession) {
      await supabaseClient.from("historico").delete().eq("user_id", currentSession.user.id);
    }
    historico = [];
    saveHistory();
    renderHistoricoList();
  });

  [
    dataPesquisaEl,
    filialPesquisaEl,
    colaboradorPesquisaEl,
    cpfPesquisadorEl,
    cidadePesquisaEl,
    periodoPesquisaEl,
  ].forEach((el) => {
    el.addEventListener("input", onMetaChange);
    el.addEventListener("change", onMetaChange);
  });

  window.addEventListener("online", () => {
    updateSyncUI();
    flushSyncQueue();
  });

  window.addEventListener("offline", () => {
    updateSyncUI();
  });
}

async function handleLogin() {
  if (authBypass) {
    setAuthFeedback("Login desativado em modo teste. Defina authBypass=false para reativar.", "info");
    return;
  }

  if (!supabaseClient) {
    setAuthFeedback("Supabase ainda não configurado.", "error");
    return;
  }

  const email = loginEmailEl.value.trim().toLowerCase();
  const password = loginSenhaEl.value;
  if (!email || !password) {
    setAuthFeedback("Informe e-mail e senha.", "warning");
    return;
  }

  btnLoginEl.disabled = true;
  setAuthFeedback("Entrando...", "info");

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btnLoginEl.disabled = false;

  if (error) {
    setAuthFeedback(error.message || "Login inválido ou usuário sem acesso.", "error");
    return;
  }

  currentSession = data.session;
  await refreshProfile();
  loginSenhaEl.value = "";
  updateAuthUI();
}

function updateAuthUI() {
  if (!currentSession?.user) {
    authContainerEl.classList.remove("hidden");
    appContainerEl.classList.add("hidden");
    loginEmailEl.focus();
    return;
  }

  authContainerEl.classList.add("hidden");
  appContainerEl.classList.remove("hidden");

  const labelName = currentProfile?.full_name || currentSession.user.email || "Usuário";
  usuarioAtualEl.textContent = `${labelName} (${roleLabel(currentProfile?.role)})`;
  btnLogoutEl.textContent = authBypass ? "Modo Teste" : "Sair";
  applyAccessControl();
  renderCollaboratorList();
}

function applyAccessControl() {
  const managerAccess = canViewPanel();
  tabPainelEl.classList.toggle("hidden", !managerAccess);
  tabColaboradoresEl.classList.toggle("hidden", !managerAccess);
  painelSectionEl.classList.toggle("hidden", !managerAccess);
  colaboradoresSectionEl.classList.toggle("hidden", !managerAccess);
  // Histórico visible to all logged-in users
  tabHistoricoEl.classList.remove("hidden");

  if (!managerAccess) {
    tabs.forEach((tab) => tab.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));
    document.querySelector('[data-tab="coleta"]').classList.add("active");
    document.getElementById("coleta").classList.add("active");
  }
}

function canViewPanel() {
  if (authBypass) return true;
  if (!currentProfile) return false;
  return currentProfile.role === "admin" || currentProfile.role === "manager";
}

function roleLabel(role) {
  return role === "manager" ? "Gestor" : "Colaborador";
}

function getHighestHour() {
  let maxIdx = 0;
  for (let i = 1; i < fluxoData.length; i += 1) {
    if (fluxoData[i] > fluxoData[maxIdx]) maxIdx = i;
  }
  return { slot: hourlySlots[maxIdx], value: fluxoData[maxIdx] };
}

function getLowestHour() {
  let minIdx = 0;
  for (let i = 1; i < fluxoData.length; i += 1) {
    if (fluxoData[i] < fluxoData[minIdx]) minIdx = i;
  }
  return { slot: hourlySlots[minIdx], value: fluxoData[minIdx] };
}

function updateComparativeReport() {
  const ranked = hourlySlots
    .map((slot, idx) => ({ slot, value: fluxoData[idx] ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const first = ranked[0];
  const second = ranked[1] || ranked[0];
  const last = ranked[ranked.length - 1];
  const gap = first.value - last.value;
  const growthVsSecond = second.value === 0 ? 0 : ((first.value - second.value) / second.value) * 100;

  comparativoResumoEl.textContent =
    `Maior concentração em ${first.slot} com ${first.value} pessoas. Diferença para o menor horário: ${gap} pessoas. Variação do pico em relação ao segundo maior horário: ${growthVsSecond.toFixed(1)}%.`;

  rankingHorariosEl.innerHTML = "";
  ranked.slice(0, 5).forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "ranking-item";
    row.innerHTML = `<span>${index + 1}º ${item.slot}</span><span class="badge">${item.value} pessoas</span>`;
    rankingHorariosEl.appendChild(row);
  });
}

function enqueueSync(reason) {
  syncQueue.push(buildPayload(reason));
  saveSyncQueue();
  updateSyncUI();
  flushSyncQueue();
}

function buildPayload(reason) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    reason,
    createdAt: new Date().toISOString(),
    date: pesquisaMeta.dataPesquisa ? formatDatePtBr(pesquisaMeta.dataPesquisa) : new Date().toLocaleDateString("pt-BR"),
    total: fluxoData.reduce((sum, value) => sum + value, 0),
    intervals: hourlySlots.map((slot, idx) => ({ slot, people: fluxoData[idx] ?? 0 })),
    research: {
      city: pesquisaMeta.cidade,
      subsidiary: pesquisaMeta.filial,
      collaboratorName: pesquisaMeta.nomeColaborador,
      collaboratorCpf: pesquisaMeta.cpf,
      period: pesquisaMeta.periodo,
      monthReference: getMonthReferenceLabel(),
    },
  };
}

async function flushSyncQueue() {
  if (syncQueue.length === 0) {
    updateSyncUI();
    return;
  }

  if (!navigator.onLine) {
    setSyncFeedback(`Offline. ${syncQueue.length} item(ns) em fila — sincronizará automaticamente ao conectar.`, "warning");
    updateSyncUI();
    return;
  }

  if (!supabaseClient || !currentSession) {
    setSyncFeedback("Faça login para sincronizar com o Supabase.", "info");
    updateSyncUI();
    return;
  }

  if (syncInProgress) {
    updateSyncUI();
    return;
  }

  syncInProgress = true;
  updateSyncUI();

  try {
    const payload = buildPayload("sync");
    const { error } = await supabaseClient.from("contagens").upsert({
      id: `${currentSession.user.id}-${payload.date.split("/").reverse().join("-")}`,
      user_id: currentSession.user.id,
      date: pesquisaMeta.dataPesquisa || new Date().toISOString().split("T")[0],
      total: payload.total,
      intervals: payload.intervals,
      city: payload.research.city,
      subsidiary: payload.research.subsidiary,
      collaborator_name: payload.research.collaboratorName,
      collaborator_cpf: payload.research.collaboratorCpf,
      period: payload.research.period,
      month_reference: payload.research.monthReference,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    syncQueue = [];
    saveSyncQueue();
    lastSyncSuccessAt = new Date();
    setSyncFeedback(`Sincronizado com Supabase às ${lastSyncSuccessAt.toLocaleTimeString("pt-BR")}.`, "success");

    // Mostra a mensagem de sucesso no rodapé automaticamente
    const footMsg = document.getElementById("enviarContagemFeedback");
    if (footMsg) {
      footMsg.textContent = `Dados salvos e sincronizados com sucesso às ${lastSyncSuccessAt.toLocaleTimeString("pt-BR")}!`;
      footMsg.className = "sync-feedback success";
      footMsg.style.display = "block";
    }

  } catch (e) {
    setSyncFeedback(`Erro ao sincronizar: ${e.message}. Tentará novamente automaticamente.`, "error");
  }

  syncInProgress = false;
  updateSyncUI();
}

function updateSyncUI() {
  const online = navigator.onLine;
  const logado = Boolean(supabaseClient && currentSession);

  statusConexaoEl.classList.remove("online", "offline");
  statusConexaoEl.classList.add(online ? "online" : "offline");
  statusConexaoEl.textContent = online ? "Online" : "Offline";

  const syncStatus = syncInProgress ? "Sincronizando..." : "Aguardando";
  statusFilaEl.textContent = `Supabase ${logado ? "conectado" : "desconectado"} | ${syncStatus} | Fila pendente: ${syncQueue.length}`;




  if (!logado) {
    setSyncFeedback("Faça login para sincronizar com o Supabase.", "info");
  } else if (!online) {
    setSyncFeedback(`Offline. ${syncQueue.length} item(ns) em fila — sincronizará ao reconectar.`, "warning");
  } else if (syncQueue.length > 0) {
    setSyncFeedback(`${syncQueue.length} item(ns) em fila. Clique em "Sincronizar agora" ou aguarde.`, "warning");
  } else if (lastSyncSuccessAt) {
    setSyncFeedback(`Tudo sincronizado com Supabase às ${lastSyncSuccessAt.toLocaleTimeString("pt-BR")}.`, "success");
  } else {
    setSyncFeedback("Sem itens pendentes para envio.", "success");
  }
}

function setAuthFeedback(message, type) {
  authFeedbackEl.textContent = message;
  authFeedbackEl.classList.remove("info", "success", "warning", "error");
  authFeedbackEl.classList.add(type);
}

function setSyncFeedback(message, type) {
  syncFeedbackEl.textContent = message;
  syncFeedbackEl.classList.remove("info", "success", "warning", "error");
  syncFeedbackEl.classList.add(type);
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array(hourlySlots.length).fill(0);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array(hourlySlots.length).fill(0);
    return hourlySlots.map((_, index) => {
      const value = Number.parseInt(parsed[index], 10);
      return Number.isNaN(value) || value < 0 ? 0 : value;
    });
  } catch {
    return Array(hourlySlots.length).fill(0);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fluxoData));
  
  // If editing a day that already exists in history, update it too
  if (pesquisaMeta.dataPesquisa) {
    const idx = historico.findIndex((e) => e.date === pesquisaMeta.dataPesquisa);
    if (idx >= 0) {
      // Use a timeout or flag to avoid showing "Editado" badge for every single keystroke
      // but ensure data is synced.
      const entry = historico[idx];
      const total = fluxoData.reduce((s, v) => s + v, 0);
      
      historico[idx] = {
        ...entry,
        filial: pesquisaMeta.filial,
        nomeColaborador: pesquisaMeta.nomeColaborador,
        cpf: pesquisaMeta.cpf,
        cidade: pesquisaMeta.cidade,
        periodo: pesquisaMeta.periodo,
        mesReferencia: pesquisaMeta.mesReferencia,
        total,
        data: [...fluxoData],
        updatedAt: new Date().toISOString()
      };
      saveHistory();
      renderHistoricoList();
    }
  }
}

function loadSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSyncQueue() {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
}



function loadPesquisaMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) {
      return {
        dataPesquisa: "",
        mesReferencia: "",
        filial: "",
        nomeColaborador: "",
        cpf: "",
        cidade: "",
        periodo: "Integral",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      dataPesquisa: parsed.dataPesquisa || "",
      mesReferencia: parsed.mesReferencia || "",
      filial: parsed.filial || "",
      nomeColaborador: parsed.nomeColaborador || "",
      cpf: parsed.cpf || "",
      cidade: parsed.cidade || "",
      periodo: parsed.periodo || "Integral",
    };
  } catch {
    return {
      dataPesquisa: "",
      mesReferencia: "",
      filial: "",
      nomeColaborador: "",
      cpf: "",
      cidade: "",
      periodo: "Integral",
    };
  }
}

async function loadCollaboratorsFromSupabase() {
  if (!supabaseClient || !currentSession) return;

  try {
    const { data, error } = await supabaseClient
      .from("colaboradores")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    if (data) {
      collaborators = data.map(c => ({
        id: c.id,
        name: c.name,
        cpf: c.cpf,
        city: c.city,
        researchDate: c.research_date,
        subsidiary: c.subsidiary,
        monthReference: c.month_reference,
        period: c.period
      }));
      saveCollaborators(); // Backup local
      populateCollaboratorSelect();
      renderCollaboratorList();
    }
  } catch (e) {
    console.error("Erro ao carregar colaboradores:", e);
  }
}

function loadCollaborators() {
  const local = localStorage.getItem(COLLABORATORS_KEY);
  if (local) {
    try { return JSON.parse(local); } catch (e) { return getDefaultCollaborators(); }
  }
  return getDefaultCollaborators();
}


function saveCollaborators() {
  localStorage.setItem(COLLABORATORS_KEY, JSON.stringify(collaborators));
}

function getDefaultCollaborators() {
  const month = getCurrentMonthIso();
  return [
    { id: crypto.randomUUID(), name: "Colaborador 1", cpf: "", city: "", subsidiary: "", monthReference: month, period: "Integral" },
    { id: crypto.randomUUID(), name: "Colaborador 2", cpf: "", city: "", subsidiary: "", monthReference: month, period: "Integral" },
    { id: crypto.randomUUID(), name: "Colaborador 3", cpf: "", city: "", subsidiary: "", monthReference: month, period: "Integral" },
  ];
}

function populateCollaboratorSelect() {
  const selectedName = pesquisaMeta.nomeColaborador || "";
  colaboradorPesquisaEl.innerHTML =
    `<option value="">Selecione...</option>` +
    collaborators.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
  colaboradorPesquisaEl.value = selectedName;
}

function savePesquisaMeta() {
  localStorage.setItem(META_KEY, JSON.stringify(pesquisaMeta));
  saveData(); // Sync with history if needed
}

function hydrateMetaInputs() {
  dataPesquisaEl.value = pesquisaMeta.dataPesquisa || "";
  filialPesquisaEl.value = pesquisaMeta.filial || "";
  colaboradorPesquisaEl.value = pesquisaMeta.nomeColaborador || "";
  cpfPesquisadorEl.value = pesquisaMeta.cpf || "";
  cidadePesquisaEl.value = pesquisaMeta.cidade || "";
  periodoPesquisaEl.value = pesquisaMeta.periodo || "Integral";
}

function onMetaChange() {
  const today = new Date().toISOString().split("T")[0];
  if (dataPesquisaEl.value > today) {
    alert("Não é permitido selecionar uma data futura para a pesquisa.");
    dataPesquisaEl.value = today;
  }

  const autoMonth = dataPesquisaEl.value ? dataPesquisaEl.value.slice(0, 7) : getCurrentMonthIso();
  pesquisaMeta = {
    dataPesquisa: dataPesquisaEl.value,
    mesReferencia: autoMonth,
    filial: filialPesquisaEl.value.trim(),
    nomeColaborador: colaboradorPesquisaEl.value.trim(),
    cpf: cpfPesquisadorEl.value.trim(),
    cidade: cidadePesquisaEl.value.trim(),
    periodo: periodoPesquisaEl.value,
  };
  savePesquisaMeta();
  renderAll();
}

function onCollaboratorSelected() {
  const selectedName = colaboradorPesquisaEl.value.trim();
  if (!selectedName) {
    pesquisaMeta.nomeColaborador = "";
    savePesquisaMeta();
    renderAll();
    return;
  }

  const found = collaborators.find((item) => item.name === selectedName);
  if (!found) return;

  pesquisaMeta.nomeColaborador = found.name;
  pesquisaMeta.cpf = found.cpf || "";
  pesquisaMeta.cidade = found.city || "";
  pesquisaMeta.periodo = found.period || "Integral";
  pesquisaMeta.mesReferencia = found.monthReference || pesquisaMeta.mesReferencia;
  pesquisaMeta.filial = found.subsidiary || pesquisaMeta.filial;
  if (found.researchDate) {
    pesquisaMeta.dataPesquisa = found.researchDate;
  }

  hydrateMetaInputs();
  savePesquisaMeta();
  renderAll();
}

async function saveCollaboratorFromAdminForm() {
  if (!canViewPanel()) {
    setAdminFeedback("Apenas administrador pode editar colaboradores.", "error");
    return;
  }

  const name = adminNomeColaboradorEl.value.trim();
  if (!name) {
    setAdminFeedback("Informe o nome do colaborador.", "warning");
    return;
  }

  const id = editingCollaboratorId || crypto.randomUUID();
  const payload = {
    id,
    name,
    cpf: adminCpfColaboradorEl.value.trim(),
    city: adminCidadeColaboradorEl.value.trim(),
    research_date: adminDataPesquisaColaboradorEl.value,
    subsidiary: adminFilialColaboradorEl.value.trim(),
    month_reference: adminDataPesquisaColaboradorEl.value ? adminDataPesquisaColaboradorEl.value.slice(0, 7) : getCurrentMonthIso(),
    period: adminPeriodoColaboradorEl.value,
    updated_at: new Date().toISOString()
  };

  setAdminFeedback("Salvando na nuvem...", "info");

  try {
    const { error } = await supabaseClient.from("colaboradores").upsert(payload);
    if (error) throw error;

    await loadCollaboratorsFromSupabase(); // Atualiza a lista local com os dados do banco
    setAdminFeedback("Colaborador salvo com sucesso!", "success");
    resetAdminCollaboratorForm(false);
  } catch (e) {
    setAdminFeedback("Erro ao salvar: " + e.message, "error");
  }
}


function renderCollaboratorList() {
  listaColaboradoresEl.innerHTML = "";
  const cityFilter = filtroCidadeColaboradorEl.value.trim().toLowerCase();
  const filtered = cityFilter
    ? collaborators.filter((item) => (item.city || "").toLowerCase().includes(cityFilter))
    : collaborators;

  if (filtered.length === 0) {
    listaColaboradoresEl.innerHTML = `<div class="note">Nenhum colaborador cadastrado.</div>`;
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement("div");
    row.className = "ranking-item";
    row.innerHTML = `
      <span>${escapeHtml(item.name)} - ${escapeHtml(item.city || "Sem cidade")}</span>
      <span class="badge">${escapeHtml(item.subsidiary || "Sem filial")} | ${escapeHtml(formatMonthIsoLabel(item.monthReference))}</span>
    `;

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn-secondary";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => editCollaborator(item.id));

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-secondary";
    removeBtn.textContent = "Remover";
    removeBtn.addEventListener("click", () => removeCollaborator(item.id));

    const actions = document.createElement("div");
    actions.className = "admin-actions";
    actions.appendChild(editBtn);
    actions.appendChild(removeBtn);
    row.appendChild(actions);
    listaColaboradoresEl.appendChild(row);
  });
}

function editCollaborator(id) {
  const found = collaborators.find((item) => item.id === id);
  if (!found) return;
  editingCollaboratorId = found.id;
  adminNomeColaboradorEl.value = found.name;
  adminCpfColaboradorEl.value = found.cpf || "";
  adminCidadeColaboradorEl.value = found.city || "";
  adminDataPesquisaColaboradorEl.value = found.researchDate || "";
  adminFilialColaboradorEl.value = found.subsidiary || "";
  adminPeriodoColaboradorEl.value = found.period || "Integral";
  setAdminFeedback(`Editando: ${found.name}`, "info");
}

async function removeCollaborator(id) {
  if (!confirm("Tem certeza que deseja remover este colaborador?")) return;
  
  setAdminFeedback("Removendo...", "info");
  
  try {
    const { error } = await supabaseClient.from("colaboradores").delete().eq("id", id);
    if (error) throw error;
    
    await loadCollaboratorsFromSupabase();
    setAdminFeedback("Colaborador removido.", "success");
  } catch (e) {
    setAdminFeedback("Erro ao remover: " + e.message, "error");
  }
}

function resetAdminCollaboratorForm(showMessage = true) {
  editingCollaboratorId = null;
  adminNomeColaboradorEl.value = "";
  adminCpfColaboradorEl.value = "";
  adminCidadeColaboradorEl.value = "";
  adminDataPesquisaColaboradorEl.value = "";
  adminFilialColaboradorEl.value = "";
  adminPeriodoColaboradorEl.value = "Integral";
  if (showMessage) {
    setAdminFeedback("Formulário limpo.", "info");
  }
}

function setAdminFeedback(message, type) {
  adminFeedbackEl.textContent = message;
  adminFeedbackEl.classList.remove("info", "success", "warning", "error");
  adminFeedbackEl.classList.add(type);
}

function updateResearchHeader() {
  refFilialEl.textContent = pesquisaMeta.filial || "--";
  refDataEl.textContent = pesquisaMeta.dataPesquisa ? formatDatePtBr(pesquisaMeta.dataPesquisa) : "--/--/----";
  refCidadeEl.textContent = pesquisaMeta.cidade || "--";
  refPesquisadorEl.textContent = pesquisaMeta.nomeColaborador || "--";
  refCpfEl.textContent = pesquisaMeta.cpf || "--";
  refPeriodoEl.textContent = pesquisaMeta.periodo || "--";

  const filialLabel = pesquisaMeta.filial || "";
  const dataLabel = pesquisaMeta.dataPesquisa ? formatDatePtBr(pesquisaMeta.dataPesquisa) : "";
  const parts = ["Contagem fluxo", filialLabel, dataLabel].filter(Boolean);
  tituloTabelaEl.textContent = parts.join(" ");
}

function getMonthReferenceLabel() {
  const monthIso = pesquisaMeta.mesReferencia || (pesquisaMeta.dataPesquisa ? pesquisaMeta.dataPesquisa.slice(0, 7) : "");
  if (!monthIso) return "--/----";
  const [year, month] = monthIso.split("-");
  return `${month}/${year}`;
}

function formatDatePtBr(dateIso) {
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

function populateReferenceSelectors() {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const monthOptions = monthNames
    .map((name, idx) => `<option value="${String(idx + 1).padStart(2, "0")}">${name}</option>`)
    .join("");
  const yearOptions = years.map((year) => `<option value="${year}">${year}</option>`).join("");
  if (mesReferenciaMesEl) mesReferenciaMesEl.innerHTML = monthOptions;
  if (mesReferenciaAnoEl) mesReferenciaAnoEl.innerHTML = yearOptions;
  if (adminMesReferenciaMesEl) adminMesReferenciaMesEl.innerHTML = monthOptions;
  if (adminMesReferenciaAnoEl) adminMesReferenciaAnoEl.innerHTML = yearOptions;
}

function setMonthSelectors(monthIso, monthEl = mesReferenciaMesEl, yearEl = mesReferenciaAnoEl) {
  if (!monthEl || !yearEl) return;
  const fallback = getCurrentMonthIso();
  const target = monthIso || fallback;
  const [year, month] = target.split("-");
  yearEl.value = year;
  monthEl.value = month;
}

function buildMonthIsoFromSelectors(monthEl = mesReferenciaMesEl, yearEl = mesReferenciaAnoEl) {
  if (!monthEl || !yearEl) return "";
  const year = yearEl.value;
  const month = monthEl.value;
  if (!year || !month) return "";
  return `${year}-${month}`;
}

function getCurrentMonthIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthIsoLabel(monthIso) {
  if (!monthIso) return "--/----";
  const [year, month] = monthIso.split("-");
  return `${month}/${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}



function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // silent fail
    });
  });
}

// ── Histórico ────────────────────────────────────────────────

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(historico));
}

async function loadHistoryFromSupabase() {
  if (!supabaseClient || !currentSession) return;

  const feedbackEl = document.getElementById("historicoFeedback");
  if (feedbackEl) {
    feedbackEl.textContent = "Sincronizando histórico com a nuvem...";
    feedbackEl.className = "sync-feedback info";
  }

  try {
    const { data, error } = await supabaseClient
      .from("contagens")
      .select("*")
      .order("date", { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      const remoteHistory = data.map((item) => ({
        date: item.date,
        total: item.total,
        data: item.intervals.map((i) => i.people),
        cidade: item.city,
        filial: item.subsidiary,
        nomeColaborador: item.collaborator_name,
        cpf: item.collaborator_cpf,
        periodo: item.period,
        mesReferencia: item.month_reference,
        updatedAt: item.updated_at,
        isSynced: true
      }));

      // Mescla e evita duplicados por data
      const existingDates = new Set(historico.map(h => h.date));
      const newItems = remoteHistory.filter(h => !existingDates.has(h.date));
      
      historico = [...historico, ...newItems].sort((a, b) => new Date(b.date) - new Date(a.date));
      saveHistory();
    }
    
    renderHistoricoList();
  } catch (e) {
    console.error("Erro ao carregar histórico do Supabase:", e);
    if (feedbackEl) {
      feedbackEl.textContent = "Erro ao sincronizar histórico. Usando dados locais.";
      feedbackEl.className = "sync-feedback warning";
    }
  }
}


async function upsertHistoricoSupabase(entry) {
  if (!supabaseClient || !currentSession) return;
  const entryDate = entry.date;
  await supabaseClient.from("contagens").upsert({
    id: `${currentSession.user.id}-${entryDate}`,
    user_id: currentSession.user.id,
    date: entryDate,
    total: entry.total,
    intervals: hourlySlots.map((slot, idx) => ({ slot, people: entry.data[idx] ?? 0 })),
    city: entry.cidade,
    subsidiary: entry.filial,
    collaborator_name: entry.nomeColaborador,
    collaborator_cpf: entry.cpf,
    period: entry.periodo,
    month_reference: entry.mesReferencia,
    updated_at: new Date().toISOString(),
  });
}


async function deleteHistoricoSupabase(entryId) {
  if (!supabaseClient || !currentSession) return;
  const entryDate = entryId.substring(0, 10); // extrai "YYYY-MM-DD" do id local
  const supabaseId = `${currentSession.user.id}-${entryDate}`;
  await supabaseClient.from("contagens").delete().eq("id", supabaseId);
}


function addToHistory(date, meta, data) {
  const total = data.reduce((s, v) => s + v, 0);
  const entry = {
    id: `${date}-${Date.now()}`,
    date,
    filial: meta.filial || "",
    nomeColaborador: meta.nomeColaborador || "",
    cpf: meta.cpf || "",
    cidade: meta.cidade || "",
    periodo: meta.periodo || "",
    mesReferencia: meta.mesReferencia || "",
    total,
    data,
    savedAt: new Date().toISOString(),
    updatedAt: null,
  };

  const idx = historico.findIndex((e) => e.date === date);
  if (idx >= 0) {
    entry.id = historico[idx].id;
    entry.savedAt = historico[idx].savedAt;
    entry.updatedAt = new Date().toISOString();
    historico[idx] = entry;
  } else {
    historico.unshift(entry);
  }
  saveHistory();
  upsertHistoricoSupabase(entry);
  renderHistoricoList();
}

function renderHistoricoList() {
  listaHistoricoEl.innerHTML = "";

  if (historico.length === 0) {
    historicoFeedbackEl.textContent = "Nenhum registro ainda. Os dados são salvos automaticamente ao trocar de dia.";
    historicoFeedbackEl.className = "sync-feedback info";
    return;
  }

  historicoFeedbackEl.textContent = `${historico.length} registro(s) salvo(s).`;
  historicoFeedbackEl.className = "sync-feedback success";

  historico.forEach((entry) => {
    const card = document.createElement("div");
    card.className = "historico-card";
    card.dataset.id = entry.id;

    const pico = entry.data.reduce(
      (best, v, i) => (v > best.v ? { v, i } : best),
      { v: -1, i: 0 },
    );
    const picoLabel = pico.v >= 0 ? `${hourlySlots[pico.i]} (${pico.v})` : "--";

    const editInfo = entry.updatedAt
      ? `<span class="historico-edited">Editado: ${new Date(entry.updatedAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}</span>`
      : "";

    card.innerHTML = `
      <div class="historico-header" data-id="${escapeHtml(entry.id)}">
        <div class="historico-info">
          <span class="historico-date">${formatDatePtBr(entry.date)} ${editInfo}</span>
          <span class="historico-meta">${escapeHtml(entry.filial || "Sem filial")} · ${escapeHtml(entry.cidade || "Sem cidade")} · ${escapeHtml(entry.nomeColaborador || "Sem colaborador")}</span>
        </div>
        <div class="historico-summary">
          <span class="badge historico-total">${entry.total} pessoas</span>
          <span class="historico-pico">Pico: ${escapeHtml(picoLabel)}</span>
          <button class="btn-apagar-header" data-id="${escapeHtml(entry.id)}" title="Apagar registro">🗑</button>
          <span class="historico-chevron">▼</span>
        </div>
      </div>
      <div class="historico-body hidden">
        <table class="historico-table">
          <thead><tr><th>Horário</th><th>Pessoas</th></tr></thead>
          <tbody>
            ${hourlySlots.map((slot, i) => `<tr><td>${slot}</td><td>${entry.data[i] ?? 0}</td></tr>`).join("")}
          </tbody>
          <tfoot><tr><td><strong>Total</strong></td><td><strong>${entry.total}</strong></td></tr></tfoot>
        </table>
        <div class="historico-actions">
          <button class="btn-secondary btn-restaurar" data-id="${escapeHtml(entry.id)}">⬆ Restaurar este dia</button>
          <button class="btn-danger btn-apagar" data-id="${escapeHtml(entry.id)}">Apagar</button>
        </div>
      </div>
    `;

    // Toggle expand
    card.querySelector(".historico-header").addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      const body = card.querySelector(".historico-body");
      const chevron = card.querySelector(".historico-chevron");
      body.classList.toggle("hidden");
      chevron.textContent = body.classList.contains("hidden") ? "▼" : "▲";
    });

    card.querySelector(".btn-restaurar").addEventListener("click", () => restoreFromHistory(entry.id));
    card.querySelector(".btn-apagar").addEventListener("click", () => deleteHistoricoEntry(entry.id));
    card.querySelector(".btn-apagar-header").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteHistoricoEntry(entry.id);
    });

    listaHistoricoEl.appendChild(card);
  });
}

function restoreFromHistory(id) {
  const entry = historico.find((e) => e.id === id);
  if (!entry) return;
  if (!confirm(`Restaurar os dados de ${formatDatePtBr(entry.date)}? Isso substituirá os dados atuais.`)) return;

  // Save current data to history before replacing (if it has data)
  const hasCurrentData = fluxoData.some((v) => v > 0);
  if (hasCurrentData && pesquisaMeta.dataPesquisa && pesquisaMeta.dataPesquisa !== entry.date) {
    addToHistory(pesquisaMeta.dataPesquisa, pesquisaMeta, [...fluxoData]);
  }

  fluxoData = [...entry.data];
  previousDataPesquisa = entry.date;
  pesquisaMeta = {
    dataPesquisa: entry.date,
    mesReferencia: entry.mesReferencia || pesquisaMeta.mesReferencia,
    filial: entry.filial,
    nomeColaborador: entry.nomeColaborador,
    cpf: entry.cpf,
    cidade: entry.cidade,
    periodo: entry.periodo,
  };

  saveData();
  savePesquisaMeta();
  hydrateMetaInputs();
  renderInputs();
  renderAll();

  // Switch to coleta tab
  tabs.forEach((t) => t.classList.remove("active"));
  tabContents.forEach((c) => c.classList.remove("active"));
  document.querySelector('[data-tab="coleta"]').classList.add("active");
  document.getElementById("coleta").classList.add("active");
}

function deleteHistoricoEntry(id) {
  if (!confirm("Apagar este registro do histórico?")) return;
  historico = historico.filter((e) => e.id !== id);
  saveHistory();
  deleteHistoricoSupabase(id);
  renderHistoricoList();
}

async function callManageUsers(payload) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const res = await fetch(`${window.SUPABASE_CONFIG.url}/functions/v1/manage-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": window.SUPABASE_CONFIG.anonKey,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function carregarListaUsuarios() {
  const feedbackEl = document.getElementById("listaUsuariosFeedback");
  const listaEl = document.getElementById("listaUsuarios");
  if (!feedbackEl || !listaEl) return;
  if (!supabaseClient || !currentSession) return;

  feedbackEl.textContent = "Carregando...";
  feedbackEl.className = "sync-feedback info";

  const result = await callManageUsers({ action: "list" });
  if (result.error) {
    feedbackEl.textContent = result.error;
    feedbackEl.className = "sync-feedback error";
    return;
  }

  const users = result.users || [];
  feedbackEl.textContent = `${users.length} usuário(s) cadastrado(s).`;
  feedbackEl.className = "sync-feedback info";

  listaEl.innerHTML = users.map((u) => `
    <div class="usuario-row">
      <div class="usuario-info">
        <div class="usuario-nome">${escapeHtml(u.full_name || "Sem nome")}</div>
        <div class="usuario-email">${escapeHtml(u.email)}</div>
      </div>
      <span class="usuario-role ${u.role}">${u.role === "manager" ? "Gestor" : "Colaborador"}</span>
      <div class="usuario-acoes">
        <button class="btn-secondary" onclick="abrirModalEdicao(${escapeHtml(JSON.stringify(u))})">Editar</button>
        <button class="btn-danger" onclick="removerUsuario('${escapeHtml(u.id)}', '${escapeHtml(u.email)}')">Remover</button>
      </div>
    </div>
  `).join("");
}

let _editandoUserId = null;

function abrirModalEdicao(user) {
  _editandoUserId = user.id;
  document.getElementById("editNome").value = user.full_name || "";
  document.getElementById("editEmail").value = user.email || "";
  document.getElementById("editSenha").value = "";
  document.getElementById("editRole").value = user.role || "collaborator";
  document.getElementById("editFeedback").textContent = "";
  document.getElementById("modalEditarUsuario").classList.remove("hidden");
}

async function handleSalvarEdicao() {
  const feedbackEl = document.getElementById("editFeedback");
  feedbackEl.textContent = "Salvando...";
  feedbackEl.className = "sync-feedback info";

  const payload = {
    action: "update",
    userId: _editandoUserId,
    full_name: document.getElementById("editNome").value.trim(),
    email: document.getElementById("editEmail").value.trim().toLowerCase(),
    role: document.getElementById("editRole").value,
  };
  const senha = document.getElementById("editSenha").value;
  if (senha) payload.password = senha;

  const result = await callManageUsers(payload);
  if (result.error) {
    feedbackEl.textContent = result.error;
    feedbackEl.className = "sync-feedback error";
    return;
  }

  document.getElementById("modalEditarUsuario").classList.add("hidden");
  carregarListaUsuarios();
}

async function removerUsuario(userId, email) {
  if (!confirm(`Remover o usuário ${email}? Esta ação não pode ser desfeita.`)) return;
  const result = await callManageUsers({ action: "delete", userId });
  if (result.error) {
    alert("Erro ao remover: " + result.error);
    return;
  }
  carregarListaUsuarios();
}

async function handleEnviarContagem() {
  const btn = document.getElementById("btnEnviarContagem");
  const feedbackEl = document.getElementById("enviarContagemFeedback");

  if (!currentSession) {
    feedbackEl.textContent = "Faça login para enviar.";
    feedbackEl.className = "sync-feedback error";
    feedbackEl.style.display = "block";
    return;
  }

  const total = fluxoData.reduce((s, v) => s + v, 0);
  if (total === 0) {
    feedbackEl.textContent = "Nenhuma contagem para enviar.";
    feedbackEl.className = "sync-feedback warning";
    feedbackEl.style.display = "block";
    return;
  }

  btn.disabled = true;
  feedbackEl.textContent = "Enviando...";
  feedbackEl.className = "sync-feedback info";
  feedbackEl.style.display = "block";

  try {
    const { error } = await supabaseClient.from("contagens").upsert({
      id: `${currentSession.user.id}-${pesquisaMeta.dataPesquisa || new Date().toISOString().split("T")[0]}`,
      user_id: currentSession.user.id,
      date: pesquisaMeta.dataPesquisa || new Date().toISOString().split("T")[0],
      total,
      intervals: hourlySlots.map((slot, idx) => ({ slot, people: fluxoData[idx] ?? 0 })),
      city: pesquisaMeta.cidade || "",
      subsidiary: pesquisaMeta.filial || "",
      collaborator_name: pesquisaMeta.nomeColaborador || "",
      collaborator_cpf: pesquisaMeta.cpf || "",
      period: pesquisaMeta.periodo || "",
      month_reference: getMonthReferenceLabel(),
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    addToHistory(
      pesquisaMeta.dataPesquisa || new Date().toISOString().split("T")[0],
      pesquisaMeta,
      [...fluxoData]
    );

    syncQueue = [];
    saveSyncQueue();
    lastSyncSuccessAt = new Date();
    feedbackEl.textContent = `Contagem enviada com sucesso às ${lastSyncSuccessAt.toLocaleTimeString("pt-BR")}!`;
    feedbackEl.className = "sync-feedback success";
    updateSyncUI();

    // Limpa os dados de pesquisa para uma nova contagem
    dataPesquisaEl.value = "";
    pesquisaMeta.dataPesquisa = "";
    previousDataPesquisa = "";
    savePesquisaMeta();

    // Limpa os campos de contagem
    fluxoData = fluxoData.map(() => 0);
    saveData();
    
    renderInputs();
    renderAll();

  } catch (e) {
    feedbackEl.textContent = `Erro ao enviar: ${e.message}`;
    feedbackEl.className = "sync-feedback error";
  } finally {
    btn.disabled = false;
  }
}

function setCriarUsuarioFeedback(message, type) {
  const el = document.getElementById("criarUsuarioFeedback");
  if (!el) return;
  el.textContent = message;
  el.className = `sync-feedback ${type}`;
}

async function handleCriarUsuario() {
  if (!supabaseClient) {
    setCriarUsuarioFeedback("Supabase não configurado.", "error");
    return;
  }

  const nome = document.getElementById("novoUsuarioNome").value.trim();
  const email = document.getElementById("novoUsuarioEmail").value.trim().toLowerCase();
  const senha = document.getElementById("novoUsuarioSenha").value;

  if (!email || !senha) {
    setCriarUsuarioFeedback("E-mail e senha são obrigatórios.", "warning");
    return;
  }
  if (senha.length < 6) {
    setCriarUsuarioFeedback("A senha deve ter no mínimo 6 caracteres.", "warning");
    return;
  }

  const btnCriar = document.getElementById("btnCriarUsuario");
  btnCriar.disabled = true;
  setCriarUsuarioFeedback("Criando usuário...", "info");

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const res = await fetch(
      `${window.SUPABASE_CONFIG.url}/functions/v1/create-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": window.SUPABASE_CONFIG.anonKey,
        },
        body: JSON.stringify({ email, password: senha, full_name: nome }),
      }
    );

    const result = await res.json();

    if (!res.ok) {
      setCriarUsuarioFeedback(result.error || "Erro ao criar usuário.", "error");
      return;
    }

    document.getElementById("novoUsuarioNome").value = "";
    document.getElementById("novoUsuarioEmail").value = "";
    document.getElementById("novoUsuarioSenha").value = "";
    setCriarUsuarioFeedback(`Usuário ${email} criado com sucesso!`, "success");
  } catch (e) {
    setCriarUsuarioFeedback(`Erro: ${e.message}`, "error");
  } finally {
    btnCriar.disabled = false;
  }
}
