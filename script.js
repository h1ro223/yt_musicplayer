let player;
let playlist = JSON.parse(localStorage.getItem("playlist") || "[]");
let currentIndex = 0;
let isLooping = false;
let isShuffling = false;

// YouTube iframe APIの読み込み後に呼ばれる
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "200",
    width: "100%",
    videoId: playlist[currentIndex]?.id || "",
    events: {
      onReady: () => {
        if (playlist.length > 0) loadVideo(currentIndex);
      },
      onStateChange: onPlayerStateChange
    }
  });
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    if (isLooping) {
      loadVideo(currentIndex);
    } else {
      nextVideo();
    }
  }
}

// ---- 入力欄：自動ペースト補助 ----
document.addEventListener("DOMContentLoaded", () => {
  const urlInput = document.getElementById("youtubeUrl");
  urlInput.addEventListener("focus", async function () {
    // モバイル対応: クリップボード自動貼り付け (ユーザーが許可してれば)
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

// 手動ペーストボタン
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
      playlist.push({ id: videoId, title });
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
        <button onclick="removeVideo(${i})" title="削除">削除</button>
      </div>
    `;
    list.appendChild(li);
  });
}

function loadVideo(index) {
  currentIndex = index;
  player.loadVideoById(playlist[index].id);
  updateNowPlaying();
}

function updateNowPlaying() {
  const title = playlist[currentIndex]?.title || "";
  document.getElementById("nowPlaying").textContent = `現在再生中 ▶ ${title}`;
}

function togglePlay() {
  const state = player.getPlayerState();
  if (state === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
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

function removeVideo(index) {
  playlist.splice(index, 1);
  localStorage.setItem("playlist", JSON.stringify(playlist));
  renderPlaylist();
  if (index === currentIndex) {
    if (playlist.length > 0) {
      loadVideo(0);
    } else {
      player.stopVideo();
      document.getElementById("nowPlaying").textContent = "";
    }
  }
}

function shufflePlaylist() {
  isShuffling = !isShuffling;
  showNotification(`シャッフルを${isShuffling ? "オン" : "オフ"}にしました！`);
}

function toggleLoop() {
  isLooping = !isLooping;
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
  const note = document.getElementById("notification");
  note.textContent = message;
  setTimeout(() => (note.textContent = ""), 1800);
}

window.onload = () => {
  renderPlaylist();
};