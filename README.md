# dotclblazorlispblocklywasm

이름이 곧 스택입니다: **dotcl + Blazor + Lisp + Blockly + WASM**.

🔗 **라이브 데모: https://naratteu.github.io/dotclblazorlispblocklywasm/**
(main 에 push 하면 GitHub Actions 가 자동 발행 → `gh-pages` 브랜치)

브라우저에서 도는 Common Lisp 학습용 블록코딩 PoC. Blockly 드래그앤드랍 블록으로
S-식을 조립하면, [dotcl](https://github.com/dotcl/dotcl)(.NET 위의 Common Lisp)이
**브라우저 WebAssembly 안에서** 그 Lisp를 실행합니다. Blazor 서버도, 백엔드도 없습니다.

## 설계 원칙

블록은 Lisp를 **읽고 쓰는 순서 그대로**다 (학습 목적):

- 연산자·함수는 **전위(prefix)**: 연산자가 먼저, 인자가 뒤 → `(+ a b c)`
- **가변인자**(톱니바퀴로 인자 추가/삭제): Lisp 연산자가 임의 개수 인자를 받음을 체험
- 블록에 실제 `(` `)` 를 그려 S-식의 모양 자체를 눈에 익힘

## 실행

```bash
dotnet run -c Release
# 브라우저에서 표시된 http://localhost:PORT 접속 → "예제 불러오기" → "실행"
```

전제조건: .NET SDK 10+, `dotnet workload install wasm-tools`, 그리고
dotcl 글로벌 툴(`dotnet tool install --global dotcl`).

저장소에는 **우리 코드만** 둔다 — 외부 의존물은 커밋하지 않는다:

- **Blockly**: 런타임에 CDN(jsdelivr)에서 로드 (`wwwroot/index.html`). 실행에 인터넷 필요.
- **`dotcl.core`**(Lisp 이미지, ~5MB): 빌드 시 설치된 dotcl 툴에서 `wwwroot/` 로 복사
  (csproj 의 `CopyDotclCore` 타겟, `.gitignore` 처리).
- **`DotCL.Runtime.dll`**: NuGet 캐시의 dotcl 툴 폴더를 `Reference` 로 참조.

RID/버전 경로(`dotcl.osx-arm64/0.1.25/...`)는 `csproj` 의 `DotclToolDir` 에서 조정.

## 구성

| 파일 | 역할 |
|---|---|
| `LispRuntime.cs` | `dotcl.core` 를 HttpClient 로 받아 `DotclHost.LoadCore(byte[])`, 코드 평가 |
| `wwwroot/lispgen.js` | Blockly 블록 정의 + Lisp(S-식) 제너레이터 + 가변인자 mutator |
| `Pages/Home.razor` | Blockly 캔버스 + 실행 버튼 + 생성코드/결과 패널 |

## 왜 브라우저에서 되나 (AOT 는 안 되는데)

dotcl 은 IL 을 런타임에 로드·실행한다. Blazor WASM 의 Mono 인터프리터는 이를 지원하지만
(그래서 동작), Native AOT 는 런타임 IL 로딩을 금지하므로 기본 core-load 경로가 실패한다.
