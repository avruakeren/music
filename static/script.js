const API = 'http://localhost:8000';

const els = {
  searchInput: document.getElementById('searchInput'),
  resultMeta: document.getElementById('resultMeta'),
  recentGrid: document.getElementById('recentGrid'),
  resultsList: document.getElementById('resultsList'),
  sectionHeading: document.getElementById('sectionHeading'),
  audio: document.getElementById('audio'),
  cover: document.getElementById('cover'),
  title: document.getElementById('title'),
  artist: document.getElementById('artist'),
  currentTime: document.getElementById('currentTime'),
  duration: document.getElementById('duration'),
  progress: document.getElementById('progress'),
  volume: document.getElementById('volume'),
  playBtn: document.getElementById('playBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  shuffleBtn: document.getElementById('shuffleBtn'),
  repeatBtn: document.getElementById('repeatBtn')
};

const state = {
  searchResults: [],
  queue: [],
  currentIndex: 0,
  isShuffle: false,
  isRepeat: false,
  recentPlays: [],
  requestId: 0,
  debounceTimer: null,
  isSearchMode: false
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTime(secs) {
  if (!Number.isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ─── YouTube via local backend ────────────────────────────────────────────────

async function searchYouTube(query) {
  const requestId = ++state.requestId;
  els.resultMeta.textContent = 'Mencari di YouTube...';
  state.isSearchMode = true;
  state.searchResults = [];
  renderView();

  try {
    const res = await fetch(`${API}/search?q=${encodeURIComponent(query)}&limit=15`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();

    if (requestId !== state.requestId) return;

    const tracks = (data.results || []).map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      durationLabel: t.duration ? formatTime(t.duration) : '--:--',
      artwork: t.thumbnail,
      src: null // resolved on play
    }));

    if (!tracks.length) {
      els.resultMeta.textContent = 'Tidak ada hasil. Coba keyword lain.';
      renderView(); return;
    }

    state.searchResults = tracks;
    els.resultMeta.textContent = `${tracks.length} lagu ditemukan`;
    renderView();
    loadAndPlay(0, false);

  } catch (err) {
    if (requestId !== state.requestId) return;
    console.error(err);
    els.resultMeta.textContent = `Gagal connect ke server. Pastikan server.py berjalan. (${err.message})`;
    renderView();
  }
}

async function resolveAndPlay(index, autoPlay = true) {
  const track = state.queue[index];
  if (!track) return;

  if (track.src) {
    // already resolved
    setAudioSrc(track, autoPlay);
    return;
  }

  els.resultMeta.textContent = `Memuat stream "${track.title}"...`;
  try {
    const res = await fetch(`${API}/stream/${encodeURIComponent(track.id)}`);
    if (!res.ok) throw new Error(`Stream error: ${res.status}`);
    const data = await res.json();
    track.src = data.url;
    setAudioSrc(track, autoPlay);
    els.resultMeta.textContent = `${state.searchResults.length} lagu ditemukan`;
  } catch (err) {
    console.error(err);
    els.resultMeta.textContent = `Gagal load stream: ${err.message}`;
  }
}

function setAudioSrc(track, autoPlay) {
  els.audio.src = track.src;
  els.currentTime.textContent = '0:00';
  els.duration.textContent = track.durationLabel || '--:--';
  els.progress.value = 0;
  setNowPlaying(track);
  renderView();
  if (autoPlay) playAudio();
  else pauseAudio();
}

function loadAndPlay(index, autoPlay = true) {
  if (!state.queue.length) return;
  state.currentIndex = Math.max(0, Math.min(index, state.queue.length - 1));
  resolveAndPlay(state.currentIndex, autoPlay);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSearchResults() {
  els.recentGrid.classList.add('hidden');
  els.resultsList.classList.remove('hidden');
  els.sectionHeading.textContent = 'Search Results';

  if (!state.searchResults.length) {
    els.resultsList.innerHTML = `<li class="track"><div class="meta"><strong>Belum ada hasil</strong><small>Coba keyword lain.</small></div></li>`;
    return;
  }

  els.resultsList.innerHTML = state.searchResults.map((track, idx) => {
    const badge = track.artwork
      ? `<img class="badge" src="${track.artwork}" alt="${track.title}" />`
      : '<div class="badge">🎵</div>';
    const active = state.queue === state.searchResults && idx === state.currentIndex;
    return `
      <li class="track ${active ? 'active' : ''}" data-index="${idx}">
        ${badge}
        <div class="meta">
          <strong>${track.title}</strong>
          <small>${track.artist}</small>
        </div>
        <span>${track.durationLabel}</span>
      </li>`;
  }).join('');

  els.resultsList.querySelectorAll('.track[data-index]').forEach(row => {
    row.addEventListener('click', () => {
      state.queue = state.searchResults;
      loadAndPlay(Number(row.dataset.index));
    });
  });
}

function renderRecent() {
  els.resultsList.classList.add('hidden');
  els.recentGrid.classList.remove('hidden');
  els.sectionHeading.textContent = 'Recent Play';

  if (!state.recentPlays.length) {
    els.recentGrid.innerHTML = '<div class="recent-item"><strong>Belum ada</strong><span>Cari dan play lagu dulu.</span></div>';
    return;
  }

  els.recentGrid.innerHTML = state.recentPlays.slice(0, 6).map((track, idx) => `
    <button class="recent-item" data-index="${idx}">
      ${track.artwork
        ? `<img class="recent-thumb" src="${track.artwork}" alt="${track.title}" />`
        : '<div class="recent-thumb">🎵</div>'}
      <strong>${track.title}</strong>
      <span>${track.artist}</span>
    </button>
  `).join('');

  els.recentGrid.querySelectorAll('[data-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.queue = state.recentPlays;
      loadAndPlay(Number(btn.dataset.index));
    });
  });
}

