// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://ogittgnxlefsfahppmse.supabase.co';
const SUPABASE_KEY = 'sb_publishable_7e3Nb7QMfmMPRexF34lLfA_R8wsjH_G';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== STATE =====
let currentUser = null;
let calendarDate = new Date();
let hidraData = { quantidade_ml: 0, meta_ml: 2000, id: null };
let perfilCache = { foto: null, carregado: false };

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
  setGreetingDate();

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    enterApp();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      currentUser = session.user;
      enterApp();
    } else {
      currentUser = null;
      showScreen('auth-screen');
    }
  });
});

// ===== THEME =====
function loadTheme() {
  const saved = localStorage.getItem('flowday-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-icon').textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('flowday-theme', next);
  document.getElementById('theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
}

// ===== AUTH =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
  setAuthMsg('', '');
}

function setAuthMsg(text, type) {
  const el = document.getElementById('auth-msg');
  el.textContent = text;
  el.className = 'auth-msg ' + type;
}

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) return setAuthMsg('Preencha todos os campos.', 'error');

  setAuthMsg('Entrando...', '');
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) setAuthMsg(error.message, 'error');
}

async function register() {
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  if (!name || !email || !password) return setAuthMsg('Preencha todos os campos.', 'error');
  if (password.length < 6) return setAuthMsg('Senha mínima de 6 caracteres.', 'error');

  setAuthMsg('Criando conta...', '');
  const { error } = await sb.auth.signUp({
    email, password,
    options: { data: { name } }
  });
  if (error) setAuthMsg(error.message, 'error');
  else setAuthMsg('Conta criada! Verifique seu email para confirmar.', 'success');
}

async function logout() {
  await sb.auth.signOut();
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function enterApp() {
  showScreen('app-screen');
  const name = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
  document.getElementById('greeting-name').textContent = name;
  document.getElementById('user-name-display').textContent = name;
  perfilCache = { foto: null, carregado: false };
  atualizarAvatares();
  carregarFotoInicial();
  goTo('dashboard');
  loadDashboard();
}

// ===== NAVIGATION =====
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  if (page === 'tarefas') loadTarefas();
  if (page === 'rotinas') loadRotinas();
  if (page === 'notas') loadNotas();
  if (page === 'hidratacao') loadHidratacao();
  if (page === 'calendario') loadCalendario();
  if (page === 'perfil') loadPerfil();
}

// ===== MODAIS =====
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function closeModalOutside(e, id) {
  if (e.target.id === id) closeModal(id);
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== DATA HELPER =====
function setGreetingDate() {
  const opts = { weekday: 'long', day: 'numeric', month: 'long' };
  document.getElementById('greeting-date').textContent =
    new Date().toLocaleDateString('pt-BR', opts);
}

// ===== DASHBOARD =====
async function loadDashboard() {
  if (!currentUser) return;

  // Tarefas pendentes
  const { data: tf } = await sb.from('tarefas').select('*').eq('user_id', currentUser.id).eq('concluida', false);
  document.getElementById('count-tarefas').textContent = `${tf?.length || 0} pendentes`;

  // Rotinas ativas
  const { data: rt } = await sb.from('rotinas').select('*').eq('user_id', currentUser.id).eq('ativa', true);
  document.getElementById('count-rotinas').textContent = `${rt?.length || 0} ativas`;

  // Notas
  const { data: nt } = await sb.from('notas').select('*').eq('user_id', currentUser.id);
  document.getElementById('count-notas').textContent = `${nt?.length || 0} notas`;

  // Hidratação hoje
  const hoje = new Date().toISOString().split('T')[0];
  const { data: hd } = await sb.from('hidratacao').select('*').eq('user_id', currentUser.id).eq('data', hoje).single();
  const atual = hd?.quantidade_ml || 0;
  const meta = hd?.meta_ml || 2000;
  document.getElementById('count-hidratacao').textContent = `${atual} / ${meta} ml`;
}

// ===== TAREFAS =====
async function loadTarefas() {
  const { data } = await sb.from('tarefas').select('*').eq('user_id', currentUser.id).order('criado_em', { ascending: false });
  const el = document.getElementById('lista-tarefas');

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">✅<p>Nenhuma tarefa ainda. Crie uma!</p></div>`;
    return;
  }

  el.innerHTML = data.map(t => `
    <div class="item-card ${t.concluida ? 'concluida' : ''}" id="tarefa-${t.id}">
      <div class="item-check ${t.concluida ? 'checked' : ''}" onclick="toggleTarefa('${t.id}', ${t.concluida})">
        ${t.concluida ? '✓' : ''}
      </div>
      <div class="item-info">
        <div class="item-title">${t.titulo}</div>
        ${t.descricao ? `<div class="item-sub">${t.descricao}</div>` : ''}
        ${t.data_vencimento ? `<div class="item-sub">📅 ${formatDate(t.data_vencimento)}</div>` : ''}
      </div>
      <button class="item-del" onclick="deletarTarefa('${t.id}')">🗑</button>
    </div>
  `).join('');
}

