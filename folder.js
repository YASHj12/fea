// FORM / FEA — folder pages: topic preview inside the opened folder's interface
(() => {
  const sheet = document.querySelector('.folder-sheet');
  if (!sheet) return;
  const topics = [...sheet.querySelectorAll('.topic')];
  const code = sheet.querySelector('.focus-code');
  const title = sheet.querySelector('.focus-title');
  const detail = sheet.querySelector('.focus-detail');
  const lessons = sheet.querySelector('.focus-lessons');
  const format = sheet.querySelector('.focus-format');

  const selectTopic = topic => {
    topics.forEach(candidate => {
      const active = candidate === topic;
      candidate.classList.toggle('is-selected', active);
      candidate.setAttribute('aria-pressed', String(active));
    });
    if (code) code.textContent = topic.dataset.code || '';
    if (title) title.textContent = topic.dataset.title || '';
    if (detail) detail.textContent = topic.dataset.detail || '';
    if (lessons) lessons.textContent = topic.dataset.lessons || '';
    if (format) format.textContent = topic.dataset.format || '';
  };

  topics.forEach(topic => topic.addEventListener('click', () => selectTopic(topic)));
})();
