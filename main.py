import json
import os
import sys
import pickle
import random
import pymysql
import gdown
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from flask.json.provider import DefaultJSONProvider
from openai import OpenAI
from dotenv import load_dotenv
from movie_api import get_movies_by_genre, get_movie_rating

# ==========================
# ✅ 기본 경로 설정
# ==========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ==========================
# ✅ Google Drive 파일 ID 목록
# ==========================
drive_files = {
    "emotion_model.pkl": "13tBT7LQe9LpJm2xXz9Bm-oNlOdjjYZV1",
    "emotion_sub_model.pkl": "15UWG9J7n66p3iSD0Xe_ClsDtsacOS94U",
    "sub_models.pkl": "1HzcGogcJZfrSiqqEmXOeOK_yYSKth3Kt",
    "sub_vectorizers.pkl": "1U3H-LsFdL0ObM7urt1rJzY5CzGtIAqdT",
    "vectorizer.pkl": "1qgpEY14xJK8uoVzNQYLAmnbS4Oe2BbMg",
}

# ==========================
# ✅ 모델 자동 다운로드 함수
# ==========================
def ensure_models_downloaded():
    for filename, file_id in drive_files.items():
        file_path = os.path.join(MODEL_DIR, filename)
        if not os.path.exists(file_path):
            print(f"⬇️ {filename} 다운로드 중...")
            url = f"https://drive.google.com/uc?id={file_id}"
            gdown.download(url, file_path, quiet=False)
        else:
            print(f"✅ {filename} 이미 존재")

# ==========================
# ✅ 환경 변수 로드 (.env)
# ==========================
env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)
    print(f"📂 .env 로드 완료: {env_path}")
else:
    print(f"⚠️ .env 파일 없음 — Railway 환경 변수 사용 예정")

api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("❌ OpenAI API Key가 설정되지 않았습니다.")
else:
    print(f"🔑 OpenAI Key 불러옴: {api_key[:10]}...")

client = OpenAI(api_key=api_key)

# ==========================
# ✅ Flask 설정
# ==========================
app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app, resources={r"/*": {"origins": "*"}})
app.config["JSON_AS_ASCII"] = False

class UTF8JSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        kwargs.setdefault("ensure_ascii", False)
        return json.dumps(obj, **kwargs)
    def loads(self, s, **kwargs):
        return json.loads(s, **kwargs)

app.json = UTF8JSONProvider(app)
sys.stdout.reconfigure(encoding="utf-8")

# ==========================
# ✅ 모델 로드
# ==========================
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

# ==========================
# ✅ 감정 → 장르 매핑
# ==========================
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

# ==========================
# ✅ /emotion 엔드포인트
# ==========================
@app.route("/emotion", methods=["POST"])
def emotion_endpoint():
    try:
        data = request.get_json()
        user_input = data.get("emotion", "").strip()
        if not user_input:
            return jsonify({"reply": "감정을 입력해 주세요"}), 400

        X = vectorizer.transform([user_input])
        predicted_emotion = model.predict(X)[0]

        try:
            X_sub = sub_vectorizer.transform([user_input])
            predicted_sub = sub_model.predict(X_sub)[0]
        except Exception:
            predicted_sub = "세부감정 없음"

        genre_id = get_genre_by_emotion(predicted_emotion)
        movies = get_movies_by_genre(genre_id)

        return jsonify({
            "emotion": predicted_emotion,
            "sub_emotion": predicted_sub,
            "movies": movies
        })
    except Exception as e:
        print("❌ /emotion 오류:", e)
        return jsonify({"reply": "서버에서 오류가 발생했어요"}), 500

# ==========================
# ✅ /chat 엔드포인트
# ==========================
conversation_history = []

@app.route("/chat", methods=["POST"])
def chat_turn():
    try:
        data = request.get_json()
        user_msg = data.get("message", "")
        turn = data.get("turn", 1)
        gpt_reply = ""

        if isinstance(turn, str):
            turn_type = "after_recommend" if turn == "after_recommend" else "normal"
        else:
            turn_type = "normal"

        conversation_history.append({"role": "user", "content": user_msg})

        if turn_type == "normal" and turn < 3:
            system_prompt = (
                "너는 감정상담 친구야. "
                "사용자의 말을 따뜻하게 공감하면서 짧게 답하고, "
                "반드시 마지막에 질문을 하나 덧붙여."
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_msg},
                ],
            )
            gpt_reply = response.choices[0].message.content.strip()
            conversation_history.append({"role": "assistant", "content": gpt_reply})
            return jsonify({"reply": gpt_reply, "final": False})

        elif turn_type == "after_recommend":
            followup_prompt = (
                "너는 감정 기반 영화 추천 친구야. "
                "이전 대화와 추천 영화를 기억하고, "
                "사용자가 '첫번째꺼', '이거' 같은 표현을 해도 이해해야 해. "
                "평점, 배우, 분위기를 물으면 자연스럽게 설명해줘."
            )
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": followup_prompt},
                    *conversation_history,
                    {"role": "user", "content": user_msg},
                ],
            )
            gpt_reply = response.choices[0].message.content.strip()
            return jsonify({"reply": gpt_reply})

        # ✅ 3턴 이후 요약 + 추천
        summary_prompt = f"""
        다음은 사용자와 감정상담 챗봇의 3턴 대화야:
        {conversation_history}
        사용자의 감정 상태를 한 문장으로 요약해줘.
        """
        summary_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "너는 감정을 따뜻하게 요약하는 친구야."},
                {"role": "user", "content": summary_prompt},
            ],
        )
        summary_text = summary_response.choices[0].message.content.strip()
        print("🧠 대화 요약문:", summary_text)

        X = vectorizer.transform([summary_text])
        predicted_emotion = model.predict(X)[0]
        try:
            X_sub = sub_vectorizer.transform([summary_text])
            predicted_sub = sub_model.predict(X_sub)[0]
        except Exception:
            predicted_sub = "세부감정 없음"

        genre_id = get_genre_by_emotion(predicted_emotion)
        movies = get_movies_by_genre(genre_id)

        return jsonify({
            "reply": gpt_reply,
            "summary": summary_text,
            "final": True,
            "emotion": predicted_emotion,
            "sub_emotion": predicted_sub,
            "movies": movies
        })

    except Exception as e:
        print("❌ /chat 오류:", e)
        return jsonify({"reply": "서버 오류 발생"}), 500

# ==========================
# ✅ HTML 라우트
# ==========================
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/index.html")
def index_alias():
    return render_template("index.html")

@app.route("/chatbot")
def chatbot_page():
    return render_template("chatbot.html")

# ==========================
# ✅ DB 연결 및 통계 API
# ==========================
def get_connection():
    return pymysql.connect(
        host=os.getenv("MYSQLHOST"),
        user=os.getenv("MYSQLUSER"),
        password=os.getenv("MYSQLPASSWORD"),
        db=os.getenv("MYSQLDATABASE"),
        port=int(os.getenv("MYSQLPORT", 3306)),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )

@app.route("/stats")
def get_stats():
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

@app.route("/top10")
def get_top10_movies():
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

# ==========================
# ✅ 서버 실행
# ==========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False, use_reloader=False)
