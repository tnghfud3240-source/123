export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 선택한 날짜에, 실제 등록 버튼을 누른 시각(시:분:초)을 붙여
// 이력조회 등에서 시간 단위로 검색할 수 있도록 한다.
export function withCurrentTime(dateStr) {
  const d = new Date();
  return `${dateStr}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

// 00~23 두 자리 문자열 배열 ("00", "01", ... "23")
export const HOURS = Array.from({ length: 24 }, (_, h) => pad2(h));

// <input type="time">에 넣을 현재 시:분 ("HH:MM")
export function currentTimeStr() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// 선택한 날짜에 사용자가 고른 시:분("HH:MM")을 붙인다.
export function withTime(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00`;
}

// occurred_at은 "YYYY-MM-DD" 또는 "YYYY-MM-DDTHH:MM:SS" 형태 모두 올 수 있어
// 화면에는 "YYYY-MM-DD HH:MM"까지만 보기 좋게 잘라서 보여준다.
export function formatOccurredAt(value) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}
