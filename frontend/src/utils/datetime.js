export function pad2(n) {
  return String(n).padStart(2, "0");
}

// 00~23 두 자리 문자열 배열 ("00", "01", ... "23")
export const HOURS = Array.from({ length: 24 }, (_, h) => pad2(h));

// occurred_at은 "YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:MM:SS" 형태 모두 올 수 있어
// 화면에는 "YYYY-MM-DD HH:MM"까지만 보기 좋게 잘라서 보여준다.
export function formatOccurredAt(value) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}
