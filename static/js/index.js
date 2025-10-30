/* ============================================================
 🧩 1. TMDB 기본 설정 및 주요 상수
============================================================ */
const apiKey = "8cde0962eca9041f7345e9c7ab7a4b7f";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const DEFAULT_POSTER = "/static/assets/img/no-poster.png";


/* ============================================================
 🧱 2. 주요 DOM 요소
============================================================ */
const genreBtns = document.querySelectorAll(".genre-btn");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const moviesDiv = document.getElementById("movies");
const slider = document.getElementById("slider");
const sliderTrack = document.getElementById("slider-track");

/* ============================================================
 🎞 3. 포스터 이미지 유틸 함수
============================================================ */
// ✅ 이미지 경로 생성
function getPosterSrc(path) {
  return path ? IMAGE_BASE + path : DEFAULT_POSTER;
}

// ✅ 포스터 이미지 엘리먼트 생성
function createPosterImg(path, alt = "") {
  const img = document.createElement("img");
  img.loading = "lazy";
  img.alt = alt || "포스터 이미지";
  img.src = getPosterSrc(path);
  img.onerror = () => (img.src = DEFAULT_POSTER);
  return img;
}

// TMDB API로 불러온 영화 목록을 수평 슬라이드 형태로 표시
function renderSlider(movies) {
  sliderTrack.innerHTML = "";

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.classList.add("poster");
    card.dataset.id = movie.id;

    const img = createPosterImg(movie.poster_path, movie.title);
    const info = document.createElement("div");
    info.className = "info-overlay";
    info.innerHTML = `
      <h4>${movie.title}</h4>
      <p>⭐ ${movie.vote_average?.toFixed?.(1) ?? "0.0"} | 
      ${movie.release_date?.slice(0, 4) ?? "N/A"}</p>
    `;

    card.append(img, info);
    sliderTrack.appendChild(card);
  });

  applyHoverAndClickEffect(movies);
}

/* ============================================================
 🌐 TMDB 요청 유틸 함수
============================================================ */
async function fetchTMDB(endpoint, params = {}) {
  const baseUrl = "https://api.themoviedb.org/3/";
  const url = new URL(endpoint, baseUrl); 

  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "ko-KR");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB 요청 실패: ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error("⚠️ TMDB 요청 실패:", err);
    return { results: [] }; // fallback
  }
}

/* ============================================================
 🖱️ 5. 슬라이더 hover + click 인터랙션 (중앙 정렬)
============================================================ */

