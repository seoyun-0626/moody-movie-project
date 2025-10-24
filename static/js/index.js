/* ============================================================
📊 Flask API에서 감정 통계 불러오기
============================================================ */
async function loadEmotionStats() {
  try {
    // ✅ Flask 배포 서버 주소로 변경
    const response = await fetch("https://web-production-5985.up.railway.app/stats");
    const data = await response.json();

    const topEmotionEl = document.getElementById("top-emotion");
    const iconEl = document.getElementById("emotion-icon");

    if (!data || data.length === 0) {
      topEmotionEl.innerText = "데이터가 아직 없어요 😢";
      iconEl.src = "../static/assets/img/chatbot-logo.png";
      return;
    }

    // 감정별 이미지 매핑
    const emotionMap = {
      "분노": "분노.gif",
      "불안": "불안.gif",
      "슬픔": "슬픔.gif",
      "외로움": "외로움.gif",
      "심심": "심심.gif",
      "탐구": "탐구.gif",
      "행복": "행복.gif"
    };

    let index = 0;

    function showNextEmotion() {
      const item = data[index];
      const emotion = item.rep_emotion;
      const count = item.count;

      // 텍스트 업데이트
      topEmotionEl.innerHTML = `사용자들이 분류된 감정은 
        <strong>${emotion}</strong> (${count}회) 입니다.`;

      // 이미지 교체 (✅ static 경로 반영)
      const gifName = emotionMap[emotion] || "chatbot-logo.png";
      iconEl.src = `../static/assets/img/${gifName}`;

      // 부드러운 전환 효과
      topEmotionEl.style.opacity = 0;
      iconEl.style.opacity = 0;
      setTimeout(() => {
        topEmotionEl.style.opacity = 1;
        iconEl.style.opacity = 1;
      }, 200);

      index = (index + 1) % data.length;
      setTimeout(showNextEmotion, 3000);
    }

    showNextEmotion();
  } catch (err) {
    console.error("통계 불러오기 실패:", err);
    document.getElementById("top-emotion").innerText = "서버 연결 오류 😢";
  }
}

/* ============================================================
🎬 Flask API에서 Top10 영화 불러오기
============================================================ */
async function loadTop10Movies() {
  try {
    // ✅ Flask 배포 서버 주소로 변경
    const response = await fetch("https://web-production-5985.up.railway.app/top10");
    const data = await response.json();

    if (!data || data.length === 0) {
      document.getElementById("top10-track").innerHTML =
        "<p>추천된 영화 데이터가 없습니다 😢</p>";
      return;
    }

    // TMDB 포스터 불러오기
    const tmdbResults = [];
    for (const item of data) {
      const query = item.movie.replace(/\(.*?\)/g, "").trim();
      const search = await fetchTMDB("search/movie", { query });
      const movieData = search.results[0];
      if (movieData) {
        tmdbResults.push(movieData);
      }
    }

    const track = document.getElementById("top10-track");
    track.innerHTML = "";

    tmdbResults.forEach((movie) => {
      const card = document.createElement("div");
      card.classList.add("poster");
      card.dataset.id = movie.id;

      const img = createPosterImg(movie.poster_path, movie.title);
      const info = document.createElement("div");
      info.className = "info-overlay";
      info.innerHTML = `
        <h4>${movie.title}</h4>
        <p>⭐ ${movie.vote_average?.toFixed?.(1) ?? "0.0"} | ${movie.release_date?.slice(0, 4) ?? "N/A"}</p>
      `;

      card.append(img, info);
      track.appendChild(card);
    });

    applyHoverAndClickEffect(tmdbResults, "#top10-track");
  } catch (err) {
    console.error("Top10 로드 실패:", err);
    document.getElementById("top10-track").innerHTML =
      "<p>서버 연결 오류 😢</p>";
  }
}
