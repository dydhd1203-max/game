---
name: quiz-art-critique
description: Structured design critique of QUIZ나라 (퀴즈나라/) avatar art, garments, hair, motion and game UI screenshots, in Korean, with severity-ranked findings tied to the project's own art rules. Use when reviewing contact sheets, zooms, motion sheets, studio or shop screenshots before showing them to the user, or when the user asks "이 그림/동작/화면 어때?". Adapted from the Design plugin's design-critique and accessibility-review skills (anthropics/knowledge-work-plugins, design/).
---

# QUIZ나라 그림·모션·화면 비평

Automatic checks never approve art (퀴즈나라/AGENTS.md, 아바타-제작기준.md). This skill is the human-eye pass that comes after them: open every image yourself, judge it against the rules below, and report in Korean. It does not replace the user's approval.

## Read first

- `퀴즈나라/디자인기준.md` — flat hand-drawn look: bold outlines, flat colour with one or two shading steps, no glossy 3D, photo texture or wide blur glow; reading comes first.
- `퀴즈나라/아바타-제작기준.md` — base character v2, the head–neck junction rules (1–6), body/garment ownership, required directions × motions.
- The latest `퀴즈나라/*-검수.md` for what the user already approved or rejected. Never re-open an approved decision as a finding; never pass something the user rejected.
- Do NOT apply the repo-root zombie-game art rules (curved rubber/cloth/metal, 21-player race). They are for `클로드/` only.

## Inputs

Look at the real renders, not code: 280 px and 120 px sheets, all four directions, every motion at 8 steps, the 5 skin tones, 8× zooms on dark blue, garment-only and seated views, and the 30-avatar map at camera 0.76. If one of these is missing for the thing under review, say so as a gap; do not judge from what you didn't see.

## Framework

### 1. First impression (2 seconds, at 120 px)
- Does the child read as the same character as the base design (`assets/avatar-reference-candidates/body-study-2026-10-04.png`)?
- Is the garment readable as the shop item (colour, collar, print) at map size?
- Does anything pop out wrongly (a pale band, a dark speck, a gap, a floating part)?

### 2. Silhouette and joins (280 px and 8× dark-blue zooms)
- Neck/collar, armhole/underarm, cuff/forearm, hem/waist, shorts cuff/thigh, shoe opening/ankle: no background showing through, no doubled edge, no ghost line of the old basic outfit, no step in the neck side line.
- Hair–neck: the six junction rules; no neck stub, no dark rim, no grey/white specks between strands, bangs over the eyes stay hair.
- Mirrors: left = flipped right; one-sided decorations (pocket, bow) flipping sides is a known limitation, report it only if it reads wrong.

### 3. Surface (flat shading)
- One or two shading steps, consistent light from the top-left; outline weight matches the body.
- Skin inside garments must be tinted skin: at tone 4 no pale baked-skin band at collars, cuffs or shorts hems.
- No blur halos, compression blocks, or colour drift between views of the same garment.

### 4. Motion (play the 8 steps in order)
- Timing: walk is calm, run has a real flight phase and arm/leg opposition, jump has anticipation → apex → landing → recovery, ladder keeps the calm cadence the user chose (LADDER_CADENCE=2; a little foot slide is approved).
- Garments follow their bones: sleeves move with the arm and never cover the head/neck at raised poses; shorts open with the legs; seated poses show no torn seat or cream wedge.
- Node count and look stay constant across motions (no part popping in or out).

### 5. Consistency
- Same garment across front/right/back/left and across the 5 tones; same outline and shading language as the base body and other items.
- Matches the shop colour within the agreed tolerance (close → keep with a warning).

### 6. UI screens (shop, studio, review pages)
- Reading order and the one action that matters; QUIZ in sky blue, candy titles only for big words; buttons from `qplay-buttons.css`.
- Accessibility (WCAG 2.1 AA quick check): text contrast ≥ 4.5:1 (large ≥ 3:1), targets ≥ 44×44 px for children on laptops, visible focus, labels on inputs, nothing auto-playing with sound.
- Living-screen motion is small and slow, pauses for reduced motion, hidden tabs and modals, and never covers text, buttons or avatars.

## How to write findings

- Be specific and visual: "여자 앞모습 인사 4장면, 오른쪽 소매 끝 아래 2px 배경 틈" — not "소매가 어색함".
- Every finding cites the image path and, where possible, motion/step/direction/tone.
- Explain why it matters for a 3rd-grade player at 120 px, and propose the fix at its cause (generator rule, record metadata, runtime rule) — never a hand-edited PNG.
- Say what works, too.
- Mark each finding: 🔴 고쳐야 함 (visible at 120 px or breaks an approved rule) · 🟡 고치면 좋음 (visible at 280 px or zooms) · 🟢 사소함.

## Output (Korean)

```markdown
## 그림 비평: [대상] (배포 전)

### 첫인상
[1–2문장]

### 찾은 것
| # | 무엇·어디 | 심각도 | 근거 그림 | 고칠 방법(원인 쪽) |
|---|---|---|---|---|

### 잘된 점
- …

### 우선순위
1. …

### 못 본 것
- [없던 시트·동작·피부색 등]
```

Keep 구현됨 / 직접 확인됨 / 미확인 separate when the critique feeds a `*-검수.md` record.