function applyHoverAndClickEffect(movies, trackSelector = ".slider-track") {
  const track = document.querySelector(trackSelector);
  const posters = track.querySelectorAll(".poster");
  let fixedPoster = null;
  let currentTranslateX = 0;

  const slider = track.closest(".slider");

  /* 🎬 마우스 벗어날 때 슬라이더 원위치 복귀 */
  slider.addEventListener("mouseleave", () => {
    if (fixedPoster) return;
    track.style.transition = "transform 0.8s ease";
    track.style.transform = "translateX(0)";
  });

  /* 😎 Hover 시 포스터 중앙 이동 */
  posters.forEach((poster) => {
    poster.addEventListener("mouseenter", () => {
      if (fixedPoster) return;

      const style = window.getComputedStyle(track);
      const matrix = new DOMMatrixReadOnly(style.transform);
      currentTranslateX = matrix.m41 || 0;

      const rect = poster.getBoundingClientRect();
      const posterCenter = rect.left + rect.width / 2;
      const windowCenter = window.innerWidth / 2;
      const moveDistance = posterCenter - windowCenter;
      const newTranslateX = currentTranslateX - moveDistance;

      track.style.transition = "transform var(--slider-transition)";
      track.style.transform = `translateX(${newTranslateX}px)`;
    });
  });

  /* 🧩 dim-layer 설정 */
  let dimLayer = document.querySelector(".dim-layer");
  if (!dimLayer) {
    dimLayer = document.createElement("div");
    dimLayer.className = "dim-layer hidden";
    document.body.appendChild(dimLayer);
  }

  /* 📦 디테일 박스 생성 */
  let detailBox = slider.querySelector(".movie-detail");
  if (!detailBox) {
    detailBox = document.createElement("div");
    detailBox.className = "movie-detail hidden";
    slider.appendChild(detailBox);
  }

  /* ❌ 닫기 함수 */
  const closeDetail = () => {
    if (!fixedPoster) return;
    detailBox.style.opacity = "0";
    detailBox.style.transform = "scale(0.95)";
    setTimeout(() => {
      detailBox.classList.add("hidden");
      dimLayer.classList.add("hidden");
      fixedPoster.classList.remove("active");
      fixedPoster = null;
      slider.style.overflow = "hidden";
    }, 400);
  };
  dimLayer.addEventListener("click", closeDetail);

  /* 🎬 클릭 시 디테일 표시 */
  posters.forEach((poster) => {
    poster.addEventListener("click", async () => {
      if (fixedPoster === poster) {
        closeDetail();
        return;
      }

      posters.forEach(p => p.classList.remove("active"));
      fixedPoster = poster;
      poster.classList.add("active");
      slider.style.overflow = "visible";
      dimLayer.classList.remove("hidden");

      const movieId = poster.dataset.id;
      const data = await fetchTMDB(`movie/${movieId}`);

      detailBox.innerHTML = `
        <div class="detail-content">
          <h3>${data.title}</h3>
          <p>⭐ ${data.vote_average?.toFixed?.(1) ?? "0.0"} | ${data.release_date?.slice(0,4) ?? "N/A"}</p>
          <p>${data.overview || "줄거리 정보가 없습니다."}</p>
        </div>
      `;

      const sliderRect = slider.getBoundingClientRect();
      const posterRect = poster.getBoundingClientRect();

      const relativeTop =
        posterRect.top - sliderRect.top + poster.offsetHeight * 0.15;
      const relativeLeft =
        posterRect.left - sliderRect.left + poster.offsetWidth + 20;

      detailBox.style.position = "absolute";
      detailBox.style.top = `${relativeTop}px`;
      detailBox.style.left = `${relativeLeft}px`;
      detailBox.classList.remove("hidden");

      requestAnimationFrame(() => {
        detailBox.style.opacity = "1";
        detailBox.style.transform = "scale(1)";
      });
    });
  });
}


/* ============================================================
 🔍 6. 검색 및 장르별 로드 기능
============================================================ */

// === 장르별 인기 최신 영화 불러오기 (최근 1년 + 병렬 OR 방식) ===
async function loadMoviesByGenre(genreIds) {
  try {
    const ids = genreIds.split(","); // ["16", "10402"]처럼 나누기
    const today = new Date().toISOString().split("T")[0];
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 1);
    const fiveYearsAgoStr = fiveYearsAgo.toISOString().split("T")[0];

    // ✅ 공통 조건
    const fetches = ids.flatMap(id => [
    fetchTMDB("discover/movie", {
      sort_by: "popularity.desc",
      with_genres: id,
      "primary_release_date.gte": fiveYearsAgoStr,
      "primary_release_date.lte": today,
      vote_count: 50,
      page: 1
    }),
    fetchTMDB("discover/movie", {
      sort_by: "popularity.desc",
      with_genres: id,
      "primary_release_date.gte": fiveYearsAgoStr,
      "primary_release_date.lte": today,
      vote_count: 50,
      page: 2
    })
  ]);


    // ✅ 병렬로 전부 가져오기
    const results = await Promise.all(fetches);

    // ✅ 결과 통합 및 중복 제거
    let combined = results.flatMap(r => r.results || []);
    const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());

    if (!unique.length) {
      slider.innerHTML = "<p>해당 장르의 영화를 찾을 수 없습니다.</p>";
      return;
    }

    // ✅ 랜덤 섞기 + 상위 10개만 표시
    const shuffled = unique.sort(() => Math.random() - 0.5);
    renderSlider(shuffled.slice(0, 10));
    applyHoverAndClickEffect(shuffled.slice(0, 10), "#slider-track");

  } catch (err) {
    console.error("🎬 장르별 영화 로드 실패:", err);
    slider.innerHTML = "<p>영화를 불러오는 중 오류가 발생했습니다.</p>";
  }
}