async function salvarTarefa() {
  const titulo = document.getElementById('tarefa-titulo').value.trim();
  if (!titulo) return showToast('Digite um título!');

  const { error } = await sb.from('tarefas').insert({
    user_id: currentUser.id,
    titulo,
    descricao: document.getElementById('tarefa-desc').value.trim() || null,
    data_vencimento: document.getElementById('tarefa-data').value || null,
  });

  if (error) return showToast('Erro ao salvar.');
  closeModal('modal-tarefa');
  document.getElementById('tarefa-titulo').value = '';
  document.getElementById('tarefa-desc').value = '';
  document.getElementById('tarefa-data').value = '';
  showToast('Tarefa criada! ✅');
  loadTarefas();
  loadDashboard();
}

async function toggleTarefa(id, atual) {
  await sb.from('tarefas').update({ concluida: !atual }).eq('id', id);
  loadTarefas();
  loadDashboard();
}

async function deletarTarefa(id) {
  await sb.from('tarefas').delete().eq('id', id);
  showToast('Tarefa removida.');
  loadTarefas();
  loadDashboard();
}

// ===== ROTINAS =====
async function loadRotinas() {
  const { data } = await sb.from('rotinas').select('*').eq('user_id', currentUser.id).order('criado_em', { ascending: false });
  const el = document.getElementById('lista-rotinas');

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty-state">🔁<p>Nenhuma rotina ainda. Crie uma!</p></div>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="item-card">
      <div class="item-check ${r.ativa ? 'checked' : ''}" onclick="toggleRotina('${r.id}', ${r.ativa})">
        ${r.ativa ? '✓' : ''}
      </div>
      <div class="item-info">
        <div class="item-title">${r.titulo}</div>
        <div class="item-sub">
          ${r.horario ? `🕐 ${r.horario.slice(0,5)}` : ''}
          ${r.horario && r.dias_semana?.length ? ' · ' : ''}
        </div>
        ${r.dias_semana?.length ? `
          <div class="dias-badges">
            ${r.dias_semana.map(d => `<span class="dia-badge">${d}</span>`).join('')}
          </div>` : ''}
      </div>
      <button class="item-del" onclick="deletarRotina('${r.id}')">🗑</button>
    </div>
  `).join('');
}

async function salvarRotina() {
  const titulo = document.getElementById('rotina-titulo').value.trim();
  if (!titulo) return showToast('Digite um título!');

  const dias = [...document.querySelectorAll('.dias-grid input:checked')].map(i => i.value);

  const { error } = await sb.from('rotinas').insert({
    user_id: currentUser.id,
    titulo,
    horario: document.getElementById('rotina-horario').value || null,
    dias_semana: dias,
  });

  if (error) return showToast('Erro ao salvar.');
  closeModal('modal-rotina');
  document.getElementById('rotina-titulo').value = '';
  document.getElementById('rotina-horario').value = '';
  document.querySelectorAll('.dias-grid input').forEach(i => i.checked = false);
  showToast('Rotina criada! 🔁');
  loadRotinas();
  loadDashboard();
}

async function toggleRotina(id, atual) {
  await sb.from('rotinas').update({ ativa: !atual }).eq('id', id);
  loadRotinas();
}

async function deletarRotina(id) {
  await sb.from('rotinas').delete().eq('id', id);
  showToast('Rotina removida.');
  loadRotinas();
  loadDashboard();
}

// ===== NOTAS =====
async function loadNotas() {
  const { data } = await sb.from('notas').select('*').eq('user_id', currentUser.id).order('criado_em', { ascending: false });
  const el = document.getElementById('lista-notas');

  if (!data || data.length === 0) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">📝<p>Nenhuma nota ainda. Crie uma!</p></div>`;
    return;
  }

  el.innerHTML = data.map(n => `
    <div class="nota-card">
      <div class="nota-titulo">${n.titulo}</div>
      <div class="nota-corpo">${n.conteudo || ''}</div>
      <button class="item-del" onclick="deletarNota('${n.id}')">🗑</button>
    </div>
  `).join('');
}

