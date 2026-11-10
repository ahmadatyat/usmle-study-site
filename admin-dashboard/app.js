(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const login = byId('login'), overview = byId('overview'), statusPanel = byId('status-panel');
  const message = byId('message'), signOut = byId('sign-out'), retry = byId('retry');
  let accessData = null;
  let client, requestVersion = 0, sessionTimer, signingOut = false, sessionUserId = null;

  function clearData() {
    overview.hidden = true;
    window.BookshopAdmin?.clear();
    accessData = null;
    byId('grants').replaceChildren();
    byId('grant-search').value = '';
    byId('create-code').disabled = true;
    byId('accounts').replaceChildren();
    for (const id of ['codes','database-metrics','table-metrics','api-traffic','provider-measurements','deployments','accounts-chart','traffic-chart']) byId(id).replaceChildren();
    byId('code-form').reset();
    syncLimits();
    byId('code-message').textContent = '';
    for (const id of ['db-size','storage-size','db-connections','grant-count','supabase-status','bandwidth-status','scrape-status','vercel-status']) byId(id).textContent = '';
    for (const id of ['total', 'confirmed', 'active', 'new', 'study-states', 'study-settings', 'updated', 'directory-count', 'visits', 'hosting', 'vercel', 'login-limit', 'password-limit']) byId(id).textContent = '';
  }
  function notify(text) {
    message.textContent = text;
    message.hidden = !text;
    if (text) message.focus();
  }
  function showLogin() {
    ++requestVersion;
    clearData();
    login.hidden = false;
    statusPanel.hidden = true;
    signOut.hidden = true;
    byId('password').value = '';
  }
  function showStatus(title, description = '', canRetry = false) {
    login.hidden = true;
    overview.hidden = true;
    statusPanel.hidden = false;
    byId('status-title').textContent = title;
    byId('status-description').textContent = description;
    retry.hidden = !canRetry;
  }
  function dateTime(value) {
    if (!value) return 'Never';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function validate(data) {
    const counts = [data?.accounts?.total, data?.accounts?.confirmed, data?.accounts?.activeLast30Days, data?.accounts?.createdLast7Days, data?.usage?.savedStudyStates, data?.usage?.savedStudySettings];
    if (!counts.every((n) => Number.isSafeInteger(n) && n >= 0) || !Array.isArray(data?.accounts?.recent) || data.accounts.recent.length > 100 || !data?.visits || !data?.hosting || !data?.limits) throw new Error('Invalid overview response');
    return data;
  }
  function render(data) {
    const values = { total: data.accounts.total, confirmed: data.accounts.confirmed, active: data.accounts.activeLast30Days, new: data.accounts.createdLast7Days, 'study-states': data.usage.savedStudyStates, 'study-settings': data.usage.savedStudySettings, updated: `Updated ${dateTime(data.generatedAt)}`, 'directory-count': `${data.accounts.recent.length} accounts shown`, visits: data.visits.reason, hosting: `Hosting: ${data.hosting.provider}`, vercel: data.hosting.vercel, 'login-limit': data.limits.signInHistory, 'password-limit': data.limits.passwords };
    for (const [id, value] of Object.entries(values)) byId(id).textContent = String(value ?? 'Unavailable');
    const rows = data.accounts.recent.map((account) => {
      const row = document.createElement('tr');
      for (const value of [account.email ?? 'No email', account.email_confirmed_at ? 'Yes' : 'No', dateTime(account.created_at), dateTime(account.last_sign_in_at), account.trial_ends_at ? dateTime(account.trial_ends_at) : 'Not recorded']) {
        const cell = document.createElement('td');
        cell.textContent = String(value);
        row.append(cell);
      }
      return row;
    });
    byId('accounts').replaceChildren(...rows);
    barChart('accounts-chart', [['Total accounts', data.accounts.total], ['Confirmed', data.accounts.confirmed], ['Signed in · 30 days', data.accounts.activeLast30Days], ['New · 7 days', data.accounts.createdLast7Days]]);

    login.hidden = true;
    statusPanel.hidden = true;
    overview.hidden = false;
    signOut.hidden = false;
  }
  function bytes(value) {
    if (!Number.isFinite(Number(value))) return 'Unavailable';
    let n = Number(value), unit = 0;
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    while (n >= 1024 && unit < units.length - 1) { n /= 1024; ++unit; }
    return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[unit]}`;
  }
  function table(id, headings, rows) {
    const el = document.createElement('table'), head = document.createElement('thead'), body = document.createElement('tbody');
    const header = document.createElement('tr');
    for (const title of headings) { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; header.append(cell); }
    head.append(header);
    for (const values of rows) {
      const row = document.createElement('tr');
      for (const value of values) { const cell = document.createElement('td'); cell.textContent = String(value ?? 'Unavailable'); row.append(cell); }
      body.append(row);
    }
    el.append(head, body); byId(id).replaceChildren(el);
    if (!rows.length) { const empty = document.createElement('p'); empty.textContent = 'No measurements available.'; byId(id).append(empty); }
  }
  const featureLabels = {planning:'Planning',resources:'Resources',exams:'Exams',flashcards:'Flashcards',avatar:'Avatar',team:'Team and focus',step2:'Step 2 CK'};
  const featureText = features => (features || []).map(f => featureLabels[f] || f).join(' · ');
  function accessRow(values, action, actionLabel) {
    const row = document.createElement('tr');
    for (const value of values) { const cell = document.createElement('td'); cell.textContent = String(value ?? ''); row.append(cell); }
    const cell = document.createElement('td');
    if (action) {
      const button = document.createElement('button'); button.className = 'secondary'; button.type = 'button'; button.textContent = actionLabel;
      button.addEventListener('click', async () => {
        button.disabled = true; const version = requestVersion;
        try { const result = await action(); if (version === requestVersion && result) renderAccess(result); }
        catch (error) { if (version === requestVersion) byId('code-message').textContent = error.message; }
        finally { if (version === requestVersion) button.disabled = false; }
      }); cell.append(button);
    }
    row.append(cell); return row;
  }
  function renderAccess(data) {
    accessData = data;
    byId('create-code').disabled = false;
    byId('codes').replaceChildren(...data.codes.map(code => accessRow([
      code.code_value ?? 'Unavailable — older code', code.label, `${code.used} / ${code.unlimited_uses ? 'Unlimited' : code.max_users}`,
      code.unlimited_duration ? 'Unlimited' : `${code.duration_value} ${code.duration_unit}`,
      featureText(code.features), !code.enabled ? 'Disabled' : !code.unlimited_uses && code.used >= code.max_users ? 'Full' : 'Enabled'
    ], () => mutateCode('toggle', {id:code.id,enabled:!code.enabled}), code.enabled ? 'Disable' : 'Enable')));
    renderGrants();
  }
  function renderGrants() {
    const query = byId('grant-search').value.toLowerCase();
    byId('grants').replaceChildren(...(accessData?.grants || []).filter(g => (g.email || '').toLowerCase().includes(query)).map(grant => accessRow([
      grant.email, grant.codeId ? accessData.codes.find(c => c.id === grant.codeId)?.label || 'Access code' : 'Existing account',
      featureText(grant.features), grant.revokedAt ? 'Revoked' : grant.expiresAt ? `Expires ${dateTime(grant.expiresAt)}` : 'Unlimited duration'
    ], grant.revokedAt ? null : () => window.confirm(`Revoke this grant for ${grant.email}? Saved study data will be kept.`) ? mutateCode('revoke',{id:grant.id}) : null, 'Revoke')));
  }
  byId('grant-search').addEventListener('input', renderGrants);
  function barChart(id, entries) {
    const root = byId(id); root.replaceChildren();
    const valid = entries.filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0);
    if (!valid.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = 'No traffic data available yet.'; root.append(p); return; }
    const max = Math.max(1, ...valid.map(([, value]) => Number(value)));
    const chart = document.createElement('div'); chart.className = 'bar-chart';
    for (const [label, value] of valid) {
      const row = document.createElement('div'); row.className = 'bar-row';
      const name = document.createElement('span'); name.textContent = label;
      const track = document.createElement('span'); track.className = 'bar-track';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 100 12'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('bar-svg'); svg.setAttribute('aria-hidden', 'true');
      const fill = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); fill.setAttribute('width', String(Math.max(0, Number(value) / max * 100))); fill.setAttribute('height', '12'); fill.setAttribute('rx', '6'); fill.classList.add('bar-fill'); svg.append(fill); track.append(svg);
      const number = document.createElement('strong'); number.textContent = Number(value).toLocaleString();
      row.append(name, track, number); chart.append(row);
    }
    root.append(chart);
  }
  function renderServices(data) {
    const m = data.metrics, p = data.providers || {}, supa = p.supabase, vercel = p.vercel;
    byId('db-size').textContent = m ? bytes(m.database?.sizeBytes) : 'Unavailable';
    byId('storage-size').textContent = m ? `${bytes(m.storage?.bytes)} · ${m.storage?.objects} files` : 'Unavailable';
    byId('db-connections').textContent = m?.database?.connections ?? 'Unavailable';
    byId('grant-count').textContent = m ? `${m.activeGrants} / ${m.expiredGrants}` : 'Unavailable';
    const labels = {statisticsSince:'Statistics reset', transactionsCommitted:'Committed transactions',transactionsRolledBack:'Rolled back transactions',blocksRead:'Disk blocks read',cacheHits:'Cached blocks hit',rowsReturned:'Rows returned',rowsFetched:'Rows fetched',rowsInserted:'Rows inserted',rowsUpdated:'Rows updated',rowsDeleted:'Rows deleted',temporaryBytes:'Temporary data (bytes)',deadlocks:'Deadlocks'};
    table('database-metrics', ['Database measurement', 'Value'], m ? Object.entries(labels).map(([key,label]) => [label, key === 'statisticsSince' ? (m.database[key] ? dateTime(m.database[key]) : 'Not recorded') : m.database[key]]) : []);
    table('table-metrics', ['Table','Estimated rows','Size incl. indexes','Dead rows','Inserts','Updates','Deletes','Last auto vacuum','Last auto analyze'], (m?.tables || []).map(t => [t.name,t.estimatedRows,bytes(t.sizeBytes),t.deadRows,t.inserts,t.updates,t.deletes,t.lastVacuum ? dateTime(t.lastVacuum) : 'Not recorded',t.lastAnalyze ? dateTime(t.lastAnalyze) : 'Not recorded']));
    byId('supabase-status').textContent = !supa?.available ? supa?.reason || 'Provider metrics unavailable.' : supa.requests?.available ? 'API requests by service, measured by Supabase.' : supa.requests?.reason;
    const points = supa?.requests?.points || [];
    barChart('traffic-chart', points.length ? [['Auth requests', points.reduce((n, p) => n + Number(p.auth || 0), 0)], ['REST requests', points.reduce((n, p) => n + Number(p.rest || 0), 0)], ['Storage requests', points.reduce((n, p) => n + Number(p.storage || 0), 0)], ['Realtime requests', points.reduce((n, p) => n + Number(p.realtime || 0), 0)]] : []);
    table('api-traffic',['Time','Auth requests','REST requests','Storage requests','Realtime requests'], (supa?.requests?.points || []).map(t => [dateTime(t.timestamp),t.auth,t.rest,t.storage,t.realtime]));
    byId('bandwidth-status').textContent = supa?.bandwidth?.reason || 'Billed bandwidth is unavailable until a supported billing usage integration is connected. Stored file size is not bandwidth.';
    byId('scrape-status').textContent = supa?.metricsStatus || supa?.reason || 'Infrastructure measurements unavailable.';
    table('provider-measurements',['Metric','Value (sum of label series)','Series count'], (supa?.measurements || []).map(t => [t.name,t.value,t.series]));
    byId('vercel-status').textContent = vercel?.available ? vercel.traffic.reason : vercel?.reason || 'Vercel integration unavailable.';
    table('deployments',['Deployment','Environment','State','Created','Ready'], (vercel?.deployments || []).map(d => [d.url || d.name,d.target || 'Preview',d.state,dateTime(d.created),d.ready ? dateTime(d.ready) : 'Not ready']));
  }
  async function mutateCode(action, data = {}) {
    const { data: result, error } = await client.rpc('manage_access', {p_action:action,p_data:data});
    if (error) throw new Error('Could not save access settings. Verify your owner sign-in, code uniqueness, limits and selected features, then retry.');
    if (!Array.isArray(result?.codes) || !Array.isArray(result?.grants)) throw new Error('Invalid access response. Please retry.');
    return result;
  }
  const codeForm = byId('code-form');
  function syncLimits() {
    codeForm.elements.maxUses.disabled = codeForm.elements.unlimitedUses.checked;
    codeForm.elements.durationDays.disabled = codeForm.elements.unlimitedDuration.checked;
  }
  codeForm.addEventListener('change', syncLimits);
  codeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!client || !accessData || byId('create-code').disabled || !form.reportValidity()) return;
    const fields = new FormData(form), code = String(fields.get('code')).trim();
    const features = fields.get('product') === 'step2' ? ['step2'] : ['planning','resources','exams','flashcards','avatar','team'];
    if (!code) { byId('code-message').textContent = 'Enter a code.'; return; }
    byId('create-code').disabled = true;
    const version = requestVersion;
    try {
      const result = await mutateCode('create', {code,label:String(fields.get('label')),maxUses:Number(fields.get('maxUses') || 1),durationDays:Number(fields.get('durationDays') || 1),unlimitedUses:fields.has('unlimitedUses'),unlimitedDuration:fields.has('unlimitedDuration'),features});
      if (version !== requestVersion) return;
      renderAccess(result);
      byId('code-message').textContent = `Created “${code}”. You can find the exact code in the first column.`;
      form.reset(); syncLimits();
    } catch (error) { if (version === requestVersion) byId('code-message').textContent = error.message; }
    finally { if (version === requestVersion) byId('create-code').disabled = false; }
  });
  async function loadOverview() {
    if (!client || signingOut) return;
    const version = ++requestVersion;
    notify('');
    clearData();
    showStatus('Loading your overview…');
    signOut.hidden = false;
    try {
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (version !== requestVersion) return;
      if (userError || !user) { showLogin(); return; }
      if (user.email?.toLowerCase() !== 'ahmadabdatyyat@gmail.com' || !user.email_confirmed_at || user.is_anonymous) {
        showStatus('Owner access required', 'Only ahmadabdatyyat@gmail.com can enter this dashboard.');
        return;
      }
      // Open the verified owner's shell before optional reports finish.
      login.hidden = true;
      statusPanel.hidden = true;
      overview.hidden = false;
      for (const id of ['total','confirmed','active','new','study-states','study-settings','db-size','storage-size','db-connections','grant-count']) byId(id).textContent = '…';
      byId('updated').textContent = 'Loading account activity…';
      byId('code-message').textContent = 'Loading access codes…';
      byId('supabase-status').textContent = 'Loading service reports…';
      byId('vercel-status').textContent = 'Loading deployment reports…';
      void window.BookshopAdmin?.load(client);
      const current = () => version === requestVersion;
      const denied = error => {
        const status = error?.context?.status;
        if (status !== 401 && status !== 403) return false;
        ++requestVersion; clearData();
        showStatus('Owner access required', 'Sign out and sign in with your verified owner account.');
        return true;
      };
      const accounts = (async () => {
        try {
          const { data, error } = await client.functions.invoke('admin-overview', { method: 'GET', timeout: 15000 });
          if (!current()) return;
          if (error) { if (denied(error)) return; throw error; }
          render(validate(data));
        } catch {
          if (current()) byId('updated').textContent = 'Account activity unavailable. Use Refresh data to retry; other controls are still available.';
        }
      })();
      const access = (async () => {
        try {
          const data = await mutateCode('list');
          if (!current()) return;
          renderAccess(data); byId('code-message').textContent = '';
        } catch (error) { if (current()) byId('code-message').textContent = error.message; }
      })();
      const services = (async () => {
        try {
          const { data, error } = await client.functions.invoke('admin-overview?view=services', { method: 'GET', timeout: 15000 });
          if (!current()) return;
          if (error) { if (denied(error)) return; throw error; }
          renderServices(data);
        } catch {
          if (current()) renderServices({ providers: { supabase: { reason: 'Service reports unavailable. Use Refresh data to retry.' }, vercel: { reason: 'Deployment reports unavailable.' } } });
        }
      })();
      await Promise.all([accounts, access, services]);
    } catch {
      if (version === requestVersion) showStatus('Overview unavailable', 'We could not reach the account service. Check your connection and try again.', true);
    }
  }

  byId('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!client || !event.currentTarget.reportValidity()) return;
    const button = byId('login-button');
    button.disabled = true;
    button.textContent = 'Signing in…';
    notify('');
    try {
      const { error } = await client.auth.signInWithPassword({ email: byId('email').value.trim(), password: byId('password').value });
      byId('password').value = '';
      if (error) notify('Sign in failed. Check your email and password. Use the password reset link if you need a new password.');
    } catch { notify('We could not reach the account service. Check your connection and try again.'); }
    finally { button.disabled = false; button.textContent = 'Sign in to owner console'; }
  });
  signOut.addEventListener('click', async () => {
    signingOut = true;
    clearTimeout(sessionTimer);
    showLogin();
    notify('');
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) notify('Sign out could not be confirmed. Close this tab to discard the console session, or try signing out again.');
    } catch { notify('Sign out could not be confirmed. Close this tab to discard the console session.'); }
    finally { signingOut = false; }
  });
  retry.addEventListener('click', () => void loadOverview());
  byId('refresh').addEventListener('click', () => void loadOverview());
  window.addEventListener('pagehide', () => { ++requestVersion; clearData(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) void loadOverview(); });

  try {
    const config = window.STUDYWELL_ADMIN_PUBLIC_CONFIG;
    if (!config?.url || !config?.publishableKey || !window.supabase) throw new Error('Missing configuration');
    client = window.supabase.createClient(config.url, config.publishableKey, { auth: { storage: window.sessionStorage, storageKey: 'studywell-owner-console-auth-v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    client.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id && session.user.id === sessionUserId && _event === 'TOKEN_REFRESHED') return;
      sessionUserId = session?.user?.id ?? null;
      clearTimeout(sessionTimer);
      ++requestVersion;
      clearData();
      if (!session) showLogin();
      else if (!signingOut) sessionTimer = setTimeout(() => void loadOverview(), 0);
    });
  } catch { showStatus('Console unavailable', 'The owner console could not initialize. Please reload this page.'); }
})();
