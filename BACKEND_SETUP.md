# ViralPick v0.7.0 · 서버 연결 및 이미지 사용

## 이번 버전에서 바로 되는 기능
- 로컬에서 실제 상품 사진 JPG/PNG/WebP 업로드 (8MB 이하)
- 로컬에서 상황 사진 업로드 및 1080x1350 Threads PNG / Instagram 카드 5장 ZIP 합성
- 직접 확인한 상품명·가격·특징·사용 대상 입력
- 등록한 이미지는 작업 중 브라우저 메모리에만 보관. 새로고침 시 업로드한 이미지는 사라짐
- 시연용 수익 데이터는 실제 수익과 무관함

## 서버 배포 전에는 안 되는 기능
- AI 상황 이미지 실제 생성 (OpenAI API 키 + 보호된 Vercel Functions 필수)
- 토스 Open API 실제 상품 목록 수신 (토스 API 승인 명세 + 해당 서버 설정 필요)
- 토스 가격/재고 실시간 확인, 자동 쉐어링크 생성, 실제 SNS 발행/예약 (미구현)

## 안전한 Vercel 백엔드 연결

1. 이 GitHub 저장소를 Vercel에 연결해 별도 프로젝트를 생성합니다. `v05.html`은 UI, `api/*.js`는 Functions로 동작합니다. 이 저장소를 Vercel에 배포하지 않고 GitHub Pages에서만 열면 API는 동작하지 않습니다.
2. Vercel Project → Settings → Environment Variables에 다음 값을 추가합니다.
   - `VIRALPICK_ACCESS_KEY`: 임의의 복잡한 16자 이상 개인 연결 암호
   - `OPENAI_API_KEY`: OpenAI API 서버 키
   - 토스 API는 **승인된 공식 명세를 확인한 후** 아래 항목을 설정합니다.
   - `TOSS_PRODUCTS_URL`: 공식 상품 조회 HTTPS URL. 서버 쪽 고정 문자열이며 선택적으로 `{keyword}`, `{limit}` 자리표시자를 사용할 수 있습니다.
   - `TOSS_API_ALLOWED_HOST`: URL과 정확히 일치해야 하는 공식 API 호스트
   - `TOSS_API_TOKEN`: 토스 API 접근 토큰
   - `TOSS_AUTH_HEADER`: 공식 명세의 인증 헤더 이름, 미지정 시 `Authorization`
   - `TOSS_AUTH_PREFIX`: 공식 명세의 토큰 접두어, 미지정 시 `Bearer `. 사용 방식이 다르면 명세에 맞춰 변경합니다.
3. 환경변수를 설정한 후 **Redeploy**합니다.
4. ViralPick → **🔌 상품·이미지 연결** 메뉴에서 배포된 `https://xxx.vercel.app` 서버 URL과 `VIRALPICK_ACCESS_KEY` 값을 입력하고 `서버 연결 확인`을 누릅니다. 연결 암호는 로컬스토리지에 저장하지 않고 브라우저 입력칸에만 유지합니다.
5. **GPT Image 2 상황 이미지 생성**을 누르면 `POST /api/image` → OpenAI 이미지 생성 → 출력 WebP → 브라우저 합성 작업으로 연결됩니다. 생성 비용은 OpenAI API 요금에 따라 발생합니다. 예산·계정 권한을 확인하세요.
6. 토스 제품 조회 응답 구조가 예제 어댑터의 예상과 다르면 `api/products.js`를 공식 문서의 필드명과 형식으로 조정해야 합니다. 가격/재고 확인과 발행용 쉐어링크 발급은 이 단계에서 **미구현**입니다.

## API 보안 및 이용 정책
- **절대로 GitHub Pages HTML, Git 커밋, 프런트엔드 JS, README에 API 키나 토큰을 입력하지 마세요.**
- 서버에는 CORS와 별도 접근 암호 검사가 있습니다. 단, 개인용 운영 서비스라도 과금 보호를 위해 Vercel 배포 보호, 요청량 제한/예산 한도 설정이 권장됩니다.
- 상품 URL과 인증 헤더는 서버 환경변수로만 설정합니다. 브라우저에서 임의 API 주소를 전달해 호출하지 않습니다.
- 서버는 토스 상품 데이터를 DB에 축적하거나 공개 쇼핑몰/가격비교 카탈로그로 제공하지 않습니다. 요청 시 일시적으로 최대 6건 반환하는 개인 SNS 제작 목적의 어댑터입니다.
- 토스 API 허용 범위 및 상품 사진 재사용 권한을 확인한 후 사용하세요.
- 생성 상황 이미지는 **정확한 제품 외형/성능**을 보증하지 않습니다. 실제 상품 외형은 사용자에게 사용권한이 있는 상품 사진 업로드로 반영합니다.
- 브라우저 저장 예약은 실제 자동발행이 아니고, PC/모바일 간 동기화되지 않습니다.

## 파일 구성
- `v05.html` — 반응형 UI, 수동 상품/사진 업로드, API 연결 화면, 이미지 합성 PNG/ZIP
- `api/status.js` — 접근 암호 검증 및 연결 상태
- `api/image.js` — OpenAI Image API 서버 프록시 (`gpt-image-2`)
- `api/products.js` — 토스 Open API 상품 조회 어댑터 (승인 계약에 따른 설정 필요)
- `lib/api-guard.js` — 출처/접근 암호/요청 크기 제한
- `package.json` — Vercel Functions ESM 실행

**참고:** 실제 이미지 생성 서버는 승인된 API 키와 별도 배포가 필요합니다. v0.7.0 GitHub Pages에서 연결 상태가 준비되지 않았다고 표시되는 것은 정상입니다.