// 영화 검색
async function searchMovies(query) {
  if (!query) return;

  try {
    moviesDiv.innerHTML = "<p>🔍 검색 중입니다...</p>";

    const pages = [1, 2, 3];

    // ✅ fetchTMDB는 이미 json을 반환하므로 .then(res => res.json()) 필요 없음
    const fetches = pages.map(page =>
      fetchTMDB("search/movie", { query, page })
    );

    const results = await Promise.all(fetches);
    const merged = results.flatMap(r => r.results || []);

    // 중복 제거
    const unique = Array.from(new Map(merged.map(m => [m.id, m])).values());

    // ✅ 렌더링 호출
    renderGrid(unique);

    // ✅ 결과 반환 (선택)
    return unique;

  } catch (err) {
    console.error("검색 오류:", err);
    moviesDiv.innerHTML = "<p>❌ 검색 중 오류가 발생했습니다.</p>";
  }
}



/* ============================================================
 🧱 7. 검색 결과 그리드 뷰
============================================================ */
function renderGrid(movies) {
  moviesDiv.className = "grid";
  moviesDiv.innerHTML = "";
  if (!movies || movies.length === 0) {
    moviesDiv.innerHTML = "<p>검색 결과가 없습니다.</p>";
    return;
  }

  let activeCard = null;

  const closeDetail = () => {
    if (!activeCard) return;
    activeCard.classList.remove("active");
    activeCard = null;
  };

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.classList.add("movie-card");

    // ✅ 카드 내부 dim-layer 생성
    const cardDim = document.createElement("div");
    cardDim.className = "card-dim";
    card.appendChild(cardDim);

    const img = createPosterImg(movie.poster_path, movie.title || "");
    const info = document.createElement("div");
    info.className = "info";
    info.innerHTML = `
      <h3>${movie.title || "제목 없음"}</h3>
      <p>⭐ ${movie.vote_average?.toFixed?.(1) ?? "0.0"}</p>
      <p>${movie.release_date || "개봉일 정보 없음"}</p>
    `;

    const detailPopup = document.createElement("div");
    detailPopup.className = "detail-popup";

    card.append(img, info, detailPopup);
    moviesDiv.appendChild(card);

    card.addEventListener("click", async (e) => {
      e.stopPropagation();

      if (activeCard === card) {
        closeDetail();
        return;
      }

      if (activeCard) closeDetail();

      const data = await fetchTMDB(`movie/${movie.id}`);
      detailPopup.innerHTML = `
        <h3>${data.title}</h3>
        <p>⭐ ${data.vote_average?.toFixed(1) ?? "0.0"} | ${data.release_date?.slice(0,4) ?? "N/A"}</p>
        <p>${data.overview || "줄거리 정보가 없습니다."}</p>
      `;

      card.classList.add("active");
      activeCard = card;
    });
  });

  document.addEventListener("click", closeDetail);
}


function setGridChatbotIcon() {
  const gridIcon = document.getElementById("grid-emotion-icon");
  gridIcon.src = "../assets/img/grid-chatbot.png";
}

// === TOP 버튼 기능 ===
const scrollTopBtn = document.getElementById("scrollTopBtn");
const resultsView = document.getElementById("results-view");

window.addEventListener("scroll", () => {
  const isResultsVisible = !resultsView.classList.contains("hidden");

  if (isResultsVisible && window.scrollY > 400) {
    scrollTopBtn.classList.add("show");
  } else {
    scrollTopBtn.classList.remove("show");
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
  scrollTopBtn.classList.remove("show"); 
});



/* ============================================================
 🖥️ 8. 뷰 전환 (홈 ↔ 검색 결과)
============================================================ */
function showView(which) {
  const homeView = document.getElementById("home-view");
  const resultsView = document.getElementById("results-view");
  const scrollTopBtn = document.getElementById("scrollTopBtn");

  if (which === "results") {
    homeView.classList.add("hidden");
    resultsView.classList.remove("hidden");

    // ✅ 탑버튼 상태 초기화
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add("show");
    } else {
      scrollTopBtn.classList.remove("show");
    }
  } else {
    resultsView.classList.add("hidden");
    homeView.classList.remove("hidden");
    scrollTopBtn.classList.remove("show"); // 홈에서는 항상 숨김
  }
}


