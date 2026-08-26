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
        _ready = true;
    }

    /// <summary>Lisp 소스를 평가하고, (stdout 출력 + 반환값)을 한 문자열로 돌려준다.</summary>
    public string Eval(string source)
    {
        // stdout(print/format t 등)까지 캡처하고, 마지막에 반환값을 prin1 로 붙인다.
        // 출력(print/format t 등)이 있으면 그걸 보여주고, 없으면 반환값을 prin1 로 보여준다.
        var wrapped =
            "(let* ((out (make-string-output-stream)) (*standard-output* out) " +
            "       (vals (multiple-value-list (progn " + source + "))) " +
            "       (s (get-output-stream-string out)))" +
            "  (if (string= s \"\") (format nil \"~{~a~^ ~}\" (mapcar #'prin1-to-string vals))" +
            "      (string-trim '(#\\Newline) s)))";
        return DotclHost.ToClr<string>(DotclHost.EvalString(wrapped));
    }
}
