/**
 * Chromium 실행 시 GPU 관련 블루스크린을 피하는 공용 인자 (v3.8.395)
 *
 * ── 왜 필요한가 (2026-08-01 실측) ──
 * 사용자 PC 가 하루에 세 번 블루스크린으로 재부팅됐다. 이벤트 로그:
 *     11:53  0x0000010E  VIDEO_MEMORY_MANAGEMENT_INTERNAL
 *     12:07  0x0000010E  VIDEO_MEMORY_MANAGEMENT_INTERNAL
 *     12:28  0x0000009F  DRIVER_POWER_STATE_FAILURE
 *
 * 하드웨어:
 *     Intel Iris Xe Graphics    드라이버 2023-06-15  ← 3년 전
 *     NVIDIA RTX 4060 Laptop    드라이버 2026-06-03
 *
 * 노트북 하이브리드 그래픽에서 Chromium 화면 합성은 보통 Intel 내장 GPU 로 간다.
 * 3년 된 Intel 드라이버 + 최신 Chromium 이 0x10E 의 전형적인 조합이고,
 * 이 앱은 크롤·이미지 생성으로 Chromium 을 반복해서 띄운다.
 *
 * ⚠️ 근본 해결은 Intel 드라이버 업데이트다. 이 인자들은 그때까지의 완화책이며,
 *   드라이버를 고친 뒤에도 유지해서 손해는 없다(스크래핑에 GPU 가속은 불필요하다).
 *
 * 주의: 기존에도 dropshotGenerator 는 **보이는 모드에서만** --disable-gpu 를 넣고 있었다.
 *   headless 라고 GPU 를 안 쓰는 게 아니다(요즘 headless 는 실제 GPU 경로를 탄다).
 */

/** GPU 경로를 완전히 우회하는 인자 — 스크래핑·크롤 용도에 안전하다 */
export const CHROMIUM_GPU_SAFE_ARGS: readonly string[] = [
  '--disable-gpu',                                    // GPU 가속 비활성
  '--disable-software-rasterizer',                    // SwiftShader 폴백까지 차단
  '--disable-gpu-compositing',                        // 합성도 CPU 로
  '--disable-features=CalculateNativeWinOcclusion',   // 창 가림 계산이 드라이버를 건드린다
  '--disable-dev-shm-usage',                          // 공유메모리 부족 크래시 방지
];

/**
 * 기존 인자에 GPU 안전 인자를 합친다 (중복 제거).
 * 호출부가 이미 --disable-gpu 를 넣었어도 안전하다.
 */
export function withGpuSafeArgs(args: string[] = []): string[] {
  const merged = [...args];
  CHROMIUM_GPU_SAFE_ARGS.forEach((flag) => {
    const key = flag.split('=')[0];
    if (!merged.some(a => a.split('=')[0] === key)) merged.push(flag);
  });
  return merged;
}
