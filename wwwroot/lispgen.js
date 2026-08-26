// Blockly 블록 정의 + Lisp(S-식) 제너레이터.
// 설계 철학: 블록이 Lisp 를 "읽고 쓰는 순서"와 똑같아야 학습에 도움이 된다.
//  - 연산자/함수는 전위(prefix): 연산자가 먼저, 그다음 인자들   → (+ a b c)
//  - 가변인자(mutator): Lisp 연산자는 인자 개수가 자유롭다는 걸 그대로 체험
//  - 블록에 실제 괄호 ( ) 를 그려 넣어 S-식의 모양 자체를 눈에 익힌다
(function () {
  const B = Blockly;

  // ---------- 가변인자 mutator (전위 연산자 블록과 함수 호출 블록이 공유) ----------
  // 리딩 입력(OP 드롭다운 또는 NAME 필드)은 건드리지 않고 ARG0.. 값 입력과 끝의 ')' 만 관리한다.
  function reconnectArg(conn, block, name) {
    if (conn) { const inp = block.getInput(name); if (inp && inp.connection) inp.connection.connect(conn); }
  }

  const ARITY_MUTATOR = {
    saveExtraState: function () { return { itemCount: this.itemCount_ }; },
    loadExtraState: function (state) { this.itemCount_ = state["itemCount"] || 0; this.updateShape_(); },

    decompose: function (workspace) {
      const container = workspace.newBlock("lisp_arity_container");
      container.initSvg();
      let connection = container.getInput("STACK").connection;
      for (let i = 0; i < this.itemCount_; i++) {
        const item = workspace.newBlock("lisp_arity_item");
        item.initSvg();
        connection.connect(item.previousConnection);
        connection = item.nextConnection;
      }
      return container;
    },
    compose: function (container) {
      let item = container.getInputTargetBlock("STACK");
      const connections = [];
      while (item) {
        if (item.isInsertionMarker && item.isInsertionMarker()) { item = item.getNextBlock(); continue; }
        connections.push(item.valueConnection_);
        item = item.getNextBlock();
      }
      // 새 배치에 없는 기존 자식은 끊는다
      for (let i = 0; i < this.itemCount_; i++) {
        const t = this.getInput("ARG" + i).connection.targetConnection;
        if (t && connections.indexOf(t) === -1) t.disconnect();
      }
      this.itemCount_ = connections.length;
      this.updateShape_();
      for (let i = 0; i < this.itemCount_; i++) reconnectArg(connections[i], this, "ARG" + i);
    },
    saveConnections: function (container) {
      let item = container.getInputTargetBlock("STACK");
      let i = 0;
      while (item) {
        if (item.isInsertionMarker && item.isInsertionMarker()) { item = item.getNextBlock(); continue; }
        const inp = this.getInput("ARG" + i);
        item.valueConnection_ = inp && inp.connection.targetConnection;
        item = item.getNextBlock();
        i++;
      }
    },
    updateShape_: function () {
      if (this.getInput("CLOSE")) this.removeInput("CLOSE");
      let have = 0; while (this.getInput("ARG" + have)) have++;
      for (let j = this.itemCount_; j < have; j++) this.removeInput("ARG" + j);
      for (let j = Math.min(have, this.itemCount_); j < this.itemCount_; j++) this.appendValueInput("ARG" + j);
      this.appendDummyInput("CLOSE").appendField(")");
    },
  };

  B.Blocks["lisp_arity_container"] = { init() {
    this.appendDummyInput().appendField("인자들"); this.appendStatementInput("STACK");
    this.setColour(230); this.contextMenu = false; } };
  B.Blocks["lisp_arity_item"] = { init() {
    this.appendDummyInput().appendField("인자"); this.setPreviousStatement(true); this.setNextStatement(true);
    this.setColour(230); this.contextMenu = false; } };

  B.Extensions.registerMutator("lisp_arity_mutator", ARITY_MUTATOR,
    function () { this.itemCount_ = 2; this.updateShape_(); }, ["lisp_arity_item"]);

  // ---------- 블록 정의 ----------
  B.defineBlocksWithJsonArray([
    { type: "lisp_number", message0: "%1", args0: [{ type: "field_number", name: "N", value: 0 }],
      output: null, colour: 210, tooltip: "숫자" },
    { type: "lisp_string", message0: "“ %1 ”", args0: [{ type: "field_input", name: "S", text: "hi" }],
      output: null, colour: 160, tooltip: "문자열" },
    { type: "lisp_var", message0: "%1", args0: [{ type: "field_input", name: "NAME", text: "x" }],
      output: null, colour: 330, tooltip: "변수 참조 (심볼)" },

    // 전위 연산자: ( +  a  b … )  ← 연산자가 먼저, 인자는 가변
    { type: "lisp_op", message0: "( %1", args0: [
        { type: "field_dropdown", name: "OP",
          options: [["+","+"],["-","-"],["*","*"],["/","/"],["<","<"],["<=","<="],["=","="],[">",">"],[">=",">="]] }],
      output: null, inputsInline: true, colour: 230, mutator: "lisp_arity_mutator",
      tooltip: "전위 연산자 — (연산자 인자 인자 …). 톱니바퀴로 인자 개수 조절" },

    // ( if  조건  참  거짓 )
    { type: "lisp_if", message0: "( if %1 %2 %3 )",
      args0: [{ type: "input_value", name: "C" }, { type: "input_value", name: "T" }, { type: "input_value", name: "E" }],
      inputsInline: true, output: null, colour: 20, tooltip: "(if 조건 참-값 거짓-값)" },

    // ( print  x )
    { type: "lisp_print", message0: "( print %1 )", args0: [{ type: "input_value", name: "X" }],
      inputsInline: true, output: null, colour: 60, tooltip: "(print x)" },

    // ( progn  a  b )  순차 실행
    { type: "lisp_progn", message0: "( progn %1 %2 )",
      args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
      inputsInline: true, output: null, colour: 60, tooltip: "(progn a b) — 위에서 아래로 실행, 마지막 값이 결과" },

    // ( let (( x  V ))  몸통 )
    { type: "lisp_let", message0: "( let (( %1 %2 )) %3 )",
      args0: [{ type: "field_input", name: "NAME", text: "x" }, { type: "input_value", name: "VAL" },
              { type: "input_value", name: "BODY" }],
      inputsInline: true, output: null, colour: 290, tooltip: "(let ((x V)) 몸통) — 지역 변수" },

    // ( defun  이름 ( 인자들 )  몸통 )
    { type: "lisp_defun", message0: "( defun %1 ( %2 ) %3 )",
      args0: [{ type: "field_input", name: "NAME", text: "square" }, { type: "field_input", name: "PARAMS", text: "n" },
              { type: "input_value", name: "BODY" }],
      inputsInline: true, output: null, colour: 290, tooltip: "(defun 이름 (인자들) 몸통) — 함수 정의" },

    // ( 이름  인자 … )  함수 호출 (가변)
    { type: "lisp_call", message0: "( %1", args0: [{ type: "field_input", name: "NAME", text: "square" }],
      output: null, inputsInline: true, colour: 290, mutator: "lisp_arity_mutator",
      tooltip: "함수 호출 — (이름 인자 …). 톱니바퀴로 인자 개수 조절" },

    // ---- 리스트 & 인용(코드=데이터) ----
    // ( list  a  b … )  인자를 평가해 리스트로 (가변)
    { type: "lisp_list", message0: "( list", output: null, inputsInline: true, colour: 170,
      mutator: "lisp_arity_mutator", tooltip: "(list …) — 인자를 평가해 리스트를 만든다. 톱니바퀴로 개수 조절" },
    // ' X   인용: 평가하지 말고 코드를 데이터로
    { type: "lisp_quote", message0: "' %1", args0: [{ type: "input_value", name: "X" }],
      inputsInline: true, output: null, colour: 45,
      tooltip: "인용(quote) 'X — 평가하지 않는다. (+ 1 2)→3 이지만 '(+ 1 2)→리스트 (+ 1 2)" },
    { type: "lisp_cons", message0: "( cons %1 %2 )",
      args0: [{ type: "input_value", name: "A" }, { type: "input_value", name: "B" }],
      inputsInline: true, output: null, colour: 170, tooltip: "(cons a 리스트) — 맨 앞에 붙인다" },
    { type: "lisp_first", message0: "( first %1 )", args0: [{ type: "input_value", name: "X" }],
      inputsInline: true, output: null, colour: 170, tooltip: "(first 리스트) — 첫 원소 (car)" },
    { type: "lisp_rest", message0: "( rest %1 )", args0: [{ type: "input_value", name: "X" }],
      inputsInline: true, output: null, colour: 170, tooltip: "(rest 리스트) — 첫 원소 뺀 나머지 (cdr)" },
  ]);

  // ---------- Lisp 제너레이터 ----------
  const gen = new B.Generator("Lisp");
  const ORDER = 0;
  const v = (b, name, dflt) => gen.valueToCode(b, name, ORDER) || dflt;
  const argCount = b => (typeof b.itemCount_ === "number" ? b.itemCount_ : 0);

  gen.forBlock["lisp_number"] = b => [String(b.getFieldValue("N")), ORDER];
  gen.forBlock["lisp_string"] = b => ['"' + String(b.getFieldValue("S")).replace(/"/g, '\\"') + '"', ORDER];
  gen.forBlock["lisp_var"]    = b => [b.getFieldValue("NAME"), ORDER];
  gen.forBlock["lisp_if"]     = b => [`(if ${v(b,"C","nil")} ${v(b,"T","nil")} ${v(b,"E","nil")})`, ORDER];
  gen.forBlock["lisp_print"]  = b => [`(print ${v(b,"X","nil")})`, ORDER];
  gen.forBlock["lisp_progn"]  = b => [`(progn ${v(b,"A","nil")} ${v(b,"B","nil")})`, ORDER];
  gen.forBlock["lisp_let"]    = b => [`(let ((${b.getFieldValue("NAME")} ${v(b,"VAL","nil")})) ${v(b,"BODY","nil")})`, ORDER];
  gen.forBlock["lisp_defun"]  = b => [`(defun ${b.getFieldValue("NAME")} (${b.getFieldValue("PARAMS")}) ${v(b,"BODY","nil")})`, ORDER];

  gen.forBlock["lisp_op"] = b => {
    const args = [];
    for (let i = 0; i < argCount(b); i++) args.push(v(b, "ARG" + i, "0"));
    return [`(${b.getFieldValue("OP")}${args.length ? " " + args.join(" ") : ""})`, ORDER];
  };
  gen.forBlock["lisp_call"] = b => {
    const args = [];
    for (let i = 0; i < argCount(b); i++) { const c = v(b, "ARG" + i, ""); if (c) args.push(c); }
    return [`(${b.getFieldValue("NAME")}${args.length ? " " + args.join(" ") : ""})`, ORDER];
  };
  gen.forBlock["lisp_list"] = b => {
    const args = [];
    for (let i = 0; i < argCount(b); i++) { const c = v(b, "ARG" + i, ""); if (c) args.push(c); }
    return [`(list${args.length ? " " + args.join(" ") : ""})`, ORDER];
  };
  gen.forBlock["lisp_quote"] = b => [`'${v(b, "X", "nil")}`, ORDER];
  gen.forBlock["lisp_cons"]  = b => [`(cons ${v(b,"A","nil")} ${v(b,"B","nil")})`, ORDER];
  gen.forBlock["lisp_first"] = b => [`(first ${v(b,"X","nil")})`, ORDER];
  gen.forBlock["lisp_rest"]  = b => [`(rest ${v(b,"X","nil")})`, ORDER];

  // 최상위(연결 안 된 값 블록들)를 세로 순서대로 모아 progn 으로 감싼다.
  function workspaceToLisp(ws) {
    const tops = ws.getTopBlocks(true).map(bl => gen.blockToCode(bl))
      .map(c => Array.isArray(c) ? c[0] : c).filter(x => x && x.trim());
    if (tops.length === 0) return "nil";
    return tops.length === 1 ? tops[0] : "(progn " + tops.join(" ") + ")";
  }

  // ---------- 툴박스 ----------
  const toolbox = { kind: "flyoutToolbox", contents: [
    { kind: "block", type: "lisp_number" }, { kind: "block", type: "lisp_string" },
    { kind: "block", type: "lisp_var" }, { kind: "block", type: "lisp_op" },
    { kind: "block", type: "lisp_if" }, { kind: "block", type: "lisp_print" },
    { kind: "block", type: "lisp_progn" }, { kind: "block", type: "lisp_let" },
    { kind: "block", type: "lisp_defun" }, { kind: "block", type: "lisp_call" },
    { kind: "block", type: "lisp_list" }, { kind: "block", type: "lisp_quote" },
    { kind: "block", type: "lisp_cons" }, { kind: "block", type: "lisp_first" },
    { kind: "block", type: "lisp_rest" },
  ] };

  // 재사용 헬퍼: 블록 JSON 을 짧게 구성
  const num = n => ({ block: { type: "lisp_number", fields: { N: n } } });
  const varn = () => ({ block: { type: "lisp_var", fields: { NAME: "n" } } });
  const op = (o, ...as) => ({ block: { type: "lisp_op", extraState: { itemCount: as.length },
    fields: { OP: o }, inputs: Object.fromEntries(as.map((a, i) => ["ARG" + i, a])) } });
  const call = (name, ...as) => ({ block: { type: "lisp_call", extraState: { itemCount: as.length },
    fields: { NAME: name }, inputs: Object.fromEntries(as.map((a, i) => ["ARG" + i, a])) } });
  const iff = (c, t, e) => ({ block: { type: "lisp_if", inputs: { C: c, T: t, E: e } } });
  const plus12 = op("+", num(1), num(2));

  const EXAMPLES = {
    // (defun square (n) (* n n)) 그리고 (print (square 7))  →  49
    square: { blocks: { languageVersion: 0, blocks: [
      { type: "lisp_defun", x: 30, y: 20, fields: { NAME: "square", PARAMS: "n" },
        inputs: { BODY: { block: { type: "lisp_op", extraState: { itemCount: 2 }, fields: { OP: "*" },
          inputs: { ARG0: { block: { type: "lisp_var", fields: { NAME: "n" } } },
                    ARG1: { block: { type: "lisp_var", fields: { NAME: "n" } } } } } } } },
      { type: "lisp_print", x: 30, y: 180,
        inputs: { X: { block: { type: "lisp_call", extraState: { itemCount: 1 }, fields: { NAME: "square" },
          inputs: { ARG0: num(7) } } } } },
    ] } },
    // 코드=데이터: 같은 (+ 1 2) 를 그냥 평가 vs 인용, 그리고 (list 1 2 3)
    list: { blocks: { languageVersion: 0, blocks: [
      { type: "lisp_print", x: 30, y: 20, inputs: { X: plus12 } },                                  // → 3
      { type: "lisp_print", x: 30, y: 110,
        inputs: { X: { block: { type: "lisp_quote", inputs: { X: plus12 } } } } },                  // → (+ 1 2)
      { type: "lisp_print", x: 30, y: 200,
        inputs: { X: { block: { type: "lisp_list", extraState: { itemCount: 3 },
          inputs: { ARG0: num(1), ARG1: num(2), ARG2: num(3) } } } } },                             // → (1 2 3)
    ] } },
    // 재귀: (defun fact (n) (if (<= n 1) 1 (* n (fact (- n 1)))))  →  (print (fact 5)) = 120
    fact: { blocks: { languageVersion: 0, blocks: [
      { type: "lisp_defun", x: 30, y: 20, fields: { NAME: "fact", PARAMS: "n" },
        inputs: { BODY: iff(op("<=", varn(), num(1)),
                            num(1),
                            op("*", varn(), call("fact", op("-", varn(), num(1))))) } },
      { type: "lisp_print", x: 30, y: 230, inputs: { X: call("fact", num(5)) } },
    ] } },
    // 재귀: (defun fib (n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))  →  (print (fib 10)) = 55
    fib: { blocks: { languageVersion: 0, blocks: [
      { type: "lisp_defun", x: 30, y: 20, fields: { NAME: "fib", PARAMS: "n" },
        inputs: { BODY: iff(op("<", varn(), num(2)),
                            varn(),
                            op("+", call("fib", op("-", varn(), num(1))),
                                    call("fib", op("-", varn(), num(2))))) } },
      { type: "lisp_print", x: 30, y: 230, inputs: { X: call("fib", num(10)) } },
    ] } },
  };

  // 블록 하나의 서브트리만 Lisp 로 변환
  function blockToLisp(block) {
    const c = gen.blockToCode(block);
    return (Array.isArray(c) ? c[0] : c) || "nil";
  }

  // 우클릭 컨텍스트 메뉴: "이 블록만 평가" → .NET(EvalBlock) 호출
  let dotNetRef = null;
  B.ContextMenuRegistry.registry.register({
    id: "lisp_eval_block",
    scopeType: B.ContextMenuRegistry.ScopeType.BLOCK,
    weight: 100,
    displayText: () => "이 블록만 평가",
    preconditionFn: () => (dotNetRef ? "enabled" : "hidden"),
    callback: (scope) => {
      const code = blockToLisp(scope.block);
      if (dotNetRef) dotNetRef.invokeMethodAsync("EvalBlock", code);
    },
  });

  let workspace = null;
  window.lispBlocks = {
    init(divId, dotNet) {
      dotNetRef = dotNet || null;
      workspace = B.inject(divId, { toolbox, trashcan: true, scrollbars: true });
    },
    getCode() { return workspace ? workspaceToLisp(workspace) : "nil"; },
    loadExample(name) {
      const ex = EXAMPLES[name] || EXAMPLES.square;
      if (workspace) { workspace.clear(); B.serialization.workspaces.load(ex, workspace); }
    },
  };
})();
