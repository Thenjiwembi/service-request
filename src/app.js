const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const path = require('node:path');

const STATUSES = ['open', 'in progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const REQUIRED_FIELDS = ['title', 'category', 'description', 'requester', 'priority', 'status'];
const ALLOWED_FIELDS = [
  ...REQUIRED_FIELDS,
  'requesterEmail',
  'assignee',
  'date',
  'progress'
];

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function createSeedRequests() {
  return [
    {
      id: 'FD-1048',
      category: 'Facilities',
      title: 'Office cleaning request',
      description: 'A deep clean is needed for the shared kitchen and meeting spaces.',
      requester: 'Olivia Chen',
      requesterEmail: 'olivia.chen@example.com',
      assignee: 'Maya Patel',
      priority: 'medium',
      status: 'open',
      date: daysAgo(0),
      progress: 18,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'FD-1047',
      category: 'IT Support',
      title: 'Laptop replacement',
      description: 'The laptop battery no longer holds a charge and needs replacing.',
      requester: 'Ethan Brooks',
      requesterEmail: 'ethan.brooks@example.com',
      assignee: 'Noah Williams',
      priority: 'high',
      status: 'open',
      date: daysAgo(0),
      progress: 12,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'FD-1046',
      category: 'Security',
      title: 'Access card not working',
      description: 'The access card does not unlock the east entrance.',
      requester: 'Amara Okafor',
      requesterEmail: 'amara.okafor@example.com',
      assignee: 'Maya Patel',
      priority: 'urgent',
      status: 'in progress',
      date: daysAgo(1),
      progress: 64,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'FD-1045',
      category: 'IT Support',
      title: 'Shared drive permissions',
      description: 'Please grant the design team access to the Q4 campaign folder.',
      requester: 'Lucas Martin',
      requesterEmail: 'lucas.martin@example.com',
      assignee: 'Noah Williams',
      priority: 'medium',
      status: 'in progress',
      date: daysAgo(2),
      progress: 48,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'FD-1044',
      category: 'Maintenance',
      title: 'Replace meeting-room bulbs',
      description: 'Two ceiling lights are out in meeting room 3B.',
      requester: 'Priya Shah',
      requesterEmail: 'priya.shah@example.com',
      assignee: 'Sofia Rivera',
      priority: 'low',
      status: 'in progress',
      date: daysAgo(2),
      progress: 76,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'FD-1043',
      category: 'Facilities',
      title: 'Water dispenser maintenance',
      description: 'The water dispenser on the second floor has been serviced.',
      requester: 'Zoe Kim',
      requesterEmail: 'zoe.kim@example.com',
      assignee: 'Sofia Rivera',
      priority: 'low',
      status: 'resolved',
      date: daysAgo(3),
      progress: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'FD-1042',
      category: 'IT Support',
      title: 'Video call setup',
      description: 'Conference room video equipment is configured and ready to use.',
      requester: 'Marcus Reed',
      requesterEmail: 'marcus.reed@example.com',
      assignee: 'Noah Williams',
      priority: 'high',
      status: 'closed',
      date: daysAgo(4),
      progress: 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

function validateRequest(input, { partial = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'Request body must be a JSON object.';
  }

  const unknownFields = Object.keys(input).filter(field => !ALLOWED_FIELDS.includes(field));
  if (unknownFields.length) {
    return `Unknown field${unknownFields.length > 1 ? 's' : ''}: ${unknownFields.join(', ')}.`;
  }

  if (partial && Object.keys(input).length === 0) {
    return 'At least one field is required.';
  }

  for (const field of REQUIRED_FIELDS) {
    if (!partial || Object.hasOwn(input, field)) {
      if (typeof input[field] !== 'string' || !input[field].trim()) {
        return `${field} is required and must be a non-empty string.`;
      }
    }
  }

  if (Object.hasOwn(input, 'priority') && !PRIORITIES.includes(input.priority)) {
    return `priority must be one of: ${PRIORITIES.join(', ')}.`;
  }
  if (Object.hasOwn(input, 'status') && !STATUSES.includes(input.status)) {
    return `status must be one of: ${STATUSES.join(', ')}.`;
  }
  if (Object.hasOwn(input, 'requesterEmail') && input.requesterEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.requesterEmail)) {
    return 'requesterEmail must be a valid email address.';
  }
  if (Object.hasOwn(input, 'progress') &&
      (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100)) {
    return 'progress must be an integer between 0 and 100.';
  }
  if (Object.hasOwn(input, 'date')) {
    const date = typeof input.date === 'string' ? new Date(`${input.date}T00:00:00Z`) : null;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
        Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) {
      return 'date must be a valid date in YYYY-MM-DD format.';
    }
  }
  for (const field of ['assignee', 'requesterEmail', 'date']) {
    if (Object.hasOwn(input, field) && typeof input[field] !== 'string') {
      return `${field} must be a string.`;
    }
  }

  return null;
}

function createApp({ requests = createSeedRequests(), archivedRequests = [] } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/requests', (req, res) => {
    const { q, status, priority } = req.query;
    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}.` });
    }
    if (priority && !PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${PRIORITIES.join(', ')}.` });
    }

    const search = typeof q === 'string' ? q.trim().toLowerCase() : '';
    const results = requests.filter(request => {
      const matchesSearch = !search || [
        request.id, request.title, request.description, request.category, request.requester
      ].some(value => value.toLowerCase().includes(search));
      return matchesSearch && (!status || request.status === status) &&
        (!priority || request.priority === priority);
    });
    return res.json(results);
  });

  app.get('/api/requests/archived', (req, res) => res.json(archivedRequests));

  app.post('/api/requests/:id/restore', (req, res) => {
    const index = archivedRequests.findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Archived service request not found.' });
    const [archived] = archivedRequests.splice(index, 1);
    const { deletedAt, ...request } = archived;
    request.updatedAt = new Date().toISOString();
    requests.unshift(request);
    return res.json(request);
  });

  app.get('/api/requests/:id', (req, res) => {
    const request = requests.find(item => item.id === req.params.id);
    if (!request) return res.status(404).json({ error: 'Service request not found.' });
    return res.json(request);
  });

  app.post('/api/requests', (req, res) => {
    const validationError = validateRequest(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const now = new Date().toISOString();
    const request = {
      id: `FD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      category: req.body.category.trim(),
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      requester: req.body.requester.trim(),
      requesterEmail: req.body.requesterEmail?.trim() || '',
      assignee: req.body.assignee?.trim() || 'Unassigned',
      priority: req.body.priority,
      status: req.body.status,
      date: req.body.date || now.slice(0, 10),
      progress: req.body.progress ?? (req.body.status === 'resolved' || req.body.status === 'closed' ? 100 : 0),
      createdAt: now,
      updatedAt: now
    };
    requests.unshift(request);
    return res.status(201).json(request);
  });

  app.put('/api/requests/:id', (req, res) => {
    const index = requests.findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Service request not found.' });
    const validationError = validateRequest(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const now = new Date().toISOString();
    requests[index] = {
      id: requests[index].id,
      createdAt: requests[index].createdAt,
      ...req.body,
      title: req.body.title.trim(),
      category: req.body.category.trim(),
      description: req.body.description.trim(),
      requester: req.body.requester.trim(),
      requesterEmail: req.body.requesterEmail?.trim() || '',
      assignee: req.body.assignee?.trim() || 'Unassigned',
      date: req.body.date || now.slice(0, 10),
      progress: req.body.progress ?? (req.body.status === 'resolved' || req.body.status === 'closed' ? 100 : 0),
      updatedAt: now
    };
    return res.json(requests[index]);
  });

  app.patch('/api/requests/:id', (req, res) => {
    const index = requests.findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Service request not found.' });
    const validationError = validateRequest(req.body, { partial: true });
    if (validationError) return res.status(400).json({ error: validationError });

    const updated = { ...requests[index], ...req.body, updatedAt: new Date().toISOString() };
    for (const field of ['title', 'category', 'description', 'requester', 'assignee', 'requesterEmail']) {
      if (typeof req.body[field] === 'string') updated[field] = req.body[field].trim();
    }
    requests[index] = updated;
    return res.json(updated);
  });

  app.delete('/api/requests/:id', (req, res) => {
    const index = requests.findIndex(item => item.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Service request not found.' });
    const [request] = requests.splice(index, 1);
    const archived = { ...request, deletedAt: new Date().toISOString() };
    archivedRequests.unshift(archived);
    return res.json(archived);
  });

  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Request body contains invalid JSON.' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body exceeds the 100kb limit.' });
    }
    console.error(err);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

module.exports = { createApp, createSeedRequests };
