let player;
let playlist = JSON.parse(localStorage.getItem("playlist") || "[]");
let currentIndex = 0;
let isLooping = false;
let isShuffling = false;
let seekbarTimer = null;
let toDeleteIndex = null;

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "200",
    width: "100%",
    videoId: playlist[currentIndex]?.id || "",
    events: {
      onReady: () => {
        if (playlist.length > 0) loadVideo(currentIndex);
        updateSeekbarUI();
      },
      onStateChange: onPlayerStateChange
    }
  });
}
function onPlayerStateChange(event) {
  updatePlayPauseBtn();
  if (event.data === YT.PlayerState.ENDED) {
    if (isLooping) {
      loadVideo(currentIndex);
    } else {
      nextVideo();
    }
  }
  if (event.data === YT.PlayerState.PLAYING) {
    startSeekbar();
  } else {
    stopSeekbar();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("youtubeUrl");
  urlInput.addEventListener("focus", async function () {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && /^https?:\/\/(www\.)?youtube\.com|youtu\.be\//.test(text) && !urlInput.value) {
          urlInput.value = text;
        }
      } catch (e) {}
    }
  });
});

function pasteUrl() {
  const urlInput = document.getElementById("youtubeUrl");
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.readText().then(text => {
      urlInput.value = text;
    });
  } else {
    alert("クリップボードAPIが使えません。手動で貼り付けてください。");
  }
}

function addVideo() {
  const url = document.getElementById("youtubeUrl").value.trim();
  const videoId = extractVideoID(url);
  if (!videoId) return alert("無効なURLです");

  fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
    .then(res => res.json())
    .then(data => {
      const title = data.title || videoId;
      const author = data.author_name || "";
      playlist.push({ id: videoId, title, author });
      localStorage.setItem("playlist", JSON.stringify(playlist));
      renderPlaylist();
      showNotification("曲を追加しました！");
      if (playlist.length === 1) loadVideo(0);
    });
  document.getElementById("youtubeUrl").value = "";
}

function extractVideoID(url) {
  const match = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return match ? match[1] : null;
}

