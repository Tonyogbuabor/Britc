import type {
  AppSnapshot,
  CustomerRecord,
  RetentionPlanAI,
  Campaign,
  WhatIfLevers,
  WhatIfSimulationResult,
  ChatMessage
} from '../../shared/types.js';

export async function fetchSnapshot(): Promise<AppSnapshot> {
  const res = await fetch('/api/snapshot');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch snapshot (${res.status})`);
  }
  return res.json();
}

export async function refreshSnapshot(): Promise<AppSnapshot> {
  const res = await fetch('/api/snapshot/refresh', { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to refresh snapshot (${res.status})`);
  }
  const data = await res.json();
  return data.snapshot;
}

export async function fetchCustomer(id: string): Promise<CustomerRecord> {
  const res = await fetch(`/api/customers/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(`Customer ${id} not found`);
  }
  return res.json();
}

export async function simulateWhatIf(id: string, levers: WhatIfLevers): Promise<WhatIfSimulationResult> {
  const res = await fetch(`/api/customers/${encodeURIComponent(id)}/whatif`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(levers),
  });
  if (!res.ok) {
    throw new Error('Simulation failed');
  }
  return res.json();
}

export async function generateRetentionPlan(id: string): Promise<RetentionPlanAI> {
  const res = await fetch(`/api/customers/${encodeURIComponent(id)}/retention-plan`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to generate retention plan');
  }
  return res.json();
}

export async function sendChatMessage(query: string, history: ChatMessage[]): Promise<ChatMessage> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, history }),
  });
  if (!res.ok) {
    throw new Error('Chat query failed');
  }
  return res.json();
}

export async function createCampaign(data: {
  name: string;
  targetSegmentId: string;
  targetTier: string;
  offerId: string;
}): Promise<Campaign> {
  const res = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error('Failed to create campaign');
  }
  return res.json();
}
