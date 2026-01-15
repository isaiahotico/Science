// Replace with your YouTube Data API v3 key
const API_KEY = 'YOUR_YOUTUBE_API_KEY';

// Extract video ID from URL
function getVideoID(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// Load video metadata and render card
async function loadVideo() {
  const url = document.getElementById('youtubeUrl').value.trim();
  const videoId = getVideoID(url);

  if (!videoId) {
    alert('Invalid YouTube URL');
    return;
  }

  try {
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

    // Render Telegram-style card
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
          <button onclick="window.open('https://www.youtube.com/watch?v=${videoId}', '_blank')">▶ Play</button>
          <button onclick="alert('Next video feature coming soon!')">⏭ Next</button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error(error);
    alert('Error fetching video data');
  }
}
