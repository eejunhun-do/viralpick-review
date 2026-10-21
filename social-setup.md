# ViralPick Meta 연결 및 자동 게시 설정

Meta 개발자 앱을 만들고 Vercel 환경변수 META_THREADS_APP_ID, META_THREADS_APP_SECRET, META_INSTAGRAM_APP_ID, META_INSTAGRAM_APP_SECRET, SOCIAL_PUBLIC_BASE_URL, CRON_SECRET(32자 이상)를 등록해야 합니다. SOCIAL_PUBLIC_BASE_URL은 실제 프로덕션 URL입니다.

Threads 리디렉션 URL: https://viralpick-review.vercel.app/api/social?oauth=callback&platform=threads

Instagram 리디렉션 URL: https://viralpick-review.vercel.app/api/social?oauth=callback&platform=instagram

Threads scope: threads_basic,threads_content_publish,threads_manage_insights

Instagram 로그인 scope: instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights

Instagram은 Professional Creator/Business 계정과 해당 API 권한이 필요합니다. 앱 권한 심사가 필요할 수 있습니다. 실제 계정 인증 이전에는 게시할 수 없습니다.

사진을 업로드하려면 Vercel Blob 저장소를 연결하여 BLOB_READ_WRITE_TOKEN 환경변수를 등록해야 합니다. 외부 공개 HTTPS 사진 URL도 이용 가능합니다. 사진은 사용 권한을 확인하세요.

서버 예약 큐는 Redis에 보존되며, /api/social-cron에서 CRON_SECRET Bearer 인증 후 예정된 게시를 처리합니다. Vercel Cron은 UTC 시각을 사용합니다. 매분 실행은 Pro 플랜 등에만 적합하며 Hobby에서는 하루 한 번만 실행할 수 있어 정확한 예약 게시를 보장하지 못하고 배포도 실패할 수 있습니다. 정확한 예약을 위해 호환되는 외부 스케줄러를 인증된 엔드포인트에 연결할 수도 있습니다.

작업 실패 또는 응답이 모호한 경우 상태를 needs_review로 표시하고 자동으로 재게시하지 않습니다. 중복 여부를 확인해야 합니다. Insights는 지원하는 필드만 표시하고 오류는 0으로 대체하지 않습니다. 토큰은 기존 계정 암호화 저장소에 보관됩니다.
