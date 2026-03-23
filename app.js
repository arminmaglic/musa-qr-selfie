document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const verseText = document.getElementById('verse-text');
    const btnCapture = document.getElementById('btn-capture');
    const btnChangeVerse = document.getElementById('btn-change-verse');
    const btnSwitchCamera = document.getElementById('btn-switch-camera');

    let verses = [];
    let currentVerseIndex = 0;
    let currentFacingMode = 'user';

    // ── In-app browser detection ──────────────────────────────────────────────
    function isInAppBrowser() {
        const ua = navigator.userAgent || '';
        return /FBAN|FBAV|FB_IAB|Instagram|Messenger|KAKAOTALK|Line\/|WhatsApp|Snapchat/i.test(ua)
            || (typeof navigator.standalone === 'undefined' && /wv|WebView/i.test(ua));
    }

    if (isInAppBrowser()) {
        document.body.innerHTML = `
            <div style="
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                height:100vh; background:#000; color:#d4af37; font-family:Georgia,serif;
                text-align:center; padding:30px; gap:20px;
            ">
                <div style="font-size:3rem;">📷</div>
                <h2 style="font-size:1.3rem; font-style:italic;">Spomen soba Musa Ćazim Ćatić Tešanj</h2>
                <p style="color:#fff; font-size:1rem; line-height:1.6;">
                    Ova aplikacija zahtijeva pristup kameri.<br>
                    Molimo otvorite link u <strong>Chrome</strong> ili <strong>Safari</strong> browseru.
                </p>
                <p style="color:#aaa; font-size:0.85rem;">
                    Pritisnite ··· ili ↗ u gornjem uglu i odaberite<br>
                    <em>"Otvori u browseru"</em>
                </p>
                <button onclick="window.location.href=window.location.href" style="
                    margin-top:10px; padding:12px 28px; background:#d4af37; color:#000;
                    border:none; border-radius:25px; font-size:1rem; font-family:Georgia,serif;
                    cursor:pointer;
                ">Pokušaj ipak otvoriti</button>
            </div>`;
        return;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OUTPUT RESOLUTION
    //
    // The saved photo is rendered at this fixed size. We use the stream's own
    // dimensions so the camera image is never upscaled. The aspect ratio of
    // the output matches the correctly-oriented stream (portrait or landscape).
    // All decorations/text are drawn at native canvas resolution — no viewport
    // scaling involved, so there is no dead space from UI chrome.
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // Camera sensor rotation offset — detected once after stream loads.
    // Android front cameras expose a landscape stream even in portrait; iOS fixes
    // this automatically. We detect once and compute correction for every angle.
    // ─────────────────────────────────────────────────────────────────────────
    let sensorRotationCW = null;

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

    // ── Device / stream orientation ───────────────────────────────────────────
    function getDeviceAngleCW() {
        if (screen.orientation && screen.orientation.angle != null) return screen.orientation.angle;
        const wo = typeof window.orientation === 'number' ? window.orientation : 0;
        return ((wo * -1) % 360 + 360) % 360;
    }

    function getStreamCorrectionCW() {
        if (!sensorRotationCW) return 0;
        return ((360 - sensorRotationCW - getDeviceAngleCW()) % 360 + 360) % 360;
    }

    window.addEventListener('resize', updateCameraTransform);
    window.addEventListener('orientationchange', () => setTimeout(updateCameraTransform, 100));

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
        try {
            if (video.srcObject) stopCurrentStream();
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: currentFacingMode },
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 }
                },
                audio: false
            });
            video.srcObject = stream;
            const trackSettings = stream.getVideoTracks()[0]?.getSettings?.();
            if (trackSettings?.facingMode === 'environment' || trackSettings?.facingMode === 'user') {
                currentFacingMode = trackSettings.facingMode;
            }
            updateSwitchCameraLabel();
            video.addEventListener('loadedmetadata', () => {
                sensorRotationCW = null;
                detectSensorOffset();
                updateCameraTransform();
            }, { once: true });
        } catch (error) {
            let msg = 'Molimo dopustite pristup kameri.';
            if (error.name === 'NotAllowedError') {
                msg = 'Pristup kameri je odbijen. Provjerite dozvole u postavkama browsera.';
            } else if (error.name === 'NotFoundError') {
                msg = 'Kamera nije pronađena na ovom uređaju.';
            } else if (error.name === 'NotSupportedError' || location.protocol !== 'https:') {
                msg = 'Aplikacija zahtijeva HTTPS vezu. Provjerite da URL počinje sa https://';
            }
            alert(msg);
            throw error;
        }
    }

    function stopCurrentStream() {
        const stream = video.srcObject;
        if (!stream) return;
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
    }

    function updateSwitchCameraLabel() {
        const isRear = currentFacingMode === 'environment';
        btnSwitchCamera.textContent = isRear ? '🤳' : '📷';
        btnSwitchCamera.setAttribute(
            'aria-label',
            isRear ? 'Prebaci na prednju kameru' : 'Prebaci na zadnju kameru'
        );
    }

    async function switchCamera() {
        currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
        try {
            await startCamera();
        } catch (error) {
            currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
            await startCamera();
        }
    }

    function detectSensorOffset() {
        if (sensorRotationCW !== null) return;
        const srcW = video.videoWidth, srcH = video.videoHeight;
        if (!srcW) return;
        const viewIsLandscape   = window.innerWidth > window.innerHeight;
        const streamIsLandscape = srcW > srcH;
        sensorRotationCW = (viewIsLandscape === streamIsLandscape) ? 0 : 90;
        console.log(`[camera] sensorRotationCW=${sensorRotationCW} stream=${srcW}×${srcH} device=${getDeviceAngleCW()}°`);
    }

    // ── Live preview CSS transform ────────────────────────────────────────────
    function updateCameraTransform() {
        if (sensorRotationCW === null && video.videoWidth) detectSensorOffset();
        const corrCW = getStreamCorrectionCW();
        video.style.transformOrigin = 'center center';
        if (corrCW === 0) {
            video.style.transform = 'scaleX(-1)';
        } else if (corrCW === 90) {
            const cw = video.offsetWidth  || video.parentElement.offsetWidth  || window.innerWidth;
            const ch = video.offsetHeight || video.parentElement.offsetHeight || window.innerHeight;
            video.style.transform = `rotate(90deg) scaleX(-1) scale(${(cw > 0 && ch > 0) ? cw / ch : 1})`;
        } else if (corrCW === 180) {
            video.style.transform = 'scaleY(-1)';
        } else { // 270
            const cw = video.offsetWidth  || video.parentElement.offsetWidth  || window.innerWidth;
            const ch = video.offsetHeight || video.parentElement.offsetHeight || window.innerHeight;
            video.style.transform = `rotate(-90deg) scaleX(-1) scale(${(cw > 0 && ch > 0) ? ch / cw : 1})`;
        }
    }

    // ── Verses ────────────────────────────────────────────────────────────────
    async function loadVerses() {
        try {
            const response = await fetch('verses.json');
            verses = await response.json();
            if (verses.length > 0) displayVerse(0);
        } catch (err) {
            verseText.innerText = 'Greška pri učitavanju stihova.';
        }
    }

    function displayVerse(index) {
        if (verses.length === 0) return;
        currentVerseIndex = index % verses.length;
        verseText.innerText = `"${verses[currentVerseIndex]}"`;
    }

    btnChangeVerse.addEventListener('click', () => displayVerse(currentVerseIndex + 1));
    btnSwitchCamera.addEventListener('click', switchCamera);
    btnCapture.addEventListener('click', takePhoto);

    // ── Draw oriented video into a rect ───────────────────────────────────────
    function drawOrientedVideoToFrame(ctx, frameRect, corrCW) {
        const srcW = video.videoWidth, srcH = video.videoHeight;
        if (!srcW || !srcH) return;

        const needsSwap = corrCW === 90 || corrCW === 270;
        const oCanvas = document.createElement('canvas');
        oCanvas.width  = needsSwap ? srcH : srcW;
        oCanvas.height = needsSwap ? srcW : srcH;

        const oCtx = oCanvas.getContext('2d');
        oCtx.translate(oCanvas.width / 2, oCanvas.height / 2);
        oCtx.scale(-1, 1);
        if (corrCW !== 0) oCtx.rotate(-corrCW * Math.PI / 180);
        oCtx.drawImage(video, -srcW / 2, -srcH / 2, srcW, srcH);

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
            size--;
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

        // ── OUTPUT CANVAS: matches the correctly-oriented stream resolution ───
        //
        // The canvas is sized to the oriented stream dimensions, NOT the viewport.
        // This means the output photo is always the full native camera resolution
        // (e.g. 1920×1080 in landscape, 1080×1920 in portrait) with zero dead space.
        //
        // All layout below is computed mathematically as fractions of canvas size,
        // completely independent of the screen layout (which has UI chrome, sidebar,
        // etc.). This is why there is no black strip on the right — the frame and
        // photo fill every pixel of the output canvas.
        const outW = needsSwap ? srcH : srcW;
        const outH = needsSwap ? srcW : srcH;
        canvas.width  = outW;
        canvas.height = outH;

        const ctx = canvas.getContext('2d');

        // ── FULL-BLEED LAYOUT ─────────────────────────────────────────────────
        // All positions/sizes are computed as proportions of the output canvas.
        // Nothing is copied from DOM getBoundingClientRect().
        const MARGIN        = Math.round(outW * 0.025);   // outer black margin
        const CORNER_SIZE   = Math.round(Math.min(outW, outH) * 0.08);
        const LINE_THICK    = Math.max(3, Math.round(Math.min(outW, outH) * 0.003));
        const DECO_SIZE     = Math.round(Math.min(outW, outH) * 0.07);

        // Frame rect — fills almost the full canvas, leaving just a small margin
        const fr = {
            x:      MARGIN,
            y:      MARGIN,
            width:  outW - MARGIN * 2,
            height: outH - MARGIN * 2
        };

        const isLandscape = outW > outH;

        // Text insets within the frame
        const hInset    = Math.max(24, fr.width  * 0.06);
        const topInset  = Math.max(20, fr.height * 0.07);
        const botInset  = Math.max(30, fr.height * 0.08);
        const textMaxW  = fr.width - hInset * 2;
        const headingY  = fr.y + topInset;
        const verseBotY = fr.y + fr.height - botInset;
        const textCX    = fr.x + fr.width / 2;   // centre X for text

        // 1. Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, outW, outH);

        // 2. Camera image, fills the entire frame
        drawOrientedVideoToFrame(ctx, fr, corrCW);

        // 3. Frame border lines
        ctx.fillStyle = '#573705';
        // top
        ctx.fillRect(fr.x + CORNER_SIZE * 0.7, fr.y, fr.width - CORNER_SIZE * 1.4, LINE_THICK);
        // bottom
        ctx.fillRect(fr.x + CORNER_SIZE * 0.7, fr.y + fr.height - LINE_THICK, fr.width - CORNER_SIZE * 1.4, LINE_THICK);
        // left
        ctx.fillRect(fr.x, fr.y + CORNER_SIZE * 0.7, LINE_THICK, fr.height - CORNER_SIZE * 1.4);
        // right
        ctx.fillRect(fr.x + fr.width - LINE_THICK, fr.y + CORNER_SIZE * 0.7, LINE_THICK, fr.height - CORNER_SIZE * 1.4);

        // 4. Corner ornaments
        const corners = [
            { x: fr.x,                  y: fr.y,                   angle: 0   },
            { x: fr.x + fr.width,       y: fr.y,                   angle: 90  },
            { x: fr.x,                  y: fr.y + fr.height,        angle: -90 },
            { x: fr.x + fr.width,       y: fr.y + fr.height,        angle: 180 },
        ];
        corners.forEach(({ x, y, angle }) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle * Math.PI / 180);
            // corner SVG is anchored top-left at angle=0
            ctx.drawImage(cornerImg, -CORNER_SIZE * 0.1, -CORNER_SIZE * 0.1, CORNER_SIZE, CORNER_SIZE);
            ctx.restore();
        });

        // 5. Decorative pero (bottom-left) and knjiga (bottom-right)
        ctx.drawImage(peroImg,   fr.x + CORNER_SIZE * 0.1,                   fr.y + fr.height - DECO_SIZE - CORNER_SIZE * 0.1, DECO_SIZE, DECO_SIZE);
        ctx.drawImage(knjigaImg, fr.x + fr.width - DECO_SIZE - CORNER_SIZE * 0.1, fr.y + fr.height - DECO_SIZE - CORNER_SIZE * 0.1, DECO_SIZE, DECO_SIZE);

        const applyShadow = () => {
            const blur = Math.max(4, Math.round(outH * 0.004));
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur  = blur;
            ctx.shadowOffsetX = Math.round(blur * 0.5);
            ctx.shadowOffsetY = Math.round(blur * 0.5);
        };

        // 6. Heading
        const headingText = 'Spomen soba Musa Ćazim Ćatić Tešanj';
        const hPref = isLandscape ? Math.max(22, fr.height * 0.055) : Math.max(18, fr.height * 0.035);
        const hMin  = isLandscape ? 16 : 14;
        const hSize = fitFontSize(ctx, headingText, textMaxW, hPref, hMin);

        ctx.font = `italic ${hSize}px Georgia`;
        ctx.fillStyle    = '#d4af37';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        applyShadow();
        ctx.fillText(headingText, textCX, headingY);

        // 7. Verse
        const verse = verses[currentVerseIndex];
        if (verse) {
            const maxFS  = isLandscape ? Math.max(18, fr.width * 0.025) : Math.max(22, fr.width * 0.038);
            const minFS  = isLandscape ? 14 : 16;
            const maxLns = isLandscape ? 3 : 4;
            let   fs     = maxFS;
            let   lh     = fs * 1.35;

            ctx.font = `italic ${fs}px Georgia`;
            ctx.fillStyle    = 'white';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'top';
            applyShadow();

            const vTopLim = headingY + hSize + Math.max(24, fr.height * 0.05);
            const vAreaH  = Math.max(fs * 1.35, verseBotY - vTopLim);
            let wrapped   = wrapText(ctx, `"${verse}"`, textMaxW, lh, maxLns);

            while ((wrapped.truncated || wrapped.lines.length * lh > vAreaH) && fs > minFS) {
                fs--; lh = fs * 1.35;
                ctx.font = `italic ${fs}px Georgia`;
                wrapped  = wrapText(ctx, `"${verse}"`, textMaxW, lh, maxLns);
            }

            const blockH = wrapped.lines.length * lh;
            const startY = Math.max(vTopLim, verseBotY - blockH);
            wrapped.lines.forEach((ln, i) => ctx.fillText(ln, textCX, startY + i * lh));
        }

        // 8. Download
        const link    = document.createElement('a');
        link.download = `musa-selfie-${Date.now()}.png`;
        link.href     = canvas.toDataURL('image/png');
        link.click();
    }
});
