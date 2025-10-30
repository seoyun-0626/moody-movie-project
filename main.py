import json
import os
import sys
import pickle
import random
import pymysql
import gdown
from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
from flask.json.provider import DefaultJSONProvider
from openai import OpenAI
from dotenv import load_dotenv
from movie_api import get_movies_by_genre, get_movie_rating


# ============================================================
# ✅ 기본 경로 설정
# ============================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)


# ============================================================
# ✅ Google Drive 모델 파일 ID 목록
# ============================================================
drive_files = {
    "emotion_model.pkl": "13tBT7LQe9LpJm2xXz9Bm-oNlOdjjYZV1",
    "emotion_sub_model.pkl": "15UWG9J7n66p3iSD0Xe_ClsDtsacOS94U",
    "sub_models.pkl": "1HzcGogcJZfrSiqqEmXOeOK_yYSKth3Kt",
    "sub_vectorizers.pkl": "1U3H-LsFdL0ObM7urt1rJzY5CzGtIAqdT",
    "vectorizer.pkl": "1qgpEY14xJK8uoVzNQYLAmnbS4Oe2BbMg",
}


# ============================================================
# ✅ 모델 자동 다운로드 함수
# ============================================================
def ensure_models_downloaded():
    for filename, file_id in drive_files.items():
        file_path = os.path.join(MODEL_DIR, filename)
        if not os.path.exists(file_path):
            print(f"⬇️ {filename} 다운로드 중...")
            url = f"https://drive.google.com/uc?id={file_id}"
            try:
                gdown.download(url, file_path, quiet=False)
            except Exception as e:
                print(f"❌ {filename} 다운로드 실패:", e)
        else:
            print(f"✅ {filename} 이미 존재")


# ============================================================
# ✅ 환경 변수 로드
# ============================================================
env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
    print(f"📂 .env 로드 완료: {env_path}")
else:
    print("⚠️ .env 파일 없음 — 클라우드 환경 변수 사용 예정")

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("❌ OpenAI API Key가 설정되지 않았습니다.")
else:
    print(f"🔑 OpenAI Key 불러옴: {api_key[:10]}...")

client = OpenAI(api_key=api_key)


# ============================================================
# ✅ Flask 설정
# ============================================================
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["JSON_AS_ASCII"] = False


# ✅ JSON 한글 깨짐 방지
class UTF8JSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        kwargs.setdefault("ensure_ascii", False)
        return json.dumps(obj, **kwargs)

    def loads(self, s, **kwargs):
        return json.loads(s, **kwargs)


app.json = UTF8JSONProvider(app)
sys.stdout.reconfigure(encoding="utf-8")


# ============================================================
# ✅ 모델 로드
# ============================================================
try:
    ensure_models_downloaded()
    model = pickle.load(open(os.path.join(MODEL_DIR, "emotion_model.pkl"), "rb"))
    sub_model = pickle.load(open(os.path.join(MODEL_DIR, "emotion_sub_model.pkl"), "rb"))
    vectorizer = pickle.load(open(os.path.join(MODEL_DIR, "vectorizer.pkl"), "rb"))
    sub_vectorizer = pickle.load(open(os.path.join(MODEL_DIR, "sub_vectorizers.pkl"), "rb"))
    print("✅ 감정 분석 모델 및 세부감정 모델 로드 완료")
except Exception as e:
    print(f"❌ 모델 로드 중 오류 발생: {e}")
    exit()


# ============================================================
# ✅ 감정 → 장르 매핑
# ============================================================
emotion_to_genre = {
    "분노": [28, 80, 53, 27, 9648],
    "불안": [53, 9648, 18, 878],
    "스트레스": [35, 10402, 10751, 16],
    "슬픔": [18, 10749, 10751, 99],
    "행복": [12, 35, 16, 10751, 10402],
    "심심": [14, 878, 12, 10751],
    "탐구": [99, 36, 18, 37],
}


def get_genre_by_emotion(emotion):
    return random.choice(emotion_to_genre.get(emotion, [18]))


