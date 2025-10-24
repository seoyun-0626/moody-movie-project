import os
import pickle
import pandas as pd
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer

# ----------------------------------------------------
# 0. 기본 경로 설정 (항상 현재 파일 기준)
# ----------------------------------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ----------------------------------------------------
# 1. 데이터 불러오기
# ----------------------------------------------------
df_path = os.path.join(DATA_DIR, "emotion_data.csv")
df = pd.read_csv(df_path, encoding="utf-8-sig")

# ----------------------------------------------------
# 2. 대표감정별 세부감정 모델 학습 (경량화)
# -----------------------------------------------------
models = {}
vectorizers = {}

for main_emotion in df["대표감정"].unique():
    sub_df = df[df["대표감정"] == main_emotion]

    if len(sub_df["세부감정"].unique()) < 2:
        print(f"[{main_emotion}] 세부감정이 1개뿐이라 학습 생략")
        continue

    print(f"[{main_emotion}] 세부감정 모델 학습 중...")

    X = sub_df["대화"]
    y = sub_df["세부감정"]

    # 🔹 TF-IDF 차원 축소 (5000 → 3000)
    vec = TfidfVectorizer(
        analyzer='char',
        ngram_range=(1, 3),
        max_features=3000,
        min_df=2
    )
    X_tfidf = vec.fit_transform(X)

    # 🔹 Extra Trees 경량화 설정
    model_sub = ExtraTreesClassifier(
        n_estimators=300,         # 1000 → 300
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        max_features='sqrt',      # log2 → sqrt
        class_weight='balanced',
        n_jobs=-1,
        random_state=42,
        verbose=0                 # 출력 최소화
    )
    model_sub.fit(X_tfidf, y)

    models[main_emotion] = model_sub
    vectorizers[main_emotion] = vec

    print(f"[{main_emotion}] ✅ 세부감정 모델 학습 완료")

# ----------------------------------------------------
# 3. 모델 저장 (압축 저장)
# ----------------------------------------------------
sub_models_path = os.path.join(MODEL_DIR, "sub_models.pkl")
sub_vectorizers_path = os.path.join(MODEL_DIR, "sub_vectorizers.pkl")

with open(sub_models_path, "wb") as f:
    pickle.dump(models, f, protocol=pickle.HIGHEST_PROTOCOL)

with open(sub_vectorizers_path, "wb") as f:
    pickle.dump(vectorizers, f, protocol=pickle.HIGHEST_PROTOCOL)

print("\n✅ 세부감정 모델 전부 저장 완료 (경량화 버전)!")
print(f"📦 모델 경로: {sub_models_path}")
print(f"📦 벡터 경로: {sub_vectorizers_path}")
