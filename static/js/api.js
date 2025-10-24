const apiKey = "8cde0962eca9041f7345e9c7ab7a4b7f";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

const moviesDiv = document.getElementById("movies");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");

// 🎬 인기 영화 가져오기
async function getPopularMovies() {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=ko-KR&page=1`
    );
    if (!res.ok) throw new Error("TMDB API 요청 실패");
    const data = await res.json();
    displayMovies(data.results);
  } catch (err) {
    console.error("⚠️ 인기 영화 로드 오류:", err);
    moviesDiv.innerHTML = "<p>영화 데이터를 불러오지 못했습니다 😢</p>";
  }
}

// 🔍 영화 검색
async function searchMovies(query) {
  if (!query) return;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=ko-KR&query=${encodeURIComponent(
        query
      )}&page=1`
    );
    if (!res.ok) throw new Error("검색 요청 실패");
    const data = await res.json();
    displayMovies(data.results);
  } catch (err) {
    console.error("⚠️ 검색 오류:", err);
    moviesDiv.innerHTML = "<p>검색 중 오류가 발생했습니다 😢</p>";
  }
}

// 🎞️ 영화 카드 표시
function displayMovies(movies) {
  moviesDiv.innerHTML = "";
  if (!movies || movies.length === 0) {
    moviesDiv.innerHTML = "<p>검색 결과가 없습니다 😢</p>";
    return;
  }

  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.classList.add("movie-card");
    card.innerHTML = `
      <img src="${movie.poster_path ? IMAGE_BASE + movie.poster_path : "/static/assets/img/no-poster.png"}" alt="${movie.title}">
      <h3>${movie.title}</h3>
      <p>⭐ 평점: ${movie.vote_average?.toFixed?.(1) ?? "0.0"}</p>
      <p>📅 개봉일: ${movie.release_date || "정보 없음"}</p>
    `;
    moviesDiv.appendChild(card);
  });
}

// 🔘 이벤트 리스너
searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  searchMovies(query);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    searchMovies(searchInput.value.trim());
  }
});

// 🚀 페이지 로드 시 인기 영화 표시
document.addEventListener("DOMContentLoaded", getPopularMovies);
