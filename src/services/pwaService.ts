// =============================================================================
// PWA — registro do service worker, aviso de nova versão e instalação
// =============================================================================
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function onPwaChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function podeInstalarDireto(): boolean {
  return deferredPrompt !== null;
}

export async function instalarApp(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return outcome === 'accepted';
}

// Aviso discreto quando sai versão nova — o usuário escolhe a hora de atualizar
function mostrarAvisoAtualizacao(atualizar: () => void) {
  if (document.getElementById('pwa-update-toast')) return;
  const el = document.createElement('div');
  el.id = 'pwa-update-toast';
  el.style.cssText = [
    'position:fixed', 'left:16px', 'right:16px', 'bottom:calc(96px + env(safe-area-inset-bottom))', 'z-index:2000',
    'display:flex', 'align-items:center', 'gap:12px', 'padding:12px 14px', 'border-radius:16px',
    'background:#2d2521', 'color:#fff', 'box-shadow:0 12px 30px rgba(0,0,0,.25)',
    'font:600 13px Inter,system-ui,sans-serif', 'max-width:480px', 'margin:0 auto',
  ].join(';');
  el.innerHTML = '<span style="flex:1">Nova versão do app disponível.</span>';
  const btn = document.createElement('button');
  btn.textContent = 'Atualizar';
  btn.style.cssText = 'border:none;border-radius:999px;padding:8px 14px;background:#c66b4d;color:#fff;font:800 12px Inter,system-ui,sans-serif;cursor:pointer';
  btn.onclick = () => { btn.textContent = 'Atualizando...'; atualizar(); };
  el.appendChild(btn);
  document.body.appendChild(el);
}

export function iniciarPwa() {
  if (!('serviceWorker' in navigator)) return;
  const updateSW = registerSW({
    onNeedRefresh() { mostrarAvisoAtualizacao(() => updateSW(true)); },
    onRegisteredSW(_url, reg) {
      // Confere atualização a cada 1h com o app aberto
      if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}
