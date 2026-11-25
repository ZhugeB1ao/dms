# Chuẩn hóa giao diện bằng Radix Themes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: dùng `executing-plans` khi thực thi trực tiếp; chỉ dùng `subagent-driven-development` nếu chọn phương thức ủy quyền phù hợp. Theo dõi bằng checkbox, đọc checklist skill trước mỗi task. Đây là plan, chưa phải lệnh cài dependency hoặc thay đổi source.

**Goal:** Dùng component thư viện cho UI phổ biến trên toàn ứng dụng; chỉ viết component/CSS riêng khi cần kết nối nghiệp vụ, bố cục đặc thù hoặc thư viện không đáp ứng.

**Architecture:** Người dùng đã chọn **Radix Themes làm nền** ngày 06/11/2026. Dùng `@radix-ui/themes` cho component có giao diện sẵn; Radix Primitives chỉ bổ sung khi Themes thiếu hành vi cần thiết. Tailwind/CSS hiện có tiếp tục phục vụ bố cục và giao diện đặc thù; không dùng chúng để dựng lại giao diện mặc định của component thư viện.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Axios, MSW, Vitest/Testing Library hiện có; bổ sung `@radix-ui/themes` khi thực thi. Không mặc định thêm shadcn/ui, MUI, Ant Design, thư viện form hoặc state manager.

**Spec:** Yêu cầu người dùng trong chat ngày 06/11/2026: tận dụng Radix thay cho CSS tự viết trên toàn UI; chỉ tự viết cho nhu cầu đặc thù/thư viện thiếu. Lựa chọn đã xác nhận: “Radix Themes làm nền (đề xuất)”. Các quy tắc cụ thể bên dưới là đề xuất triển khai để review.

**Trạng thái:** Đã khảo sát source và tài liệu chính thức; chưa cài Radix, chưa sửa code cho migration này. Mọi đường dẫn bên dưới tính từ `front-end/`.

## Global Constraints

- UI luôn dùng tiếng Anh. Không dịch nội dung người dùng nhập hay dữ liệu nghiệp vụ thực.
- Giữ role ADMIN/MANAGER/EMPLOYEE, route, API contract, mock, refresh/retry và validation nghiệp vụ hiện tại.
- Library-first: Themes → Themes composition → Primitives nếu cần → CSS/component đặc thù cuối cùng.
- Ưu tiên props và token chính thức. Không sao chép CSS nội bộ `.rt-*`, không thêm `!important` để ép style thư viện.
- Không tự tạo wrapper cho mỗi component. Chỉ giữ adapter khi có giá trị rõ: API cũ nhiều caller hoặc mapping giá trị/form của Select.
- Không mô phỏng DOM ChangeEvent để làm API Radix trông như native. Đổi caller sang callback giá trị rõ ràng.
- Giữ cơ chế native của input thực, đặc biệt password manager/paste, file upload và FormData. Không giả định Select/Dialog Radix có API như HTML tương ứng.
- Không xóa CSS chỉ vì không xuất hiện trong một screenshot. Phải kiểm tra toàn bộ caller, breakpoint, state và native control chưa migrate.
- Giữ mọi thay đổi chưa commit hiện tại. Không tự reset, commit, push hoặc merge khi thực hiện plan.
- Đọc lại AGENTS.md trước thực thi; quyền sửa source đã có trong chat không đồng nghĩa đã triển khai/cài thư viện ở lần chỉ lập plan này.

## Review Focus

1. Giá trị rỗng, clear filter và lựa chọn null: hiển thị đúng placeholder, không phát sinh giá trị giả trong FormData/API — task 4.
2. Select trong dialog: popup không bị native top layer che, không mất theme/focus, Escape đóng lớp trên trước — task 3–4.
3. Validation: lỗi đầu tiên focus đúng trigger/input, không focus hidden input; required/disabled và fieldset được xử lý đúng — task 4–5.
4. CSS cũ và Tailwind reset làm biến dạng component mới hoặc portal: kiểm tra cả dev lẫn production build — task 1, 7–8.
5. Đóng modal hoặc logout khi request còn chạy: không gửi mutation hai lần, không áp response cũ hoặc đóng modal giả thành công — task 3, 8.

## 1. Quyết định dùng thư viện

