// ===================================================
// 우리 반 담벼락 - Firebase Firestore 연동
//
// Firebase Firestore 데이터베이스를 연결하여
// 새로고침해도 메모가 영구적으로 보존됩니다.
// ===================================================

// Firebase SDK 불러오기 (모듈 방식 CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyAumeOOHNDLOfGN9c1JE1CRc3wcyWUXGZA",
  authDomain: "myclass-wall.firebaseapp.com",
  projectId: "myclass-wall",
  storageBucket: "myclass-wall.firebasestorage.app",
  messagingSenderId: "675434855225",
  appId: "1:675434855225:web:8a66daa34bbb28217b06e8"
};

// Firebase 및 Firestore 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firebase 인증(Auth) 초기화
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let currentUser = null;

// 관리자(교사) 이메일
const ADMIN_EMAIL = "adh103006@gmail.com";


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore의 'memos' 컬렉션을 사용합니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore에서 작성 시각(createdAt) 순으로 정렬해서 가져옵니다 (uid, authorName, aiComment 포함).
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  const memos = [];
  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    memos.push({
      id: docSnap.id,
      text: data.text,
      createdAt: data.createdAt,
      uid: data.uid || "",
      authorName: data.authorName || "",
      aiComment: data.aiComment || ""
    });
  });
  return memos;
}

// 메모를 새로 씁니다.
// Firestore의 'memos' 컬렉션에 새 문서를 추가합니다 (로그인한 사람의 uid 및 이름 포함).
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 Google 로그인을 해주세요.");
    return;
  }
  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid,
    authorName: currentUser.displayName || currentUser.email.split("@")[0]
  });
}

// 메모를 지웁니다.
// Firestore에서 해당 id의 문서를 찾아 삭제합니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memos = await loadMemos();

  // 등록된 메모가 없을 때 안내
  if (memos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>아직 등록된 메모가 없습니다.</strong><p>첫 번째 메모를 남겨 우리 반 담벼락을 채워보세요!</p>";
    wall.appendChild(empty);
    return;
  }

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  const isMyMemo = currentUser && (currentUser.uid === memo.uid);
  const isTeacher = currentUser && (currentUser.email === ADMIN_EMAIL);
  div.className = "memo" + (isMyMemo ? " my-memo" : "");

  // 1. 카드 상단 (작성자 + 삭제 버튼)
  const header = document.createElement("div");
  header.className = "memo-header";

  const authorInfo = document.createElement("div");
  authorInfo.className = "author-info";

  const authorName = document.createElement("span");
  authorName.textContent = memo.authorName || "익명";
  authorInfo.appendChild(authorName);

  if (isMyMemo) {
    const myBadge = document.createElement("span");
    myBadge.className = "author-badge-me";
    myBadge.textContent = "나";
    authorInfo.appendChild(myBadge);
  }

  header.appendChild(authorInfo);

  // 삭제 버튼: 교사이거나 본인이 작성한 메모인 경우에만 노출
  if (isTeacher || isMyMemo) {
    const del = document.createElement("button");
    del.className = "btn-delete";
    del.title = "메모 삭제";
    del.textContent = "×";
    del.addEventListener("click", async function () {
      if (!confirm("이 메모를 삭제하시겠습니까?")) return;
      try {
        await deleteMemo(memo.id);
        await render();
      } catch (error) {
        console.error("삭제 실패:", error);
        alert("삭제 권한이 없습니다. (본인의 메모만 삭제할 수 있습니다)");
      }
    });
    header.appendChild(del);
  }

  div.appendChild(header);

  // 2. 카드 본문
  const textDiv = document.createElement("div");
  textDiv.className = "memo-text";
  textDiv.textContent = memo.text;
  div.appendChild(textDiv);

  // 2-1. AI 선생님 코멘트가 있을 경우 표시
  if (memo.aiComment) {
    const aiBox = document.createElement("div");
    aiBox.className = "ai-comment-box";

    const aiTag = document.createElement("div");
    aiTag.className = "ai-comment-tag";
    aiTag.innerHTML = `<span>✨</span> AI 선생님의 한마디`;
    aiBox.appendChild(aiTag);

    const aiText = document.createElement("p");
    aiText.className = "ai-comment-text";
    aiText.textContent = memo.aiComment;
    aiBox.appendChild(aiText);

    div.appendChild(aiBox);
  }

  // 3. 카드 하단 (작성 시각)
  const footer = document.createElement("div");
  footer.className = "memo-footer";
  const dateSpan = document.createElement("span");
  dateSpan.textContent = formatTime(memo.createdAt);
  footer.appendChild(dateSpan);
  div.appendChild(footer);

  return div;
}

