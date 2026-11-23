# Five-week roadmap and budgeted hours — v2 (Nov 14, 2026)

The course expects approximately 40–60 hours **per person**. This plan targets about 50 hours. v2 adds inventory and grocery planning (P1), so the cut line matters: **P0 must be stable before P1 work starts**, and P1 may be demonstrated partially if clearly labelled. Backlog IDs refer to [BACKLOG.md](BACKLOG.md).

| Week | Dates | Focus | Target evidence | Backlog | Hours |
|---|---|---|---|---|---|
| 1 | Nov 9–15 | Scope, docs, scaffold, labelled simulated demo of all five areas | Docs, passing tests/build, screenshots, portfolio progress card | SKH-01–06 (partial), SKH-19 | 9 |
| 2 | Nov 16–22 | Scan pipeline + structured recipes | Pi camera photo (or labelled fallback), upload validation, vision/mock adapter, confirm/edit UI with quantity entry, structured seed recipes, full recipe view | SKH-02, 03, 05, 07, 08, 09 | 12 |
| 3 | Nov 23–29 (Thanksgiving Nov 26) | Discovery + persistence | Quantity-aware matching with ranking reasons, time/servings filters, TheMealDB adapter, SQLite inventory, grocery list basics | SKH-04, 10, 11, 12, 13, 16 | 12 |
| 4 | Nov 30–Dec 6 | Inventory actions + integration | Deduction preview/confirm/undo, low-stock indicators, Pi touchscreen kiosk, timers/error states; **demo freeze Dec 6** | SKH-14, 15, 17, 18 | 12 |
| 5 | Dec 7–13 | Show-and-tell, validation, documentation | Dec 7 demo; final portfolio Dec 13 | SKH-20 | 5 |
| | | **Total** | | | **50** |

If behind schedule, cut in this order: timers (SKH-18) → low stock (SKH-15) → TheMealDB (SKH-10, keep seed recipes) → deductions undo UI polish. Never cut P0 items or simulation labelling.

## Week 1 status (recorded Nov 14, 2026)
| Planned | Target date | Actual status |
|---|---|---|
| Lock vision + budget, define P0/P1/P2, initial architecture | Thu Nov 12 | Done (v1). Scope revised to v2 on Nov 14 (ADR-007). |
| Initialize repository, CLAUDE.md, backend/frontend scaffold, tests | Fri Nov 13 | **Partial.** Scaffold, CLAUDE.md, and 5 backend tests exist (scaffold generated with ChatGPT on Nov 12 per journal). **Git repository not yet initialized**; no GitHub URL. |
| Simulated scan → recipe → cooking demo, screenshot, log blockers | Sat Nov 14 | **Partial.** Flow exists; backend tests (5 passed) and frontend build verified Nov 14. Not yet run/screenshotted in a browser by the owner. Inventory and grocery demo screens (SKH-19) not built. |
| Portfolio link update and submit | Sun Nov 15 11:59 PM | Not started. Needs GitHub URL. Week 6 quiz, reflection PDF, and learning-group minutes are separate class obligations. |

## Week 2 status (recorded Nov 22, 2026)
| Planned | Actual status |
|---|---|
| Pi camera photo (or labelled fallback) | **Partial.** Pi 5, touchscreen and Arducam IMX708 acquired and configured; camera ribbon-cable connectivity troubleshot; test image captured on the Pi. Not connected to the app; the labelled simulated scan remains the in-app path. |
| Upload validation, vision/mock adapter | Not started. |
| Confirm/edit UI with quantity entry | Done earlier (Week 1, simulated scan → verify amounts). |
| Structured seed recipes, full recipe view | Done earlier (Week 1). |
| Pi touchscreen kiosk (W4, SKH-17) | Hardware in hand; app not yet run on the Pi display. |

## Major dependency gates
- Hardware order: verify stock and delivered price; order early in Week 2 at the latest to allow troubleshooting.
- Camera smoke test before AI integration.
- User confirmation before matching or saving to inventory.
- Structured recipe schema (SKH-03) before full recipe view, quantity matching, or deductions.
- SQLite persistence (SKH-12) before deductions (SKH-14) and low stock (SKH-15).
- Seed recipes and cooking guide working before provider complexity.
- Dec 6 working demo freeze before the Dec 7 presentation; stretch features only afterward if safe.

## Weekly retrospective prompts
What worked? What broke? What did Claude implement? What did I verify myself? What changed in scope? What happens next?