- **Đã chọn:** Radix Themes có style sẵn. Import stylesheet thư viện và một Theme provider; chọn appearance/tokens chung thay cho tự viết màu, border, focus và hover từng control.
- **Không chọn làm nền:** Primitives đơn thuần, vì đây là component không có style, chưa giải quyết trực tiếp mục tiêu giảm CSS. Vẫn dùng khi một hành vi đặc thù không có trong Themes.
- **Không dùng thêm một bộ UI khác:** tránh nhiều hệ token/spacing/overlay trong cùng dự án.

Không hứa “không còn CSS”. Shell/sidebar, bố cục chat, nội dung OCR, responsive của trang và bố cục bảng vẫn là trách nhiệm ứng dụng. Mục tiêu là bỏ phần tự dựng lại control phổ biến.

### Nguồn chính thức để đọc lúc thực thi

- [Themes getting started](https://www.radix-ui.com/themes/docs/overview/getting-started): package, stylesheet và Theme provider.
- [Themes styling](https://www.radix-ui.com/themes/docs/overview/styling): props/token, CSS precedence, Tailwind và portal.
- [Themes Select](https://www.radix-ui.com/themes/docs/components/select), [Primitives Select](https://www.radix-ui.com/primitives/docs/components/select): controlled value, name/required, positioning và accessibility.
- [Text Field](https://www.radix-ui.com/themes/docs/components/text-field), [Dialog](https://www.radix-ui.com/themes/docs/components/dialog), [Alert Dialog](https://www.radix-ui.com/themes/docs/components/alert-dialog).

Không khóa một version dự đoán trong plan. Khi thực thi, kiểm tra peer dependencies với React 19/React DOM hiện có, chọn version cụ thể phù hợp rồi lưu package-lock. Không chạy upgrade toàn bộ dependency.

## 2. Hiện trạng, phạm vi ảnh hưởng

Hiện chưa cài Radix. Có Button tự viết; Select native với Select.css, 10 vị trí sử dụng trong UsersPage/UserFormDialog/CategoriesPage. Search/text/password dùng input trực tiếp; nhiều button trong chat/OCR chưa dùng Button chung. Modal tài khoản, danh mục, signup demo và sidebar mobile đang dùng native dialog/showModal/close.

Form hiện thu thập bằng FormData; `formValidation.ts` quét input/select và focus qua form.elements. Các giả định này cần sửa có chủ đích khi trigger Select trở thành button. Test helper userFeature/App.test render app với router/auth riêng, vì vậy Theme phải có trong cả app thật lẫn môi trường test.

### GitNexus đã tra cứu

| Symbol         | Callers/process chính                                                                        | Kết quả snapshot                                              |
| -------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Button         | SignupDemoForm/Modal, AccountPage, CategoriesPage, Header, Sidebar → AppLayout/AppRouter/App | **HIGH**, 9 upstream; ảnh hưởng auth/layout/pages             |
| AppLayout      | AppRouter → App                                                                              | Luồng layout/router; kiểm tra lại graph hiện tại khi thực thi |
| AccountPage    | AppRouter; login/forgot/change password                                                      | Snapshot cũ, cần đối chiếu TS hiện tại                        |
| CategoriesPage | AppRouter → App                                                                              | LOW, 3 upstream                                               |
| Select         | Source: UsersPage, UserFormDialog, CategoriesPage                                            | **UNKNOWN**, chưa có trong index                              |

Index còn JS/JSX trong khi source hiện tại là TS/TSX; FTS không khả dụng. HIGH phải được coi là cảnh báo thực sự; UNKNOWN không được xem như an toàn. Trước sửa source, cập nhật/tra lại context và impact nếu môi trường cho phép. Ghi rõ phần graph chưa xác minh; không thay thế graph bằng một câu “grep không thấy lỗi”.

## 3. Bảng chuyển đổi component

| UI hiện tại                               | Radix Themes đề xuất                            | Phần ứng dụng giữ lại                                          |
| ----------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Button / button tùy biến                  | Button, IconButton                              | type=button mặc định, icon/action và business handler          |
| Search input                              | TextField.Root + Slot                           | query, debounce 300 ms, abort và API filter                    |
| Text/email/password                       | TextField.Root                                  | name, type, autocomplete, validation, error text               |
| Dropdown                                  | Select.Root/Trigger/Content/Item                | mapping domain value, options và FormData/validation adapter   |
| Form modal / signup demo                  | Dialog                                          | form, async state, error handling                              |
| Xác nhận khóa/mở khóa/reset/ngưng dùng    | AlertDialog                                     | xác nhận, validation reset password, mutation và pending guard |
| Bảng users/categories                     | Table                                           | dữ liệu, lọc, phân trang, responsive overflow và action        |
| Nhãn trạng thái                           | Badge                                           | mapping ACTIVE/INACTIVE/OCR status, text thay vì chỉ màu       |
| Thông báo/lỗi/loading                     | Callout, Spinner, Skeleton                      | nội dung, role/aria-live và retry handler                      |
| Profile/avatar                            | Avatar, Text, DataList, Card khi phù hợp        | initials, route hồ sơ chỉ đọc và dữ liệu hiện tại              |
| Chat history/source tabs                  | Tabs khi thực sự đúng semantics                 | chat state, streaming, nguồn dẫn và responsive panel           |
| File upload                               | Giữ input type=file native, kết hợp Button/Text | file selection, accept, upload và OCR                          |
| App shell/sidebar/chat bubble/OCR preview | Flex/Grid/ScrollArea khi phù hợp + layout riêng | các phần bố cục đặc thù được phép có CSS                       |

Không đổi mọi div thành component thư viện. Không thêm dropdown menu, date picker, toast framework hoặc datagrid khi dự án chưa cần.

## 4. API dùng chung và ranh giới

### Theme

Tạo `src/app/AppTheme.tsx`: `AppTheme({ children }: { children: ReactNode }): ReactElement`. Cấu hình appearance dark, neutral palette và radius theo props chính thức; dùng màu mặc định/token làm chuẩn, chưa ép khớp từng pixel của CSS cũ. App thật và test render dùng cùng AppTheme. Không tạo theme context/state manager mới.

Tạo `src/shared/styles/theme.css` chỉ khi cần override token toàn cục hoặc accessibility/layout ngoại lệ. Không dùng file này dựng lại Button/Input/Select từ đầu. Thứ tự CSS và cascade được chốt bằng kiểm tra dev/build của task 1, không sao chép workaround Tailwind v3 vào dự án Tailwind v4.

### Button

Giữ `src/shared/components/Button.tsx` như adapter mỏng trong giai đoạn chuyển đổi để không sửa mọi caller cùng lúc: primary → Themes Button solid; secondary → soft; icon → IconButton ghost. Giữ type=button, disabled và event props. Chỗ nào cần color/variant Themes đặc thù dùng trực tiếp component thư viện, không thêm hàng loạt boolean props vào adapter. Xóa `.button--*` khi không còn caller phụ thuộc.

### Select

Thay API native-props bằng API domain rõ ràng trong `src/shared/components/Select.tsx`:

- `SelectOption = { value: string; label: string; disabled?: boolean }`.
- Props: `id: string`, `name?: string`, `value: string`, `onValueChange(value: string): void`, `options: readonly SelectOption[]`, `placeholder: string`, `emptyLabel?: string`, `disabled?: boolean`, `required?: boolean`, `className?: string`, `aria-invalid?`, `aria-describedby?`, trigger ref.
- `value=''` là giá trị domain rỗng; options không chứa empty value. `emptyLabel` tạo lựa chọn clear/all ở UI qua sentinel nội bộ, callback luôn chuẩn hóa về ''. Không đưa sentinel vào request.
- Trường tùy chọn có thể clear; trường bắt buộc được kiểm tra bằng validation nghiệp vụ. Filter chọn lại All và reset form phải đồng bộ state.
- Có name: render đúng một hidden input có name/value bằng domain value để FormData ổn định; Root không truyền name để tránh submit trùng. Root/Trigger nhận disabled theo đúng props; hidden input cũng disabled tương ứng. Không trông chờ hidden input thực hiện native required/focus.
- Trigger có id trùng tên field cần focus, aria-required/aria-invalid/aria-describedby; label htmlFor trỏ trigger. Required validation của Select được xử lý rõ trong form, không dựa vào việc tìm HTMLSelectElement.
- Content dùng `position='popper'`, side bottom và collision handling của thư viện. Không ép luôn mở xuống ngoài viewport; không dùng CSS anchor/::picker cũ.
- Không parse/cloning children `<option>` hoặc tạo event.target giả. Chuyển toàn bộ 10 caller sang options/value/onValueChange rõ ràng trong cùng task 4.

Adapter này có mục đích tương thích dữ liệu form; không phải dựng lại popup/focus/keyboard của Radix. Không thêm duplicate hidden native select, MutationObserver hoặc state lưu lại toàn bộ options.

### Validation và focus

Giữ `validateForm(form)` cho text/password inputs thực. Select required và role/department được kiểm tra từ giá trị domain trong UserFormDialog/CategoriesPage; merge errors vào cùng shape `Record<string,string>`. `focusError(form, errors)` ưu tiên phần tử có id field nằm trong form, bỏ qua hidden input, rồi fallback control native có thể focus. Không phụ thuộc selector CSS nội bộ Radix.

Không dùng `form.reset()` để kỳ vọng reset controlled state. Khi save/close/unmount thì reset form + state theo lifecycle hiện có; khi lỗi 409/422 phải giữ input và lựa chọn.

### Dialog/portal

Chuyển các native dialog liên quan sang Themes trước khi đổi Select. Không trộn popup portal ngoài body với native modal top layer mà không kiểm chứng. AccountDialog giữ interface `title/pending/onClose/children` hiện có, nhưng dùng Themes Dialog controlled. Confirmation dùng AlertDialog; pending không tự đóng khi Escape/outside click hoặc khi bấm action trước khi request thành công.

Không tăng z-index tùy ý để chữa overlay. Dùng portal/theme của Themes; nếu cần custom Primitives portal, bao đúng Theme theo tài liệu chính thức. Nút Confirm không được bị AlertDialog.Action tự đóng trước kết quả async; error phải giữ dialog mở.

## 5. Task triển khai

### Task 1 — Baseline, dependency và Theme không làm đổi nghiệp vụ

**Files:** chỉnh package.json/package-lock.json, src/main.tsx, src/app/App.tsx, src/shared/styles/styles.css; tạo src/app/AppTheme.tsx và src/shared/styles/theme.css nếu thật sự cần; chỉnh src/test/userFeature.tsx và src/app/App.test.tsx để bọc Theme.

**Skills:** using-superpowers, brainstorming cho quyết định còn mở, executing-plans, ponytail, design-system, ui-ux-pro-max, verification-before-completion.

- [ ] Đọc plan/spec/AGENTS, lưu Git status và danh sách thay đổi có sẵn; chọn workspace theo quyền hiện tại, không làm mất phần chưa commit.
- [ ] Chạy baseline `npm run check`; số test gần nhất là 65, phải ghi kết quả thực tế. Lưu screenshot/size production CSS+JS để so sánh sau migration.
- [ ] Xác minh peer deps, cài đúng @radix-ui/themes và lockfile. Không cài toàn bộ bộ thư viện khác hoặc nâng React/Vite.
- [ ] Thêm AppTheme cho app/test. Xác minh import stylesheet, Tailwind reset và các selector toàn cục input/select/button/dialog đang tác động gì trước khi chuyển control.
- [ ] Chạy smoke render bằng Themes Button/TextField trong test context và browser; kiểm tra dark theme/portal trong dev và production. Chạy `npm run check` và ghi bằng chứng trước task 2.

**Đầu ra:** ứng dụng cũ vẫn hoạt động, foundation Themes sẵn sàng; chưa xóa CSS cũ hàng loạt.

### Task 2 — Button, text field và search dùng thư viện

**Files:** chỉnh shared/components/Button.tsx; tạo shared/components/SearchField.tsx nếu dùng chung users/categories; chỉnh auth/pages/AccountPage.tsx, auth/components/SignupDemoForm.tsx, users/pages/UsersPage.tsx, users/components/UserFormDialog.tsx, UserActionDialog.tsx, categories/pages/CategoriesPage.tsx; test tương ứng ở các thư mục này.

**Interfaces:** Button giữ API adapter mục 4. `SearchField({id, value, onChange, placeholder, 'aria-label', disabled?})` dùng TextField.Root type=search và icon Slot; onChange vẫn là event input thật. Không nhét debounce/API vào SearchField.

**Skills:** TDD, vercel-react-best-practices, ui-styling, ui-ux-pro-max; duy trì ponytail/executing-plans/verification.

- [ ] Viết test cho nguy cơ migration: click Cancel không submit; Enter submit đúng một lần; Search clear cập nhật query, giữ debounce/cancel; label/error/autocomplete/ref trỏ input thực.
- [ ] Chuyển Button adapter sang Themes, bỏ class styling cũ ở các caller đã migrate. Dùng IconButton có accessible name cho icon action.
- [ ] Chuyển search và text/email/password sang TextField, giữ name/type/maxLength/autocomplete/native validity; không đổi payload/login semantics.
- [ ] Chạy test users form/list/action, auth/app/sidebar; kiểm tra typing, disabled/pending và focus trên browser. Chạy `npm run check`.

**Đầu ra:** control phổ biến bắt đầu dùng style Themes, search logic giữ nguyên.

### Task 3 — Chuẩn hóa dialog trước khi đổi Select

**Files:** chỉnh users/components/AccountDialog.tsx, UserActionDialog.tsx; categories/pages/CategoriesPage.tsx; auth/components/SignupDemoModal.tsx; layouts/AppLayout/AppLayout.tsx và Sidebar.tsx khi cần callback đóng mobile; test app, sidebar và form/action.

**Interfaces:** AccountDialog giữ props mục 4. Mobile sidebar dùng controlled open state + onOpenChange, thay showModal/close refs. Sidebar.handleNavigation vẫn đóng drawer khi nhấn link. Signup demo giữ nguyên tính chất demo.

**Skills:** TDD, ui-ux-pro-max, ui-styling, vercel-react-best-practices; systematic-debugging nếu focus/portal khác dự kiến.

- [ ] Viết test đóng/mở, focus ban đầu/trả focus, Escape/outside, pending không đóng, API lỗi giữ dialog và input; Confirm nhanh hai lần chỉ một request.
- [ ] Chuyển form dialogs sang Dialog và confirmation sang AlertDialog. Tiêu đề/mô tả có semantics thư viện, không tạo button lồng button khi dùng Trigger/Close.
- [ ] Chuyển signup/mobile sidebar cùng cơ chế overlay; bố cục drawer bên trái là ngoại lệ layout được ghi nhận, không tự viết lại focus trap.
- [ ] Bỏ showModal/close/onCancel trong component đã migrate; chỉ gỡ polyfill jsdom cũ khi không còn native dialog caller.
- [ ] Kiểm tra overlay/dark theme/focus trên browser; test auth/signup/mobile/account/categories và `npm run check` đạt trước task 4.

**Đầu ra:** các modal dùng một nền overlay, sẵn sàng cho Select có portal.

### Task 4 — Thay toàn bộ Select và bảo toàn contract form

**Files:** chỉnh shared/components/Select.tsx; tạo shared/components/Select.test.tsx; chỉnh users/components/formValidation.ts, UserFormDialog.tsx, users/pages/UsersPage.tsx, categories/pages/CategoriesPage.tsx và tests; xóa shared/components/Select.css sau khi không còn import.

**Interfaces:** SelectOption/SelectProps, empty domain value, hidden input và focus theo mục 4; DOM change handler cũ được thay bằng onValueChange. DepartmentId là string|null, positionId number|null tại API boundary như hiện tại.

**Skills:** TDD, vercel-react-best-practices, ui-ux-pro-max, playwright, verification-before-completion.

- [ ] Test trước implementation: đổi lựa chọn → đúng callback/domain value; chọn lại All/clear → ''; new FormData có một entry đúng cho mỗi name, không có sentinel; disabled không submit; reset controlled state đúng.
- [ ] Test required department theo role và current inactive option được giữ nhưng không được gán mới; lỗi email/department/position focus đúng trigger/input, kể cả sau khi pending mở khóa.
- [ ] Cài adapter mỏng bằng Themes Select. Không giữ song song một menu CSS native tự vẽ trong wrapper mới.
- [ ] Chuyển đủ 10 caller: 4 users filters/pagination, 3 create/edit fields, 2 category filters + 1 category form field. Chặn sentinel ngay trước API nếu có lỗi mapping; không coi placeholder là dữ liệu thật.
- [ ] Kiểm tra browser: keyboard/typeahead/Escape; Select trong Dialog/AlertDialog; desktop 1280×720 và mobile 375×812; ưu tiên mở dưới, chỉ flip khi không đủ chỗ; popup dài cuộn được và không tràn ngang.
- [ ] Đổi test tương tác dùng getByRole combobox/option + keyboard/click thay vì ép userEvent.selectOptions cho component không còn native. Giữ nguyên assertion về kết quả nghiệp vụ.
- [ ] Chạy `npm test -- src/shared/components/Select.test.tsx src/features/users src/app/App.test.tsx`; bổ sung category form integration test, rồi `npm run check`.

**Đầu ra:** hết phụ thuộc appearance:base-select/::picker, contract form và các role không đổi.

### Task 5 — Form và bảng nghiệp vụ thống nhất

**Files:** users/components/FormField.tsx, users/pages/UsersPage.tsx, ProfilePage.tsx; categories/pages/CategoriesPage.tsx; test pages/components và tạo CategoriesPage.test.tsx nếu chưa có.

**Interfaces:** giữ public API của FormField (label/error/children). Dùng Table/Badge/Callout/Spinner/DataList theo bảng mapping, không tự tạo datagrid wrapper.

**Skills:** ui-ux-pro-max, ui-styling, TDD cho thay đổi hành vi, web-design-guidelines lúc audit.

- [ ] Chuyển bảng, trạng thái, loading/empty/error/retry sang Themes phù hợp; giữ caption, th/row semantics, live announcements và horizontal-scroll region.
- [ ] Profile vẫn chỉ đọc; avatar/footer sidebar dùng Avatar/Text khi phù hợp, không thêm action menu.
- [ ] Bổ sung assertions filter/search/page-size vẫn về trang hợp lệ; mutation làm mất hàng khỏi filter vẫn refetch/lùi trang; 401/403/409/422 giữ thông báo/focus đúng.
- [ ] Test tên/email dài, dữ liệu rỗng, required và disabled; kiểm tra viewport nhỏ, zoom 200%, không dùng màu làm dấu trạng thái duy nhất.
- [ ] Chạy các test users/categories/profile và `npm run check`.

**Đầu ra:** các trang nghiệp vụ phổ biến dùng cùng control, feedback và bảng từ thư viện.

### Task 6 — Hoàn tất chat/OCR/layout/shared pages

**Files:** features/chat/components/ChatInput.tsx, SendButton.tsx, MessageActions.tsx, ChatSidePanel.tsx, ChatArea.tsx, AssistantMessage.tsx; chat/pages/ChatPage.tsx; ocr/pages/OcrPage.tsx; layouts/AppLayout/Header.tsx, Sidebar.tsx; pages/Workspace.tsx, ForbiddenPage.tsx, NotFoundPage.tsx, ErrorPage.tsx khi có control phổ biến.

**Skills:** ui-ux-pro-max, vercel-react-best-practices, ui-styling; TDD cho luồng tương tác bị thay; ponytail tránh refactor streaming/API.

- [ ] Chuyển button/icon button, search/text entry, status, retry/loading sang Themes; tabs/panel chỉ chuyển nếu giữ được semantics và state hiện có.
- [ ] File upload vẫn input file thật, có label và keyboard; không ép thành TextField. Giữ file accept, upload, chọn document, copy/retry/index action.
- [ ] Giữ bố cục chat, streaming và nguồn dẫn; không để submit action kích hoạt ngoài ý muốn, không mất câu hỏi khi request lỗi. Nội dung người dùng/tài liệu vẫn nguyên gốc.
- [ ] Dùng Tooltip cho trợ giúp có ích; mọi icon action vẫn có aria-label độc lập với tooltip.
- [ ] Bổ sung smoke tests chat input/send/pending/keyboard và OCR upload/copy/retry ở đúng feature; dùng MSW/boundary mock, không cần BE thật để nghiệm thu component migration.
- [ ] Chạy `npm run check`, kiểm tra nhanh toàn bộ route theo 3 role.

**Đầu ra:** không bỏ quên các control tự CSS nằm ngoài feature users.

### Task 7 — Dọn CSS/component trùng và ghi ngoại lệ

**Files:** shared/styles/styles.css, theme.css; shared/components/Button.tsx/Select.tsx và CSS cũ; các className ở caller đã migrate; README.md; tạo docs/ui/radix-guidelines.md (thêm ngoại lệ .gitignore cho tài liệu này nếu cần track).

**Skills:** ponytail, design-system, verification-before-completion, requesting-code-review.

- [ ] Lập danh sách selector cũ → caller còn lại → hành động. Xóa .button--*, custom select/option/picker, input chrome, modal overlay/focus/hover và badge/table chrome đã được Themes thay thế.
- [ ] Không xóa layout responsive, chat bubble, OCR preview/file treatment hay styling còn dùng bởi input file native. Thu hẹp global selector để không chọc vào internals của Themes.
- [ ] Không giữ CSS fallback của select cũ chỉ “phòng khi cần”. Fallback của thư viện được kiểm tra theo browser matrix, không thêm native menu tự vẽ thứ hai.
- [ ] Ghi bảng ngoại lệ cho mỗi phần custom còn lại: vị trí, nhu cầu, component Themes/Primitives đã xem, lý do không đáp ứng, token dùng lại, test/bằng chứng.
- [ ] Quy ước component mới: tra Themes trước; dùng props/token/composition; chỉ tạo custom khi có lý do được ghi. Không thêm wrapper re-export chỉ để đổi tên import.
- [ ] Ghi cách dùng Theme, SearchField/Select, empty value/validation, async AlertDialog và portal. Cập nhật README “Shared dropdown” để không còn hướng dẫn API/CSS native cũ.
- [ ] So sánh phần CSS tự bảo trì trước/sau và production bundle; không đặt tỷ lệ giảm tùy ý. Có thể tăng CSS tổng tải do stylesheet thư viện, nhưng CSS tự duy trì cho control phải giảm và không còn bản dựng trùng.

**Đầu ra:** nền UI rõ ràng, phần tự viết có giới hạn và lý do, không chỉ cài dependency rồi giữ nguyên toàn bộ CSS cũ.

### Task 8 — Nghiệm thu và bàn giao

**Files:** tạo docs/ui/radix-migration-acceptance.md, cập nhật plan/ledger và hướng dẫn .gitignore cho tài liệu nếu cần.

**Skills:** verification-before-completion, web-design-guidelines, playwright, requesting-code-review; receiving-code-review cho findings; systematic-debugging khi fail.

- [ ] Chạy `npm run check` đầy đủ; ghi số test thực tế, lint zero warning, format và production build. Không đánh dấu test dự kiến là đã chạy.
- [ ] Browser matrix: Chrome/Edge và Firefox; Safari nếu môi trường hỗ trợ, nếu không phải công khai chưa kiểm tra. Kiểm tra UI trên production preview, không chỉ Vite dev.
- [ ] Flow: login → users search/filter/create/edit/disable/activate/reset → profile/change password → logout; categories create/edit/deactivate; chat send/source/history; OCR upload/select/retry/copy. Mock cho phép nghiệm thu độc lập BE; kiểm tra role/401/403/409 giữ nguyên.
- [ ] Keyboard-only, Tab/Shift+Tab, Enter/Space, typeahead, Escape theo lớp, focus sau đóng/lỗi, scroll modal/dropdown và mobile drawer; kiểm tra desktop/mobile/zoom/reduced motion.
- [ ] Lấy Web Interface Guidelines mới khi audit; review độc lập diff, 5 Review Focus cases và danh sách ngoại lệ custom. Chỉ sửa findings thực sự ảnh hưởng task, thêm regression cho bug rồi chạy lại kiểm tra liên quan.
- [ ] Kiểm tra Git diff/whitespace, dependency lockfile, không còn import Select.css/showModal ở phần đã chuyển; chạy GitNexus detect-changes trước khi commit nếu có bước commit được yêu cầu. Báo rõ graph chưa chạy được, không coi UNKNOWN là đạt.
- [ ] Bàn giao code + guideline + acceptance + ngoại lệ + hạn chế môi trường. Không tự push/merge; không tuyên bố tích hợp BE thật.

**Đầu ra:** UI library-first đã kiểm chứng, nghiệp vụ cũ còn hoạt động và phần custom được quản lý.

## 6. Checklist skill không bỏ sót

| Skill                                                     | Khi dùng                                            | Bằng chứng cần ghi khi thực thi                                                                            |
| --------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| using-superpowers                                         | Đầu phiên                                           | Đọc skill áp dụng trước hành động                                                                          |
| brainstorming / writing-plans                             | Chốt/đổi thiết kế và plan                           | Themes đã được chọn; quyết định mới được ghi, không tự mở rộng scope                                       |
| executing-plans                                           | Thực hiện trực tiếp                                 | Task hiện tại, ledger và các quyết định; không làm lại task đã xong                                        |
| ponytail                                                  | Toàn bộ migration                                   | Dependency/wrapper tối thiểu; dùng component có sẵn trước                                                  |
| design-system                                             | Theme và quy ước chung                              | Props/token/cỡ/biến thể dùng nhất quán, bảng ngoại lệ                                                      |
| ui-ux-pro-max / ui-styling                                | Task 1–7                                            | Accessibility, state, responsive; điều chỉnh ví dụ shadcn của skill về Themes đã chọn, không tự cài shadcn |
| vercel-react-best-practices                               | Sửa React/context/handlers                          | Giữ controlled state, cleanup và boundaries; không đổi API vì refactor UI                                  |
| test-driven-development                                   | Logic adapter, validation, dialog                   | Test hành vi thất bại đúng nguyên nhân → sửa tối thiểu → pass; không tạo test chỉ kiểm tra tên class       |
| systematic-debugging                                      | Có lỗi/test fail                                    | Tái hiện và nguyên nhân trước khi sửa                                                                      |
| requesting-code-review / receiving-code-review            | Trước bàn giao/khi có finding                       | Finding, kiểm chứng, xử lý hoặc lý do giữ nguyên                                                           |
| web-design-guidelines / playwright                        | Audit/nghiệm thu                                    | Guidelines mới và browser evidence thật, nhất là portal/focus/position                                     |
| verification-before-completion                            | Trước mỗi mốc hoàn tất                              | Command, exit code, kết quả và phạm vi chưa kiểm tra                                                       |
| using-git-worktrees                                       | Trước thực thi nếu cần cách ly                      | Kiểm tra workspace và quyền/preference, giữ thay đổi hiện tại                                              |
| subagent-driven-development / dispatching-parallel-agents | Chỉ khi chọn delegation và có task độc lập          | Không giao hai agent sửa shared CSS/modal/select cùng lúc                                                  |
| finishing-a-development-branch                            | Sau khi code/test/review đạt, có nhánh cần bàn giao | Làm đúng phương thức tích hợp đã được cho phép, không hỏi lại quyền đã có                                  |

- [ ] Mỗi task ghi `task | skill đã dùng | test/review/bằng chứng | quyết định/ngoại lệ` vào ledger.
- [ ] Skill có điều kiện phải ghi đã dùng hoặc không áp dụng + lý do. Đọc tên skill không đồng nghĩa hoàn thành.
- [ ] Sau đổi phiên/compaction đọc plan/ledger/Git trước khi tiếp tục. Không tự cài thư viện hoặc chạy migration khi yêu cầu còn chỉ là lập plan.

## 7. Thứ tự, hoàn thành và ước lượng

Thứ tự: foundation → text/button/search → overlays → Select/validation → business presentation → chat/OCR/layout → CSS cleanup → acceptance. Không thay Select portal ở caller còn native modal chưa xử lý.

Hoàn thành khi: mọi control phổ biến ở các route hiện tại có mapping Themes; không còn CSS tự dựng trùng; ngoại lệ custom có lý do; UI tiếng Anh/dark theme nhất quán; 10 dropdown và các luồng form giữ đúng dữ liệu/quyền; tests/build/browser review đạt. Không yêu cầu “0 CSS” hoặc đạt một phần trăm giảm số dòng giả định.

Ước lượng sơ bộ: 4–6 ngày làm việc cho một developer quen source, gồm adapter/validation/dialog và test; chưa tính thay đổi nghiệp vụ hoặc browser không có trong môi trường. Điểm rủi ro lớn nhất là shared Button, native dialog → portal và required/empty Select, không phải việc cài package.

## 8. Tự rà soát plan

- [x] Lựa chọn Themes đã được người dùng xác nhận; Primitives không bị nhầm là thư viện có giao diện sẵn.
- [x] Có inventory, file, interface, task, test và tiêu chí hoàn thành; giữ UI tiếng Anh và nghiệp vụ.
- [x] Có bước xử lý Select empty/FormData/focus, dialog top layer, async confirm và CSS precedence.
- [x] Cả search/button/dialog/table/status lẫn chat/OCR/layout đều có task; không chỉ thay dropdown.
- [x] Có nguyên tắc hạn chế wrapper/CSS, cleanup và bảng ngoại lệ; không hứa loại bỏ toàn bộ CSS.
- [x] Checklist skill gắn với thời điểm/bằng chứng; phân biệt kế hoạch với công việc đã triển khai.
