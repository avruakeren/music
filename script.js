const tracks = [
  { id:1, title:"Neon Dreamer", artist:"Luna Vega", emoji:"🌙", color:"linear-gradient(135deg,#1a1a3e,#4a0080)", dur:213, tags:["new"] },
  { id:2, title:"Summer Storm", artist:"The Waves", emoji:"⚡", color:"linear-gradient(135deg,#0a2a4a,#006699)", dur:187, tags:["hot"] },
  { id:3, title:"Golden Hour", artist:"Marisol", emoji:"🌅", color:"linear-gradient(135deg,#3a1a00,#c85000)", dur:241, tags:[] },
  { id:4, title:"Drift Away", artist:"Echo Pulse", emoji:"🌊", color:"linear-gradient(135deg,#001a2a,#004466)", dur:198, tags:["hot"] },
  { id:5, title:"City Lights", artist:"Neon Circus", emoji:"🌃", color:"linear-gradient(135deg,#1a0030,#660099)", dur:225, tags:["new"] },
  { id:6, title:"Deep Forest", artist:"Ambira", emoji:"🌿", color:"linear-gradient(135deg,#001a00,#006600)", dur:312, tags:[] },
  { id:7, title:"Retrograde", artist:"Pixel Sky", emoji:"🪐", color:"linear-gradient(135deg,#1a1a00,#666600)", dur:267, tags:["hot"] },
  { id:8, title:"Midnight Run", artist:"Sable Fox", emoji:"🦊", color:"linear-gradient(135deg,#2a0000,#990000)", dur:194, tags:[] },
];

const playlists = [
  { name:"Chill Vibes", emoji:"🧊", count:"12 lagu" },
  { name:"Workout Mix", emoji:"💪", count:"8 lagu" },
  { name:"Lo-Fi Study", emoji:"📚", count:"24 lagu" },
  { name:"Late Night", emoji:"🌙", count:"15 lagu" },
];

const featuredCards = [
  { label:"PLAYLIST BARU", title:"Neon Dreamer Collection", sub:"Luna Vega • 12 lagu", bg:"linear-gradient(135deg,#1a1a3e,#4a0080,#c8f557 200%)", emoji:"🌙" },
  { label:"TRENDING", title:"Summer Storm EP", sub:"The Waves", bg:"linear-gradient(135deg,#0a2a4a,#006699,#ff6b6b 200%)", emoji:"⚡" },
  { label:"DIREKOMENDASIKAN", title:"Golden Hour Vibes", sub:"Marisol • Ambira", bg:"linear-gradient(135deg,#3a1a00,#c85000,#ffcc00 200%)", emoji:"🌅" },
];

let currentIdx = 0;
let isPlaying = false;
let progress = 0;
let volume = 0.7;
let shuffle = false;
let repeat = false;
let interval = null;
let likedTracks = new Set();

// Set greeting & date
(function() {
  const h = new Date().getHours();
  const greet = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
  document.getElementById('greeting').textContent = greet;
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const now = new Date();
  document.getElementById('dateLabel').textContent = `${days[now.getDay()]}, ${now.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'][now.getMonth()]}`;
})();

