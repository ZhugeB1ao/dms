<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **docs** (873 symbols, 1768 relationships, 68 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact analysis before editing.** Use `impact({target: "symbolName", direction: "upstream"})` (MCP) or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .` (CLI fallback); report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/docs/context` | Codebase overview, check index freshness |
| `gitnexus://repo/docs/clusters` | All functional areas |
| `gitnexus://repo/docs/processes` | All execution flows |
| `gitnexus://repo/docs/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

---

# QUY TẮC BẮT BUỘC KHI PHÁT TRIỂN (SUPERPOWERS + GITNEXUS + PONYTAIL)

Mọi tác vụ phân tích, thiết kế, lập kế hoạch và viết code trong repository `docs` phải kích hoạt và tuân thủ nghiêm ngặt **3 bộ skill bắt buộc**:

1. **Superpowers (`using-superpowers`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`)**:
   - Lập kế hoạch thực thi chi tiết (gồm `Goal`, `Architecture`, `Tech Stack`, `Spec`, `Global Constraints`, `Review Focus`) trước khi viết code.
   - Thực hiện theo các bước nhỏ (bite-sized tasks) kèm TDD (viết test trước → xác nhận fail → viết code tối thiểu → xác nhận pass).
   - Luôn chạy kiểm chứng thực tế (`npm run check` & `node .gitnexus/run.cjs detect-changes --scope all --repo docs`) trước khi báo cáo hoàn tất.
2. **GitNexus (`impact`, `context`, `query`, `detect-changes`)**:
   - Luôn chạy phân tích vùng ảnh hưởng (`impact --direction upstream`) trước khi sửa symbol hiện có.
   - Nếu `risk: UNKNOWN`, phải kiểm chứng bổ sung bằng text search (`grep`).
3. **Ponytail (`ponytail`, `ponytail-review`, `ponytail-audit`)**:
   - Triết lý **Minimalist & YAGNI**: Giải pháp ngắn gọn nhất, ít dòng code nhất nhưng hoạt động chính xác (*shortest working diff wins*).
   - Ưu tiên tuyệt đối Standard Library / Native Web APIs (`FormData`, `input.validity`, `AbortController`, `<dialog>`) trước khi viết helper riêng; chỉ tách abstraction dùng chung khi có từ 3 nơi tái sử dụng trở lên.
   - Không cài thêm thư viện ngoài khi chưa có sự đồng thuận kiến trúc.