// 작성 시각 표시 헬퍼 함수
function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "오후" : "오전";
  hours = hours % 12 || 12;
  return `${month}월 ${day}일 ${ampm} ${hours}:${minutes}`;
}


// ===================================================
// 메모 입력칸 제어 및 등록
// ===================================================

const input = document.getElementById("input");
const charCount = document.getElementById("charCount");
const submitBtn = document.getElementById("submitBtn");

// 글자 수 계산 및 등록 버튼 활성화 검사
function updateCharCount() {
  if (!input || !charCount || !submitBtn) return;
  const len = input.value.trim().length;
  charCount.textContent = `${len} / 50자 (최소 5자)`;
  if (len >= 5 && len <= 50) {
    charCount.classList.add("valid");
    submitBtn.disabled = !currentUser;
  } else {
    charCount.classList.remove("valid");
    submitBtn.disabled = true;
  }
}

input.addEventListener("input", updateCharCount);

// 메모 제출 처리 함수
async function handleAddMemo() {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 Google 로그인을 해주세요.");
    return;
  }

  const text = input.value.trim();
  if (text === "") return;
  if (text.length < 5) {
    alert("메모는 5글자 이상 입력해 주세요.");
    return;
  }
  if (text.length > 50) {
    alert("메모는 50글자 이하로 입력해 주세요.");
    return;
  }

  submitBtn.disabled = true;
  await addMemo(text);
  input.value = "";
  updateCharCount();
  await render();
}

submitBtn.addEventListener("click", handleAddMemo);

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    await handleAddMemo();
  }
});


// ===================================================
// 실시간 반영 및 시작
// ===================================================

// 실시간 감지: 다른 사람이 메모를 쓰거나 지웠을 때도 화면을 자동으로 갱신합니다.
const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
onSnapshot(q, function () {
  render();
});


// ===================================================
// 로그인 상태 관리 및 화면 표시
// ===================================================

const userArea = document.getElementById("userArea");

