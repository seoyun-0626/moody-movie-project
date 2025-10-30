
  // ===============================
  // 🎬 TMDB API 설정 (Flask에서 주입)
  // ===============================
const apiKey = "8cde0962eca9041f7345e9c7ab7a4b7f";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

  // ===============================
  // 🎨 요소 선택
  // ===============================
  const chatBox = document.getElementById("chat");
  const msgInput = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");

  // ===============================
  // ⚙️ 상태 변수
  // ===============================
  let turn = 0;
  let phase = "emotion"; // emotion → after_recommend

  // ===============================
  // 💬 메시지 추가
  // ===============================
  function appendMsg(text, who = "bot") {
    const row = document.createElement("div");
    row.className = "row";
    
    const bubble = document.createElement("div");
    bubble.className = `msg ${who}`;
    bubble.innerHTML = text.replace(/\n/g, "<br>");

    if (who === "bot") {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      thumb.innerHTML = `<img src="/static/assets/img/chatbot-logo.png" alt="bot">`;
      row.appendChild(thumb);
    }

    row.appendChild(bubble);
    chatBox.appendChild(row);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  // ===============================
  // 🌀 스피너
  // ===============================
  function showSpinner() {
    const loadingRow = document.createElement("div");
    loadingRow.className = "row loading-row";

    const thumb = document.createElement("div");
    thumb.className = "thumb";
    thumb.innerHTML = `<img src="/static/assets/img/chatbot-logo.png" alt="bot">`;

    const spinner = document.createElement("div");
    spinner.className = "spinner";

    loadingRow.appendChild(thumb);
    loadingRow.appendChild(spinner);
    chatBox.appendChild(loadingRow);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function removeSpinner() {
    const spinners = chatBox.querySelectorAll(".loading-row");
    spinners.forEach(s => s.remove());
  }

  // ===============================
  // 🎥 포스터 표시
  // ===============================
 async function displayMoviePosters(movieList) {
  if (!movieList || movieList.length === 0) return;

  const row = document.createElement("div");
  row.className = "row bot-poster-row";

  const thumb = document.createElement("div");
  thumb.className = "thumb";
  thumb.innerHTML = `<img src="/static/assets/img/chatbot-logo.png" alt="bot">`;
  row.appendChild(thumb);

  const posterWrap = document.createElement("div");
  posterWrap.className = "poster-wrap";

  movieList.forEach(movie => {
    console.log("movie:", movie);

    const img = document.createElement("img");
    img.alt = movie.title ?? "No Title";
    img.title = movie.title ?? "No Title";
    
    // ✅ poster 키 우선 사용, 없으면 poster_path 사용
    const posterUrl = movie.poster || movie.poster_path;
    
    img.src = posterUrl
      ? (posterUrl.startsWith("http") 
         ? posterUrl 
         : `${IMAGE_BASE}${posterUrl}`)
      : "/static/assets/img/no-poster.png";

    posterWrap.appendChild(img);
  });

  row.appendChild(posterWrap);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
}

  // ===============================
  // 👋 시작 인사
  // ===============================
  window.onload = () => {
    appendMsg("너의 기분에 맞는 영화를 추천해줄게! 😊<br>오늘 기분이 어때?");
  };

  // ===============================
  // 🚀 메시지 전송
  // ===============================
  async function sendMessage() {
    const userText = msgInput.value.trim();
    if (!userText) return;

    appendMsg(userText, "user");
    msgInput.value = "";

   

    showSpinner();
    turn = (phase === "emotion") ? turn + 1 : turn;

    try {
      const res = await fetch(`/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          turn: (phase === "emotion") ? turn : "after_recommend"
        }),
      });

      const data = await res.json();
      removeSpinner();

      if (data.reply) appendMsg(data.reply, "bot");

      if (phase === "emotion" && data.final) {
        let combined = `🧠 요약: ${data.summary}\n`;
        combined += `🎭 대표 감정: ${data.emotion}\n`;
        if (data.sub_emotion && data.sub_emotion !== "세부감정 없음") {
          combined += `💫 세부 감정: ${data.sub_emotion}\n`;
        }
        combined += `🎥 추천 영화 목록:\n`;
        (data.movies || []).forEach(m => combined += `- ${m.title}\n`);

        appendMsg(combined, "bot");
        await displayMoviePosters(data.movies);

        phase = "after_recommend";
        turn = 0;
        appendMsg("내가 추천해준 영화가 마음에 들어? 🎬", "bot");
      }
    } catch (err) {
      console.error(err);
      removeSpinner();
      appendMsg("⚠️ 서버 연결 오류", "bot");
    }
  }

  // ===============================
  // 🖱 이벤트
  // ===============================
  sendBtn.addEventListener("click", sendMessage);
  msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) sendMessage();
  });