# ==========================================================
# ✅ 6. /emotion 엔드포인트
# ==========================================================
@app.route("/emotion", methods=["POST"])
def emotion_endpoint():
    """
    사용자가 입력한 문장에서 감정을 예측하고
    TMDB 장르에 맞는 영화 추천 리스트를 반환함.
    """

    try:
        data = request.get_json()
        user_input = data.get("emotion", "").strip()

        if not user_input:
            return jsonify({"reply": "감정을 입력해 주세요"}), 400

        # 1️⃣ 대표감정 예측
        X = vectorizer.transform([user_input])
        predicted_emotion = model.predict(X)[0]

        # 2️⃣ 세부감정 예측 (dict / 단일 모델 안전 처리)
        predicted_sub = "세부감정 없음"
        try:
            if isinstance(sub_vectorizer, dict):
                vec = sub_vectorizer.get(predicted_emotion)
                model_for_emotion = sub_model.get(predicted_emotion)
                if vec is not None and hasattr(vec, "transform") and model_for_emotion is not None:
                    X_sub = vec.transform([user_input])
                    probs = model_for_emotion.predict_proba(X_sub)[0]
                    predicted_sub = model_for_emotion.classes_[probs.argmax()]
            elif hasattr(sub_vectorizer, "transform"):
                # 단일 벡터라이저/모델 처리
                X_sub = sub_vectorizer.transform([user_input])
                predicted_sub = sub_model.predict(X_sub)[0]
        except Exception as e:
            print("⚠️ 세부감정 분석 오류:", e)
            predicted_sub = "세부감정 없음"

            # 3️⃣ 감정에 맞는 영화 추천
        genre_id = get_genre_by_emotion(predicted_emotion)
        movies = get_movies_by_genre(genre_id)

        # ✅ TMDB 이미지 URL 완전 경로로 변환
        for m in movies:
            if m.get("poster_path"):
                m["poster_path"] = f"https://image.tmdb.org/t/p/w500{m['poster_path']}"
            else:
                m["poster_path"] = "/static/assets/img/no-poster.png"


        return jsonify({
            "emotion": predicted_emotion,
            "sub_emotion": predicted_sub,
            "movies": movies
        })

    except Exception as e:
        print("❌ /emotion 오류:", e)
        return jsonify({"reply": "서버에서 오류가 발생했어요"}), 500

# ==========================================================
# ✅ 7. /chat 엔드포인트 (3턴 감정상담 + 추천 대화)
# ==========================================================
conversation_history = []          # 사용자와의 대화 내역 저장
recommended_movies_memory = []     # 추천 영화 기억용

