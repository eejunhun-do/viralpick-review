# ViralPick Meta 연결 및 자동 게시 설정

Meta 개발자 앱을 만들고 Vercel 환경변수 META_THREADS_APP_ID, META_THREADS_APP_SECRET, META_INSTAGRAM_APP_ID, META_INSTAGRAM_APP_SECRET, SOCIAL_PUBLIC_BASE_URL, CRON_SECRET(32자 이상)를 등록해야 합니다. SOCIAL_PUBLIC_BASE_URL은 실제 프로덕션 URL입니다.

Threads 리디렉션 URL: https://viralpick-review.vercel.app/api/social?oauth=callback&platform=threads

Instagram 리디렉션 URL: https://viralpick-review.vercel.app/api/social?oauth=callback&platform=instagram

Threads scope: threads_basic,threads_content_publish,threads_manage_insights,threads_manage_replies,threads_read_replies

Instagram 로그인 scope: instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights

Instagram은 Professional Creator/Business 계정과 해당 API 권한이 필요합니다. 앱 권한 심사가 필요할 수 있습니다. 실제 계정 인증 이전에는 게시할 수 없습니다.

서버 경유 업로드는 Vercel 요청 제한 때문에 사진당 3.8MB 이하여야 합니다. 사진을 업로드하려면 Vercel Blob 저장소를 연결하여 BLOB_READ_WRITE_TOKEN 환경변수를 등록해야 합니다. 외부 공개 HTTPS 사진 URL도 이용 가능합니다. 사진은 사용 권한을 확인하세요.

서버 예약 큐는 Redis에 보존되며, /api/social-cron에서 CRON_SECRET Bearer 인증 후 예정된 게시를 처리합니다. Vercel Cron은 UTC 시각을 사용합니다. 매분 실행은 Pro 플랜 등에만 적합하며 Hobby에서는 하루 한 번만 실행할 수 있어 정확한 예약 게시를 보장하지 못하고 배포도 실패할 수 있습니다. 정확한 예약을 위해 호환되는 외부 스케줄러를 인증된 엔드포인트에 연결할 수도 있습니다.

작업 실패 또는 응답이 모호한 경우 상태를 needs_review로 표시하고 자동으로 재게시하지 않습니다. 중복 여부를 확인해야 합니다. Insights는 지원하는 필드만 표시하고 오류는 0으로 대체하지 않습니다. 토큰은 기존 계정 암호화 저장소에 보관됩니다.

## Threads 2단 답글 권한과 복구

Meta 앱 화면에서 권한이 '테스트 준비 완료'인 것과 실제 연결 사용자 액세스 토큰이 그 권한을 허용한 것은 다릅니다. Threads 재연결(OAuth)에 `threads_manage_replies` 및 `threads_read_replies`를 포함합니다. 연결 성공 직후 토큰 디버거에서 실제 허용 권한을 확인하며, 확인되지 않으면 답글이 포함된 예약을 접수하거나 1단만 게시하지 않습니다. 토큰 자체가 권한을 갖지 못했다면 Meta의 테스트 사용자 역할/앱 심사 및 토큰 재인증을 확인하세요. 앱 비밀키나 사용자 토큰을 UI에 공개하지 않습니다.

기존 `published_reply_failed`에는 1단을 다시 발행하지 않는 `retry_reply` 작업을 제공합니다. 이 작업은 먼저 원글 답글 목록을 읽어 동일 문구 존재 여부를 확인하며, 불확실하면 자동 재시도를 중단합니다. 발행 완료인지 애매한 경우 Threads 앱의 실제 답글 상태를 먼저 확인해야 합니다.

## Instagram 캐러셀 자동 게시 연결 절차 (2026-10)

Meta 개발자 대시보드에서 Instagram API with Instagram Login (Business Login for Instagram) 사용 사례를 추가합니다. Instagram 계정은 비즈니스 또는 크리에이터 프로페셔널 계정이어야 합니다. Facebook Page를 연결할 필요는 없습니다.

1. Instagram App ID와 Instagram App Secret을 확인합니다. Threads 앱 ID/Secret과 혼동하지 마세요. 이 값을 채팅으로 공유하지 마세요.
2. 유효한 Instagram OAuth Redirect URI에 https://viralpick-review.vercel.app/api/social?oauth=callback&platform=instagram 을 등록합니다.
3. Meta 앱 권한: instagram_business_basic, instagram_business_content_publish. 현재 ViralPick은 instagram_business_manage_insights도 요청하므로 해당 앱 권한 활성화가 필요합니다.
4. Vercel viralpick-review 프로젝트 Production 환경변수에 META_INSTAGRAM_APP_ID와 META_INSTAGRAM_APP_SECRET을 비밀값으로 추가하고 Production을 재배포합니다.
5. 자동게시 관리 → Instagram 계정 연결에서 Meta 계정 인증을 진행합니다. 실제 Instagram 프로페셔널 계정 유형은 API 응답으로 검증합니다.
6. 실제 상품 선택 → Instagram 제작 → AI 이미지 1~5장 모두 생성 → 캡션과 광고 고지 검수 → 5장 캐러셀 예약 등록을 확인합니다. 빈 이미지나 가짜 템플릿이 있으면 예약하지 않습니다.
7. 예약 시각 이후 Instagram 피드에서 5장 모두 올라갔는지 실제 확인합니다. 실패 내역은 자동 중복 게시하지 않습니다.

Instagram 이미지 API는 공개 URL의 JPG/JPEG만 지원합니다. ViralPick 제작 이미지는 JPEG로 변환해 Blob에 저장하며 수동 파일 업로드는 JPEG만 허용합니다. 2장 이상은 캐러셀(최대 10장)로 게시됩니다.

2026-10-22 기준 확인한 Vercel Production 설정에는 Instagram App ID/Secret이 없고 Threads App ID/Secret과 Blob 환경변수는 존재합니다. Instagram 실제 연결 및 발행은 사용자 Meta/Vercel 설정 후 가능하며, 현재 배포 자체가 Instagram 계정에 게시했다는 뜻은 아닙니다.

공식 자료: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
