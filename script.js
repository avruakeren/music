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

// Piped instances to try in order
const PIPED_INSTANCES = [
  'https://pipedapi.adminforge.de',
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de'
];

function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  const minute = Math.floor(value / 60);
  const second = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minute}:${second}`;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderSearchResults() {
  const tracks = state.searchResults;
  els.recentGrid.classList.add('hidden');
  els.resultsList.classList.remove('hidden');
  els.sectionHeading.textContent = 'Search Results';

  if (!tracks.length) {
    els.resultsList.innerHTML = `<li class="track"><div class="meta"><strong>Belum ada hasil</strong><small>Coba keyword lain.</small></div></li>`;
    return;
  }

  els.resultsList.innerHTML = tracks.map((track, idx) => {
    const badge = track.artwork
      ? `<img class="badge" src="${track.artwork}" alt="${track.title}" />`
      : '<div class="badge">🎵</div>';
    const active = state.queue === state.searchResults && idx === state.currentIndex;
    return `
      <li class="track ${active ? 'active' : ''}" data-index="${idx}">
        ${badge}
        <div class="meta">
          <strong>${track.title}</strong>
          <small>${track.artist || 'Unknown Artist'}</small>
        </div>
        <span>${track.durationLabel || '--:--'}</span>
      </li>`;
  }).join('');

  els.resultsList.querySelectorAll('.track[data-index]').forEach(row => {
    row.addEventListener('click', () => {
      playFromList(state.searchResults, Number(row.dataset.index));
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
      ${track.artwork ? `<img class="recent-thumb" src="${track.artwork}" alt="${track.title}" />` : '<div class="recent-thumb">🎵</div>'}
      <strong>${track.title}</strong>
      <span>${track.artist || 'Unknown Artist'}</span>
    </button>
  `).join('');

  els.recentGrid.querySelectorAll('[data-index]').forEach(button => {
    button.addEventListener('click', () => {
      playFromList(state.recentPlays, Number(button.dataset.index));
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

function playFromList(list, index, autoPlay = true) {
  if (!list.length) return;
  state.queue = list;
  state.currentIndex = Math.max(0, Math.min(index, list.length - 1));
  const track = state.queue[state.currentIndex];
  els.audio.src = track.src;
  els.currentTime.textContent = '0:00';
  els.duration.textContent = track.durationLabel || '--:--';
  els.progress.value = 0;
  setNowPlaying(track);
  renderView();
  if (autoPlay) playAudio();
  else pauseAudio();
}

async function playAudio() {
  try {
    await els.audio.play();
    els.playBtn.textContent = '⏸';
    const track = state.queue[state.currentIndex];
    if (track) {
      state.recentPlays = [track, ...state.recentPlays.filter(t => t.src !== track.src)].slice(0, 20);
    }
  } catch {
    els.playBtn.textContent = '▶';
  }
}

function pauseAudio() {
  els.audio.pause();
  els.playBtn.textContent = '▶';
}

function togglePlay() {
  if (!state.queue.length) return;
  if (els.audio.paused) playAudio();
  else pauseAudio();
}

function nextTrack() {
  if (!state.queue.length) return;
  const next = state.isShuffle
    ? Math.floor(Math.random() * state.queue.length)
    : (state.currentIndex + 1) % state.queue.length;
  playFromList(state.queue, next, true);
}

function prevTrack() {
  if (!state.queue.length) return;
  const prev = (state.currentIndex - 1 + state.queue.length) % state.queue.length;
  playFromList(state.queue, prev, true);
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

// ─── YouTube via Piped ────────────────────────────────────────────────────────

function parseVideoId(urlLike = '') {
  try {
    const full = new URL(urlLike, 'https://youtube.com');
    return full.searchParams.get('v') || full.pathname.split('/').filter(Boolean).pop() || '';
  } catch {
    return '';
  }
}

function mapYoutubeTrack(video, streamUrl) {
  return {
    title: video.title || 'Untitled',
    artist: video.uploaderName || video.uploader || 'YouTube',
    durationLabel: Number(video.duration) ? formatTime(Number(video.duration)) : '--:--',
    artwork: video.thumbnail || video.thumbnailUrl || '',
    src: streamUrl
  };
}

async function fetchFromInstance(instance, query) {
  const res = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&filter=music_songs`, {
    signal: AbortSignal.timeout(8000)
  });
  const data = await res.json();
  const items = (Array.isArray(data.items) ? data.items : [])
    .filter(item => item.url || item.videoId)
    .slice(0, 12);

  const tracks = [];

  for (const video of items) {
    const id = video.videoId || parseVideoId(video.url);
    if (!id) continue;
    try {
      const streamRes = await fetch(`${instance}/streams/${encodeURIComponent(id)}`, {
        signal: AbortSignal.timeout(8000)
      });
      const streamData = await streamRes.json();
      const audioStreams = Array.isArray(streamData.audioStreams) ? streamData.audioStreams : [];
      const best = audioStreams
        .filter(a => a.url && (!a.mimeType || /audio\//i.test(a.mimeType)))
        .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))[0];
      if (best?.url) {
        tracks.push(mapYoutubeTrack(video, best.url));
      }
    } catch {
      // skip video if stream fetch fails
    }
  }

  return tracks;
}

async function searchYouTube(query) {
  const requestId = ++state.requestId;
  els.resultMeta.textContent = 'Mencari di YouTube...';
  state.isSearchMode = true;
  state.searchResults = [];
  renderView();

  try {
    let results = [];

    for (const instance of PIPED_INSTANCES) {
      try {
        results = await fetchFromInstance(instance, query);
        if (results.length) break;
      } catch {
        // try next instance
      }
    }

    if (requestId !== state.requestId) return;

    state.searchResults = results;

    if (!results.length) {
      els.resultMeta.textContent = 'Tidak ada hasil atau semua instance error. Coba keyword lain.';
      renderView();
      return;
    }

    els.resultMeta.textContent = `${results.length} lagu ditemukan dari YouTube`;
    renderView();
    playFromList(state.searchResults, 0, false);
  } catch {
    if (requestId !== state.requestId) return;
    els.resultMeta.textContent = 'Search gagal. Coba lagi.';
  }
}

function onSearchInput() {
  clearTimeout(state.debounceTimer);
  const keyword = els.searchInput.value.trim();

  if (!keyword) {
    state.searchResults = [];
    state.isSearchMode = false;
    els.resultMeta.textContent = 'Cari lagu di kolom search di atas.';
    renderView();
    return;
  }

  state.debounceTimer = setTimeout(() => {
    searchYouTube(keyword);
  }, 450);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

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
els.volume.addEventListener('input', () => {
  els.audio.volume = Number(els.volume.value);
});

els.audio.addEventListener('timeupdate', updateProgress);
els.audio.addEventListener('loadedmetadata', updateProgress);
els.audio.addEventListener('pause', () => { els.playBtn.textContent = '▶'; });
els.audio.addEventListener('play', () => { els.playBtn.textContent = '⏸'; });
els.audio.addEventListener('ended', () => {
  if (state.isRepeat) {
    els.audio.currentTime = 0;
    playAudio();
    return;
  }
  nextTrack();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

setNowPlaying(null);
els.audio.volume = Number(els.volume.value);
renderView();
