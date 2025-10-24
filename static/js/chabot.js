// === 요소 선택 ===
const chatBox = document.getElementById("chat");
const msgInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// === TMDB API 설정 ===
const apiKey = "8cde0962eca9041f7345e9c7ab7a4b7f";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// === 상태 변수 ===
let turn = 0;
let phase = "emotion"; // emotion → after_recommend

// === 말풍선 메시지 추가 함수 ===
function appendMsg(text, who = "bot") {
  const row = document.createElement("div");
  row.className = "row";

  const bubble = document.createElement("div");
  bubble.className = `msg ${who}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");

  if (who === "bot") {
    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.innerHTML = `<img src="../static/assets/img/chatbot-logo.png" alt="bot">`;
    row.appendChild(thumb);
  }

  row.appendChild(bubble);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 🌀 스피너 표시 함수
function showSpinner() {
  const loadingRow = document.createElement("div");
  loadingRow.className = "row loading-row";

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  thumb.innerHTML = `<img src="../static/assets/img/chatbot-logo.png" alt="bot">`;

  const spinner = document.createElement("div");
  spinner.className = "spinner";

  loadingRow.appendChild(thumb);
  loadingRow.appendChild(spinner);
  chatBox.appendChild(loadingRow);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// 🆕 TMDB에서 영화 포스터 가져오기 함수
async function fetchPoster(title) {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=ko-KR&query=${encodeURIComponent(title)}&page=1`
    );
    const data = await res.json();
    if (data.results && data.results.length > 0 && data.results[0].poster_path) {
      return IMAGE_BASE + data.results[0].poster_path;
    }
    return null;
  } catch (err) {
    console.error("TMDB 포스터 가져오기 실패:", err);
    return null;
  }
}

// 🆕 영화 포스터들을 채팅창에 표시
async function displayMoviePosters(movieList) {
  const row = document.createElement("div");
  row.className = "row bot-poster-row";

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  thumb.innerHTML = `<img src="../static/assets/img/chatbot-logo.png" alt="bot">`;
  row.appendChild(thumb);

  const posterWrap = document.createElement("div");
  posterWrap.className = "poster-wrap";

  for (const m of movieList) {
    const posterUrl = await fetchPoster(m.title);
    if (posterUrl) {
      const img = document.createElement("img");
      img.src = posterUrl;
      img.alt = m.title;
      img.title = m.title;
      posterWrap.appendChild(img);
    }
  }

  row.appendChild(posterWrap);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ✅ 시작 인사
window.onload = () => {
  appendMsg("너의 기분에 맞는 영화를 추천해줄게! 😊<br>오늘 기분이 어때?");
};

// === 메시지 전송 ===
async function sendMessage() {
  const userText = msgInput.value.trim();
  if (!userText) return;

  appendMsg(userText, "user");
  msgInput.value = "";

  // 🧠 Railway 서버 주소 (고정)
  const BASE_URL = "https://web-production-5985.up.railway.app";

  if (phase === "emotion") {
    turn++;
    showSpinner(); // 🌀 스피너 표시

    try {
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, turn }),
      });

      const data = await res.json();
      chatBox.lastChild.remove(); // 스피너 제거

      appendMsg(data.reply, "bot");

      if (data.final) {
        let combined = "";
        combined += `🧠 요약: ${data.summary}\n`;
        combined += `🎭 대표 감정: ${data.emotion}\n`;
        if (data.sub_emotion && data.sub_emotion !== "세부감정 없음") {
          combined += `💫 세부 감정: ${data.sub_emotion}\n`;
        }
        combined += `🎥 추천 영화 목록:\n`;
        (data.movies || []).forEach((m) => {
          combined += `- ${m.title}\n`;
        });

        appendMsg(combined, "bot");

        // 🆕 TMDB 포스터 표시
        if (data.movies && data.movies.length > 0) {
          await displayMoviePosters(data.movies);
        }

        phase = "after_recommend";
        turn = 0;
        appendMsg("내가 추천해준 영화가 마음에 들어? 🎬", "bot");
      }
    } catch (err) {
      console.error(err);
      chatBox.lastChild.remove(); // 스피너 제거
      appendMsg("⚠️ 서버 연결 오류", "bot");
    }
  } else if (phase === "after_recommend") {
    showSpinner(); // 🌀 스피너 표시

    try {
      const res = await fetch(`${BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          turn: "after_recommend",
        }),
      });

      const data = await res.json();
      chatBox.lastChild.remove(); // 스피너 제거
      appendMsg(data.reply, "bot");
    } catch (err) {
      console.error(err);
      chatBox.lastChild.remove(); // 스피너 제거
      appendMsg("⚠️ 서버 연결 오류", "bot");
    }
  }
}

// === 이벤트 ===
sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