/* ============================================================
 🔁 9. 검색 실행 + URL 업데이트
1️⃣ API 요청 → 인셉션 관련 영화 10개 불러옴  
2️⃣ 홈 화면 숨기고 결과 화면 표시  
3️⃣ 브라우저 주소 변경:
   http://localhost:3000/index.html?q=인셉션
4️⃣ 새로고침해도 "인셉션" 검색 결과 그대로 유지됨
============================================================ */
async function runSearch(query) {
  await searchMovies(query);
  showView("results");
  const url = new URL(window.location);
  url.searchParams.set("q", query);
  history.pushState({ q: query }, "", url);
}

/* ============================================================
 🎚️ 10. 이벤트 리스너 등록
============================================================ */

// === 장르 버튼 클릭 ===
genreBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    genreBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadMoviesByGenre(btn.dataset.id);
  });
});

// === 공통 검색 실행 함수 ===
async function handleSearch(inputEl) {
  const q = inputEl.value.trim();
  if (!q) return;

  // ✅ 화면 최상단으로 스크롤
  window.scrollTo({ top: 0, behavior: "smooth" });

  // ✅ “검색 중입니다...” 메시지 표시
  moviesDiv.innerHTML = "<p>🔍 검색 중입니다...</p>";

  // ✅ 검색 실행
  await runSearch(q);
}


// ========================= 홈 검색창 ============================
if (searchBtn && searchInput) {
  let searchHistory = JSON.parse(localStorage.getItem("searchHistory")) || [];

  const saveSearchHistory = (term) => {
    if (!term) return;
    searchHistory = [term, ...searchHistory.filter((t) => t !== term)];
    localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
  };

  const renderHistory = () => {
    const historyList = document.getElementById("search-history");
    if (!historyList) return;

    historyList.innerHTML = searchHistory
      .map((t, i) => `<li>${t}</li>`)
      .join("");
    historyList.classList.toggle("hidden", searchHistory.length === 0);

    // 클릭 시 바로 검색 실행
    historyList.addEventListener("click", (e) => {
      if (e.target.tagName === "LI") {
        const q = e.target.textContent.trim();
        searchInput.value = q;
        runSearch(q);
        historyList.classList.add("hidden");
      }
    });
  };

  // 검색 버튼 클릭
  searchBtn.addEventListener("click", () => {
    const q = searchInput.value.trim();
    if (q) {
      saveSearchHistory(q);
      renderHistory();
      runSearch(q);
    }
  });

  // Enter 입력
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = searchInput.value.trim();
      if (q) {
        saveSearchHistory(q);
        renderHistory();
        runSearch(q);
      }
    }
  });

  // 포커스 시 기록 표시
  searchInput.addEventListener("focus", renderHistory);
}

// ================ 🔍 검색 결과 페이지 검색창 =======================
const searchInputResults = document.getElementById("search-input-results");
const searchBtnResults = document.getElementById("search-btn-results");
const searchHistoryResults = document.getElementById("search-history-results");

if (searchBtnResults && searchInputResults) {
  let searchHistory = JSON.parse(localStorage.getItem("searchHistory")) || [];

  const saveSearchHistory = (term) => {
    if (!term) return;
    searchHistory = [term, ...searchHistory.filter((t) => t !== term)];
    localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
  };

  const renderHistory = () => {
    if (!searchHistoryResults) return;
    if (searchHistory.length === 0) {
      searchHistoryResults.classList.add("hidden");
      return;
    }

    searchHistoryResults.innerHTML = searchHistory
      .map((t) => `<li>${t}</li>`)
      .join("");
    searchHistoryResults.classList.remove("hidden");

    searchHistoryResults.addEventListener("click", (e) => {
      if (e.target.tagName === "LI") {
        const q = e.target.textContent.trim();
        searchInputResults.value = q;
        runSearch(q);
        searchHistoryResults.classList.add("hidden");
      }
    });  
  };

  // 🔍 검색 버튼 클릭
  searchBtnResults.addEventListener("click", () => {
    const q = searchInputResults.value.trim();
    if (q) {
      saveSearchHistory(q);
      renderHistory();
      runSearch(q);
    }
  });

  // 🔍 Enter 입력
  searchInputResults.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const q = searchInputResults.value.trim();
      if (q) {
        saveSearchHistory(q);
        renderHistory();
        runSearch(q);
      }
    }
  });

  // 🔍 포커스 시 기록 표시
  searchInputResults.addEventListener("focus", renderHistory);
}


