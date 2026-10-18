# Creating Flow — BaByLon 1.44.5

## Usage
1. Reload BaByLon in chrome://extensions (or the browser extensions manager).
2. Open a Google Flow project and leave its composer visible.
3. Open Creating Flow in BaByLon. For a long batch, use “Mở cửa sổ chạy riêng”.
4. Choose image/video and the intended Flow project. Paste one prompt per line (maximum 100).
5. Choose an output directory, then click “Bắt đầu tạo & tải”.
6. Keep this window open. Do not manually generate or run Flow Auto in the same project during the batch.

Files are streamed to the selected directory, named 1.png / 2.png or 1.mp4 / 2.mp4 etc., using the actual response MIME. Numbering follows successful sequential saves, not prompt indices. Existing numbered files make numbering continue after the highest number. Canceling the folder picker does not start a batch. Stopping aborts local processing; it cannot cancel an already submitted Google generation.

## Implementation / limits
AI Studio was removed and replaced with Creating Flow. Shared AI Hub and legacy Flow Auto remain for other tools. Generation uses the signed-in Flow page, not the configured AI Hub keys. Native image/video controls are selected when recognizable; Agent mode receives an explicit image/video instruction. The adapter refuses ambiguous controls and never retries a submission automatically.

The queue runs sequentially. New DOM media must be stable across three polls; preexisting media URLs and nodes are excluded. Multiple outputs are collected until no visible progress and 12 seconds without a newly saved output. This is a DOM heuristic, not a server-confirmed Flow job boundary. Recycled nodes, virtualized old results, custom player layouts, canvas-only images, MediaSource blobs and protected URLs may be unsupported. Concurrent manual generation can cause ambiguity. As of 1.44.3, downloads use the new result card menu, selecting an identifiable original/default quality; no paid upscale is requested. The download link emitted by that menu is streamed to the selected directory. Unknown menu layouts or quality choices stop with a specific error; there is no thumbnail fallback.

Prompts/results are stored in extension-local storage. Folder authorization must be selected again after the interface reloads. Closing a popup can interrupt processing; use the standalone window. No auto-resume submits prompts after restart.

## Validation (2026-10-18)
- 8 Node regression tests passed: parsing, URL allowlist, numbering, preservation, failed/empty download cleanup, abort, MIME, source close on preflight failure.
- Chrome headless fixture passed: two actual image files streamed to browser filesystem as 1.png and 2.png; two submissions; existing image excluded; video result detection and 300 KB blob transfer in <=128 KB messages; competing session rejected.
- Evidence: .test-artifacts/1792288126757/results.json and creating-flow.png (ignored by Git).
- All 23 root JavaScript modules passed node --check; referenced JS/CSS files exist; git diff --check passed.
- HTML IDs checked case-sensitively; translatorSrtFileName and translatorSrtFilename are distinct existing IDs. Creating Flow has no duplicate IDs.
- Live authenticated Flow generation NOT tested. No Google credits consumed during validation. Fixture video uses simulated metadata, not an end-to-end generated/decoded video.
- No commit/push performed for this feature. Only BaByLon files modified.

Run tests:
    node --test tests/creating-flow.test.cjs
    node --experimental-websocket tests/creating-flow.browser.cjs
