import os
import pickle
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.metrics import accuracy_score, classification_report

# ----------------------------------------------------
# 0. 기본 경로 설정
# ----------------------------------------------------
BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODEL_DIR, exist_ok=True)

# ----------------------------------------------------
# 1. 데이터 불러오기 + 감정사전 적용
# ----------------------------------------------------
df = pd.read_csv(os.path.join(DATA_DIR, "emotion_data.csv"), encoding="utf-8-sig")
dict_df = pd.read_csv(os.path.join(DATA_DIR, "emotion_dictionary.csv"), encoding="utf-8-sig")

emotion_dict = {}
for _, row in dict_df.iterrows():
    emotion = row["감정"]
    word = str(row["단어"]).strip()
    if word:
        emotion_dict.setdefault(emotion, []).append(word)

def match_emotion(text):
    if pd.isna(text):
        return None
    for emotion, words in emotion_dict.items():
        for w in words:
            if w in str(text):
                return emotion
    return None

df["사전감정"] = df["대화"].apply(match_emotion)
df["대표감정"] = df["사전감정"].fillna(df["대표감정"])

# ----------------------------------------------------
# 2. 사전감정을 학습에 포함
# ----------------------------------------------------
df["입력문장"] = df.apply(
    lambda r: f"[감정사전:{r['사전감정']}] {r['대화']}"
    if pd.notna(r["사전감정"]) else r["대화"],
    axis=1
)

texts = df["입력문장"]
labels = df["대표감정"]
sub_labels = df["세부감정"]

# ----------------------------------------------------
# 3. 대표감정 모델 학습
# ----------------------------------------------------
print("\n대표감정 모델 학습 시작...")

X_train, X_test, y_train, y_test = train_test_split(
    texts, labels, test_size=0.2, random_state=42, stratify=labels
)

# TF-IDF 차원 축소 (8000 → 4000)
vectorizer = TfidfVectorizer(
    analyzer='char',
    ngram_range=(1, 3),
    max_features=4000,
    min_df=2
)
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

# Extra Trees 모델 (n_estimators ↓ 674 → 350)
et_model = ExtraTreesClassifier(
    n_estimators=350,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features='sqrt',   # log2 → sqrt (속도 & 메모리 절약)
    class_weight='balanced',
    n_jobs=-1,
    random_state=42,
    verbose=0
)
et_model.fit(X_train_tfidf, y_train)

y_pred = et_model.predict(X_test_tfidf)
print("\n[대표감정 모델 결과]")
print(f"Train Accuracy: {accuracy_score(y_train, et_model.predict(X_train_tfidf)):.4f}")
print(f"Test  Accuracy: {accuracy_score(y_test, y_pred):.4f}")
print(classification_report(y_test, y_pred))
print("=" * 60)

# ----------------------------------------------------
# 4. 세부감정 모델 학습
# ----------------------------------------------------
print("\n세부감정 모델 학습 시작...")

X_train_sub, X_test_sub, y_train_sub, y_test_sub = train_test_split(
    texts, sub_labels, test_size=0.2, random_state=42, stratify=sub_labels
)

X_train_sub_tfidf = vectorizer.transform(X_train_sub)
X_test_sub_tfidf = vectorizer.transform(X_test_sub)

sub_et_model = ExtraTreesClassifier(
    n_estimators=350,
    max_depth=None,
    min_samples_split=2,
    min_samples_leaf=1,
    max_features='sqrt',
    class_weight='balanced',
    n_jobs=-1,
    random_state=42,
    verbose=0
)
sub_et_model.fit(X_train_sub_tfidf, y_train_sub)

sub_pred = sub_et_model.predict(X_test_sub_tfidf)
print("\n[세부감정 모델 결과]")
print(f"Test Accuracy: {accuracy_score(y_test_sub, sub_pred):.4f}")
print(classification_report(y_test_sub, sub_pred))
print("=" * 60)

# ----------------------------------------------------
# 5. 모델 저장 (압축 프로토콜 적용)
# ----------------------------------------------------
with open(os.path.join(MODEL_DIR, "emotion_model.pkl"), "wb") as f:
    pickle.dump(et_model, f, protocol=pickle.HIGHEST_PROTOCOL)

with open(os.path.join(MODEL_DIR, "vectorizer.pkl"), "wb") as f:
    pickle.dump(vectorizer, f, protocol=pickle.HIGHEST_PROTOCOL)

with open(os.path.join(MODEL_DIR, "emotion_sub_model.pkl"), "wb") as f:
    pickle.dump(sub_et_model, f, protocol=pickle.HIGHEST_PROTOCOL)

with open(os.path.join(MODEL_DIR, "sub_vectorizers.pkl"), "wb") as f:
    pickle.dump(vectorizer, f, protocol=pickle.HIGHEST_PROTOCOL)

print("\n✅ 모든 모델 학습 및 저장 완료! (경량화 버전)")
