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

        // 2. Draw Frame + Text using geometry captured from DOM/CSS.
        const captureLayout = computeCaptureLayoutFromDom(canvas);
        if (!captureLayout) return;

        const frameX = captureLayout.frame.x;
        const frameY = captureLayout.frame.y;
        const frameW = captureLayout.frame.width;
        const frameH = captureLayout.frame.height;

        // Draw Lines (Brown #573705)
        ctx.fillStyle = '#573705';
        Object.values(captureLayout.lines).forEach((lineRect) => {
            if (!lineRect) return;
            ctx.fillRect(lineRect.x, lineRect.y, lineRect.width, lineRect.height);
        });

        // Draw Corners
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

        // Draw Decorations
        if (captureLayout.decorations.pero) {
            const peroRect = captureLayout.decorations.pero;
            ctx.drawImage(peroImg, peroRect.x, peroRect.y, peroRect.width, peroRect.height);
        }
        if (captureLayout.decorations.knjiga) {
            const knjigaRect = captureLayout.decorations.knjiga;
            ctx.drawImage(knjigaImg, knjigaRect.x, knjigaRect.y, knjigaRect.width, knjigaRect.height);
        }


        // 3. Draw Heading
        const headingRect = captureLayout.heading;
        const headingFontSize = headingRect ? Math.max(12, headingRect.height * 0.55) : Math.max(18, canvas.width * 0.03);
        ctx.font = `italic ${headingFontSize}px Georgia`;
        ctx.fillStyle = '#d4af37';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const headingX = headingRect ? headingRect.x + (headingRect.width / 2) : canvas.width / 2;
        const headingY = headingRect ? headingRect.y : 15;
        ctx.fillText(captureLayout.headingText, headingX, headingY);


        // 4. Draw Verse
        const verse = verses[currentVerseIndex];
        if (verse) {
            const fontSize = Math.max(24, canvas.width * 0.04); // Responsive font size
            ctx.font = `italic ${fontSize}px Georgia`;
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text Shadow
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            // Wrap text
            const verseRect = captureLayout.verse;
            const textX = verseRect ? verseRect.x + (verseRect.width / 2) : canvas.width / 2;
            const textY = verseRect ? verseRect.y + (verseRect.height / 2) : frameY + frameH + 40;
            const maxWidth = verseRect ? verseRect.width : canvas.width * 0.9;

            wrapText(ctx, `"${verse}"`, textX, textY, maxWidth, fontSize * 1.2);
        }

        // 5. Download
        const link = document.createElement('a');
        link.download = `musa-selfie-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        const lines = [];

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            const testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        // Adjust Y to center the block of text
        const totalHeight = lines.length * lineHeight;
        let startY = y - (totalHeight / 2) + (lineHeight / 2);

        for (let k = 0; k < lines.length; k++) {
            ctx.fillText(lines[k], x, startY + (k * lineHeight));
        }
    }
});