## 1.44.1 — 2026-10-18
- Fixed project discovery for flow.google.com/project/... (the URL in the user's screenshot); retained flow.google and labs.google support and strict hostname checking.
- Start refreshes the open project list before validation, avoiding stale empty dropdowns.
- Creating Flow wait choices are now 1/2/3 minutes, default 3. Saved older 5/10/20-minute choices migrate to 3 minutes. This is a generation wait limit, not a promise of Google generation speed or a video duration setting; file transfers may take additional time.
- Node regression covers the screenshot hostname and malicious suffix rejection. Browser fixture now uses flow.google.com URLs.
## 1.44.2 — Flow submission handling
- Page adapter now returns a serializable driverError/action/message envelope. Extension UI reports the actual stage/error instead of losing thrown injected-script errors behind the generic no-response message.
- Prompt is filled before locating the final submit button. Re-query composer/button after React updates, wait up to four seconds for enablement, and click only once.
- Recognize one unlabeled SVG button in the bottom-right of the composer when no named submit control is present. Ambiguous controls still stop the run.
- Tests cover the normal two-prompt fill/click/save sequence plus an unlabeled SVG submit control; no authenticated live Flow run.
## 1.44.3 — Agent confirmation and card download menu
- An initial click that only opens/reparents the Agent composer is not treated as a submitted generation. The relocated editor containing the same complete prompt gets its own send click. Unchanged editors are never blindly resubmitted. Success requires an empty live composer or a new result; unacknowledged clicks report a stage-specific error after eight seconds.
- The Agent setting survives the panel transition within the owned session; long prompt composer panels are supported.
- For every new result: find its own card, open ⋮, choose Tải xuống, choose a recognized original/default submenu item, capture the download link emitted by that action, and stream to the user-selected folder with numbered names. Limited scoped interception is restored after the menu operation, including cancel/error. Blob URLs remain alive through streaming and are released afterward.
- Only mark a prompt complete after successful file close. A failed save retains its error alongside any files already saved. No silent preview-image fallback.
- Supported browser download mechanisms: download anchors, direct menu links, and identifiable blob/download window.open URLs. Other site mechanisms or ambiguous menu structures require adapter updates; live authenticated Flow remains unverified.
- Eight Node tests passed. Updated Chrome fixture simulates the Agent opening without submitting, unlabeled SVG arrow, menu + quality submenu, preview 320px versus original 640px, and verifies first file close before second prompt submission. No Google quota used. First run exposed a test folder-picker readiness race; fixture now waits until folder selection is fully settled before starting.
- Changes limited to BaByLon. No commit or push.
## 1.44.4 — Sequential barrier and native submit fallback
- Submit is blocked while awaiting the current result. Each result is acknowledged only after its file writer closes; complete requires all seen result keys saved and no visible generation progress. The UI awaits this barrier before sending the next prompt. Errors never skip to the next prompt.
- If synthetic clicks leave the exact prompt unchanged with no progress/result, the driver returns a pending native-click request. The extension attaches chrome.debugger only to the selected Flow tab, revalidates the field/button/coordinates and hit target, sends one mouse press/release, and confirms the prompt was consumed or a new result appeared. It detaches only its own connection. Existing debugger sessions cause a clear error and are not detached. No new permissions: debugger was already declared.
- Reference: https://developer.chrome.com/docs/extensions/reference/api/debugger and https://chromedevtools.github.io/devtools-protocol/tot/Input/ .
- Browser regression includes a top-level fixture rejecting untrusted JS click events; actual CDP mouse events must submit exactly once. Attempts to submit the next prompt or complete without a saved image must fail. This tests the actual mouse event path, not authenticated Google Flow or Chrome extension attach permissions in a user's profile.
- Eight core tests, JS syntax and whitespace checks passed. No real Flow generations, commits or pushes performed.
## 1.44.5 — Real hover and explicit 2K download
- Replaced synthetic hover with staged Chrome Input mouse events: hover the large result card, click its ellipsis, hover Download, click exactly the enabled 2K item. Never silently select 1K/4K when 2K is absent or locked. This supersedes earlier original/default-quality selection.
- The existing debugger permission is used only for the selected Flow tab; preexisting attached sessions are not taken over. All stage coordinates are checked for obstruction. The download handler remains scoped to the 2K click and restores interceptors on success/cancel/error or timeout.
- Tiny Agent-chat previews are excluded from fresh downloadable results; choose the largest matching result rendering for the card menu.
- Allow up to three minutes for Flow to prepare the requested 2K download. Saving a finished file extends the settling window so time spent preparing 2K does not falsely mark an otherwise completed prompt as failed. The next prompt still requires successful save acknowledgment and completion barrier.
- Chrome fixture PASS: .test-artifacts/1792290504360. Ellipsis is hidden with display:none until actual CSS :hover; Download submenu opens only for trusted pointer events. A 1K distractor and 2K option coexist. Actual downloaded PNGs decode to 2048px width, twice, with prompt 2 sent after first file close. CDP event bridge uses real browser Input events; chrome.debugger attach permissions are mocked. Initial test bridge needed Runtime enabled after navigation before binding mouse requests.
- Eight core tests, JavaScript syntax, diff checks passed. Live authenticated Google Flow / real 2K generation remains unverified. No other folders changed; no commit or push.
## 1.44.6 — Native input synchronization and send diagnostics
- Screenshot still showed nativeConfirm timeout with text remaining in the Agent composer. Root cause on authenticated Flow is not established; existing gallery output is not proof that the current prompt was accepted.
- Before the native fallback click, focus/select the exact unchanged pending prompt and replace it with the same text through Chrome Input.insertText. This provides browser-generated input events to editors that did not synchronize synthetic DOM input. Changed fields/text or visible progress stop this operation.
- Re-measure and hit-test the send button after mouse movement, and separate press/release by 80ms. Capture trusted pointerdown/up/click on the intended button; confirmation failures now distinguish a received click from a missed click without logging prompt content. Remove listeners on confirmation, failure or session release.
- Preserve sequential generation/save barrier and explicit hover card > ellipsis > hover Download > 2K workflow. No commit/push and no changes outside BaByLon.
- Validation: eight core tests PASS; JavaScript syntax PASS; isolated Chrome fixture PASS (.test-artifacts/1792290940670), including real trusted input, a button moving 30px before remeasurement, actual trusted click receipt, two 2048px downloads, and save-before-next-prompt. Chrome extension attach transport is mocked; authenticated Google Flow remains unverified.
## 1.44.7 — Immediate native send and exposed menu targets
- Production submit now prepares a native send immediately after input/button readiness. It no longer waits through the synthetic click's eight-second timeout before using Chrome mouse input. Confirmation still waits after the click; no generation-speed guarantee.
- If the first native click opens/relocates the Agent composer with the exact prompt retained, identify the new bottom-right send button and perform one further native send. At most two stages; unchanged unconfirmed input stops rather than blindly resubmitting.
- Menu hit testing checks several exposed points inside the exact intended control, clipped to viewport. Wait up to three seconds for Download/2K animation/temporary obstruction; advance phase only after finding an exposed point. Never click through an overlay or select another quality.
- Validation: eight core tests, syntax and diff checks PASS. Chrome fixture PASS .test-artifacts/1792291363535: production native-first batch, two 2048px outputs, file-close before next prompt, full temporary menu overlay and center obstruction, native input/moving button checks and sequential barriers. Earlier fixture failed because its fixed iframe extended below Chrome's default viewport; set explicit 1100x1000 test window. This is not evidence of an authenticated Flow run. Real site menu structure remains to be verified by user.
- Only BaByLon files changed. No commit/push.
## 1.44.8 — User-selected starting filename number
- Added Số bắt đầu (default 1) in popup, sidepanel and standalone Creating Flow. Persist in draft and lock during a batch. Starting at 4 produces 4,5,6 for three successful saves; starting at 1 produces 1,2,3. Higher existing numbers do not change the user's selection.
- Batch counter advances only after successful writer close; actual MIME determines extension. Existing exact filenames cause a stop without overwrite. Positive safe integer validation runs before generation and before file creation.
- Validation: nine core tests PASS, including three saves from 1 and 4 with existing 99.png, collision preservation and invalid inputs. JS syntax PASS. No live generation required for this filename-only change. No other folders modified; no commit/push.