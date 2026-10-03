import api from '../services/api';

function fileNameFromDisposition(header: string | undefined, fallback: string) {
  const disp = String(header || '');
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disp);
  const quoted = /filename="([^"]+)"/i.exec(disp);
  const plain = /filename=([^;]+)/i.exec(disp);
  const raw = (star?.[1] || quoted?.[1] || plain?.[1] || fallback).trim();
  try {
    return decodeURIComponent(raw.replace(/"/g, ''));
  } catch {
    return raw.replace(/"/g, '') || fallback;
  }
}

export async function downloadAuthFile(path: string, fallbackName = 'invoice') {
  const res = await api.get(path, { responseType: 'blob' });
  const blob = res.data as Blob;
  if (blob.type && blob.type.includes('json')) {
    const parsed = JSON.parse(await blob.text()) as { message?: string };
    throw new Error(parsed.message || 'Download failed');
  }
  const name = fileNameFromDisposition(res.headers['content-disposition'], fallbackName);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
