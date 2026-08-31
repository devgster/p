# p — 외부 검사 페이지 호스팅

플라이휠(Flywheel)의 **검사·검수 페이지 전용 정적 호스팅 레포**다.
`https://devgster.com/p/<slug>/` 로 서빙된다.

## 이 레포의 성격

- 🔴 **관리 대상 화이트리스트 밖이다.** `ai-automation-control/rules/managed-repos.txt`에
  넣지 않는다. GLOBAL-RULES RULE-001(push 전 검토 마커)·강제 훅이 적용되지 않는다.
  자동 파이프라인이 검토 마커 없이 push해야 하므로 의도적으로 밖에 둔다.
- 🔴 **공개 레포다.** GitHub Pages는 비공개가 없다. URL을 아는 사람은 누구나 열람한다.
  방어는 ①추측 불가 slug ②페이지마다 `noindex,nofollow` ③만료 삭제, 이 셋뿐이다.
- 사람이 직접 파일을 만들지 않는다. `ai-automation-control`의 `python -m pages`가 쓴다.

## 넣지 않는 것

시크릿(API 키·토큰)·계좌번호·인증정보는 **절대** 넣지 않는다. 발행 도구가 패턴 검사로
차단하지만, 도구를 우회해 손으로 커밋하지 않는다.

미발행 콘텐츠(발행 전 원고·썸네일)를 올리면 그 시점부터 공개된 것과 같다.

## 구조

```
index.html      이 레포 안내 (noindex)
pages.json      발행 원장 — slug·제목·발행일·만료일
<slug>/         발행된 페이지 하나 (index.html + 자산)
```

정본 문서: `ai-automation-control/docs/external-pages.md`
