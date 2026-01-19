# VS Code Idle Game

A tiny idle game that runs inside VS Code.

## Run locally

1. Open this folder in VS Code.
2. Press `F5` to launch the Extension Development Host.
3. Open the Explorer view and find the `Idle Game` panel at the bottom.
4. (Optional) Run the command `Idle Game: Focus` from the Command Palette.

Progress is saved using VS Code's global state.

## 설계 메모

- 위치: 탐색기 사이드바 하단 패널(Webview View).
- 핵심 루프: 초당 기본 수익에 Fever 배수를 곱함.
- 활동성: 타이핑을 유지하면 Fever가 오르고, 비활동 시 배수가 감소.

### 파라미터(현재)

- 활동 유지 기준: 마지막 입력 후 10초 이내.
- Fever 증가: 활동 중 0.1초당 +0.1.
- 배수 감소: 비활동 시 초당 -0.1x (최소 1.0x).
- 소프트 캡: k=1.0, s=2.0.

### 배수 공식

`F`는 Fever, `x = log10(1 + F)`로 정의.

```
mult = 1 + (x * k) / (1 + x / s)
```

비활동 시에는 배수를 선형으로 감소시키고, 위 공식을 역으로 풀어 `F`를 갱신.

## 레이어 설계(초안)

자원은 Bits 단일. 유저 활동(타이핑)은 최종 산출에만 배수를 적용하며,
생산 레이어의 내부 증가는 활동과 무관하게 돌아가는 구조.

### 레이어 구성

- L0 Typing: 기본 생산. 타이핑은 Fever만 증가.
- L1 Assembly: Typing 생산량을 곱/더하기로 강화, 주기적 버스트 생산.
- L2 Compiler: Assembly 산출에 곱 배수, 빌드 큐로 주기적 증폭.
- L3 High-Level: Compiler 산출에 지수/강화 배수, 자동화 해금.
- L4 Runtime/Cloud: 최종 생산량에 추가 곱 배수, 오프라인 보정 강화.

### 레벨/티어 규칙

- 각 레이어는 레벨을 올릴 수 있으며, 10레벨마다 티어가 1 상승.
- 파생 자원을 포함한 누적 값 `C`를 기준으로 효과가 강화됨.
  - `C = L + Delivered`
  - `E = C * T`

### 구매 비용(초안)

- 공통 형태(지수 성장):
  - `cost(L) = base * growth^L`
- 티어 구간 가중(10레벨마다 비용 증가):
  - `tierCost = tierGrowth^(T-1)`
  - `finalCost = cost(L) * tierCost`
- 파생(Delivered)은 직접 구매 비용 없음.
- 초기 값(보통 성장):
  - base: Typing 10 / Assembly 1e3 / Compiler 1e6 / High-Level 1e9 / Runtime 1e12
  - growth: 1.2 ~ 1.4
  - tierGrowth: 1.5

### 자원 분리 의도

- 업그레이드로 직접 생성된 자원과, 상위 레이어에서 파생된 자원을 분리.
- 예: Compiler가 Assembly 자원을 생성(파생)하되, 직접 업그레이드로 증가한 Assembly와 구분.

### 자원 파생 규칙

- Delivered는 상위 레이어의 `E`를 기준으로 생성.
- Compiler → Assembly Delivered 생성
- High-Level → Compiler Delivered 생성
- Runtime/Cloud → Typing 지수 증가
- baseBits는 레이어 전체곱으로 시작

### 레이어 특수 능력 (Infinity 업그레이드로 강화)

- Typing: Fever 유지 시간/최종 배수 안정화.
- Assembly: 주기적 생산 버스트.
- Compiler: 파생 생성 효율 상승.
- High-Level: 자동화 해금/강화.
- Runtime/Cloud: 오프라인 보정 강화 + 지수 스케일링.

### 최종 산출 개념

```
baseBits = Typing * Assembly * Compiler * HighLevel * Runtime
finalBits = baseBits * ActivityMultiplier(Fever)
```

## 리셋 계층(초안)

- Sacrifice: 모든 레이어 레벨 리셋 후, 최종 생산량에 곱 증가 보상.
  - 보상 형태(안): `1 + s * log10(1 + baseBits)` (s=0.2)
- Prestige: 레이어/희생 리셋 후, 레이어 베이스 레벨 상승(기본값 증가).
  - 각 레이어의 최종 레벨의 10%를 베이스 레벨로 승계(내림 처리).
  - 초반 X는 챌린지/Infinity 업그레이드로 증가 가능.
- Infinity: 직전 모든 요소 리셋 후 Infinity 포인트 획득.
  - Infinity 업그레이드에 기본 배수 증가 항목 포함 또는 Infinity 자체가 기본 생산량을 증가시키는 옵션 제공.
  - 레이어 특수 능력은 Infinity 포인트로 업그레이드 가능.
- Eternity: 세부 설계는 보류하되, 아래 방향 중 일부로 구성 검토.
  - Infinity 업그레이드 상한/효율 확장
  - 리셋 후 자동화/레이어 유지(마일스톤)
  - 파생 효율/오프라인 보정 강화

## 계산식 정리(초안)

### 레이어 값

```
T = floor(L / 10) + 1
C = L + Delivered
E = C * T
```

### 파생(Delivered)

- Delivered는 상위 레이어의 `E`를 기준으로 생성.
- Compiler → Assembly Delivered
- High-Level → Compiler Delivered
- Runtime/Cloud → Typing 지수 증가.
- 생성률(빠름): `Delivered += 0.05 * E_parent / sec`

### 생산

```
baseBits = E_Typing * E_Assembly * E_Compiler * E_HighLevel * E_Runtime
finalBits = baseBits * ActivityMultiplier(Fever)
```

### 구매 비용

```
cost(L) = base * growth^L
tierCost = tierGrowth^(T - 1)
finalCost = cost(L) * tierCost
```

### 수치 라이브러리

- 로컬 번들 사용: `src/vendor/break_infinity.min.js`

### 리셋 유도 기준(초안)

- 리셋 후 일정 시간 내에 기존 생산 속도 회복이 가능하면 리셋이 유리하다고 판단.
- 기준 시간은 리셋 레이어별로 다르게 설정.
- 리셋 횟수가 늘어날수록 회복 속도가 점점 더 빨라지는 방향으로 설계.

#### 리셋 가속(원칙)

- 리셋 보상 배수는 유지.
- 리셋 횟수 가속은 현재는 적용하지 않음(추후 검토).
