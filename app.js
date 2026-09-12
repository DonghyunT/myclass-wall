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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore의 'memos' 컬렉션을 사용합니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore에서 작성 시각(createdAt) 순으로 정렬해서 가져옵니다.
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt", "asc"));
  const querySnapshot = await getDocs(q);
  const memos = [];
  querySnapshot.forEach((docSnap) => {
    memos.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return memos;
}

// 메모를 새로 씁니다.
// Firestore의 'memos' 컬렉션에 새 문서를 추가합니다.
async function addMemo(text) {
  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now()
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
  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    await addMemo(text);
    input.value = "";
    await render();
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

// 첫 화면 그리기
render();
input.focus();
