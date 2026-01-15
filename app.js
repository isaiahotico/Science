const API_KEY = 'YOUR_YOUTUBE_API_KEY'; // Replace with your YouTube API key

/* ================= TELEGRAM USER ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser
  ? `@${tgUser.username || tgUser.first_name}`
  : "Guest";

document.getElementById("userBar").innerText =
  "👤 User: " + username;

// Extract video ID from URL
function getVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Load video and render card
async function loadVideo() {
  const url = document.getElementById('youtubeUrl').value.trim();
  const videoId = getVideoID(url);

  if (!videoId) {
    alert('Invalid YouTube URL');
    return;
  }

  try {
    // Fetch video metadata
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${API_KEY}`);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      alert('Video not found');
      return;
    }

    const video = data.items[0];
    const title = video.snippet.title;
    const channel = video.snippet.channelTitle;
    const thumbnail = video.snippet.thumbnails.high.url;
    const duration = video.contentDetails.duration.replace('PT', '').replace('M', ':').replace('S', '');
    const views = video.statistics.viewCount;

    const container = document.getElementById('videoContainer');
    container.innerHTML = `
      <div class="video-card">
        <img src="${thumbnail}" alt="${title}">
        <div class="video-info">
          <p>📌 <b>${title}</b></p>
          <p>👤 ${channel} 🇮🇳</p>
          <p>⏱ ${duration} | 👁 ${Number(views).toLocaleString()} views</p>
        </div>
        <div class="buttons">
          <button onclick="playVideo('${videoId}')">▶ Play</button>
        </div>
        <div id="iframeContainer"></div>
        <div class="suggestions" id="suggestionsContainer"></div>
      </div>
    `;

    // Fetch related videos
    fetchRelatedVideos(videoId);

  } catch (error) {
    console.error(error);
    alert('Error fetching video data');
  }
}

// Play video inside iframe
function playVideo(videoId) {
  const iframeContainer = document.getElementById('iframeContainer');
  iframeContainer.innerHTML = `
    <iframe 
      src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
      frameborder="0" 
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
      allowfullscreen>
    </iframe>
  `;
}

// Fetch related videos for Next Suggestions
async function fetchRelatedVideos(videoId) {
  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=5&key=${API_KEY}`);
    const data = await response.json();

    const suggestionsContainer = document.getElementById('suggestionsContainer');
    suggestionsContainer.innerHTML = `<h4>Next Video Suggestions:</h4>`;

    data.items.forEach(item => {
      const suggestion = document.createElement('div');
      suggestion.className = 'suggestion-card';
      suggestion.innerHTML = `
        <img src="${item.snippet.thumbnails.default.url}" alt="${item.snippet.title}">
        <p>${item.snippet.title}</p>
      `;
      suggestion.onclick = () => {
        playVideo(item.id.videoId);
      };
      suggestionsContainer.appendChild(suggestion);
    });

  } catch (error) {
    console.error(error);
  }
}
