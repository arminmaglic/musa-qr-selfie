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

    function takePhoto() {
        if (!video.videoWidth) return;

        // Set canvas to match video resolution
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        // Detect actual screen orientation from viewport so capture logic tracks preview transform.
        const isScreenLandscape = window.innerWidth > window.innerHeight;

        // 1. Draw Video (kept in sync with updateCameraTransform)
        ctx.save();
        if (isScreenLandscape) {
            // Landscape preview is `scaleX(-1) rotate(-90deg)`. We render that sequence on an
            // offscreen surface first, then fit it into the output canvas with positive coordinates.
            const orientedCanvas = document.createElement('canvas');
            orientedCanvas.width = video.videoHeight;
            orientedCanvas.height = video.videoWidth;
            const orientedCtx = orientedCanvas.getContext('2d');

            orientedCtx.save();
            orientedCtx.translate(orientedCanvas.width, 0);
            // Coordinates now have origin at top-right; +x moves left, +y still moves down.
            orientedCtx.scale(-1, 1);
            // Coordinates return to top-left orientation; x/y are positive right/down.
            orientedCtx.translate(0, orientedCanvas.height);
            // Coordinates rotate so source portrait frame becomes landscape in positive destination space.
            orientedCtx.rotate(-90 * Math.PI / 180);
            // After transforms, drawing rect (0,0,video.videoWidth,video.videoHeight) fully covers offscreen bounds.
            orientedCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
            orientedCtx.restore();

            // Draw the fully-oriented intermediate frame into final canvas bounds.
            ctx.drawImage(orientedCanvas, 0, 0, canvas.width, canvas.height);
        } else {
            // Portrait mirrored selfie path.
            ctx.translate(canvas.width, 0);
            // Coordinates now have origin at top-right; +x points left, +y points down.
            ctx.scale(-1, 1);
            // Coordinates return to standard top-left orientation, so destination remains fully in-bounds.
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        ctx.restore();

        // 2. Draw Frame
        // Calculate frame dimensions based on video size, mimicking CSS
        const isLandscape = canvas.width > canvas.height;

        let paddingX, paddingTop, paddingBottom;

        if (isLandscape) {
            // Landscape: Controls on right
            paddingX = 20; // 20px left
            const paddingRight = 140; // 140px right for controls
            paddingTop = 50; // Extra space for heading
            paddingBottom = 20;

            var frameX = paddingX;
            var frameY = paddingTop;
            var frameW = canvas.width - paddingX - paddingRight;
            var frameH = canvas.height - paddingTop - paddingBottom;
        } else {
            // Portrait: Controls on bottom
            paddingX = 20;
            paddingTop = 70; // Extra space for heading
            paddingBottom = 140; // 140px space at bottom

            var frameX = paddingX;
            var frameY = paddingTop;
            var frameW = canvas.width - (paddingX * 2);
            var frameH = canvas.height - paddingTop - paddingBottom;
        }

        // Draw Lines (Brown #573705)
        ctx.fillStyle = '#573705';
        const lineWidth = 3;
        const lineOffset = 50; // 50px offset from corners

        // Top Line
        ctx.fillRect(frameX + lineOffset, frameY, frameW - (lineOffset * 2), lineWidth);
        // Bottom Line
        ctx.fillRect(frameX + lineOffset, frameY + frameH - lineWidth, frameW - (lineOffset * 2), lineWidth);
        // Left Line
        ctx.fillRect(frameX, frameY + lineOffset, lineWidth, frameH - (lineOffset * 2));
        // Right Line
        ctx.fillRect(frameX + frameW - lineWidth, frameY + lineOffset, lineWidth, frameH - (lineOffset * 2));

        // Draw Corners
        const cornerSize = 60;
        const cornerOffset = 10; // -10px in CSS

        // Helper to draw rotated image
        function drawRotatedImage(img, x, y, angle) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle * Math.PI / 180);
            ctx.drawImage(img, 0, 0, cornerSize, cornerSize);
            ctx.restore();
        }

        // Top-Left (0 deg)
        ctx.drawImage(cornerImg, frameX - cornerOffset, frameY - cornerOffset, cornerSize, cornerSize);

        // Top-Right (90 deg)
        drawRotatedImage(cornerImg, frameX + frameW + cornerOffset, frameY - cornerOffset, 90);

        // Bottom-Left (-90 deg)
        drawRotatedImage(cornerImg, frameX - cornerOffset, frameY + frameH + cornerOffset, -90);

        // Bottom-Right (180 deg)
        drawRotatedImage(cornerImg, frameX + frameW + cornerOffset, frameY + frameH + cornerOffset, 180);

        // Draw Decorations
        const decoSize = 50;
        const decoOffset = 10;

        // Pero (Bottom-Left)
        ctx.drawImage(peroImg, frameX + decoOffset, frameY + frameH - decoSize - decoOffset, decoSize, decoSize);

        // Knjiga (Bottom-Right)
        ctx.drawImage(knjigaImg, frameX + frameW - decoSize - decoOffset, frameY + frameH - decoSize - decoOffset, decoSize, decoSize);


        const horizontalInset = Math.max(24, frameW * 0.08);
        const topInset = Math.max(20, frameH * 0.08);
        const bottomInset = Math.max(30, frameH * 0.1);
        const textX = frameX + (frameW / 2);
        const textMaxWidth = Math.max(120, frameW - (horizontalInset * 2));
        const headingY = frameY + topInset;
        const verseBottomY = frameY + frameH - bottomInset;

        // 3. Draw Heading
        const headingFontSize = Math.max(18, frameW * 0.03);
        ctx.font = `italic ${headingFontSize}px Georgia`;
        ctx.fillStyle = '#d4af37';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText('Spomen soba Musa Ćazim Ćatić Tešanj', textX, headingY);


        // 4. Draw Verse
        const verse = verses[currentVerseIndex];
        if (verse) {
            const maxVerseFontSize = Math.max(22, frameW * 0.04);
            const minVerseFontSize = 16;
            let fontSize = maxVerseFontSize;
            const maxLines = 4;

            ctx.font = `italic ${fontSize}px Georgia`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Text Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

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
                ctx.fillText(wrapped.lines[i], textX, verseStartY + (i * lineHeight));
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