function renderView() {
  if (state.isSearchMode) renderSearchResults();
  else renderRecent();
}

// ─── Player ───────────────────────────────────────────────────────────────────

function setNowPlaying(track) {
  els.title.textContent = track?.title || 'Pilih lagu';
  els.artist.textContent = track?.artist || '-';
  els.cover.textContent = track?.artwork ? '' : '🎧';
  els.cover.style.background = track?.artwork
    ? `url(${track.artwork}) center/cover no-repeat`
    : '#232327';
}

async function playAudio() {
  try {
    await els.audio.play();
    els.playBtn.textContent = '⏸';
    const track = state.queue[state.currentIndex];
    if (track) {
      state.recentPlays = [track, ...state.recentPlays.filter(t => t.id !== track.id)].slice(0, 20);
    }
  } catch (e) {
    console.error(e);
    els.playBtn.textContent = '▶';
  }
}

function pauseAudio() {
  els.audio.pause();
  els.playBtn.textContent = '▶';
}

function togglePlay() {
  if (!state.queue.length) return;
  els.audio.paused ? playAudio() : pauseAudio();
}

function nextTrack() {
  if (!state.queue.length) return;
  const next = state.isShuffle
    ? Math.floor(Math.random() * state.queue.length)
    : (state.currentIndex + 1) % state.queue.length;
  loadAndPlay(next);
}

function prevTrack() {
  if (!state.queue.length) return;
  loadAndPlay((state.currentIndex - 1 + state.queue.length) % state.queue.length);
}

function updateProgress() {
  const { currentTime, duration } = els.audio;
  els.currentTime.textContent = formatTime(currentTime);
  if (duration) {
    els.duration.textContent = formatTime(duration);
    els.progress.value = (currentTime / duration) * 100;
  }
}

function seekTrack() {
  if (!els.audio.duration) return;
  els.audio.currentTime = (Number(els.progress.value) / 100) * els.audio.duration;
}

function onSearchInput() {
  clearTimeout(state.debounceTimer);
  const keyword = els.searchInput.value.trim();
  if (!keyword) {
    state.searchResults = [];
    state.isSearchMode = false;
    els.resultMeta.textContent = 'Cari lagu di kolom search di atas.';
    renderView(); return;
  }
  state.debounceTimer = setTimeout(() => searchYouTube(keyword), 500);
}

// ─── Events ───────────────────────────────────────────────────────────────────

els.searchInput.addEventListener('input', onSearchInput);
els.playBtn.addEventListener('click', togglePlay);
els.prevBtn.addEventListener('click', prevTrack);
els.nextBtn.addEventListener('click', nextTrack);
els.shuffleBtn.addEventListener('click', () => {
  state.isShuffle = !state.isShuffle;
  els.shuffleBtn.classList.toggle('active', state.isShuffle);
});
els.repeatBtn.addEventListener('click', () => {
  state.isRepeat = !state.isRepeat;
  els.repeatBtn.classList.toggle('active', state.isRepeat);
});
els.progress.addEventListener('input', seekTrack);
els.volume.addEventListener('input', () => { els.audio.volume = Number(els.volume.value); });
els.audio.addEventListener('timeupdate', updateProgress);
els.audio.addEventListener('loadedmetadata', updateProgress);
els.audio.addEventListener('pause', () => { els.playBtn.textContent = '▶'; });
els.audio.addEventListener('play', () => { els.playBtn.textContent = '⏸'; });
els.audio.addEventListener('ended', () => {
  if (state.isRepeat) { els.audio.currentTime = 0; playAudio(); return; }
  nextTrack();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

setNowPlaying(null);
els.audio.volume = Number(els.volume.value);
renderView();

// Check server on load
fetch(`${API}/health`)
  .then(r => r.json())
  .then(() => els.resultMeta.textContent = 'Server terhubung ✓ Cari lagu di atas.')
  .catch(() => els.resultMeta.textContent = '⚠️ Server tidak terdeteksi. Jalankan server.py dulu.');
