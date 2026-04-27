# MO-NO-LOG

영화 검색, 장르 탐색, 리뷰 작성, 위시리스트 관리를 제공하는 영화 리뷰 웹 서비스 프론트엔드입니다.  
HTML, CSS, Vanilla JavaScript로 구성된 정적 웹 프로젝트이며, 영화/회원/리뷰 데이터는 `https://api.mono-log.fun` API와 연동합니다.

## 주요 기능

- 영화 검색 및 목록 조회
- 트렌드 영화, 현재 상영작 TOP 7, 관객 평점 순위, 추천 영화 표시
- 장르별 영화 필터링 및 AND/OR 조건 검색
- 영화 상세 정보, 평균 평점, 줄거리 확인
- 별점 기반 리뷰 작성 및 댓글/답글 작성
- 회원가입, 로그인, 로그아웃
- 이메일 인증 기반 회원가입
- 마이페이지에서 프로필, 작성 리뷰, 위시리스트 확인
- 프로필 정보 및 프로필 이미지 수정
- 영화 위시리스트 추가/삭제

## 기술 스택

- HTML5
- CSS3
- JavaScript
- REST API 연동
- LocalStorage 기반 access token 저장

## 페이지 구성

| 파일 | 설명 |
| --- | --- |
| `index.html` | 메인 페이지, 영화 검색, 트렌드/추천 영화 섹션 |
| `movielist.html` | 검색 결과 및 영화 목록 페이지 |
| `jenre.html` | 장르별 영화 탐색 페이지 |
| `review.html` | 영화 상세 정보 및 리뷰 페이지 |
| `wishlist.html` | 위시리스트 페이지 |
| `mypage.html` | 마이페이지 |
| `editpage.html` | 회원 정보 수정 페이지 |
| `join.html` | 회원가입 페이지 |
| `login.html` | 로그인 페이지 |
| `find_id.html` | 아이디 찾기 페이지 |
| `find_pwd.html` | 비밀번호 찾기 페이지 |
| `header.html` | 공통 헤더 마크업 |

## 폴더 구조

```text
.
├── css/             # 페이지별 스타일시트
├── images/          # 포스터, 사용자 이미지, UI 이미지
├── js/              # 페이지별 JavaScript
│   └── page/        # 메인 페이지 전용 스크립트
├── references/      # 디자인/기획 참고 이미지
├── *.html           # 정적 페이지 파일
├── LICENSE
└── README.md
```

## 실행 방법

별도의 빌드 과정은 필요하지 않습니다.

1. 저장소를 클론합니다.

```bash
git clone <repository-url>
cd web
```

2. 정적 서버를 실행합니다.

```bash
npx serve .
```

또는 VS Code의 Live Server 확장 프로그램으로 `index.html`을 실행할 수 있습니다.

3. 브라우저에서 접속합니다.

```text
http://localhost:3000
```

> `npx serve`의 포트는 환경에 따라 달라질 수 있습니다. 터미널에 표시되는 주소로 접속하세요.

## API 연동

프론트엔드 스크립트는 아래 API 서버를 사용합니다.

```text
https://api.mono-log.fun
```

로그인 성공 시 발급된 access token은 브라우저 `localStorage`의 `access_token` 키에 저장됩니다.  
로그인, 회원가입, 리뷰 작성, 위시리스트, 마이페이지 등 일부 기능은 API 서버 연결과 인증이 필요합니다.

## 라이선스

이 프로젝트는 `LICENSE` 파일에 명시된 Unlicense 조건을 따릅니다.
