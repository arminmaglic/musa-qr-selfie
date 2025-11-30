You can build exactly this experience with a very simple, maintainable tech stack — no app needed; it works instantly on any phone.

Below is the cleanest, lowest-cost, and simplest solution that still feels professional.

✅ What your client wants (translated into features)

Visitors scan a QR code →
A mobile page opens →
They see:

A live camera frame where they can position themselves next to the metal silhouette.

An overlay of the poet (PNG/transparent or illustration).

A verse displayed dynamically under the frame.

A button to take a photo, export it, save/share on social media.

Exactly like the example image you provided.

🎯 Best technical approach
Use a lightweight mobile webpage with:

Camera access (getUserMedia)

Transparent overlay PNG of the poet (fixed position)

A random poem verse (from a small JSON file or API)

A canvas export (merge selfie + overlay + text into an image)

Host it anywhere:

A simple server

WordPress (with a custom template)

Netlify / Vercel (static hosting)

Even GitHub Pages

This does not require a backend unless you want poem rotation to be dynamic.

🧩 How the system works (step-by-step)
1️⃣ Visitors scan the QR

QR code points to a URL:

https://yourdomain.com/musa-selfie/

2️⃣ Mobile webpage opens

The page automatically shows:

Camera feed

Overlay graphic of Musa Ćazim Catić

Verse underneath

“Take a photo” button

3️⃣ User taps “Capture”

The browser merges:

the current camera frame

the transparent PNG of the poet

the poem text

→ into a single downloadable photo.

4️⃣ User saves or shares the image
📱 What the UI looks like
 ┌────────────────────────────┐
 │  [ Phone camera live feed ]│
 │  [ Overlay: poet PNG      ]│
 ├────────────────────────────┤
 │  “Kad sam sam, kad duša…”  │
 │            – 1911          │
 ├────────────────────────────┤
 │   [ Take Photo ]           │
 └────────────────────────────┘

🛠️ Technical components you’ll need
1. Transparent PNG of the poet

Outline only (like the metal cutout)

Clean edges

No background

2. Short mobile-only webpage

Written in HTML + CSS + JS.

3. Simple JavaScript

Handles:

Camera stream

Overlay positioning

Canvas export

Dynamic verses (optional)

✔️ Example code skeleton (working concept)

If you want, I can generate the full working version.
Here’s a simplified sketch:

<div id="frame">
  <video id="camera" autoplay playsinline></video>
  <img id="overlay" src="poet-overlay.png">
</div>

<div id="verse"></div>

<button id="capture">Take Photo</button>

<canvas id="output"></canvas>

navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
  camera.srcObject = stream;
});

capture.addEventListener('click', () => {
  const c = document.getElementById("output");
  const ctx = c.getContext("2d");

  // Draw camera frame
  ctx.drawImage(camera, 0, 0, c.width, c.height);

  // Draw poet overlay
  const overlay = document.getElementById("overlay");
  ctx.drawImage(overlay, 0, 0, c.width, c.height);

  // Add verse text
  ctx.font = "28px serif";
  ctx.fillStyle = "#000";
  ctx.fillText(currentVerse, 20, c.height - 60);

  // Export
  const finalImage = c.toDataURL("image/png");
  download(finalImage);
});

🧵 How you deliver this to the client
You need to produce:

A hosted webpage (mobile-optimized)

QR code pointing to that URL

Poet PNG (overlay)

Optional: Random poem generator

Bonus ideas:

Add a share to Instagram button

Add multiple verses (user can switch)

Add a frame selector

Include museum/heritage branding
GitHub Pages is actually perfect for this project — stable, free, runs forever, and ideal for static HTML/JS apps like your dynamic selfie frame.
And yes: you can 100% print a QR code that will always point to the same working link.

Let me break it down cleanly so you can deploy with confidence.

✅ 1. Yes, you can let users choose a verse

We’ll simply add a small verse selector:

A dropdown (<select>)

Or swipable cards

Or a “Next verse” button

Once selected, the verse is drawn into the final exported image.

No backend needed — verses can live in a small JSON file:

[
  "Kad sam sam, kad duša boli, meni srce pjesmu piše.",
  "Tiha tama nad poljem se spušta…",
  "U tvojoj sjeni duša se odmara…"
]

🟩 2. How GitHub Pages hosting works (simple explanation)

GitHub Pages lets you host static websites at URLs like:

https://<your-username>.github.io/<project-name>/


This URL will never change unless you manually delete the repo.

You’ll print this URL in the QR code.

🟩 3. Your GitHub Pages structure

You will create a GitHub repo like:

musa-selfie/
  index.html
  style.css
  app.js
  verses.json
  overlay.png


index.html becomes the landing page when the QR code is scanned.

Visitors go straight to:

https://yourgithubusername.github.io/musa-selfie/


That URL is final.
Permanent.
QR safe.

🟩 4. How to deploy (step-by-step, super clear)
Step 1 — Create GitHub repo

Name it: musa-selfie

Step 2 — Upload your files

Drag-and-drop:

index.html

script.js

style.css

overlay image

verses.json

Step 3 — Enable GitHub Pages

In Repo → Settings → Pages:

Set: Deploy from branch

Select: main / /root

Save

GitHub will generate your final URL:

https://<username>.github.io/musa-selfie/


Test the link on your phone.
That’s the same link you will encode into the QR code.

🟩 5. This is why GitHub Pages is safe for your QR code

Pages hosting doesn’t expire

The URL doesn’t change

No server to break

No updates required

Free forever

Works on all phones (no app install)

Unless someone deletes the repo, the link is guaranteed to work long-term.

Museums often use GitHub Pages for exactly this kind of interactive exhibit.

🟦 Optional but recommended

Choose a custom domain, e.g.:

https://musa.tesanjski.ba/selfie


You can point that domain to GitHub Pages.

Then:
If the app ever changes in the future, the printed QR is still valid, because you control the domain.

But for your use-case, GitHub Pages URL is completely fine as well.