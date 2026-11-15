export const CURRENCY = import.meta.env.VITE_CURRENCY || 'INR';
export const SHOP_NAME = import.meta.env.VITE_SHOP_NAME || 'Retail Manager';

const moneyFmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY });
export const money = (n) => moneyFmt.format(Number(n) || 0);
export const dt = (d) => (d ? new Date(d).toLocaleString() : '—');
export const dOnly = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const CATEGORIES = [
  { value: 'clothes', label: 'Clothes & dresses' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'home_tools', label: 'Home tools' },
];
export const catLabel = (v) => (CATEGORIES.find((c) => c.value === v) || {}).label || v || '—';

export const ROLES = ['admin', 'salesperson', 'billing', 'user'];
export const ROLE_LABEL = { admin: 'Admin', salesperson: 'Salesperson', billing: 'Billing', user: 'Customer' };
export const STAFF = ['admin', 'salesperson', 'billing'];

export const STATUS_LABEL = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

// Category specific product details stored in product.attributes
export const ATTR_FIELDS = {
  clothes: [
    { key: 'size', label: 'Size' },
    { key: 'color', label: 'Colour' },
    { key: 'material', label: 'Material' },
  ],
  groceries: [
    { key: 'weight', label: 'Weight / pack size' },
    { key: 'shelfLife', label: 'Shelf life' },
  ],
  home_tools: [
    { key: 'model', label: 'Model' },
    { key: 'warranty', label: 'Warranty' },
    { key: 'power', label: 'Power / spec' },
  ],
};

// <input type="datetime-local"> wants local time without timezone
export function toLocalInput(d) {
  const x = d ? new Date(d) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
export const toDateInput = (d) => toLocalInput(d).slice(0, 10);

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function downloadCsv(filename, rows) {
  if (!rows || !rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function randomPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}
