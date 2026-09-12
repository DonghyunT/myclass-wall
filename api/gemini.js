// ===================================================
// Gemini API를 호출하는 Vercel 서버리스 함수
//
// 주의: 개인정보 보호 규칙에 따라 uid나 이메일 등 식별 정보는 Gemini로 전송하지 않습니다.
// API 키는 Vercel 환경변수 process.env.GEMINI_API_KEY 로 안전하게 꺼내 씁니다.
// ===================================================

export default async function handler(req, res) {
  // POST 요청만 허용
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  // Vercel 환경변수에서 Gemini API 키 읽기
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다. Vercel 프로젝트 설정의 Environment Variables에 GEMINI_API_KEY를 등록해 주세요."
    });
  }

  const { memos } = req.body || {};
  if (!Array.isArray(memos) || memos.length === 0) {
    return res.status(400).json({ error: "코멘트를 생성할 메모 목록이 없습니다." });
  }

  // 개인정보 보호: 학생 식별 정보(uid, 이메일 등)는 제외하고 텍스트와 ID만 전달합니다.
  const sanitizedMemos = memos.map((m, index) => ({
    id: m.id || String(index),
    text: String(m.text || "").trim()
  }));

  try {
    const prompt = `당신은 학생들을 따뜻하게 격려하고 칭찬해 주는 초·중등학교 선생님 AI 도우미입니다.
아래 학생들이 교실 담벼락에 작성한 메모들을 읽고, 각 메모마다 학생의 생각과 노력을 응원하고 지지하는 다정하고 따뜻한 1~2문장의 피드백 코멘트를 한국어로 작성해 주세요.

[학생 메모 목록]
${JSON.stringify(sanitizedMemos, null, 2)}

[응답 규칙]
1. 반드시 마크다운(코드블록 등) 없이 순수 JSON 문자열만 출력하세요.
2. 각 항목은 "id"와 "comment" 키를 가지는 JSON 배열이어야 합니다.
형식 예시:
[
  { "id": "1", "comment": "실험을 스스로 해보며 깨달음을 얻은 점이 참 멋져요!" }
]`;

    // 사용자가 요청한 gemini-3.6-flash 모델 호출
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API 호출 실패:", errorText);

      let hint = "";
      if (response.status === 404) {
        hint = " (요청한 gemini-3.6-flash 모델을 찾을 수 없습니다)";
      } else if (response.status === 401 || response.status === 403) {
        hint = " (API 키 인증 실패. 유효한 Gemini API 키인지 확인해 주세요)";
      }

      return res.status(response.status).json({
        error: `Gemini API 호출 오류 (${response.status})${hint}`,
        details: errorText
      });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";

    // JSON 파싱 (혹시 모를 마크다운 태그 제거)
    let jsonString = candidateText.trim();
    if (jsonString.startsWith("```json")) {
      jsonString = jsonString.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (jsonString.startsWith("```")) {
      jsonString = jsonString.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const comments = JSON.parse(jsonString);
    return res.status(200).json({ comments });

  } catch (error) {
    console.error("AI 코멘트 처리 오류:", error);
    return res.status(500).json({
      error: "AI 코멘트를 처리하는 중 문제가 발생했습니다: " + error.message
    });
  }
}
