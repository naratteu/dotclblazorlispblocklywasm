using System.Net.Http;
using DotCL;

namespace dotclblazorlispblocklywasm;

/// <summary>
/// dotcl(.NET 위의 Common Lisp)을 브라우저 wasm 안에서 초기화하고 코드를 평가한다.
/// core 이미지는 wwwroot/dotcl.core 에서 HttpClient 로 받아 LoadCore(byte[]) 로 넘긴다.
/// (Blazor wasm 에서는 파일 경로 로드보다 바이트 배열 로드가 안전하다.)
/// </summary>
public sealed class LispRuntime
{
    private readonly HttpClient _http;
    private bool _ready;

    public LispRuntime(HttpClient http) => _http = http;

    public async Task EnsureReadyAsync()
    {
        if (_ready) return;
        DotclHost.Initialize();
        var core = await _http.GetByteArrayAsync("dotcl.core");
        DotclHost.LoadCore(core);
        // stdout 캡처용 전역 (defmacro 가 top-level 로 평가되도록 SOURCE 를 감싸지 않으므로
        // *standard-output* 은 let 이 아니라 전역 재지정으로 다룬다)
        DotclHost.EvalString("(progn (defparameter cl-user::*app-out* nil) (defparameter cl-user::*app-old* nil))");
        _ready = true;
    }

    /// <summary>
    /// Lisp 소스를 평가하고 (stdout 출력 → 없으면 반환값 prin1) 을 문자열로 돌려준다.
    /// SOURCE 는 (progn …) 로 감싸 최상위(top-level)로 평가한다 → 같은 프로그램에서
    /// defmacro 정의 후 바로 사용하는 매크로가 올바로 확장된다.
    /// </summary>
    public string Eval(string source)
    {
        // stdout 을 전역으로 재지정(let 이 아님 → top-level 유지). 새 스트림으로 매 호출 초기화.
        DotclHost.EvalString(
            "(progn (setf cl-user::*app-old* *standard-output*)" +
            "       (setf cl-user::*app-out* (make-string-output-stream))" +
            "       (setf *standard-output* cl-user::*app-out*))");
        try
        {
            var value = DotclHost.EvalString("(progn\n" + source + "\n)");   // top-level
            var stdout = DotclHost.ToClr<string>(
                DotclHost.EvalString("(get-output-stream-string cl-user::*app-out*)")) ?? "";
            stdout = stdout.Trim('\n', '\r', ' ');
            if (stdout.Length > 0) return stdout;
            return DotclHost.ToClr<string>(DotclHost.Call("PRIN1-TO-STRING", value)) ?? "";
        }
        finally
        {
            DotclHost.EvalString("(setf *standard-output* cl-user::*app-old*)");
        }
    }
}
