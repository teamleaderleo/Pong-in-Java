# Pong: Forensic Chaos Edition

![Original Pong demo](pongDemo.gif)

This began as a 2015 Processing experiment in making Pong more interesting by calculating outgoing angles from where the ball hit the paddle. The dream was curve, spin, and expressive returns.

The implementation achieved something rarer: **a ball capable of occasionally rejecting collision as a concept.**

The repository now contains two versions:

- The original Java/Processing game, preserved in all its youthful confidence.
- A zero-build browser port that runs the same idea in **Legacy Chaos** or **Responsible Physics** mode.

## Play the browser version

Open `index.html` directly, or serve the folder with any static server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

The site is plain HTML, CSS, and JavaScript. It can be deployed directly to GitHub Pages, Netlify, Cloudflare Pages, or Vercel with no build command and no output-directory configuration.

### Controls

| Action | Control |
| --- | --- |
| Green paddle | `W` / `S` |
| Pink paddle | `↑` / `↓` |
| Serve | `Space` |
| Reset | `R` |
| Toggle physics mode | `C` |

## The two physics personalities

### Legacy Chaos

This deliberately preserves the spirit and several exact failure patterns of the Java version:

- Integer ball coordinates chew the decimal portion off every sine/cosine movement.
- The ball moves before collision detection asks where it went.
- Paddle zones use strict boundaries, creating four exact horizontal lines where the ball belongs to no zone.
- Spin bounces can move the ball once before collision, once inside the bounce handler, and another half-step afterward.
- Paddle collision can fire without checking whether the ball is approaching or escaping.
- Obstacle checks can reverse angles while the ball sits outside the obstacle, then another obstacle call can reverse the reversal.
- Green occasionally receives divine competitive intervention from Zeus, because friends kept picking green and apparently game balance once meant theology.

The live incident report calls out these offenses as they occur.

### Responsible Physics

This keeps the expressive bounce idea and gives it adult supervision:

- Floating-point ball positions.
- One ball movement per frame.
- Swept collision detection across the paddle face.
- Collision only while approaching the paddle.
- The ball gets placed outside the paddle after impact.
- Hit position controls the base return angle.
- Paddle vertical velocity contributes actual spin.
- Speed and vertical angle stay within playable limits.

The result remains Pong. The ball has fewer supernatural abilities.

## Forensic reconstruction: how the original ball escaped reality

A typical paddle-phasing sequence looked like this:

1. The frame drew the ball at its old position.
2. The paddle moved 9 pixels.
3. The ball moved a full step using trigonometry, then stored the result in integer `x` and `y` fields.
4. Collision detection checked only the new position. The path between the old and new positions disappeared from consideration.
5. The ball landed on one of the strict zone boundaries, where `isTop`, `isMid`, and `isBot` all returned false.
6. No bounce occurred.
7. The code noticed that the ball had entered or crossed the paddle and rewarded it with `halfMove()` in the same incoming direction.
8. On the next frame, the ball had crossed beyond the narrow overlap range and continued toward the score boundary with the serene confidence of a defendant whose paperwork was lost.

A successful angled hit could produce its own spectacle:

1. Normal frame movement.
2. Collision changes the outgoing angle.
3. The bounce method calls `move()` again.
4. The embedded-ball branch calls `halfMove()`.
5. The next rendered frame reveals the ball roughly 2.5 movement steps away from its previous appearance.

One pink top-zone switch branch even changes the angle while skipping the extra `move()` that every neighboring branch performs. A tiny artisanal inconsistency, hand-crafted for one specific strip of paddle.

## Did paddle movement actually create topspin?

Almost.

The Java version checks whether a paddle is moving and then chooses an outgoing angle from the ball's vertical hit zone. Up and down activate the same path; paddle direction never enters the angle calculation. Pressing any movement key also sets the ball speed to 9 from anywhere on the board.

So the committed code contains:

- Hit-location angle selection.
- A boolean “paddle is moving” gate.
- The spiritual promise of topspin.

The browser's Responsible Physics mode completes the original idea by adding paddle vertical velocity to the outgoing ball velocity.

## Running the original Java version

The Java code uses the Processing library. The checked-in IntelliJ module configuration references a local Windows path for Processing 3.5.4's `core.jar`, so a fresh checkout needs that dependency configured again.

The practical routes are:

1. Install Processing 3.5.4 and point the IDE at `core.jar`.
2. Add Processing Core as a managed Maven/Gradle dependency and run `Drew` as the main class.

The browser version exists partly because a Pong game deserves a lower setup burden than a small banking platform.

## Historical bug list

The original README once offered this beautifully concise status report:

> Ball sometimes goes through paddle.  
> Ball sometimes goes through obstacles.  
> Ball sometimes angles wrong.

Correct. The investigation is complete. The suspect was several suspects wearing one trench coat.

## Why preserve it?

A competent Pong clone is common. This one has personality, accidental emergent behavior, divine punishment, and a physics engine that occasionally decides the paddle is a rumor.

The browser port keeps the comedy available while placing the clean implementation beside it. The difference between the modes is the whole exhibit.
