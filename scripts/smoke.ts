// scripts/smoke.ts (임시)
import { resolveOfficialLink } from "../src/cta/resolve";

const tests = [
  { q: "SRT 좌석변경 예매", intent: "예매", prefer: ["etk.srail.kr"] },
  { q: "코레일 KTX 예매 환불", intent: "예매", prefer: ["letskorail.com"] },
  { q: "정부24 민원 발급 신청", intent: "신청" },
];

for (const t of tests) {
  const r = resolveOfficialLink({ query: t.q, intent: t.intent as any, preferHosts: t.prefer });
  console.log(t.q, "=>", r);
}
