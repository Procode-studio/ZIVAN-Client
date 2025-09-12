import React, { useEffect, useState } from 'react';

function TurnSettingsModal({ onClose }) {
  const [iceUrlsText, setIceUrlsText] = useState('');
  const [relayOnly, setRelayOnly] = useState(true);
  const [ttl, setTtl] = useState(3600);
  const [secret, setSecret] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const run = async () => {
      try {
        const token = localStorage.getItem('token');
        const r = await fetch(`${api}/api/admin/turn-config`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });
        if (!r.ok) {
          console.warn('[TURN] admin fetch failed', r.status);
          setLoading(false);
          return;
        }
        const cfg = await r.json();
        const urls = (cfg.iceUrls || []).join('\n');
        setIceUrlsText(urls);
        setRelayOnly(!!cfg.relayOnly);
        setTtl(Number(cfg.ttl || 3600));
        setHasSecret(!!cfg.hasSecret);
      } catch (e) {
        console.warn('[TURN] admin fetch error', e);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [api]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const body = {
        iceUrls: iceUrlsText.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
        relayOnly,
        ttl: Number(ttl),
      };
      if (secret && secret.length > 0) body.secret = secret; // не логируем и не сохраняем в браузере
      const r = await fetch(`${api}/api/admin/turn-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        alert('Не удалось сохранить настройки TURN (проверьте права администратора)');
        return;
      }
      alert('Настройки TURN сохранены. Перезагрузите страницу для применения.');
      onClose?.();
    } catch (e) {
      alert('Ошибка сохранения настроек TURN');
      console.warn('[TURN] admin save error', e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" style={styles.overlay}>
        <div className="modal" style={styles.modal}>
          <h3>Настройки TURN</h3>
          <p>Загрузка...</p>
          <div style={styles.actions}>
            <button onClick={onClose} style={styles.btnSecondary}>Закрыть</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" style={styles.overlay}>
      <div className="modal" style={styles.modal}>
        <h3 style={{ marginTop: 0 }}>Настройки TURN (админ)</h3>
        <form onSubmit={handleSave}>
          <label style={styles.label}>Серверы (по одному в строке):</label>
          <textarea
            value={iceUrlsText}
            onChange={(e) => setIceUrlsText(e.target.value)}
            placeholder="Например: turn:176.58.60.22:3478\nturns:176.58.60.22:5349"
            style={styles.textarea}
            rows={5}
          />

          <label style={styles.label}>
            <input type="checkbox" checked={relayOnly} onChange={(e) => setRelayOnly(e.target.checked)} />
            &nbsp;Только через TURN (relay-only)
          </label>

          <label style={styles.label}>TTL для временных учёток (сек):</label>
          <input
            type="number"
            value={ttl}
            onChange={(e) => setTtl(e.target.value)}
            min={60}
            step={60}
            style={styles.input}
          />

          <label style={styles.label}>TURN REST secret (вводите только при установке/замене):</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={hasSecret ? 'секрет установлен на сервере' : 'введите секрет'}
            style={styles.input}
          />

          <div style={styles.actions}>
            <button type="button" onClick={onClose} style={styles.btnSecondary}>Отмена</button>
            <button type="submit" disabled={saving} style={styles.btnPrimary}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  modal: {
    background: '#fff', borderRadius: 8, padding: 16, width: 'min(560px, 90vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
  },
  label: { display: 'block', fontWeight: 600, margin: '12px 0 6px' },
  textarea: { width: '100%', boxSizing: 'border-box' },
  input: { width: '100%', boxSizing: 'border-box', padding: 8 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  btnSecondary: { padding: '8px 12px' },
  btnPrimary: { padding: '8px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4 }
};

export default TurnSettingsModal;