function renderPlaylist() {
  const list = document.getElementById("playlist");
  list.innerHTML = "";
  playlist.forEach((video, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${video.title}</span>
      <div class="btn-group">
        <button onclick="moveUp(${i})" title="上へ">↑</button>
        <button onclick="moveDown(${i})" title="下へ">↓</button>
        <button onclick="window.open('https://www.youtube.com/watch?v=${video.id}', '_blank')" title="YouTubeで開く">▶</button>
        <button class="delete-btn" onclick="confirmDelete(${i})" title="削除">削除</button>
      </div>
    `;
    list.appendChild(li);
  });
}

// 削除警告モーダル
function confirmDelete(index) {
  toDeleteIndex = index;
  document.getElementById("confirmDeleteModal").style.display = "flex";
}
document.getElementById("confirmDeleteYes").onclick = () => {
  if (toDeleteIndex !== null) removeVideo(toDeleteIndex);
  document.getElementById("confirmDeleteModal").style.display = "none";
  toDeleteIndex = null;
};
document.getElementById("confirmDeleteNo").onclick = () => {
  document.getElementById("confirmDeleteModal").style.display = "none";
  toDeleteIndex = null;
};

function removeVideo(index) {
  playlist.splice(index, 1);
  localStorage.setItem("playlist", JSON.stringify(playlist));
  renderPlaylist();
  if (index === currentIndex) {
    if (playlist.length > 0) {
      loadVideo(0);
    } else {
      player.stopVideo();
      document.getElementById("nowPlayingTitle").textContent = "";
      document.getElementById("nowPlayingChannel").textContent = "";
      updateSeekbarUI();
    }
  }
}

function loadVideo(index) {
  currentIndex = index;
  player.loadVideoById(playlist[index].id);
  updateNowPlaying();
  updateSeekbarUI();
  resetLikeBtns();
}

function updateNowPlaying() {
  const title = playlist[currentIndex]?.title || "";
  const author = playlist[currentIndex]?.author || "";
  const titleElem = document.getElementById("nowPlayingTitle");
  titleElem.textContent = title;
  document.getElementById("nowPlayingChannel").textContent = author;
  setTimeout(() => updateScrollTitle(), 300); // タイトルセット後に判定
}

function updateScrollTitle() {
  const wrap = document.querySelector(".now-title-scroll-wrap");
  const titleElem = document.getElementById("nowPlayingTitle");
  if (!titleElem || !wrap) return;
  // スクロール長判定
  if (titleElem.scrollWidth > wrap.offsetWidth) {
    titleElem.classList.add("scroll");
  } else {
    titleElem.classList.remove("scroll");
  }
}

function togglePlay() {
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
  setTimeout(() => updatePlayPauseBtn(), 150);
}

function updatePlayPauseBtn() {
  const btn = document.getElementById("playPauseBtn");
  if (!player || !btn) return;
  const state = player.getPlayerState();
  btn.textContent = (state === YT.PlayerState.PLAYING) ? "⏸️" : "▶️";
}

function nextVideo() {
  if (isShuffling) {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else {
    currentIndex = (currentIndex + 1) % playlist.length;
  }
  loadVideo(currentIndex);
}
function prevVideo() {
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  loadVideo(currentIndex);
}
function shufflePlaylist() {
  isShuffling = !isShuffling;
  document.getElementById("shuffleBtn").classList.toggle("active", isShuffling);
  showNotification(`シャッフルを${isShuffling ? "オン" : "オフ"}にしました！`);
}
function toggleLoop() {
  isLooping = !isLooping;
  document.getElementById("loopBtn").classList.toggle("active", isLooping);
  showNotification(`ループを${isLooping ? "オン" : "オフ"}にしました！`);
}
function moveUp(index) {
  if (index <= 0) return;
  [playlist[index - 1], playlist[index]] = [playlist[index], playlist[index - 1]];
  localStorage.setItem("playlist", JSON.stringify(playlist));
  renderPlaylist();
}
function moveDown(index) {
  if (index >= playlist.length - 1) return;
  [playlist[index], playlist[index + 1]] = [playlist[index + 1], playlist[index]];
  localStorage.setItem("playlist", JSON.stringify(playlist));
  renderPlaylist();
}
function showNotification(message) {
  // 画面内表示が欲しい場合は適宜追加
}

function startSeekbar() {
  stopSeekbar();
  seekbarTimer = setInterval(updateSeekbarUI, 400);
}
function stopSeekbar() {
  if (seekbarTimer) clearInterval(seekbarTimer);
}
function updateSeekbarUI() {
  const seekbar = document.getElementById("seekbar");
  const current = document.getElementById("currentTime");
  const dur = document.getElementById("duration");
  if (!player || typeof player.getCurrentTime !== "function") return;
  let cur = 0;
  let total = 0;
  try {
    cur = player.getCurrentTime();
    total = player.getDuration();
  } catch (e) {}
  seekbar.max = total || 1;
  seekbar.value = cur || 0;
  current.textContent = formatTime(cur);
  dur.textContent = formatTime(total);
}
function formatTime(s) {
  s = Math.floor(s || 0);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
document.getElementById("seekbar").addEventListener("input", function (e) {
  if (!player) return;
  player.seekTo(Number(this.value), true);
  updateSeekbarUI();
});

// 👍👎ボタン
document.getElementById("likeBtn").onclick = function () {
  this.classList.toggle("active");
  document.getElementById("dislikeBtn").classList.remove("active");
};
document.getElementById("dislikeBtn").onclick = function () {
  this.classList.toggle("active");
  document.getElementById("likeBtn").classList.remove("active");
};
function resetLikeBtns() {
  document.getElementById("likeBtn").classList.remove("active");
  document.getElementById("dislikeBtn").classList.remove("active");
}

// 起動時初期化
window.onload = () => {
  renderPlaylist();
  updateNowPlaying();
  updateSeekbarUI();
  updatePlayPauseBtn();
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  // スクロール禁止念押し
  window.addEventListener('scroll', function(){ window.scrollTo(0,0); });
}; 