@app.route("/chat", methods=["POST"])
def chat_turn():
    global conversation_history, recommended_movies_memory  # 최상단 선언

    try:
        data = request.get_json()
        user_msg = data.get("message", "")
        turn = data.get("turn", 1)
        gpt_reply = ""

        # turn 타입 정리
        if isinstance(turn, str):
            turn_type = "after_recommend" if turn == "after_recommend" else "normal"
            if turn_type != "after_recommend":
                try: turn = int(turn)
                except ValueError: turn = 1
        else:
            turn_type = "normal"

        conversation_history.append({"role": "user", "content": user_msg})

        # 1~2턴: 공감형 대화
        if turn_type == "normal" and turn < 3:
            system_prompt = (
                "너는 감정상담 친구야. "
                "사용자의 말을 따뜻하게 공감하면서 짧게 답하고, "
                "반드시 마지막에 질문을 하나 덧붙여. "
                "사용자와 너가 한말을 모두 기억해."
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "system", "content": system_prompt}, *conversation_history, {"role": "user", "content": user_msg}],
            )
            gpt_reply = response.choices[0].message.content.strip()
            conversation_history.append({"role": "assistant", "content": gpt_reply})
            return jsonify({"reply": gpt_reply, "final": False})

        # 추천 이후 대화
        elif turn_type == "after_recommend":
            try:
                followup_prompt = (
                    "너는 감정 기반 영화 추천 친구야. "
                    "지금까지의 대화와 추천한 영화들을 전부 기억하고 있어. "
                    "사용자가 영화 제목 일부나 번호(1,2,3번)만 말해도 어떤 영화를 의미하는지 알아들어야 해. "
                    "사용자가 평점이나 줄거리, 배우, 분위기 등을 물으면 자연스럽게 설명해줘. "
                    "응답은 짧고 자연스럽게, 친구처럼 따뜻하게 대화해. "
                    "이미 한 말을 다시 하지 말고, 대화가 자연스럽게 이어지게 말해."
                )
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "system", "content": followup_prompt}, *conversation_history, {"role": "user", "content": user_msg}],
                )
                gpt_reply = response.choices[0].message.content.strip()

                # 평점 조회 처리
                lower_msg = user_msg.lower()
                if any(word in lower_msg for word in ["평점","점수","몇점","점"]):
                    candidate = None
                    for title in recommended_movies_memory:
                        if title.lower().replace(" ","") in lower_msg:
                            candidate = title.strip()
                            break
                    if not candidate and recommended_movies_memory:
                        candidate = recommended_movies_memory[0].strip()
                    if candidate:
                        result = get_movie_rating(candidate)
                        if result:
                            gpt_reply += f"\n🎬 '{result['title']}'의 TMDB 평점은 {result['rating']}점이에요!"
                        else:
                            gpt_reply += f"\n'{candidate}'의 평점을 찾지 못했어요 😢"

                return jsonify({"reply": gpt_reply})
            except Exception as e:
                print("❌ after_recommend 오류:", e)
                return jsonify({"reply":"영화 정보를 불러오는 중 오류가 발생했어요 😢"},500)

        # 3턴: 요약 + 감정 분석 + 영화 추천
        recent_history = conversation_history[-6:]
        summary_prompt = f"""
        다음은 사용자와 감정상담 챗봇의 최근 대화야:
        {recent_history}
        사용자의 현재 감정 상태를 한 문장으로 요약해줘.
        """
        summary_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"system","content":"너는 감정을 따뜻하게 요약하는 친구야."},{"role":"user","content":summary_prompt}],
        )
        summary_text = summary_response.choices[0].message.content.strip()
        print("🧠 대화 요약문:", summary_text)

        # ✅ 대표감정 안정화 처리
        try:
            import re
            summary_clean = re.sub(r"[^가-힣\s]", "", summary_text.lower().strip())

            # 키워드 기반 추출
            emotion_keywords = ["행복","슬픔","분노","불안","평온","지루함","당황"]
            predicted_emotion = None
            for kw in emotion_keywords:
                if kw in summary_clean:
                    predicted_emotion = kw
                    break

            # 키워드 없으면 모델 예측
            if not predicted_emotion:
                if hasattr(vectorizer, "transform") and hasattr(model, "predict"):
                    X = vectorizer.transform([summary_clean])
                    predicted_emotion = model.predict(X)[0]
                elif isinstance(vectorizer, dict) and isinstance(model, dict):
                    key = list(vectorizer.keys())[0]
                    vec = vectorizer[key]
                    mdl = model[key]
                    if vec and mdl and hasattr(vec,"transform"):
                        X = vec.transform([summary_clean])
                        predicted_emotion = mdl.predict(X)[0]
                    else:
                        predicted_emotion = "알 수 없음"
                else:
                    predicted_emotion = "알 수 없음"
        except Exception as e:
            print("⚠️ 대표감정 분석 오류:", e)
            predicted_emotion = "알 수 없음"

        # ✅ 세부감정 예측 안정화
        try:
            if isinstance(sub_vectorizer, dict) and isinstance(sub_model, dict):
                vec = sub_vectorizer.get(predicted_emotion)
                mdl = sub_model.get(predicted_emotion)
                if vec and mdl and hasattr(vec,"transform"):
                    X_sub = vec.transform([summary_clean])
                    predicted_sub = mdl.predict(X_sub)[0]
                else:
                    predicted_sub = "세부감정 없음"
            else:
                X_sub = sub_vectorizer.transform([summary_clean])
                predicted_sub = sub_model.predict(X_sub)[0]
        except Exception as e:
            print("⚠️ 세부감정 분석 오류:", e)
            predicted_sub = "세부감정 없음"

                # 감정 기반 영화 추천
        genre_id = get_genre_by_emotion(predicted_emotion)
        movies = get_movies_by_genre(genre_id)

        # ✅ 이미지 경로 변환 추가!
        for m in movies:
            if m.get("poster_path"):
                m["poster_path"] = f"https://image.tmdb.org/t/p/w500{m['poster_path']}"
            else:
                m["poster_path"] = "/static/assets/img/no-poster.png"

        movie_titles = [m["title"] for m in movies if isinstance(m, dict)]
        recommended_movies_memory = movie_titles

        # 대화 히스토리 갱신
        conversation_history.append({"role":"assistant","content":f"추천 영화 목록은 {', '.join(movie_titles)}야."})
        conversation_history.append({"role":"assistant","content":"내가 추천해준 영화가 마음에 들어? 🎬"})

        return jsonify({
            "reply":"지금 기분에 어울리는 영화를 추천해봤어 🎬",
            "summary": summary_text,
            "final": True,
            "emotion": predicted_emotion,
            "sub_emotion": predicted_sub,
            "movies": movies
        })

    except Exception as e:
        print("❌ /chat 오류:", e)
        return jsonify({"reply":"서버 오류 발생했당"},500)





# ============================================================
# HTML 라우트
# ============================================================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chatbot")
def chatbot():
    return render_template("chatbot.html")

# ============================================================
# DB 연결 및 통계 API
# ============================================================
def get_connection():
    return pymysql.connect(
        host=os.getenv("MYSQLHOST"),
        user=os.getenv("MYSQLUSER"),
        password=os.getenv("MYSQLPASSWORD"),
        db=os.getenv("MYSQLDATABASE"),
        port=int(os.getenv("MYSQLPORT", 3306)),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        auth_plugin_map={
            'caching_sha2_password': 'mysql_native_password'
        }
    )


@app.route("/stats")
def get_stats():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT rep_emotion, COUNT(*) AS count
            FROM movies_emotions
            GROUP BY rep_emotion
            ORDER BY count DESC;
        """)
        result = cursor.fetchall()
        conn.close()
        return jsonify(result)
    except Exception as e:
        print("⚠️ /stats 오류:", e)
        return jsonify([])

@app.route("/top10")
def get_top10_movies():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT movie, COUNT(*) AS count
            FROM movies_emotions
            GROUP BY movie
            ORDER BY count DESC
            LIMIT 10;
        """)
        result = cursor.fetchall()
        conn.close()
        return jsonify(result)
    except Exception as e:
        print("⚠️ /top10 오류:", e)
        return jsonify([])

# ============================================================
# 서버 실행
# ============================================================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)
