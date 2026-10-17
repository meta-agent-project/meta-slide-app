# 편집 가능한 HTML 규약 v1

외부 HTML은 규약 없이도 가져올 수 있다. 새로 만드는 자료는 다음을 지키면 선택과 편집이 더 안정적이다.

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, "Malgun Gothic", sans-serif; }
    [data-slide] { position: relative; width:1280px; height:720px; overflow:hidden; }
  </style>
</head>
<body>
  <section data-slide="1" aria-label="페이지 제목">
    <h1 data-kind="text" style="position:absolute;left:64px;top:64px;width:1100px;margin:0;font-size:56px">제목</h1>
  </section>
</body>
</html>
```

- 페이지는 중첩하지 않은 `[data-slide]`를 사용한다. 번호는 안정적으로 유지한다.
- 페이지는 다른 페이지의 존재나 높이에 의존하지 않게 만든다. 페이지마다 다른 레이아웃을 사용할 수 있다.
- `data-kind`: text, image, video, rect, rounded, circle, line, arrow, table, group 등의 의미를 붙일 수 있다.
- 동적 묶음은 `data-sr-opaque`를 붙이고 명시적인 크기를 준다. 편집기에서는 통째 이동·크기 조절하며, 내부 수정은 제작 단계에서 한다.
- `canvas`에는 width/height와 CSS 크기를 명시한다. iframe이나 복잡한 SVG도 하나의 묶음으로 취급할 수 있다.
- SVG 안에 주요 강의 본문을 넣지 않는다. 텍스트를 HTML로 분리한다.
- 표는 실제 `<table>`과 올바른 rowspan/colspan을 사용한다. 이미지로 표를 흉내내지 않는다.
- 리모션 영상은 `<video controls playsinline src="...">`로 넣는다. 상대 경로 에셋은 함께 전달한다.
- 글자 편집이 필요한 곳은 pseudo-element의 content 대신 DOM 텍스트로 만든다.
- 런타임 스크립트는 해당 페이지 요소가 없을 때 안전하게 종료한다. 편집기가 페이지를 분리하므로 다른 페이지의 노드가 항상 있다고 가정하지 않는다.
- 외부 스크립트가 필요한 HTML은 네트워크·CORS·인증 의존성을 기록한다. 로컬 blob URL은 최종 결과에 남기지 않는다.

## 저장 형식

편집기의 JSON 프로젝트는 `{version:1,title,slides:[{id,name,html}]}` 구조다. `html`은 각 페이지의 스타일과 스크립트를 포함한 독립 문서다. 최종 HTML은 이 메타데이터를 `script#slide-room-project[type="application/json"]`에 포함하고, 격리된 iframe과 슬라이드 이동 UI로 표시한다.

메타데이터는 실행 코드가 아니다. JSON의 `<`는 `\u003c`로 이스케이프해 `</script>`에 의해 문서 구조가 깨지지 않게 한다. 사람이 직접 이 JSON을 수정할 필요는 없다.