/* ============================================================
📊 Flask API에서 감정 통계 불러오기
============================================================ */
/* 📊 감정 통계 + 챗봇 아이콘 자동 변경 */
async function loadEmotionStats() {
  try {
    const response = await fetch("/stats");
    const data = await response.json();

    const topEmotionEl = document.getElementById("top-emotion");
    const iconEl = document.getElementById("emotion-icon");

    if (!data || data.length === 0) {
      topEmotionEl.innerText = "데이터가 아직 없어요 😢";
      iconEl.src = "/static/assets/img/chatbot-logo.png";
      return;
    }

    // 감정명 - 이미지 파일 매핑
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

      // 이미지 교체
      const gifName = emotionMap[emotion] || "chatbot-logo.png";
      iconEl.src = `/static/assets/img/${gifName}`;

      // 부드러운 전환 (opacity)
      topEmotionEl.style.opacity = 0;
      iconEl.style.opacity = 0;
      setTimeout(() => {
        topEmotionEl.style.opacity = 1;
        iconEl.style.opacity = 1;
      }, 200);

      // 다음 감정으로 순환
      index = (index + 1) % data.length;
      setTimeout(showNextEmotion, 3000); // 3초 간격
    }

    showNextEmotion();

  } catch (err) {
    console.error("통계 불러오기 실패:", err);
    document.getElementById("top-emotion").innerText = "서버 연결 오류 😢";
  }
}

// ✅ 페이지 로드시 실행
document.addEventListener("DOMContentLoaded", loadEmotionStats);


/* ============================================================
🎬 Flask API에서 Top10 영화 불러오기
============================================================ */
async function loadTop10Movies() {
  try {
    const response = await fetch("/top10");
    const data = await response.json();

    if (!data || data.length === 0) {
      document.getElementById("top10-track").innerHTML =
        "<p>추천된 영화 데이터가 없습니다 😢</p>";
      return;
    }

    // TMDB 포스터 정보 불러오기
    const tmdbResults = [];
    for (const item of data) {
      const query = item.movie.replace(/\(.*?\)/g, "").trim(); // 괄호 제거
      const search = await fetchTMDB("search/movie", { query });
      const movieData = search.results[0];
      if (movieData) {
        tmdbResults.push(movieData);
      }
    }

    // 기존 renderSlider() 재활용해서 Top10 영역에 렌더링
    const track = document.getElementById("top10-track");
    track.innerHTML = ""; // 기존 비우기

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

    // 동일한 hover / click 효과 적용
    applyHoverAndClickEffect(tmdbResults, "#top10-track");

  } catch (err) {
    console.error("Top10 로드 실패:", err);
    document.getElementById("top10-track").innerHTML =
      "<p>서버 연결 오류 😢</p>";
  }
}



/* ============================================================
 🚀 11. 초기 로드 + 로고 클릭 처리
============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");

  // ✅ 로고 클릭 시 홈으로 복귀
  const logo = document.querySelector(".logo-wrap");
  const scrollTopBtn = document.getElementById("scrollTopBtn");

  if (logo) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", () => {
      showView("home");
      const url = new URL(window.location);
      url.searchParams.delete("q");
      history.pushState({}, "", url);
      window.scrollTo({ top: 0, behavior: "smooth" });
      scrollTopBtn?.classList.remove("show");
    });
  }

  // ✅ 초기 로드
  if (q) {
    searchInput.value = q;
    await runSearch(q);
  } else {
    await loadEmotionStats();
    await loadTop10Movies();
    await loadMoviesByGenre("35");
    showView("home");
  }
});