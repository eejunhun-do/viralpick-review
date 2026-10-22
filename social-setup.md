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
