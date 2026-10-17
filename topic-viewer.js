// FORM / FEA — enlarged topic viewer + on-device topic editor.
// Edits, notes and images are stored per-topic in this browser's localStorage.
// Nothing is uploaded: this is a static site with no server/database.
(() => {
  const dataEl = document.getElementById('topic-data');
  const backdrop = document.getElementById('topic-backdrop');
  if (!dataEl || !backdrop) return;

  let topics = {};
  try { topics = JSON.parse(dataEl.textContent || '{}'); } catch (_) { topics = {}; }

  const $ = sel => backdrop.querySelector(sel);
  const els = {
    modal: $('.topic-modal'),
    kicker: $('#tm-kicker'),
    title: $('#tm-title'),
    summary: $('#tm-summary'),
    detail: $('#tm-detail'),
    detailEditor: $('#tm-detail-editor'),
    editBtn: $('#tm-edit-btn'),
    saveBtn: $('#tm-save-btn'),
    cancelBtn: $('#tm-cancel-btn'),
    defaultBtn: $('#tm-default-btn'),
    practice: $('#tm-practice'),
    categoryGoal: $('#tm-category-goal'),
    notes: $('#tm-notes'),
    notesStatus: $('#tm-notes-status'),
    gallery: $('#tm-gallery'),
    emptyImages: $('#tm-empty-images'),
    fileInput: $('#tm-file-input'),
    addImageBtn: $('#tm-add-image-btn'),
    imageUrl: $('#tm-image-url'),
    addUrlBtn: $('#tm-add-url-btn'),
    resetBtn: $('#tm-reset-btn'),
    closeBtn: $('#tm-close-btn'),
    editedFlag: $('#tm-edited-flag'),
  };
  const toast = document.getElementById('toast');
  let currentId = null;
  let lastFocused = null;
  let toastTimer = null;

  const KEY = id => `formFea.topic.${id}`;
  const LEGACY_KEY = id => `formFea.fp.topic.${id}`; // Folder 01 keys from the first release
  const blank = () => ({ detail: null, notes: '', images: [] });

  const load = id => {
    try {
      const raw = localStorage.getItem(KEY(id)) || localStorage.getItem(LEGACY_KEY(id));
      if (!raw) return blank();
      const data = JSON.parse(raw);
      return { detail: typeof data.detail === 'string' ? data.detail : null,
               notes: typeof data.notes === 'string' ? data.notes : '',
               images: Array.isArray(data.images) ? data.images.filter(i => i && typeof i.src === 'string') : [] };
    } catch (_) { return blank(); }
  };

  const save = (id, data) => {
    try {
      localStorage.setItem(KEY(id), JSON.stringify(data));
      try { localStorage.removeItem(LEGACY_KEY(id)); } catch (_) {}
      return true;
    } catch (_) { return false; }
  };

  const hasCustom = (topic, data) =>
    (data.detail !== null && data.detail !== topic.core) || data.notes.trim() !== '' || data.images.length > 0;

  const showToast = (html, ms = 3200) => {
    if (!toast) return;
    toast.innerHTML = html;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
  };

  const refreshBadges = () => {
    document.querySelectorAll('[data-topic-id]').forEach(card => {
      const topic = topics[card.dataset.topicId];
      const badge = card.querySelector('.topic-saved');
      if (!topic || !badge) return;
      const data = load(card.dataset.topicId);
      if (!hasCustom(topic, data)) { badge.hidden = true; badge.textContent = ''; return; }
      const parts = [];
      if (data.detail !== null && data.detail !== topic.core) parts.push('Text edited');
      if (data.notes.trim()) parts.push('Notes');
      if (data.images.length) parts.push(`${data.images.length} image${data.images.length === 1 ? '' : 's'}`);
      badge.textContent = 'Saved · ' + parts.join(' · ');
      badge.hidden = false;
    });
  };

  const renderImages = data => {
    els.gallery.innerHTML = '';
    els.emptyImages.hidden = data.images.length > 0;
    data.images.forEach((image, index) => {
      const figure = document.createElement('figure');
      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt || `Image ${index + 1} for this topic`;
      img.loading = 'lazy';
      const caption = document.createElement('figcaption');
      const label = document.createElement('span');
      label.textContent = `Image ${String(index + 1).padStart(2, '0')}`;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'img-remove';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        const current = load(currentId);
        current.images.splice(index, 1);
        if (save(currentId, current)) { renderImages(current); refreshBadges(); updateEditedFlag(); showToast('<b>Removed.</b> Image deleted from this topic.'); }
      });
      caption.append(label, remove);
      figure.append(img, caption);
      els.gallery.append(figure);
    });
  };

  const setEditing = editing => {
    els.detail.hidden = editing;
    els.detailEditor.hidden = !editing;
    els.editBtn.hidden = editing;
    els.defaultBtn.hidden = editing;
    els.saveBtn.hidden = !editing;
    els.cancelBtn.hidden = !editing;
    if (editing) els.detailEditor.focus();
  };

  const currentTopic = () => topics[currentId];

  const updateEditedFlag = () => {
    const topic = currentTopic();
    if (!topic || !els.editedFlag) return;
    els.editedFlag.textContent = hasCustom(topic, load(currentId)) ? '· customised on this device' : '· original text';
  };

  const populate = () => {
    const topic = currentTopic();
    if (!topic) return;
    const data = load(currentId);
    const detailText = data.detail !== null ? data.detail : topic.core;
    els.kicker.textContent = `Topic ${topic.no} · ${topic.category}`;
    els.title.textContent = topic.title;
    els.summary.textContent = topic.summary;
    els.detail.textContent = detailText;
    els.detailEditor.value = detailText;
    els.practice.textContent = topic.practice;
    els.categoryGoal.textContent = topic.goal;
    els.notes.value = data.notes;
    els.notesStatus.textContent = data.notes ? 'Notes saved in this browser.' : 'No notes yet — start typing, it saves automatically.';
    setEditing(false);
    renderImages(data);
    updateEditedFlag();
    backdrop.querySelector('.topic-modal').scrollTop = 0;
  };

  const openTopic = (id, card) => {
    if (!topics[id]) return;
    currentId = id;
    lastFocused = card || document.activeElement;
    populate();
    backdrop.hidden = false;
    document.body.classList.add('modal-open');
    if (history.replaceState) history.replaceState(null, '', '#topic-' + topics[id].no);
    els.closeBtn.focus();
  };

  const closeTopic = () => {
    backdrop.hidden = true;
    document.body.classList.remove('modal-open');
    setEditing(false);
    currentId = null;
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  };

  document.querySelectorAll('[data-topic-id]').forEach(card => {
    card.addEventListener('click', () => openTopic(card.dataset.topicId, card));
  });

  els.closeBtn.addEventListener('click', closeTopic);
  backdrop.addEventListener('click', event => { if (event.target === backdrop) closeTopic(); });
  document.addEventListener('keydown', event => {
    if (backdrop.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeTopic(); return; }
    if (event.key === 'Tab') {
      const focusable = [...backdrop.querySelectorAll('button:not([hidden]),textarea:not([hidden]),input:not([hidden]),a[href]')]
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });

  // ---- Edit topic text ----
  els.editBtn.addEventListener('click', () => {
    els.detailEditor.value = els.detail.textContent;
    setEditing(true);
  });
  els.cancelBtn.addEventListener('click', () => setEditing(false));
  els.saveBtn.addEventListener('click', () => {
    const text = els.detailEditor.value.trim();
    if (!text) { showToast('<b>Empty text.</b> Write something, or tap Cancel.'); return; }
    const data = load(currentId);
    data.detail = text;
    if (!save(currentId, data)) { showToast('<b>Could not save.</b> Browser storage may be full — remove some images and try again.', 5000); return; }
    els.detail.textContent = text;
    setEditing(false);
    refreshBadges(); updateEditedFlag();
    showToast('<b>Saved.</b> Topic text updated on this device.');
  });
  els.defaultBtn.addEventListener('click', () => {
    const data = load(currentId);
    data.detail = null;
    save(currentId, data);
    populate(); refreshBadges();
    showToast('<b>Restored.</b> Original topic text is back.');
  });

  // ---- Notes (auto-save) ----
  let notesTimer = null;
  els.notes.addEventListener('input', () => {
    els.notesStatus.textContent = 'Saving…';
    clearTimeout(notesTimer);
    notesTimer = setTimeout(() => {
      const data = load(currentId);
      data.notes = els.notes.value;
      els.notesStatus.textContent = save(currentId, data) ? 'Notes saved in this browser.' : 'Could not save — browser storage may be full.';
      refreshBadges(); updateEditedFlag();
    }, 350);
  });

  // ---- Add images (device files are resized before storage to protect the storage quota) ----
  const fileToDataUrl = file => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1400;
      const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read-failed'));
        reader.readAsDataURL(file);
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('read-failed')); };
    img.src = url;
  });

  const addImages = async files => {
    const images = [...files].filter(f => f.type && f.type.startsWith('image/'));
    if (!images.length) { showToast('<b>No image selected.</b> Please choose an image file.'); return; }
    const data = load(currentId);
    let added = 0;
    for (const file of images) {
      try {
        const src = await fileToDataUrl(file);
        data.images.push({ src, alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') });
        if (!save(currentId, data)) {
          data.images.pop();
          save(currentId, data);
          showToast('<b>Storage full.</b> That image could not be kept. Remove some images or use a smaller one.', 5200);
          break;
        }
        added++;
      } catch (_) { showToast('<b>Could not read</b> one of those files.', 4200); }
    }
    renderImages(load(currentId)); refreshBadges(); updateEditedFlag();
    if (added) showToast(`<b>Added ${added} image${added === 1 ? '' : 's'}.</b> Saved inside this topic on this device.`);
  };

  els.addImageBtn.addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => { addImages(els.fileInput.files); els.fileInput.value = ''; });
  els.addUrlBtn.addEventListener('click', () => {
    const url = els.imageUrl.value.trim();
    if (!/^(https?:\/\/|data:image\/)/i.test(url)) { showToast('<b>Invalid image link.</b> Paste a full http(s) image URL.'); return; }
    const data = load(currentId);
    data.images.push({ src: url, alt: 'Linked image for this topic' });
    if (!save(currentId, data)) { showToast('<b>Storage full.</b> Could not save that link.', 4600); return; }
    els.imageUrl.value = '';
    renderImages(data); refreshBadges(); updateEditedFlag();
    showToast('<b>Image linked.</b> It now appears inside this topic.');
  });

  // ---- Reset everything custom for this topic ----
  els.resetBtn.addEventListener('click', () => {
    if (!currentId) return;
    if (!window.confirm('Reset this topic? Your edited text, notes and images for this topic will be removed from this browser.')) return;
    try { localStorage.removeItem(KEY(currentId)); localStorage.removeItem(LEGACY_KEY(currentId)); } catch (_) {}
    populate(); refreshBadges();
    showToast('<b>Topic reset.</b> Back to the original text with no notes or images.');
  });

  refreshBadges();

  // Deep link: category.html#topic-07 opens that topic enlarged
  const match = location.hash.match(/^#topic-(\d{2})$/);
  if (match) {
    const id = Object.keys(topics).find(key => topics[key].no === match[1]);
    if (id) openTopic(id, document.querySelector(`[data-topic-id="${id}"]`));
  }
})();
