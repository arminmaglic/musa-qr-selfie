document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('camera');
    const canvas = document.getElementById('canvas');
    const verseText = document.getElementById('verse-text');
    const btnCapture = document.getElementById('btn-capture');
    const btnChangeVerse = document.getElementById('btn-change-verse');

    let verses = [];
    let currentVerseIndex = 0;

    // Initialize
    init();

    // Fullscreen logic
    function requestFullScreen() {
        const doc = window.document;
        const docEl = doc.documentElement;

        const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;

        if (requestFullScreen) {
            requestFullScreen.call(docEl).catch(err => {
                console.log("Error attempting to enable full-screen mode:", err.message);
            });
        }
    }

    // Try to go fullscreen on first interaction
    document.addEventListener('click', function initAudio() {
        requestFullScreen();
        document.removeEventListener('click', initAudio);
    }, { once: true });

    document.addEventListener('touchstart', function initTouch() {
        requestFullScreen();
        document.removeEventListener('touchstart', initTouch);
    }, { once: true });

    // Orientation change listeners
    window.addEventListener('resize', updateCameraTransform);
    window.addEventListener('orientationchange', updateCameraTransform);

    // Load assets
    const cornerImg = new Image();
    cornerImg.src = 'elements/corner.svg';
    const peroImg = new Image();
    peroImg.src = 'elements/pero.svg';
    const knjigaImg = new Image();
    knjigaImg.src = 'elements/knjiga.svg';

    async function init() {
        try {
            await startCamera();
            await loadVerses();
        } catch (error) {
            console.error("Initialization error:", error);
            alert("Molimo dopustite pristup kameri za korištenje aplikacije.");
        }
    }

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            video.srcObject = stream;
            updateCameraTransform();
        } catch (err) {
            console.error("Camera error:", err);
            throw err;
        }
    }

    function updateCameraTransform() {
        const isLandscape = window.innerWidth > window.innerHeight;
        if (isLandscape) {
            video.style.transform = 'scaleX(-1) rotate(-90deg)';
        } else {
            video.style.transform = 'scaleX(-1)';
        }
    }

    async function loadVerses() {
        try {
            const response = await fetch('verses.json');
            verses = await response.json();
            if (verses.length > 0) {
                displayVerse(0);
            }
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

    btnChangeVerse.addEventListener('click', () => {
        displayVerse(currentVerseIndex + 1);
    });

    btnCapture.addEventListener('click', takePhoto);

    function computeCaptureLayoutFromDom(canvas) {
        const frameOverlay = document.getElementById('frame-overlay');
        const heading = document.getElementById('app-heading');
        const verseContainer = document.getElementById('verse-container');

        if (!frameOverlay) return null;

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
        const scaleX = canvas.width / viewportWidth;
        const scaleY = canvas.height / viewportHeight;

        const mapRect = (rect) => ({
            x: rect.left * scaleX,
            y: rect.top * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY
        });

        const getRect = (selector) => {
            const el = typeof selector === 'string' ? frameOverlay.querySelector(selector) : selector;
            if (!el) return null;
            return mapRect(el.getBoundingClientRect());
        };

        const corners = {
            topLeft: getRect('.corner-top-left'),
            topRight: getRect('.corner-top-right'),
            bottomLeft: getRect('.corner-bottom-left'),
            bottomRight: getRect('.corner-bottom-right')
        };

        return {
            frame: mapRect(frameOverlay.getBoundingClientRect()),
            heading: heading ? mapRect(heading.getBoundingClientRect()) : null,
            headingText: heading ? heading.innerText : 'Spomen soba Musa Ćazim Ćatić Tešanj',
            verse: verseContainer ? mapRect(verseContainer.getBoundingClientRect()) : null,
            lines: {
                top: getRect('.line-top'),
                bottom: getRect('.line-bottom'),
                left: getRect('.line-left'),
                right: getRect('.line-right')
            },
            corners: {
                topLeft: corners.topLeft ? { ...corners.topLeft, angle: 0 } : null,
                topRight: corners.topRight ? { ...corners.topRight, angle: 90 } : null,
                bottomLeft: corners.bottomLeft ? { ...corners.bottomLeft, angle: -90 } : null,
                bottomRight: corners.bottomRight ? { ...corners.bottomRight, angle: 180 } : null
            },
            decorations: {
                pero: getRect('.decoration-pero'),
                knjiga: getRect('.decoration-knjiga')
            }
        };
    }

    function drawOrientedVideoToFrame(ctx, frameRect, isLandscapeViewport) {
        const sourceWidth = video.videoWidth;
        const sourceHeight = video.videoHeight;
        if (!sourceWidth || !sourceHeight) return;

        // In landscape viewport, enforce a 90° counterclockwise rotation to match preview expectation.
        const shouldRotate = Boolean(isLandscapeViewport);

        const orientedCanvas = document.createElement('canvas');
        const orientedCtx = orientedCanvas.getContext('2d');

        orientedCanvas.width = shouldRotate ? sourceHeight : sourceWidth;
        orientedCanvas.height = shouldRotate ? sourceWidth : sourceHeight;

        orientedCtx.translate(orientedCanvas.width / 2, orientedCanvas.height / 2);
        orientedCtx.scale(-1, 1);
        if (shouldRotate) {
            orientedCtx.rotate(-90 * Math.PI / 180);
        }
        orientedCtx.drawImage(video, -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight);

        const scale = Math.max(frameRect.width / orientedCanvas.width, frameRect.height / orientedCanvas.height);
        const drawWidth = orientedCanvas.width * scale;
        const drawHeight = orientedCanvas.height * scale;
        const drawX = frameRect.x + ((frameRect.width - drawWidth) / 2);
        const drawY = frameRect.y + ((frameRect.height - drawHeight) / 2);

        ctx.save();
        ctx.beginPath();
        ctx.rect(frameRect.x, frameRect.y, frameRect.width, frameRect.height);
        ctx.clip();
        ctx.drawImage(orientedCanvas, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }

    function fitFontSize(ctx, text, maxWidth, preferredSize, minSize) {
        let fontSize = preferredSize;
        while (fontSize > minSize) {
            ctx.font = `italic ${fontSize}px Georgia`;
            if (ctx.measureText(text).width <= maxWidth) {
                break;
            }
            fontSize -= 1;
        }
        return fontSize;
    }

    function takePhoto() {
        if (!video.videoWidth) return;

        // Set canvas to match camera resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        // Read CSS-driven geometry first so capture matches on-screen layout.
        const captureLayout = computeCaptureLayoutFromDom(canvas);
        if (!captureLayout) return;

        const frameX = captureLayout.frame.x;
        const frameY = captureLayout.frame.y;
        const frameW = captureLayout.frame.width;
        const frameH = captureLayout.frame.height;
        const isLandscapeFrame = frameW > frameH;

        // 1. Background + camera locked to frame interior.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const isLandscapeViewport = window.innerWidth > window.innerHeight;
        drawOrientedVideoToFrame(ctx, captureLayout.frame, isLandscapeViewport);

        // 2. Draw Frame + Decorations using geometry captured from DOM/CSS.
        ctx.fillStyle = '#573705';
        Object.values(captureLayout.lines).forEach((lineRect) => {
            if (!lineRect) return;
            ctx.fillRect(lineRect.x, lineRect.y, lineRect.width, lineRect.height);
        });

        Object.values(captureLayout.corners).forEach((cornerRect) => {
            if (!cornerRect) return;
            const centerX = cornerRect.x + cornerRect.width / 2;
            const centerY = cornerRect.y + cornerRect.height / 2;

            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate((cornerRect.angle || 0) * Math.PI / 180);
            ctx.drawImage(cornerImg, -cornerRect.width / 2, -cornerRect.height / 2, cornerRect.width, cornerRect.height);
            ctx.restore();
        });

        if (captureLayout.decorations.pero) {
            const peroRect = captureLayout.decorations.pero;
            ctx.drawImage(peroImg, peroRect.x, peroRect.y, peroRect.width, peroRect.height);
        }
        if (captureLayout.decorations.knjiga) {
            const knjigaRect = captureLayout.decorations.knjiga;
            ctx.drawImage(knjigaImg, knjigaRect.x, knjigaRect.y, knjigaRect.width, knjigaRect.height);
        }

        const horizontalInset = Math.max(24, frameW * 0.08);
        const topInset = Math.max(20, frameH * 0.08);
        const bottomInset = Math.max(30, frameH * 0.1);
        const textX = frameX + (frameW / 2);
        const textMaxWidth = Math.max(120, frameW - (horizontalInset * 2));
        const headingY = frameY + topInset;
        const verseBottomY = frameY + frameH - bottomInset;

        // 3. Draw Heading (slightly smaller in portrait to keep it inside frame).
        const headingRect = captureLayout.heading;
        const headingText = captureLayout.headingText;
        const headingPreferredSize = isLandscapeFrame
            ? Math.max(18, frameH * 0.06)
            : Math.max(14, frameH * 0.04);
        const headingMinSize = isLandscapeFrame ? 14 : 12;
        const headingFontSize = fitFontSize(ctx, headingText, textMaxWidth, headingPreferredSize, headingMinSize);

        ctx.font = `italic ${headingFontSize}px Georgia`;
        ctx.fillStyle = '#d4af37';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const headingX = headingRect ? headingRect.x + (headingRect.width / 2) : textX;
        ctx.fillText(headingText, headingX, headingY);

        // 4. Draw Verse (reduce cap in landscape so text is less dominant).
        const verse = verses[currentVerseIndex];
        if (verse) {
            const maxVerseFontSize = isLandscapeFrame
                ? Math.max(14, frameW * 0.028)
                : Math.max(18, frameW * 0.04);
            const minVerseFontSize = isLandscapeFrame ? 12 : 14;
            let fontSize = maxVerseFontSize;
            const maxLines = isLandscapeFrame ? 3 : 4;

            ctx.font = `italic ${fontSize}px Georgia`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            const verseRect = captureLayout.verse;
            const verseX = verseRect ? verseRect.x + (verseRect.width / 2) : textX;
            const verseTopLimit = headingY + headingFontSize + Math.max(20, frameH * 0.06);
            const verseBottomLimit = verseBottomY;
            const verseAreaHeight = Math.max(fontSize * 1.2, verseBottomLimit - verseTopLimit);
            let lineHeight = fontSize * 1.2;
            let wrapped = wrapText(ctx, `"${verse}"`, textMaxWidth, lineHeight, maxLines);

            while ((wrapped.truncated || (wrapped.lines.length * lineHeight) > verseAreaHeight) && fontSize > minVerseFontSize) {
                fontSize -= 1;
                lineHeight = fontSize * 1.2;
                ctx.font = `italic ${fontSize}px Georgia`;
                wrapped = wrapText(ctx, `"${verse}"`, textMaxWidth, lineHeight, maxLines);
            }

            const blockHeight = wrapped.lines.length * lineHeight;
            const verseStartY = Math.max(verseTopLimit, verseBottomLimit - blockHeight);
            for (let i = 0; i < wrapped.lines.length; i++) {
                ctx.fillText(wrapped.lines[i], verseX, verseStartY + (i * lineHeight));
            }
        }

        // 5. Download
        const link = document.createElement('a');
        link.download = `musa-selfie-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function wrapText(ctx, text, maxWidth, lineHeight, maxLines = Infinity) {
        const words = text.split(' ');
        let line = '';
        const lines = [];
        let truncated = false;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line.trim());
                if (lines.length === maxLines) {
                    truncated = true;
                    break;
                }
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        if (!truncated && line.trim()) {
            lines.push(line.trim());
        }

        if (truncated && lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            lines[lines.length - 1] = lastLine.endsWith('…') ? lastLine : `${lastLine}…`;
        }

        return { lines, lineHeight, truncated };
    }
});
