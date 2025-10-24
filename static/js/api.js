const apiKey = "8cde0962eca9041f7345e9c7ab7a4b7f";
const moviesDiv = document.getElementById("movies");
const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");

const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// 인기 영화 가져오기
async function getPopularMovies() {
  const res = await fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=ko-KR&page=1`);
  const data = await res.json();
  displayMovies(data.results);
}

// 영화 검색
async function searchMovies(query) {
  if (!query) return;
  const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=ko-KR&query=${encodeURIComponent(query)}&page=1`);
  const data = await res.json();
  displayMovies(data.results);
}

// 영화 카드 표시
function displayMovies(movies) {
  moviesDiv.innerHTML = "";
  if (!movies || movies.length === 0) {
    moviesDiv.innerHTML = "<p>검색 결과가 없습니다.</p>";
    return;
  }

  movies.forEach(movie => {
    const card = document.createElement("div");
    card.classList.add("movie-card");
    card.innerHTML = `
      <img src="${movie.poster_path ? IMAGE_BASE + movie.poster_path : ''}" alt="${movie.title}">
      <h3>${movie.title}</h3>
      <p>평점: ${movie.vote_average}</p>
      <p>개봉일: ${movie.release_date || '정보 없음'}</p>
    `;
    moviesDiv.appendChild(card);
  });
}

// 이벤트
searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  searchMovies(query);
});

// 페이지 로드 시 인기 영화 표시
getPopularMovies();