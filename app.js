document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const verseText = document.getElementById('verse-text');
    const btnCapture = document.getElementById('btn-capture');
    const btnChangeVerse = document.getElementById('btn-change-verse');

    let verses = [];
    let currentVerseIndex = 0;

    // ─────────────────────────────────────────────────────────────────────────
    // Camera sensor rotation offset.
    //
    // Android front cameras expose a raw stream that is NOT automatically
    // rotated to match the screen. The sensor is physically mounted at a fixed
    // angle — typically 90° CW from the device's natural (portrait) orientation.
    // iOS browsers correct this automatically; Android browsers do not.
    //
    // We detect the offset once after stream metadata loads:
    //   - Stream is landscape while viewport is portrait → sensorRotationCW = 90
    //   - Stream matches viewport → sensorRotationCW = 0  (iOS / desktop)
    //
    // We then combine that with the live device rotation angle (screen.orientation)
    // to compute the exact correction needed in any orientation.
    // ─────────────────────────────────────────────────────────────────────────
    let sensorRotationCW = null; // null = not yet detected

    init();

    // ── Fullscreen ────────────────────────────────────────────────────────────
    function requestFullScreen() {
        const docEl = document.documentElement;
        const rfs = docEl.requestFullscreen || docEl.mozRequestFullScreen ||
                    docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        if (rfs) rfs.call(docEl).catch(err => console.log('Fullscreen:', err.message));
    }
    document.addEventListener('click',      () => requestFullScreen(), { once: true });
    document.addEventListener('touchstart', () => requestFullScreen(), { once: true });

    // ── Orientation helpers ───────────────────────────────────────────────────

    /**
     * Returns the current device rotation in degrees CW from its natural
     * (portrait) orientation.
     *
     * screen.orientation.angle is the authoritative source per W3C spec:
     * "the angle of the current screen orientation relative to the default
     * screen orientation, expressed as degrees going clockwise."
     *   0   → portrait (natural)
     *   90  → landscape, device rotated 90° CW  (top points right)
     *   180 → portrait, upside-down
     *   270 → landscape, device rotated 90° CCW (top points left)
     *
     * Fallback: window.orientation uses the OPPOSITE sign convention (CCW = +)
     * so we negate it to convert to CW.
     */
    function getDeviceAngleCW() {
        if (screen.orientation && screen.orientation.angle != null) {
            return screen.orientation.angle;
        }
        const wo = typeof window.orientation === 'number' ? window.orientation : 0;
        return ((wo * -1) % 360 + 360) % 360;
    }

    /**
     * How many degrees CW must the raw stream be rotated so it appears upright?
     *
     * The camera sensor is fixed at sensorRotationCW degrees CW from "natural up".
     * When the device is rotated deviceAngleCW degrees CW, the correction is:
     *
     *   correctionCW = (360 - sensorRotationCW - deviceAngleCW) mod 360
     *
     * Examples with sensorRotationCW = 90 (typical Android front camera):
     *   deviceAngle   0° (portrait)         → correction 270° (= -90° CCW) ✓
     *   deviceAngle  90° (landscape CW)     → correction 180°
     *   deviceAngle 270° (landscape CCW)    → correction   0° (no rotation needed)
     *   deviceAngle 180° (portrait flipped) → correction  90°
     */
    function getStreamCorrectionCW() {
        if (!sensorRotationCW) return 0;
        const deviceAngle = getDeviceAngleCW();
        return ((360 - sensorRotationCW - deviceAngle) % 360 + 360) % 360;
    }

    // ── Orientation change listeners ──────────────────────────────────────────
    window.addEventListener('resize', updateCameraTransform);
    window.addEventListener('orientationchange', () => {
        // Small delay — some browsers fire before screen.orientation.angle updates
        setTimeout(updateCameraTransform, 100);
    });

    // ── Asset preloads ────────────────────────────────────────────────────────
    const cornerImg  = new Image(); cornerImg.src  = 'elements/corner.svg';
    const peroImg    = new Image(); peroImg.src    = 'elements/pero.svg';
    const knjigaImg  = new Image(); knjigaImg.src  = 'elements/knjiga.svg';

    // ── Init ──────────────────────────────────────────────────────────────────
    async function init() {
        try {
            await startCamera();
            await loadVerses();
        } catch (error) {
            console.error('Initialization error:', error);
            alert('Molimo dopustite pristup kameri za korištenje aplikacije.');
        }
    }

    // ── Camera ────────────────────────────────────────────────────────────────
    async function startCamera() {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width:  { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720  }
            },
            audio: false
        });
        video.srcObject = stream;

        // Wait for real dimensions — videoWidth/Height are 0 until loadedmetadata.
        video.addEventListener('loadedmetadata', () => {
            detectSensorOffset();
            updateCameraTransform();
        }, { once: true });
    }

    /**
     * Detect the camera sensor's fixed CW rotation offset relative to the
     * device's natural (portrait) orientation. Called once after stream loads.
     *
     * We account for the current device angle so detection works even if the
     * user has already rotated to landscape before opening the app.
     */
    function detectSensorOffset() {
        if (sensorRotationCW !== null) return; // already detected

        const srcW = video.videoWidth;
        const srcH = video.videoHeight;
        if (!srcW) return;

        const viewIsLandscape   = window.innerWidth > window.innerHeight;
        const streamIsLandscape = srcW > srcH;

        if (viewIsLandscape === streamIsLandscape) {
            // Both match → stream is already correctly oriented (iOS / desktop)
            sensorRotationCW = 0;
        } else {
            // Mismatch → Android-style 90° sensor offset
            sensorRotationCW = 90;
        }

        console.log(`[camera] sensor offset: ${sensorRotationCW}° CW | ` +
                    `stream: ${srcW}×${srcH} | device: ${getDeviceAngleCW()}°`);
    }

    // ── Live preview transform ────────────────────────────────────────────────
    function updateCameraTransform() {
        if (sensorRotationCW === null && video.videoWidth) detectSensorOffset();

        const corrCW = getStreamCorrectionCW();
        video.style.transformOrigin = 'center center';

        if (corrCW === 0) {
            // No rotation needed — just selfie mirror
            video.style.transform = 'scaleX(-1)';

        } else if (corrCW === 90) {
            // 90° CW + mirror. After the rotation width/height are swapped,
            // so scale by (containerW / containerH) to cover the container.
            const cw = video.offsetWidth  || video.parentElement.offsetWidth  || window.innerWidth;
            const ch = video.offsetHeight || video.parentElement.offsetHeight || window.innerHeight;
            const s  = (cw > 0 && ch > 0) ? cw / ch : 1;
            video.style.transform = `rotate(90deg) scaleX(-1) scale(${s})`;

        } else if (corrCW === 180) {
            // 180° = just flip vertically (mirror + vertical flip = scaleY(-1))
            video.style.transform = 'scaleY(-1)';

        } else {
            // 270° CW = -90° CCW. This is the common Android portrait case.
            // Scale by (containerH / containerW) to cover the portrait container.
            const cw = video.offsetWidth  || video.parentElement.offsetWidth  || window.innerWidth;
            const ch = video.offsetHeight || video.parentElement.offsetHeight || window.innerHeight;
            const s  = (cw > 0 && ch > 0) ? ch / cw : 1;
            video.style.transform = `rotate(-90deg) scaleX(-1) scale(${s})`;
        }
    }

    // ── Verses ────────────────────────────────────────────────────────────────
    async function loadVerses() {
        try {
            const response = await fetch('verses.json');
            verses = await response.json();
            if (verses.length > 0) displayVerse(0);
        } catch (err) {
            console.error('Error loading verses:', err);
            verseText.innerText = 'Greška pri učitavanju stihova.';
        }
    }

    function displayVerse(index) {
        if (verses.length === 0) return;
        currentVerseIndex = index % verses.length;
        verseText.innerText = `"${verses[currentVerseIndex]}"`;
    }

    btnChangeVerse.addEventListener('click', () => displayVerse(currentVerseIndex + 1));
    btnCapture.addEventListener('click', takePhoto);

    // ── DOM → canvas coordinate mapping ──────────────────────────────────────
    function computeCaptureLayoutFromDom(canvasEl) {
        const frameOverlay   = document.getElementById('frame-overlay');
        const heading        = document.getElementById('app-heading');
        const verseContainer = document.getElementById('verse-container');
        if (!frameOverlay) return null;

        const vw = window.innerWidth  || document.documentElement.clientWidth  || 1;
        const vh = window.innerHeight || document.documentElement.clientHeight || 1;
        const sx = canvasEl.width  / vw;
        const sy = canvasEl.height / vh;

        const mapRect = r => ({ x: r.left * sx, y: r.top * sy, width: r.width * sx, height: r.height * sy });
        const getRect = sel => {
            const el = typeof sel === 'string' ? frameOverlay.querySelector(sel) : sel;
            return el ? mapRect(el.getBoundingClientRect()) : null;
        };

        return {
            frame:       mapRect(frameOverlay.getBoundingClientRect()),
            heading:     heading        ? mapRect(heading.getBoundingClientRect())        : null,
            headingText: heading        ? heading.innerText : 'Spomen soba Musa Ćazim Ćatić Tešanj',
            verse:       verseContainer ? mapRect(verseContainer.getBoundingClientRect()) : null,
            lines:   { top: getRect('.line-top'), bottom: getRect('.line-bottom'), left: getRect('.line-left'), right: getRect('.line-right') },
            corners: {
                topLeft:     { ...getRect('.corner-top-left'),     angle: 0   },
                topRight:    { ...getRect('.corner-top-right'),    angle: 90  },
                bottomLeft:  { ...getRect('.corner-bottom-left'),  angle: -90 },
                bottomRight: { ...getRect('.corner-bottom-right'), angle: 180 }
            },
            decorations: { pero: getRect('.decoration-pero'), knjiga: getRect('.decoration-knjiga') }
        };
    }

    // ── Draw video into frame ─────────────────────────────────────────────────
    /**
     * Renders the raw camera stream into frameRect on ctx, applying corrCW
     * degrees of CW rotation plus a selfie mirror — exactly matching what
     * the user sees in the live preview.
     */
    function drawOrientedVideoToFrame(ctx, frameRect, corrCW) {
        const srcW = video.videoWidth;
        const srcH = video.videoHeight;
        if (!srcW || !srcH) return;

        // The intermediate canvas has the correctly-oriented dimensions.
        // A 90° or 270° correction swaps width and height.
        const needsSwap = corrCW === 90 || corrCW === 270;
        const oCanvas = document.createElement('canvas');
        oCanvas.width  = needsSwap ? srcH : srcW;
        oCanvas.height = needsSwap ? srcW : srcH;

        const oCtx = oCanvas.getContext('2d');
        oCtx.translate(oCanvas.width / 2, oCanvas.height / 2);
        oCtx.scale(-1, 1);                                   // selfie mirror first
        if (corrCW !== 0) {
            // rotate() takes CCW radians; corrCW is CW degrees, so negate.
            oCtx.rotate(-corrCW * Math.PI / 180);
        }
        oCtx.drawImage(video, -srcW / 2, -srcH / 2, srcW, srcH);

        // Scale-to-fill frameRect, centred, clipped to frame bounds
        const scale = Math.max(frameRect.width / oCanvas.width, frameRect.height / oCanvas.height);
        const drawW = oCanvas.width  * scale;
        const drawH = oCanvas.height * scale;
        const drawX = frameRect.x + (frameRect.width  - drawW) / 2;
        const drawY = frameRect.y + (frameRect.height - drawH) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(frameRect.x, frameRect.y, frameRect.width, frameRect.height);
        ctx.clip();
        ctx.drawImage(oCanvas, drawX, drawY, drawW, drawH);
        ctx.restore();
    }

    // ── Text helpers ──────────────────────────────────────────────────────────
    function fitFontSize(ctx, text, maxWidth, preferred, minSize) {
        let size = preferred;
        while (size > minSize) {
            ctx.font = `italic ${size}px Georgia`;
            if (ctx.measureText(text).width <= maxWidth) break;
            size -= 1;
        }
        return size;
    }

    function wrapText(ctx, text, maxWidth, lineHeight, maxLines = Infinity) {
        const words = text.split(' ');
        let line = '', lines = [], truncated = false;
        for (let n = 0; n < words.length; n++) {
            const test = line + words[n] + ' ';
            if (ctx.measureText(test).width > maxWidth && n > 0) {
                lines.push(line.trim());
                if (lines.length === maxLines) { truncated = true; break; }
                line = words[n] + ' ';
            } else { line = test; }
        }
        if (!truncated && line.trim()) lines.push(line.trim());
        if (truncated && lines.length > 0) {
            const last = lines[lines.length - 1];
            lines[lines.length - 1] = last.endsWith('…') ? last : `${last}…`;
        }
        return { lines, lineHeight, truncated };
    }

    // ── Take photo ────────────────────────────────────────────────────────────
    function takePhoto() {
        if (!video.videoWidth) return;

        const corrCW    = getStreamCorrectionCW();
        const srcW      = video.videoWidth;
        const srcH      = video.videoHeight;
        const needsSwap = corrCW === 90 || corrCW === 270;

        // Canvas dimensions must match the VISUAL output orientation.
        // If the correction swaps dimensions (90° or 270°), swap the canvas too
        // so the DOM→canvas scale factors are uniform and the frame isn't distorted.
        //   e.g. raw 1920×1080 + 270° correction → portrait canvas 1080×1920
        //   e.g. raw 1920×1080 + 0° correction   → landscape canvas 1920×1080
        canvas.width  = needsSwap ? srcH : srcW;
        canvas.height = needsSwap ? srcW : srcH;

        const ctx    = canvas.getContext('2d');
        const layout = computeCaptureLayoutFromDom(canvas);
        if (!layout) return;

        const { frame: fr } = layout;
        const isLandscapeFrame = fr.width > fr.height;

        // 1. Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Camera image — correctly oriented and clipped to frame
        drawOrientedVideoToFrame(ctx, fr, corrCW);

        // 3. Frame lines
        ctx.fillStyle = '#573705';
        Object.values(layout.lines).forEach(r => { if (r) ctx.fillRect(r.x, r.y, r.width, r.height); });

        // 4. Corners
        Object.values(layout.corners).forEach(r => {
            if (!r) return;
            ctx.save();
            ctx.translate(r.x + r.width / 2, r.y + r.height / 2);
            ctx.rotate((r.angle || 0) * Math.PI / 180);
            ctx.drawImage(cornerImg, -r.width / 2, -r.height / 2, r.width, r.height);
            ctx.restore();
        });

        // 5. Decorations
        ['pero', 'knjiga'].forEach(key => {
            const r   = layout.decorations[key];
            const img = key === 'pero' ? peroImg : knjigaImg;
            if (r) ctx.drawImage(img, r.x, r.y, r.width, r.height);
        });

        // 6. Text setup
        const hInset   = Math.max(24, fr.width  * 0.08);
        const topInset = Math.max(20, fr.height * 0.08);
        const botInset = Math.max(30, fr.height * 0.1);
        const textX    = fr.x + fr.width / 2;
        const textMaxW = Math.max(120, fr.width - hInset * 2);
        const headingY = fr.y + topInset;
        const verseBotY = fr.y + fr.height - botInset;

        const applyShadow = () => {
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur  = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
        };

        // 7. Heading
        const headingText = layout.headingText;
        const hPref = isLandscapeFrame ? Math.max(18, fr.height * 0.06) : Math.max(14, fr.height * 0.04);
        const hMin  = isLandscapeFrame ? 14 : 12;
        const hSize = fitFontSize(ctx, headingText, textMaxW, hPref, hMin);

        ctx.font = `italic ${hSize}px Georgia`;
        ctx.fillStyle    = '#d4af37';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        applyShadow();
        const headingX = layout.heading ? layout.heading.x + layout.heading.width / 2 : textX;
        ctx.fillText(headingText, headingX, headingY);

        // 8. Verse
        const verse = verses[currentVerseIndex];
        if (verse) {
            const maxFS  = isLandscapeFrame ? Math.max(14, fr.width * 0.028) : Math.max(18, fr.width * 0.04);
            const minFS  = isLandscapeFrame ? 12 : 14;
            const maxLns = isLandscapeFrame ? 3 : 4;
            let   fs     = maxFS;
            let   lh     = fs * 1.2;

            ctx.font = `italic ${fs}px Georgia`;
            ctx.fillStyle    = 'white';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';
            applyShadow();

            const verseX  = layout.verse ? layout.verse.x + layout.verse.width / 2 : textX;
            const vTopLim = headingY + hSize + Math.max(20, fr.height * 0.06);
            const vAreaH  = Math.max(fs * 1.2, verseBotY - vTopLim);
            let wrapped   = wrapText(ctx, `"${verse}"`, textMaxW, lh, maxLns);

            while ((wrapped.truncated || wrapped.lines.length * lh > vAreaH) && fs > minFS) {
                fs--; lh = fs * 1.2;
                ctx.font = `italic ${fs}px Georgia`;
                wrapped  = wrapText(ctx, `"${verse}"`, textMaxW, lh, maxLns);
            }

            const blockH = wrapped.lines.length * lh;
            const startY = Math.max(vTopLim, verseBotY - blockH);
            wrapped.lines.forEach((ln, i) => ctx.fillText(ln, verseX, startY + i * lh));
        }

        // 9. Download
        const link    = document.createElement('a');
        link.download = `musa-selfie-${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    }
});