async function salvarNota() {
  const titulo = document.getElementById('nota-titulo').value.trim();
  if (!titulo) return showToast('Digite um título!');

  const { error } = await sb.from('notas').insert({
    user_id: currentUser.id,
    titulo,
    conteudo: document.getElementById('nota-conteudo').value.trim() || null,
  });

  if (error) return showToast('Erro ao salvar.');
  closeModal('modal-nota');
  document.getElementById('nota-titulo').value = '';
  document.getElementById('nota-conteudo').value = '';
  showToast('Nota salva! 📝');
  loadNotas();
  loadDashboard();
}

async function deletarNota(id) {
  await sb.from('notas').delete().eq('id', id);
  showToast('Nota removida.');
  loadNotas();
  loadDashboard();
}

// ===== HIDRATAÇÃO =====
async function loadHidratacao() {
  const hoje = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('hidratacao').select('*').eq('user_id', currentUser.id).eq('data', hoje).single();

  if (data) {
    hidraData = data;
  } else {
    hidraData = { quantidade_ml: 0, meta_ml: 2000, id: null };
  }

  updateHidraUI();
}

function updateHidraUI() {
  document.getElementById('hidra-atual').textContent = hidraData.quantidade_ml;
  document.getElementById('hidra-meta-text').textContent = hidraData.meta_ml;

  const circunf = 2 * Math.PI * 54; // 339.29
  const pct = Math.min(hidraData.quantidade_ml / hidraData.meta_ml, 1);
  const offset = circunf * (1 - pct);
  document.getElementById('hidra-circle').style.strokeDashoffset = offset;
}

async function addAgua(ml) {
  const novoTotal = hidraData.quantidade_ml + ml;
  const hoje = new Date().toISOString().split('T')[0];

  if (hidraData.id) {
    await sb.from('hidratacao').update({ quantidade_ml: novoTotal }).eq('id', hidraData.id);
    hidraData.quantidade_ml = novoTotal;
  } else {
    const { data } = await sb.from('hidratacao').insert({
      user_id: currentUser.id,
      quantidade_ml: novoTotal,
      meta_ml: 2000,
      data: hoje,
    }).select().single();
    if (data) hidraData = data;
  }

  updateHidraUI();
  loadDashboard();
  if (novoTotal >= hidraData.meta_ml) showToast('Meta de hidratação batida! 💧🎉');
}

async function resetAgua() {
  if (!hidraData.id) return;
  await sb.from('hidratacao').update({ quantidade_ml: 0 }).eq('id', hidraData.id);
  hidraData.quantidade_ml = 0;
  updateHidraUI();
  loadDashboard();
  showToast('Hidratação zerada.');
}

// ===== CALENDÁRIO =====
let eventosCache = [];

async function loadCalendario() {
  await fetchEventos();
  renderCalendar();
  renderEventosList();
}

