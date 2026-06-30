/*
 * Console web d'administration des licences HydroNet.
 * Page autonome (HTML + CSS + JS en ligne) servie par le serveur sur /admin.
 * Le secret admin est saisi dans le navigateur et envoyé en en-tête
 * (x-admin-secret) à chaque appel — jamais stocké côté serveur ni en clair.
 */
module.exports = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>HydroNet — Console des licences</title>
<style>
  :root { --bg:#0b2545; --card:#13315c; --line:#1e4a7a; --accent:#2f80ed; --ok:#27ae60; --warn:#e67e22; --bad:#e74c3c; --muted:#9fb3c8; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, Segoe UI, Roboto, sans-serif; background:#0a1929; color:#e6edf3; }
  header { background:var(--bg); padding:14px 22px; display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid var(--accent); }
  header h1 { font-size:18px; margin:0; font-weight:600; }
  header .sub { color:var(--muted); font-size:12px; }
  button { cursor:pointer; border:none; border-radius:6px; padding:8px 14px; font-size:13px; font-weight:600; }
  .btn-primary { background:var(--accent); color:#fff; }
  .btn-ghost { background:transparent; color:var(--muted); border:1px solid var(--line); }
  .btn-warn { background:var(--warn); color:#fff; }
  .btn-bad { background:var(--bad); color:#fff; }
  .btn-sm { padding:5px 9px; font-size:12px; }
  .wrap { max-width:1200px; margin:0 auto; padding:22px; }
  /* Login */
  #login { max-width:420px; margin:8vh auto; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:28px; }
  #login h2 { margin:0 0 6px; }
  #login p { color:var(--muted); font-size:13px; margin:0 0 18px; }
  input[type=password], input[type=text], input[type=number] { width:100%; padding:10px 12px; border-radius:7px; border:1px solid var(--line); background:#0a1929; color:#e6edf3; font-size:14px; }
  .err { color:var(--bad); font-size:13px; margin-top:10px; min-height:18px; }
  /* Cards */
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .card .n { font-size:26px; font-weight:700; }
  .card .l { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
  /* Toolbar */
  .toolbar { display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
  .toolbar .grow { flex:1 1 220px; }
  .gen { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px 16px; margin-bottom:18px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .gen label { font-size:13px; color:var(--muted); }
  .gen input { width:90px; }
  /* Table */
  table { width:100%; border-collapse:collapse; font-size:13px; background:var(--card); border-radius:10px; overflow:hidden; }
  th, td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--line); }
  th { background:#0e2746; color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.4px; position:sticky; top:0; }
  td.key { font-family:ui-monospace, Consolas, monospace; cursor:copy; }
  td.key:hover { color:var(--accent); }
  .badge { padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
  .b-free { background:#234; color:#9fb3c8; }
  .b-assigned { background:rgba(39,174,96,.18); color:#7ee2a8; }
  .b-revoked { background:rgba(231,76,60,.18); color:#ff9c92; }
  .b-demo { background:rgba(230,126,34,.18); color:#ffc27a; }
  .b-seed { background:rgba(47,128,237,.18); color:#9cc4ff; }
  .muted { color:var(--muted); }
  .actions { display:flex; gap:6px; }
  #status { color:var(--muted); font-size:12px; margin-left:auto; }
  .hidden { display:none; }
  .tablewrap { max-height:62vh; overflow:auto; border-radius:10px; border:1px solid var(--line); }
</style>
</head>
<body>

<div id="login">
  <h2>Console des licences</h2>
  <p>HydroNet — NovaSoft. Saisissez le secret d'administration.</p>
  <input id="secret" type="password" placeholder="ADMIN_SECRET" autofocus />
  <div class="err" id="loginErr"></div>
  <button class="btn-primary" style="width:100%;margin-top:14px" onclick="login()">Se connecter</button>
</div>

<div id="app" class="hidden">
  <header>
    <div>
      <h1>HydroNet — Console des licences</h1>
      <div class="sub">NovaSoft · gestion des clés de licence</div>
    </div>
    <button class="btn-ghost" onclick="logout()">Déconnexion</button>
  </header>

  <div class="wrap">
    <div class="cards" id="cards"></div>

    <div class="gen">
      <label>Générer</label>
      <input id="genCount" type="number" min="1" max="500" value="10" />
      <label>nouvelle(s) clé(s)</label>
      <button class="btn-primary btn-sm" onclick="generate()">Générer</button>
      <button class="btn-ghost btn-sm" onclick="exportCsv()">Exporter l'inventaire (CSV)</button>
      <span id="status"></span>
    </div>

    <div class="toolbar">
      <input class="grow" id="search" type="text" placeholder="Rechercher une clé ou un e-mail…" oninput="render()" />
      <button class="btn-ghost btn-sm" onclick="load()">Rafraîchir</button>
    </div>

    <div class="tablewrap">
      <table>
        <thead><tr>
          <th>#</th><th>Clé</th><th>Titulaire (e-mail)</th><th>Type</th><th>Poste lié</th><th>État</th><th>Actions</th>
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
let SECRET = sessionStorage.getItem('hn_admin_secret') || '';
let DATA = { counts:{}, rows:[] };

async function api(path, body) {
  const res = await fetch(path, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-admin-secret': SECRET },
    body: JSON.stringify(body || {}),
  });
  if (res.status === 401) { logout(); throw new Error('Non autorisé'); }
  if (!res.ok) throw new Error('Erreur ' + res.status);
  return res.json();
}

async function login() {
  SECRET = document.getElementById('secret').value.trim();
  if (!SECRET) return;
  try {
    document.getElementById('loginErr').textContent = 'Connexion…';
    await load();
    sessionStorage.setItem('hn_admin_secret', SECRET);
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  } catch (e) {
    document.getElementById('loginErr').textContent = 'Secret incorrect ou serveur injoignable.';
  }
}

function logout() {
  sessionStorage.removeItem('hn_admin_secret'); SECRET = '';
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login').classList.remove('hidden');
}

async function load() {
  const d = await api('/admin/inventory');
  DATA = d;
  renderCards();
  render();
}

function renderCards() {
  const c = DATA.counts || {};
  const cards = [
    ['Total', c.total, ''],
    ['Attribuées', c.assigned, ''],
    ['Libres', (c.total||0)-(c.assigned||0)-(c.revoked||0), ''],
    ['Révoquées', c.revoked, ''],
    ['Générées', c.generated, ''],
    ['Démo', c.demo, ''],
  ];
  document.getElementById('cards').innerHTML = cards.map(
    ([l,n]) => '<div class="card"><div class="n">'+(n??0)+'</div><div class="l">'+l+'</div></div>'
  ).join('');
}

function typeBadge(t) {
  if (t === 'demo') return '<span class="badge b-demo">démo</span>';
  if (t === 'pre-definie') return '<span class="badge b-seed">pré-définie</span>';
  return '<span class="badge">générée</span>';
}
function stateBadge(r) {
  if (r.revoked) return '<span class="badge b-revoked">révoquée</span>';
  if (r.email)   return '<span class="badge b-assigned">attribuée</span>';
  return '<span class="badge b-free">libre</span>';
}

function render() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  const rows = DATA.rows.filter(r =>
    !q || r.key.toLowerCase().includes(q) || (r.email||'').toLowerCase().includes(q)
  );
  document.getElementById('status').textContent = rows.length + ' / ' + DATA.rows.length + ' clés';
  const tb = document.getElementById('rows');
  tb.innerHTML = rows.slice(0, 2000).map((r, idx) => {
    const machine = r.machineId ? '<span class="muted">'+r.machineId.slice(0,12)+'…</span>' : '<span class="muted">—</span>';
    const email   = r.email ? r.email : '<span class="muted">—</span>';
    let actions = '';
    if (r.type !== 'demo') {
      if (!r.revoked) actions += '<button class="btn-bad btn-sm" onclick="revoke(\\''+r.key+'\\')">Révoquer</button>';
      if (r.machineId && !r.revoked) actions += '<button class="btn-warn btn-sm" onclick="unbind(\\''+r.key+'\\')">Détacher</button>';
    }
    return '<tr>'
      + '<td class="muted">'+(idx+1)+'</td>'
      + '<td class="key" title="Cliquer pour copier" onclick="copyKey(\\''+r.key+'\\')">'+r.key+'</td>'
      + '<td>'+email+'</td>'
      + '<td>'+typeBadge(r.type)+'</td>'
      + '<td>'+machine+'</td>'
      + '<td>'+stateBadge(r)+'</td>'
      + '<td><div class="actions">'+actions+'</div></td>'
      + '</tr>';
  }).join('');
}

function copyKey(k) { navigator.clipboard?.writeText(k); setStatus('Clé copiée : '+k); }
function setStatus(t) { document.getElementById('status').textContent = t; }

async function revoke(key) {
  if (!confirm('Révoquer définitivement la clé '+key+' ?\\nLe logiciel se bloquera chez le client (sous 30 j).')) return;
  await api('/admin/revoke', { key });
  await load();
}
async function unbind(key) {
  if (!confirm('Détacher la clé '+key+' de son poste actuel ?\\nLe client pourra réactiver sur un autre ordinateur.')) return;
  await api('/admin/unbind', { key });
  await load();
}

async function generate() {
  const count = Math.max(1, Math.min(500, parseInt(document.getElementById('genCount').value) || 1));
  setStatus('Génération de '+count+' clé(s)…');
  const d = await api('/admin/keys', { count });
  const keys = d.keys || (d.key ? [d.key] : []);
  // Téléchargement automatique des nouvelles clés
  downloadText('HydroNet-nouvelles-cles-'+stamp()+'.txt', keys.join('\\r\\n'));
  setStatus(keys.length + ' clé(s) générée(s) et téléchargée(s).');
  await load();
}

function exportCsv() {
  const head = 'N;Cle;Email;Type;PosteLie;Etat';
  const lines = DATA.rows.map((r, i) =>
    [i+1, r.key, r.email||'', r.type, r.machineId||'', r.revoked?'revoquee':(r.email?'attribuee':'libre')].join(';')
  );
  downloadText('HydroNet-inventaire-'+stamp()+'.csv', [head].concat(lines).join('\\r\\n'));
}

function downloadText(name, text) {
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2,'0');
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'-'+p(d.getHours())+p(d.getMinutes());
}

// Auto-connexion si un secret est déjà en session
if (SECRET) {
  load().then(() => {
    document.getElementById('login').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  }).catch(() => logout());
}
document.getElementById('secret').addEventListener('keydown', e => { if (e.key==='Enter') login(); });
</script>
</body>
</html>`;
