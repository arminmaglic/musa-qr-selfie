document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const verseText = document.getElementById('verse-text');
    const btnCapture = document.getElementById('btn-capture');
    const btnChangeVerse = document.getElementById('btn-change-verse');

    let verses = [];
    let currentVerseIndex = 0;

    init();

    // ---------------------------------------------------------------------------
    // Fullscreen
    // ---------------------------------------------------------------------------
    function requestFullScreen() {
        const docEl = document.documentElement;
        const rfs = docEl.requestFullscreen || docEl.mozRequestFullScreen ||
                    docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        if (rfs) rfs.call(docEl).catch(err => console.log("Fullscreen error:", err.message));
    }
    document.addEventListener('click',      () => requestFullScreen(), { once: true });
    document.addEventListener('touchstart', () => requestFullScreen(), { once: true });

    // ---------------------------------------------------------------------------
    // Orientation helpers
    // ---------------------------------------------------------------------------

    /**
     * Returns a snapshot of the current orientation relationship between the
     * browser viewport and the raw camera stream.
     *
     * On Android the front-camera sensor delivers a landscape stream (e.g.
     * 1280×720) even when the phone is held in portrait. iOS corrects this
     * automatically. We detect the mismatch here so every other function can
     * use a single consistent source of truth.
     */
    function getOrientationInfo() {
        const isLandscapeViewport = window.innerWidth > window.innerHeight;
        const streamW = video.videoWidth;
        const streamH = video.videoHeight;
        const streamIsLandscape = streamW > 0 && streamW > streamH;

        // Android portrait: viewport is portrait but stream is landscape → needs -90° rotation
        const androidPortraitMismatch = !isLandscapeViewport && streamIsLandscape;
        // Android landscape with portrait stream (uncommon): needs +90° rotation
        const androidLandscapeMismatch = isLandscapeViewport && !streamIsLandscape && streamW > 0;

        return { isLandscapeViewport, streamW, streamH, streamIsLandscape,
                 androidPortraitMismatch, androidLandscapeMismatch };
    }

    // ---------------------------------------------------------------------------
    // Orientation change listeners
    // ---------------------------------------------------------------------------
    window.addEventListener('resize',            updateCameraTransform);
    window.addEventListener('orientationchange', updateCameraTransform);

    // ---------------------------------------------------------------------------
    // Asset preloads
    // ---------------------------------------------------------------------------
    const cornerImg = new Image();  cornerImg.src  = 'elements/corner.svg';
    const peroImg   = new Image();  peroImg.src    = 'elements/pero.svg';
    const knjigaImg = new Image();  knjigaImg.src  = 'elements/knjiga.svg';

    // ---------------------------------------------------------------------------
    // Init
    // ---------------------------------------------------------------------------
    async function init() {
        try {
            await startCamera();
            await loadVerses();
        } catch (error) {
            console.error("Initialization error:", error);
            alert("Molimo dopustite pristup kameri za korištenje aplikacije.");
        }
    }

    // ---------------------------------------------------------------------------
    // Camera
    // ---------------------------------------------------------------------------
    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    // FIX 3: Request higher resolution — most modern front cameras
                    // support 1920×1080 or better. The browser picks the closest
                    // available; it won't fail if the device tops out lower.
                    width:  { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720  }
                },
                audio: false
            });
            video.srcObject = stream;

            // FIX 1 (timing): Wait for stream dimensions before applying transforms.
            // videoWidth/videoHeight are 0 until loadedmetadata fires on Android,
            // so calling updateCameraTransform() inline always fell through to the
            // plain scaleX(-1) branch, leaving the preview rotated 90° CW.
            video.addEventListener('loadedmetadata', updateCameraTransform, { once: true });
        } catch (err) {
            console.error("Camera error:", err);
            throw err;
        }
    }

    function updateCameraTransform() {
        const { isLandscapeViewport, androidPortraitMismatch, androidLandscapeMismatch } = getOrientationInfo();

        video.style.transformOrigin = 'center center';

        if (androidPortraitMismatch) {
            // Portrait viewport, landscape stream: raw stream appears rotated 90° CW.
            // Counter-rotate -90°, mirror for selfie, then scale up to cover the
            // portrait container (after rotation the video natural size is swapped).
            const containerW = video.offsetWidth  || video.parentElement.offsetWidth  || window.innerWidth;
            const containerH = video.offsetHeight || video.parentElement.offsetHeight || window.innerHeight;
            const scale = (containerH > 0 && containerW > 0) ? containerH / containerW : 1;
            video.style.transform = `rotate(-90deg) scaleX(-1) scale(${scale})`;

        } else if (androidLandscapeMismatch) {
            // Landscape viewport, portrait stream (uncommon): rotate +90°, mirror.
            video.style.transform = 'rotate(90deg) scaleX(-1)';

        } else {
            // Stream and viewport orientations match (iOS, desktop): just mirror.
            video.style.transform = 'scaleX(-1)';
        }
    }

    // ---------------------------------------------------------------------------
    // Verses
    // ---------------------------------------------------------------------------
    async function loadVerses() {
        try {
            const response = await fetch('verses.json');
            verses = await response.json();
            if (verses.length > 0) displayVerse(0);
        } catch (err) {
            console.error("Error loading verses:", err);
            verseText.innerText = "Greška pri učitavanju stihova.";
        }
    }

    function displayVerse(index) {
        if (verses.length === 0) return;
        currentVerseIndex = index % verses.length;
        verseText.innerText = `"${verses[currentVerseIndex]}"`;
    }

    btnChangeVerse.addEventListener('click', () => displayVerse(currentVerseIndex + 1));
    btnCapture.addEventListener('click', takePhoto);

    // ---------------------------------------------------------------------------
    // Capture layout — maps visible DOM positions onto canvas coordinates
    // ---------------------------------------------------------------------------
    function computeCaptureLayoutFromDom(canvasEl) {
        const frameOverlay    = document.getElementById('frame-overlay');
        const heading         = document.getElementById('app-heading');
        const verseContainer  = document.getElementById('verse-container');
        if (!frameOverlay) return null;

        const viewportWidth  = window.innerWidth  || document.documentElement.clientWidth  || 1;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;

        // These scale factors are now correct because takePhoto() sets canvas
        // dimensions to match the visual output orientation (portrait for portrait
        // mode), not the raw stream dimensions.
        const scaleX = canvasEl.width  / viewportWidth;
        const scaleY = canvasEl.height / viewportHeight;

        const mapRect = (rect) => ({
            x:      rect.left   * scaleX,
            y:      rect.top    * scaleY,
            width:  rect.width  * scaleX,
            height: rect.height * scaleY
        });

        const getRect = (selector) => {
            const el = typeof selector === 'string'
                ? frameOverlay.querySelector(selector)
                : selector;
            if (!el) return null;
            return mapRect(el.getBoundingClientRect());
        };

        return {
            frame:       mapRect(frameOverlay.getBoundingClientRect()),
            heading:     heading       ? mapRect(heading.getBoundingClientRect())        : null,
            headingText: heading       ? heading.innerText : 'Spomen soba Musa Ćazim Ćatić Tešanj',
            verse:       verseContainer ? mapRect(verseContainer.getBoundingClientRect()) : null,
            lines: {
                top:    getRect('.line-top'),
                bottom: getRect('.line-bottom'),
                left:   getRect('.line-left'),
                right:  getRect('.line-right')
            },
            corners: {
                topLeft:     { ...getRect('.corner-top-left'),     angle: 0   },
                topRight:    { ...getRect('.corner-top-right'),    angle: 90  },
                bottomLeft:  { ...getRect('.corner-bottom-left'),  angle: -90 },
                bottomRight: { ...getRect('.corner-bottom-right'), angle: 180 }
            },
            decorations: {
                pero:   getRect('.decoration-pero'),
                knjiga: getRect('.decoration-knjiga')
            }
        };
    }

    // ---------------------------------------------------------------------------
    // Draw oriented video into the frame rectangle
    // ---------------------------------------------------------------------------
    /**
     * Renders the video stream into frameRect on ctx, applying any necessary
     * rotation (for Android portrait mismatch) and the selfie mirror.
     *
     * We first draw into a correctly-oriented intermediate canvas, then
     * scale-to-fill into frameRect. This keeps the main canvas logic simple.
     */
    function drawOrientedVideoToFrame(ctx, frameRect, androidPortraitMismatch) {
        const srcW = video.videoWidth;
        const srcH = video.videoHeight;
        if (!srcW || !srcH) return;

        const oCanvas = document.createElement('canvas');
        const oCtx    = oCanvas.getContext('2d');

        if (androidPortraitMismatch) {
            // FIX 2a: The raw stream is 1280×720 (landscape). After a -90° rotation
            // the natural size becomes 720×1280 (portrait) — swap W and H.
            oCanvas.width  = srcH;  // portrait width
            oCanvas.height = srcW;  // portrait height

            oCtx.translate(oCanvas.width / 2, oCanvas.height / 2);
            oCtx.rotate(-90 * Math.PI / 180);   // correct CW rotation from Android sensor
            oCtx.scale(-1, 1);                   // mirror for selfie
            oCtx.drawImage(video, -srcW / 2, -srcH / 2, srcW, srcH);
        } else {
            oCanvas.width  = srcW;
            oCanvas.height = srcH;

            oCtx.translate(oCanvas.width / 2, oCanvas.height / 2);
            oCtx.scale(-1, 1);                   // mirror only
            oCtx.drawImage(video, -srcW / 2, -srcH / 2, srcW, srcH);
        }

        // Scale-to-fill frameRect, centred, clipped
        const scale   = Math.max(frameRect.width / oCanvas.width, frameRect.height / oCanvas.height);
        const drawW   = oCanvas.width  * scale;
        const drawH   = oCanvas.height * scale;
        const drawX   = frameRect.x + (frameRect.width  - drawW) / 2;
        const drawY   = frameRect.y + (frameRect.height - drawH) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(frameRect.x, frameRect.y, frameRect.width, frameRect.height);
        ctx.clip();
        ctx.drawImage(oCanvas, drawX, drawY, drawW, drawH);
        ctx.restore();
    }

    // ---------------------------------------------------------------------------
    // Text helpers
    // ---------------------------------------------------------------------------
    function fitFontSize(ctx, text, maxWidth, preferredSize, minSize) {
        let fontSize = preferredSize;
        while (fontSize > minSize) {
            ctx.font = `italic ${fontSize}px Georgia`;
            if (ctx.measureText(text).width <= maxWidth) break;
            fontSize -= 1;
        }
        return fontSize;
    }

    function wrapText(ctx, text, maxWidth, lineHeight, maxLines = Infinity) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        let truncated = false;

        for (let n = 0; n < words.length; n++) {
            const testLine  = line + words[n] + ' ';
            const testWidth = ctx.measureText(testLine).width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line.trim());
                if (lines.length === maxLines) { truncated = true; break; }
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        if (!truncated && line.trim()) lines.push(line.trim());
        if (truncated && lines.length > 0) {
            const last = lines[lines.length - 1];
            lines[lines.length - 1] = last.endsWith('…') ? last : `${last}…`;
        }
        return { lines, lineHeight, truncated };
    }

    // ---------------------------------------------------------------------------
    // Take photo
    // ---------------------------------------------------------------------------
    function takePhoto() {
        if (!video.videoWidth) return;

        const { isLandscapeViewport, streamW, streamH, androidPortraitMismatch } = getOrientationInfo();

        // FIX 2b: Set canvas to match the VISUAL output orientation, not the raw
        // stream dimensions. For Android portrait the stream is landscape (1280×720)
        // but the user sees portrait, so the output canvas must be portrait (720×1280).
        // Previously canvas was always set to streamW×streamH which caused the
        // DOM-to-canvas coordinate scale factors to be wildly mismatched in X vs Y,
        // distorting and stretching the decorative frame.
        if (androidPortraitMismatch) {
            canvas.width  = streamH;   // e.g. 1080 → portrait width
            canvas.height = streamW;   // e.g. 1920 → portrait height
        } else {
            canvas.width  = streamW;
            canvas.height = streamH;
        }

        const ctx = canvas.getContext('2d');
        const captureLayout = computeCaptureLayoutFromDom(canvas);
        if (!captureLayout) return;

        const { frame: frameRect } = captureLayout;
        const frameW = frameRect.width;
        const frameH = frameRect.height;
        const isLandscapeFrame = frameW > frameH;

        // 1. Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Camera image — correctly oriented and clipped to the frame area
        drawOrientedVideoToFrame(ctx, frameRect, androidPortraitMismatch);

        // 3. Frame lines
        ctx.fillStyle = '#573705';
        Object.values(captureLayout.lines).forEach(lineRect => {
            if (lineRect) ctx.fillRect(lineRect.x, lineRect.y, lineRect.width, lineRect.height);
        });

        // 4. Corner ornaments
        Object.values(captureLayout.corners).forEach(cornerRect => {
            if (!cornerRect) return;
            const cx = cornerRect.x + cornerRect.width  / 2;
            const cy = cornerRect.y + cornerRect.height / 2;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate((cornerRect.angle || 0) * Math.PI / 180);
            ctx.drawImage(cornerImg,
                -cornerRect.width / 2, -cornerRect.height / 2,
                 cornerRect.width,      cornerRect.height);
            ctx.restore();
        });

        // 5. Decorative icons
        if (captureLayout.decorations.pero) {
            const r = captureLayout.decorations.pero;
            ctx.drawImage(peroImg,   r.x, r.y, r.width, r.height);
        }
        if (captureLayout.decorations.knjiga) {
            const r = captureLayout.decorations.knjiga;
            ctx.drawImage(knjigaImg, r.x, r.y, r.width, r.height);
        }

        // 6. Text layout constants
        const horizontalInset = Math.max(24, frameW * 0.08);
        const topInset        = Math.max(20, frameH * 0.08);
        const bottomInset     = Math.max(30, frameH * 0.1);
        const textX           = frameRect.x + frameW / 2;
        const textMaxWidth    = Math.max(120, frameW - horizontalInset * 2);
        const headingY        = frameRect.y + topInset;
        const verseBottomY    = frameRect.y + frameH - bottomInset;

        // 7. Heading
        const headingText          = captureLayout.headingText;
        const headingPreferredSize = isLandscapeFrame ? Math.max(18, frameH * 0.06) : Math.max(14, frameH * 0.04);
        const headingMinSize       = isLandscapeFrame ? 14 : 12;
        const headingFontSize      = fitFontSize(ctx, headingText, textMaxWidth, headingPreferredSize, headingMinSize);

        ctx.font         = `italic ${headingFontSize}px Georgia`;
        ctx.fillStyle    = '#d4af37';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor  = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur   = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const headingRect = captureLayout.heading;
        const headingX    = headingRect ? headingRect.x + headingRect.width / 2 : textX;
        ctx.fillText(headingText, headingX, headingY);

        // 8. Verse
        const verse = verses[currentVerseIndex];
        if (verse) {
            const maxVerseFontSize = isLandscapeFrame
                ? Math.max(14, frameW * 0.028)
                : Math.max(18, frameW * 0.04);
            const minVerseFontSize = isLandscapeFrame ? 12 : 14;
            const maxLines = isLandscapeFrame ? 3 : 4;
            let fontSize   = maxVerseFontSize;

            ctx.font         = `italic ${fontSize}px Georgia`;
            ctx.fillStyle    = 'white';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';

            const verseRect       = captureLayout.verse;
            const verseX          = verseRect ? verseRect.x + verseRect.width / 2 : textX;
            const verseTopLimit   = headingY + headingFontSize + Math.max(20, frameH * 0.06);
            const verseAreaHeight = Math.max(fontSize * 1.2, verseBottomY - verseTopLimit);
            let   lineHeight      = fontSize * 1.2;
            let   wrapped         = wrapText(ctx, `"${verse}"`, textMaxWidth, lineHeight, maxLines);

            while ((wrapped.truncated || wrapped.lines.length * lineHeight > verseAreaHeight) && fontSize > minVerseFontSize) {
                fontSize   -= 1;
                lineHeight  = fontSize * 1.2;
                ctx.font    = `italic ${fontSize}px Georgia`;
                wrapped     = wrapText(ctx, `"${verse}"`, textMaxWidth, lineHeight, maxLines);
            }

            const blockHeight  = wrapped.lines.length * lineHeight;
            const verseStartY  = Math.max(verseTopLimit, verseBottomY - blockHeight);
            wrapped.lines.forEach((line, i) => {
                ctx.fillText(line, verseX, verseStartY + i * lineHeight);
            });
        }

        // 9. Download
        const link      = document.createElement('a');
        link.download   = `musa-selfie-${Date.now()}.png`;
        link.href       = canvas.toDataURL('image/png');
        link.click();
    }
});
