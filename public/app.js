(() => {
  const requestDialog = document.getElementById('request-dialog');
  const form = document.getElementById('request-form');
  const formError = document.getElementById('form-error');
  const toast = document.getElementById('toast');
  const searchInput = document.getElementById('search');
  const statusFilter = document.getElementById('status-filter');
  const priorityFilter = document.getElementById('priority-filter');
  const teamMembers = document.getElementById('team-members');
  const archivedRequests = document.getElementById('archived-requests');
  const settingsForm = document.getElementById('settings-form');
  const defaultStatusSetting = document.getElementById('setting-default-status');
  const apiUrlSetting = document.getElementById('setting-api-url');
  const fields = {
    id: document.getElementById('request-id'),
    title: document.getElementById('field-title'),
    category: document.getElementById('field-category'),
    priority: document.getElementById('field-priority'),
    requester: document.getElementById('field-requester'),
    requesterEmail: document.getElementById('field-email'),
    assignee: document.getElementById('field-assignee'),
    status: document.getElementById('field-status'),
    description: document.getElementById('field-description')
  };

  let requests = [];
  let archives = [];
  let toastTimer;
  let defaultRequestStatus = 'open';
  let apiBaseUrl = '';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function initials(name) {
    return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('');
  }

  function formatDate(value) {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2800);
  }

  async function api(path, options = {}) {
    let response;
    try {
      response = await fetch(apiBaseUrl ? `${apiBaseUrl}${path}` : path, {
        ...options,
        headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...options.headers }
      });
    } catch {
      const target = apiBaseUrl || window.location.origin;
      throw new Error(`Could not reach the FlowDesk API at ${target}. Check that the API server is running and the URL is correct.`);
    }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 405) {
        throw new Error('This preview server does not support the FlowDesk API. Start FlowDesk with "npm start", then set its address under Settings → FlowDesk API server URL.');
      }
      throw new Error(error.error || `Request failed (${response.status}).`);
    }
    return response.status === 204 ? null : response.json();
  }

  function columnFor(status) {
    if (status === 'open') return 'pending';
    if (status === 'in progress') return 'progress';
    return 'finished';
  }

  function cardMarkup(request) {
    const progress = Math.max(0, Math.min(100, Number(request.progress) || 0));
    const requester = escapeHtml(request.requester);
    const title = escapeHtml(request.title);
    const assignee = escapeHtml(request.assignee || 'Unassigned');
    const description = escapeHtml(request.description);
    return `<article class="request-card" data-request-id="${escapeHtml(request.id)}">
      <div class="card-topline"><span class="category-label">${escapeHtml(request.category)}</span>
        <div class="card-menu-wrap"><button class="card-menu" aria-label="Actions for ${title}" aria-expanded="false">···</button>
          <div class="card-actions"><button type="button" data-action="edit">Edit request</button><button type="button" class="delete-action" data-action="delete">Delete request</button></div>
        </div>
      </div>
      <h4>${title}</h4>
      <p class="card-description">${description}</p>
      <div class="requester-row"><span class="avatar" style="background:${avatarColor(request.requester)}" aria-hidden="true">${escapeHtml(initials(request.requester))}</span><span class="requester-name">${requester}</span><span class="assignee">${assignee === 'Unassigned' ? '' : `→ ${assignee}`}</span></div>
      <div class="card-meta"><span class="priority priority-${escapeHtml(request.priority)}">${escapeHtml(request.priority)}</span><span class="request-id">${escapeHtml(request.id)}</span><span class="card-date"><span aria-hidden="true">◷</span>${escapeHtml(formatDate(request.date))}</span></div>
      <div class="progress-row" aria-label="Progress ${progress}%"><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div><span class="progress-value">${progress}%</span></div>
    </article>`;
  }

  function archiveCardMarkup(request) {
    return `<article class="archive-card" data-request-id="${escapeHtml(request.id)}">
      <div class="archive-card-top"><span class="category-label">${escapeHtml(request.category)}</span><span class="request-id">${escapeHtml(request.id)}</span></div>
      <h2>${escapeHtml(request.title)}</h2>
      <p>${escapeHtml(request.description)}</p>
      <div class="archive-card-meta"><span>Requested by ${escapeHtml(request.requester)}</span><span>Deleted ${escapeHtml(request.deletedAt ? formatDate(request.deletedAt.slice(0, 10)) : 'date unavailable')}</span></div>
      <button class="restore-button" type="button" data-action="restore">Restore request</button>
    </article>`;
  }

  function avatarColor(name) {
    const colors = ['#f5d5c2', '#d8e8ee', '#e9ddf4', '#e7edce', '#f3dce1', '#d9e8d9'];
    const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  function render() {
    const search = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const priority = priorityFilter.value;
    const visible = requests.filter(request => {
      const text = [request.id, request.title, request.description, request.category, request.requester].join(' ').toLowerCase();
      return (!search || text.includes(search)) && (!status || request.status === status) &&
        (!priority || request.priority === priority);
    });
    const columns = { pending: [], progress: [], finished: [] };
    visible.forEach(request => columns[columnFor(request.status)].push(request));

    for (const [name, items] of Object.entries(columns)) {
      document.getElementById(`${name}-cards`).innerHTML = items.map(cardMarkup).join('');
      document.getElementById(`${name}-column-count`).textContent = items.length;
    }

    const pending = requests.filter(request => request.status === 'open').length;
    const inProgress = requests.filter(request => request.status === 'in progress').length;
    const finished = requests.filter(request => request.status === 'resolved' || request.status === 'closed').length;
    document.getElementById('total-count').textContent = requests.length;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('progress-count').textContent = inProgress;
    document.getElementById('finished-count').textContent = finished;
    document.getElementById('sidebar-count').textContent = requests.length;
    document.getElementById('board-total').textContent = `${visible.length} ${visible.length === 1 ? 'request' : 'requests'}`;
    const empty = visible.length === 0;
    document.getElementById('board-columns').hidden = empty;
    document.getElementById('empty-board').hidden = !empty;
    renderArchives();
    renderTeam();
  }

  function renderArchives() {
    archivedRequests.innerHTML = archives.map(archiveCardMarkup).join('');
    document.getElementById('archive-count').textContent = archives.length;
    document.getElementById('archive-total').textContent = `${archives.length} ${archives.length === 1 ? 'request' : 'requests'}`;
    document.getElementById('archive-empty').hidden = archives.length !== 0;
    archivedRequests.hidden = archives.length === 0;
  }

  function renderTeam() {
    const members = new Map();
    requests.forEach(request => {
      const name = request.assignee?.trim();
      if (!name || name.toLowerCase() === 'unassigned') return;
      const member = members.get(name) || { name, assigned: 0, active: 0, completed: 0 };
      member.assigned += 1;
      if (request.status === 'resolved' || request.status === 'closed') member.completed += 1;
      else member.active += 1;
      members.set(name, member);
    });
    const list = [...members.values()].sort((left, right) => left.name.localeCompare(right.name));
    teamMembers.innerHTML = list.map(member => `<article class="team-card">
      <span class="avatar team-avatar" style="background:${avatarColor(member.name)}" aria-hidden="true">${escapeHtml(initials(member.name))}</span>
      <div class="team-member-copy"><h2>${escapeHtml(member.name)}</h2><p>Request assignee</p></div>
      <div class="team-stats"><span><strong>${member.assigned}</strong> assigned</span><span><strong>${member.active}</strong> active</span><span><strong>${member.completed}</strong> completed</span></div>
    </article>`).join('');
    document.getElementById('team-total').textContent = `${list.length} ${list.length === 1 ? 'member' : 'members'}`;
    document.getElementById('team-empty').hidden = list.length !== 0;
    teamMembers.hidden = list.length === 0;
  }

  function viewForHash() {
    const view = window.location.hash.slice(1);
    return ['requests', 'archives', 'team', 'settings', 'help'].includes(view) ? view : 'dashboard';
  }

  function showView(view) {
    const labels = {
      dashboard: 'Dashboard',
      requests: 'All requests',
      archives: 'Archives',
      team: 'Team members',
      settings: 'Settings',
      help: 'Help center'
    };
    const label = labels[view] || labels.dashboard;
    document.getElementById('current-view').textContent = label;
    document.getElementById('dashboard-overview').hidden = view !== 'dashboard';
    document.getElementById('summary-grid').hidden = view !== 'dashboard';
    document.getElementById('board').hidden = !['dashboard', 'requests'].includes(view);
    document.getElementById('archives-view').hidden = view !== 'archives';
    document.getElementById('team-view').hidden = view !== 'team';
    document.getElementById('settings-view').hidden = view !== 'settings';
    document.getElementById('help-view').hidden = view !== 'help';
    document.getElementById('board-title').textContent = view === 'requests' ? 'All requests' : 'Request board';
    document.getElementById('board-description').textContent = "Track and manage your team's service requests.";

    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      const active = item.dataset.view === view;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
  }

  function resetRequestFilters() {
    searchInput.value = '';
    statusFilter.value = '';
    priorityFilter.value = '';
    render();
  }

  function loadSettings() {
    try {
      const saved = window.localStorage.getItem('flowdesk-settings');
      if (!saved) return;
      const settings = JSON.parse(saved);
      const validStatuses = ['open', 'in progress', 'resolved', 'closed'];
      if (!settings || !validStatuses.includes(settings.defaultStatus)) {
        showToast('Saved settings were invalid. Using the default request status.', true);
        return;
      }
      defaultRequestStatus = settings.defaultStatus;
      defaultStatusSetting.value = defaultRequestStatus;
      if (typeof settings.apiBaseUrl === 'string') {
        try {
          apiBaseUrl = normalizeApiBaseUrl(settings.apiBaseUrl);
          apiUrlSetting.value = apiBaseUrl;
        } catch (error) {
          showToast(error.message, true);
        }
      }
    } catch {
      showToast('Could not load saved settings. Using the default request status.', true);
    }
  }

  function normalizeApiBaseUrl(value) {
    const trimmed = value.trim();
    if (!trimmed) return '';
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error('Enter a valid FlowDesk API URL, such as http://localhost:3000.');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Use only the FlowDesk server origin, for example http://localhost:3000.');
    }
    return url.origin;
  }

  async function loadRequests({ quiet = false } = {}) {
    const refresh = document.getElementById('refresh');
    refresh.disabled = true;
    refresh.style.opacity = '.55';
    try {
      const [loadedRequests, loadedArchives] = await Promise.all([
        api('/api/requests'),
        api('/api/requests/archived')
      ]);
      requests = loadedRequests;
      archives = loadedArchives;
      render();
      if (!quiet) showToast('Requests are up to date.');
    } catch (error) {
      showToast(error.message, true);
    } finally {
      refresh.disabled = false;
      refresh.style.opacity = '';
    }
  }

  function openForm(request = null, initialStatus = defaultRequestStatus) {
    form.reset();
    formError.textContent = '';
    fields.id.value = request?.id || '';
    fields.title.value = request?.title || '';
    fields.category.value = request?.category || '';
    fields.priority.value = request?.priority || 'medium';
    fields.requester.value = request?.requester || '';
    fields.requesterEmail.value = request?.requesterEmail || '';
    fields.assignee.value = request?.assignee === 'Unassigned' ? '' : request?.assignee || '';
    fields.status.value = request?.status || initialStatus;
    fields.description.value = request?.description || '';
    const editing = Boolean(request);
    document.getElementById('dialog-title').textContent = editing ? 'Edit request' : 'New request';
    document.getElementById('submit-label').textContent = editing ? 'Save changes' : 'Create request';
    requestDialog.showModal();
    fields.title.focus();
  }

  function closeForm() {
    requestDialog.close();
    formError.textContent = '';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    formError.textContent = '';
    if (!form.reportValidity()) return;
    const payload = {
      title: fields.title.value.trim(),
      category: fields.category.value,
      description: fields.description.value.trim(),
      requester: fields.requester.value.trim(),
      requesterEmail: fields.requesterEmail.value.trim(),
      assignee: fields.assignee.value.trim(),
      priority: fields.priority.value,
      status: fields.status.value
    };
    try {
      const editing = Boolean(fields.id.value);
      const path = editing ? `/api/requests/${encodeURIComponent(fields.id.value)}` : '/api/requests';
      const saved = await api(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      if (editing) requests = requests.map(request => request.id === saved.id ? saved : request);
      else requests.unshift(saved);
      closeForm();
      render();
      showToast(editing ? 'Request updated.' : 'Request created.');
    } catch (error) {
      formError.textContent = error.message;
    }
  });

  document.getElementById('new-request').addEventListener('click', () => openForm());
  document.getElementById('sidebar-new').addEventListener('click', () => openForm());
  document.querySelectorAll('.add-card').forEach(button => button.addEventListener('click', () => openForm(null, button.dataset.addStatus)));
  document.getElementById('close-dialog').addEventListener('click', closeForm);
  document.getElementById('cancel-dialog').addEventListener('click', closeForm);
  requestDialog.addEventListener('click', event => {
    if (event.target === requestDialog) closeForm();
  });
  document.getElementById('refresh').addEventListener('click', () => loadRequests());
  archivedRequests.addEventListener('click', async event => {
    const button = event.target.closest('[data-action="restore"]');
    const card = button?.closest('.archive-card');
    if (!button || !card) return;
    button.disabled = true;
    try {
      const restored = await api(`/api/requests/${encodeURIComponent(card.dataset.requestId)}/restore`, { method: 'POST' });
      archives = archives.filter(request => request.id !== restored.id);
      requests.unshift(restored);
      render();
      showToast('Request restored.');
    } catch (error) {
      button.disabled = false;
      showToast(error.message, true);
    }
  });
  settingsForm.addEventListener('submit', event => {
    event.preventDefault();
    const selectedStatus = defaultStatusSetting.value;
    let selectedApiBaseUrl;
    try {
      selectedApiBaseUrl = normalizeApiBaseUrl(apiUrlSetting.value);
    } catch (error) {
      showToast(error.message, true);
      apiUrlSetting.focus();
      return;
    }
    try {
      window.localStorage.setItem('flowdesk-settings', JSON.stringify({
        defaultStatus: selectedStatus,
        apiBaseUrl: selectedApiBaseUrl
      }));
      defaultRequestStatus = selectedStatus;
      apiBaseUrl = selectedApiBaseUrl;
      showToast('Settings saved.');
      loadRequests({ quiet: true });
    } catch {
      showToast('Could not save settings in this browser.', true);
    }
  });
  searchInput.addEventListener('input', render);
  statusFilter.addEventListener('change', render);
  priorityFilter.addEventListener('change', render);

  document.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', event => {
      event.preventDefault();
      const view = item.dataset.view;
      if (view === 'requests') resetRequestFilters();
      const hash = `#${view}`;
      if (window.location.hash === hash) showView(view);
      else window.location.hash = hash;
      sidebar.classList.remove('mobile-open');
      mobileMenu.setAttribute('aria-expanded', 'false');
      mobileMenu.setAttribute('aria-label', 'Open navigation');
    });
  });

  window.addEventListener('hashchange', () => {
    const view = viewForHash();
    if (view === 'requests') resetRequestFilters();
    showView(view);
  });

  document.getElementById('board-columns').addEventListener('click', async event => {
    const button = event.target.closest('button');
    const card = event.target.closest('.request-card');
    if (!button || !card) return;
    const request = requests.find(item => item.id === card.dataset.requestId);
    if (!request) return;

    if (button.classList.contains('card-menu')) {
      const menu = card.querySelector('.card-actions');
      const opening = !menu.classList.contains('open');
      document.querySelectorAll('.card-actions.open').forEach(openMenu => openMenu.classList.remove('open'));
      menu.classList.toggle('open', opening);
      button.setAttribute('aria-expanded', String(opening));
      return;
    }
    if (button.dataset.action === 'edit') {
      card.querySelector('.card-actions').classList.remove('open');
      openForm(request);
      return;
    }
    if (button.dataset.action === 'delete') {
      if (!window.confirm(`Delete "${request.title}"? This action cannot be undone.`)) return;
      try {
        const archived = await api(`/api/requests/${encodeURIComponent(request.id)}`, { method: 'DELETE' });
        requests = requests.filter(item => item.id !== request.id);
        archives.unshift(archived);
        render();
        showToast('Request moved to Archives.');
      } catch (error) {
        showToast(error.message, true);
      }
    }
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.card-menu-wrap')) {
      document.querySelectorAll('.card-actions.open').forEach(menu => menu.classList.remove('open'));
      document.querySelectorAll('.card-menu[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && requestDialog.open) closeForm();
  });
  const sidebar = document.getElementById('sidebar');
  const mobileMenu = document.getElementById('mobile-menu');
  mobileMenu.addEventListener('click', () => {
    const open = sidebar.classList.toggle('mobile-open');
    mobileMenu.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });

  loadSettings();
  showView(viewForHash());
  loadRequests({ quiet: true });
})();
