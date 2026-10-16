const { after, before, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, createSeedRequests } = require('../src/app');

describe('FlowDesk requests API', () => {
  let server;
  let baseUrl;

  before(async () => {
    const app = createApp({ requests: createSeedRequests() });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  async function json(path, options) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const body = response.status === 204 ? null : await response.json();
    return { response, body };
  }

  const validRequest = {
    category: 'IT Support',
    title: 'New monitor',
    description: 'A replacement monitor is needed.',
    requester: 'Jamie Lee',
    priority: 'medium',
    status: 'open'
  };

  it('provides a healthy status and serves the dashboard', async () => {
    const health = await json('/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.status, 'ok');

    const page = await fetch(`${baseUrl}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /FlowDesk/);
  });

  it('lists, filters, searches, and retrieves seeded requests', async () => {
    const all = await json('/api/requests');
    assert.equal(all.response.status, 200);
    assert.equal(all.body.length, 7);

    const filtered = await json('/api/requests?status=in%20progress&priority=medium');
    assert.equal(filtered.body.length, 1);
    const search = await json('/api/requests?q=cleaning');
    assert.equal(search.body.length, 1);

    const detail = await json('/api/requests/FD-1048');
    assert.equal(detail.body.title, 'Office cleaning request');
    const missing = await json('/api/requests/not-real');
    assert.equal(missing.response.status, 404);
  });

  it('creates, replaces, patches, and deletes a request', async () => {
    const created = await json('/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validRequest)
    });
    assert.equal(created.response.status, 201);
    assert.match(created.body.id, /^FD-[A-F0-9]{8}$/);
    assert.equal(created.body.progress, 0);

    const replacement = { ...validRequest, title: 'Updated monitor', status: 'in progress' };
    const replaced = await json(`/api/requests/${created.body.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(replacement)
    });
    assert.equal(replaced.response.status, 200);
    assert.equal(replaced.body.title, 'Updated monitor');

    const patched = await json(`/api/requests/${created.body.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ priority: 'urgent' })
    });
    assert.equal(patched.body.priority, 'urgent');
    assert.equal(patched.body.title, 'Updated monitor');

    const deleted = await fetch(`${baseUrl}/api/requests/${created.body.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 200);
    const archivedRequest = await deleted.json();
    assert.equal(archivedRequest.id, created.body.id);
    assert.ok(archivedRequest.deletedAt);
    const missing = await json(`/api/requests/${created.body.id}`);
    assert.equal(missing.response.status, 404);

    const archived = await json('/api/requests/archived');
    assert.equal(archived.response.status, 200);
    assert.ok(archived.body.some(request => request.id === created.body.id));

    const restored = await json(`/api/requests/${created.body.id}/restore`, { method: 'POST' });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.body.title, 'Updated monitor');
    const active = await json(`/api/requests/${created.body.id}`);
    assert.equal(active.response.status, 200);
    const archiveAfterRestore = await json('/api/requests/archived');
    assert.ok(!archiveAfterRestore.body.some(request => request.id === created.body.id));
  });

  it('rejects invalid fields, enums, empty patches, and malformed JSON', async () => {
    const invalid = await json('/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRequest, priority: 'whenever' })
    });
    assert.equal(invalid.response.status, 400);

    const invalidDate = await json('/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validRequest, date: '2026-02-31' })
    });
    assert.equal(invalidDate.response.status, 400);

    const badFilter = await json('/api/requests?status=unknown');
    assert.equal(badFilter.response.status, 400);

    const emptyPatch = await json('/api/requests/FD-1048', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    });
    assert.equal(emptyPatch.response.status, 400);

    const malformed = await fetch(`${baseUrl}/api/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{'
    });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json()).error, /invalid JSON/i);
  });
});