async function fetchEventos() {
  const ano = calendarDate.getFullYear();
  const mes = calendarDate.getMonth() + 1;
  const mesStr = String(mes).padStart(2,'0');
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const inicio = `${ano}-${mesStr}-01`;
  const fim = `${ano}-${mesStr}-${String(ultimoDia).padStart(2,'0')}`;

  const { data, error } = await sb.from('eventos').select('*')
    .eq('user_id', currentUser.id)
    .gte('data_inicio', inicio)
    .lte('data_inicio', fim + 'T23:59:59')
    .order('data_inicio');

  if (error) console.error('Erro ao buscar eventos:', error);
  eventosCache = data || [];
}

function renderCalendar() {
  const ano = calendarDate.getFullYear();
  const mes = calendarDate.getMonth();
  const hoje = new Date();

  document.getElementById('cal-titulo').textContent =
    new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  // Dias que têm eventos — compara apenas a parte da data (YYYY-MM-DD)
  const mesStr = String(mes + 1).padStart(2,'0');
  const diasComEvento = new Set(eventosCache.map(ev => {
    return String(ev.data_inicio).slice(8, 10);
  }));

  let html = nomes.map(n => `<div class="cal-day-name">${n}</div>`).join('');

  for (let i = 0; i < primeiroDia; i++) {
    html += `<div class="cal-day empty"></div>`;
  }

  for (let d = 1; d <= totalDias; d++) {
    const isHoje = d === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
    const dStr = String(d).padStart(2,'0');
    const temEvento = diasComEvento.has(dStr);
    html += `
      <div class="cal-day ${isHoje ? 'today' : ''} ${temEvento ? 'has-event' : ''}" onclick="clickDia(${ano},${mes+1},${d})">
        <span>${d}</span>
        ${temEvento ? `<div class="event-dot"><span></span></div>` : ''}
      </div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function renderEventosList() {
  const el = document.getElementById('lista-eventos');
  const mesesNomes = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  if (eventosCache.length === 0) {
    el.innerHTML = `<div class="empty-state">📅<p>Nenhum evento neste mês. Clique em um dia para adicionar!</p></div>`;
    return;
  }

  el.innerHTML = `<h3>Eventos do mês (${eventosCache.length})</h3>` + eventosCache.map(ev => {
    const partes = String(ev.data_inicio).split('T');
    const [anoEv, mesEv, diaEv] = partes[0].split('-');
    const mesNome = mesesNomes[parseInt(mesEv, 10) - 1];
    const hora = partes[1] ? partes[1].slice(0, 5) : '';

    return `
      <div class="evento-card">
        <div class="evento-data">
          <span class="evento-dia">${diaEv}</span>
          <span class="evento-mes">${mesNome}</span>
        </div>
        <div class="evento-info">
          <div class="evento-titulo">${ev.titulo}</div>
          ${hora ? `<div class="evento-horario">🕐 ${hora}${ev.descricao ? ' &nbsp;·&nbsp; ' + ev.descricao : ''}</div>` : (ev.descricao ? `<div class="evento-horario">${ev.descricao}</div>` : '')}
        </div>
        <button class="item-del" onclick="deletarEvento('${ev.id}')">🗑</button>
      </div>
    `;
  }).join('');
}

function changeMonth(delta) {
  calendarDate.setMonth(calendarDate.getMonth() + delta);
  loadCalendario();
}

function clickDia(ano, mes, dia) {
  const dataStr = `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
  document.getElementById('evento-data').value = dataStr;
  document.getElementById('evento-hora').value = '';
  openModal('modal-evento');
}

async function salvarEvento() {
  const titulo = document.getElementById('evento-titulo').value.trim();
  const data = document.getElementById('evento-data').value;
  const hora = document.getElementById('evento-hora').value;
  if (!titulo) return showToast('Digite um título para o evento!');
  if (!data) return showToast('Selecione a data!');

  const dataInicio = hora ? `${data}T${hora}:00` : `${data}T00:00:00`;

  const { error } = await sb.from('eventos').insert({
    user_id: currentUser.id,
    titulo,
    descricao: document.getElementById('evento-desc').value.trim() || null,
    data_inicio: dataInicio,
    data_fim: null,
  });

  if (error) { console.error(error); return showToast('Erro ao salvar evento. Verifique o console.'); }

  closeModal('modal-evento');
  document.getElementById('evento-titulo').value = '';
  document.getElementById('evento-data').value = '';
  document.getElementById('evento-hora').value = '';
  document.getElementById('evento-desc').value = '';
  showToast('Evento criado! 📅');

  await fetchEventos();
  renderCalendar();
  renderEventosList();
}

async function deletarEvento(id) {
  await sb.from('eventos').delete().eq('id', id);
  showToast('Evento removido.');
  await fetchEventos();
  renderCalendar();
  renderEventosList();
}

// ===== PERFIL =====
async function loadPerfil() {
  const name = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
  document.getElementById('perfil-nome').value = name;
  document.getElementById('perfil-email').value = currentUser.email;

  if (!perfilCache.carregado) {
    const { data } = await sb.from('perfis').select('foto_base64').eq('user_id', currentUser.id).single();
    perfilCache.foto = data?.foto_base64 || null;
    perfilCache.carregado = true;
  }
  atualizarAvatares();
}

async function carregarFotoInicial() {
  if (perfilCache.carregado) return;
  const { data } = await sb.from('perfis').select('foto_base64').eq('user_id', currentUser.id).single();
  perfilCache.foto = data?.foto_base64 || null;
  perfilCache.carregado = true;
  atualizarAvatares();
}

function atualizarAvatares() {
  const name = currentUser.user_metadata?.name || currentUser.email.split('@')[0];
  const initials = name.slice(0, 2).toUpperCase();
  const foto = perfilCache.foto;

  // Avatar da página de perfil
  const img = document.getElementById('perfil-avatar-img');
  const ini = document.getElementById('perfil-avatar-initials');
  if (img) {
    if (foto) {
      img.src = foto;
      img.style.display = 'block';
      ini.style.display = 'none';
      document.getElementById('btn-remove-foto').style.display = 'inline-block';
    } else {
      img.style.display = 'none';
      ini.textContent = initials;
      ini.style.display = 'block';
      document.getElementById('btn-remove-foto').style.display = 'none';
    }
  }

  // Avatar mini da sidebar
  const sImg = document.getElementById('sidebar-avatar-img');
  const sIni = document.getElementById('sidebar-avatar-initials');
  if (foto) {
    sImg.src = foto;
    sImg.style.display = 'block';
    sIni.style.display = 'none';
  } else {
    sImg.style.display = 'none';
    sIni.textContent = initials;
    sIni.style.display = 'block';
  }
}

function trocarFoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) return showToast('Foto muito grande. Máximo 2MB.');

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    const { data: existing } = await sb.from('perfis').select('id').eq('user_id', currentUser.id).single();
    if (existing) {
      await sb.from('perfis').update({ foto_base64: base64 }).eq('user_id', currentUser.id);
    } else {
      await sb.from('perfis').insert({ user_id: currentUser.id, foto_base64: base64 });
    }
    perfilCache.foto = base64;
    atualizarAvatares();
    showToast('Foto atualizada! 📸');
  };
  reader.readAsDataURL(file);
}

async function removerFoto() {
  await sb.from('perfis').update({ foto_base64: null }).eq('user_id', currentUser.id);
  perfilCache.foto = null;
  document.getElementById('foto-input').value = '';
  atualizarAvatares();
  showToast('Foto removida.');
}

async function salvarPerfil() {
  const nome = document.getElementById('perfil-nome').value.trim();
  if (!nome) return showToast('Digite seu nome!');

  const { error } = await sb.auth.updateUser({ data: { name: nome } });
  if (error) return showToast('Erro ao salvar. Tente novamente.');

  currentUser.user_metadata.name = nome;
  document.getElementById('greeting-name').textContent = nome;
  document.getElementById('user-name-display').textContent = nome;
  atualizarAvatares();
  showToast('Perfil salvo! ✅');
}

// ===== UTILS =====
function formatDate(d) {
  if (!d) return '';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