// 사용자 영역 그리기 (로그인/로그아웃 버튼)
function renderUserArea(user) {
  userArea.innerHTML = "";
  const teacherAiArea = document.getElementById("teacherAiArea");

  if (user) {
    const isTeacher = user.email === ADMIN_EMAIL;

    // 교사 전용 AI 코멘트 버튼 표시 여부
    if (teacherAiArea) {
      teacherAiArea.style.display = isTeacher ? "block" : "none";
    }

    // 사용자 정보 알약 (아바타 + 이름 + 역할 뱃지)
    const pill = document.createElement("div");
    pill.className = "user-pill";

    const avatar = document.createElement("div");
    avatar.className = "user-avatar";
    const initial = (user.displayName || user.email || "U").charAt(0).toUpperCase();
    avatar.textContent = initial;
    pill.appendChild(avatar);

    const nameSpan = document.createElement("span");
    nameSpan.className = "user-name";
    nameSpan.textContent = user.displayName || user.email.split("@")[0];
    pill.appendChild(nameSpan);

    const roleBadge = document.createElement("span");
    roleBadge.className = "role-badge " + (isTeacher ? "teacher" : "student");
    roleBadge.textContent = isTeacher ? "선생님 (관리자)" : "학생";
    pill.appendChild(roleBadge);

    userArea.appendChild(pill);

    // 로그아웃 버튼
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn-logout";
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    });
    userArea.appendChild(logoutBtn);

    // 메모 작성 칸 활성화
    input.disabled = false;
    input.placeholder = "우리 반 친구들과 나눌 메모를 적어보세요 (5~50자, 엔터로 등록)";
    updateCharCount();
  } else {
    // 교사 전용 AI 코멘트 버튼 숨기기
    if (teacherAiArea) {
      teacherAiArea.style.display = "none";
    }

    // 로그아웃된 상태: 구글 로그인 버튼 표시
    const loginBtn = document.createElement("button");
    loginBtn.className = "btn-login";
    loginBtn.type = "button";
    loginBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
      Google 로그인
    `;
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("로그인 실패:", error);
        if (error.code !== "auth/popup-closed-by-user") {
          alert("로그인 중 오류가 발생했습니다: " + error.message);
        }
      }
    });
    userArea.appendChild(loginBtn);

    // 메모 작성 칸 비활성화
    input.disabled = true;
    input.value = "";
    input.placeholder = "메모를 작성하려면 먼저 상단에서 Google 로그인을 해주세요.";
    updateCharCount();
  }
}

// 로그인 상태 변경 실시간 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea(user);
  render(); // 로그인 상태에 따라 삭제 버튼 노출 여부 다시 그리기
});


// ===================================================
// 교사용 AI 피드백 코멘트 생성
// ===================================================

const aiFeedbackBtn = document.getElementById("aiFeedbackBtn");

if (aiFeedbackBtn) {
  aiFeedbackBtn.addEventListener("click", async function () {
    if (!currentUser || currentUser.email !== ADMIN_EMAIL) {
      alert("AI 코멘트 생성은 선생님(관리자)만 가능합니다.");
      return;
    }

    const memos = await loadMemos();
    if (memos.length === 0) {
      alert("담벼락에 분석할 메모가 없습니다.");
      return;
    }

    const originalText = aiFeedbackBtn.innerHTML;
    aiFeedbackBtn.disabled = true;
    aiFeedbackBtn.innerHTML = `<span>⏳</span> AI 코멘트 작성 중...`;

    try {
      // 개인정보 보호 규칙: 학생 식별 정보(uid, 이메일, 작성자명)는 제외하고 텍스트와 id만 전송합니다.
      const payload = memos.map((m) => ({ id: m.id, text: m.text }));

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memos: payload })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        let errMsg = errorData.error || `서버 오류 (${res.status})`;
        // 로컬 환경(Live Server)에서는 /api/gemini 서버리스 함수를 찾을 수 없어 404 발생
        if (res.status === 404 && !errorData.error) {
          errMsg = "로컬 개발 환경(Live Server)에서는 /api/gemini 서버리스 함수를 실행할 수 없습니다(404). Vercel 배포 사이트에서 접속하시거나 Vercel CLI(vercel dev)를 이용해 주세요.";
        }
        throw new Error(errMsg);
      }

      const { comments } = await res.json();
      if (!Array.isArray(comments) || comments.length === 0) {
        throw new Error("AI로부터 코멘트를 받아오지 못했습니다.");
      }

      // 각 메모에 Firestore updateDoc 으로 aiComment 필드 기록
      let count = 0;
      for (const item of comments) {
        if (item.id && item.comment) {
          await updateDoc(doc(db, "memos", item.id), {
            aiComment: item.comment
          });
          count++;
        }
      }

      await render();
      alert(`총 ${count}개의 메모에 AI 선생님의 따뜻한 코멘트가 달렸습니다! ✨`);

    } catch (error) {
      console.error("AI 코멘트 생성 실패:", error);
      alert("AI 코멘트 생성 실패: " + error.message);
    } finally {
      aiFeedbackBtn.disabled = false;
      aiFeedbackBtn.innerHTML = originalText;
    }
  });
}

// 첫 화면 그리기
render();