function fmt(s) {
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function render() {
  // Featured
  document.getElementById('featuredRow').innerHTML = featuredCards.map((c,i) => `
    <div class="featured-card" onclick="playTrack(${i})" style="grid-column:${i===0?'1':'auto'}">
      <div class="bg" style="background:${c.bg}"></div>
      <div class="overlay"></div>
      <div class="info">
        <div class="fc-label">${c.label}</div>
        <div class="fc-title">${c.emoji} ${c.title}</div>
        <div class="fc-sub">${c.sub}</div>
      </div>
    </div>
  `).join('');

  // Tracks
  document.getElementById('tracksGrid').innerHTML = tracks.map((t,i) => `
    <div class="track-row ${currentIdx===i && isPlaying?'playing':''}" onclick="playTrack(${i})">
      <div class="track-num">
        ${currentIdx===i && isPlaying
          ? '<div class="equalizer"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>'
          : (i+1)}
      </div>
      <div class="track-cover" style="background:${t.color}">
        <span>${t.emoji}</span>
        <div class="play-overlay">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div class="track-meta">
        <div class="track-title">
          ${t.title}
          ${t.tags.map(tag => `<span class="tag tag-${tag}">${tag}</span>`).join('')}
        </div>
        <div class="track-artist">${t.artist}</div>
      </div>
      <div class="track-duration">${fmt(t.dur)}</div>
      <div class="track-like ${likedTracks.has(t.id)?'liked':''}" onclick="event.stopPropagation();toggleLike(${t.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="${likedTracks.has(t.id)?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>
    </div>
  `).join('');

  // Sidebar playlists
  document.getElementById('playlistSidebar').innerHTML = playlists.map(p => `
    <div class="playlist-item">
      <div class="playlist-thumb" style="background:var(--surface3)">${p.emoji}</div>
      <div class="playlist-info">
        <div class="playlist-name">${p.name}</div>
        <div class="playlist-count">${p.count}</div>
      </div>
    </div>
  `).join('');

  // Queue (next 4)
  const nextItems = [];
  for(let i=1;i<=4;i++) nextItems.push(tracks[(currentIdx+i)%tracks.length]);
  document.getElementById('queueList').innerHTML = nextItems.map((t,i) => `
    <div class="queue-item" onclick="playTrack(${(currentIdx+i+1)%tracks.length})">
      <div class="queue-cover" style="background:${t.color}">${t.emoji}</div>
      <div class="queue-info">
        <div class="queue-title">${t.title}</div>
        <div class="queue-artist">${t.artist}</div>
      </div>
    </div>
  `).join('');
}

function updateNP() {
  const t = tracks[currentIdx];
  document.getElementById('npTitle').textContent = t.title;
  document.getElementById('npArtist').textContent = t.artist;
  const art = document.getElementById('npArt');
  art.textContent = t.emoji;
  art.style.background = t.color;
  art.className = 'np-art' + (isPlaying ? ' playing-art' : '');
  document.getElementById('durTime').textContent = fmt(t.dur);
}

function playTrack(idx) {
  currentIdx = idx;
  progress = 0;
  isPlaying = true;
  clearInterval(interval);
  startTimer();
  updateNP();
  render();
  updatePlayBtn();
}

function startTimer() {
  interval = setInterval(() => {
    if(!isPlaying) return;
    progress += 1/tracks[currentIdx].dur * 100;
    if(progress >= 100) {
      if(repeat) { progress = 0; }
      else { nextTrack(); return; }
    }
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('curTime').textContent = fmt(progress/100 * tracks[currentIdx].dur);
  }, 1000);
}

function togglePlay() {
  if(!isPlaying) {
    isPlaying = true;
    if(!interval) startTimer();
    document.getElementById('npArt').classList.add('playing-art');
  } else {
    isPlaying = false;
    document.getElementById('npArt').classList.remove('playing-art');
  }
  updatePlayBtn();
  render();
}

function updatePlayBtn() {
  document.getElementById('playIcon').innerHTML = isPlaying
    ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>'
    : '<polygon points="5 3 19 12 5 21 5 3"/>';
}

function prevTrack() {
  currentIdx = (currentIdx - 1 + tracks.length) % tracks.length;
  progress = 0; clearInterval(interval);
  if(isPlaying) startTimer();
  updateNP(); render();
}

function nextTrack() {
  if(shuffle) {
    let r; do { r = Math.floor(Math.random()*tracks.length); } while(r===currentIdx);
    currentIdx = r;
  } else {
    currentIdx = (currentIdx + 1) % tracks.length;
  }
  progress = 0; clearInterval(interval);
  if(isPlaying) startTimer();
  updateNP(); render();
}

function toggleShuffle() {
  shuffle = !shuffle;
  document.getElementById('shuffleBtn').classList.toggle('active', shuffle);
}

function toggleRepeat() {
  repeat = !repeat;
  document.getElementById('repeatBtn').classList.toggle('active', repeat);
}

function seekTo(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  progress = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  document.getElementById('progressFill').style.width = progress + '%';
  document.getElementById('curTime').textContent = fmt(progress/100 * tracks[currentIdx].dur);
}

function setVolume(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  volume = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  document.getElementById('volFill').style.width = (volume*100) + '%';
}

function toggleLike(id) {
  if(likedTracks.has(id)) likedTracks.delete(id);
  else likedTracks.add(id);
  render();
}

function shuffleQueue() { nextTrack(); }

function setNav(el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
}

// INIT
updateNP();
render();
document.getElementById('volFill').style.width = '70%';