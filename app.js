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
        } catch (err) {
            console.error("Camera error:", err);
            throw err;
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

        // 1. Draw Video (Mirrored)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();

        // 2. Draw Frame
        // Calculate frame dimensions based on video size, mimicking CSS
        const isLandscape = canvas.width > canvas.height;

        let paddingX, paddingTop, paddingBottom;

        if (isLandscape) {
            // Landscape: Controls on right
            paddingX = 20; // 20px left
            const paddingRight = 140; // 140px right for controls
            paddingTop = 20;
            paddingBottom = 20;

            var frameX = paddingX;
            var frameY = paddingTop;
            var frameW = canvas.width - paddingX - paddingRight;
            var frameH = canvas.height - paddingTop - paddingBottom;
        } else {
            // Portrait: Controls on bottom
            paddingX = 20;
            paddingTop = 20;
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


        // 3. Draw Verse
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
            const textX = canvas.width / 2;
            const textY = frameY + frameH + (paddingBottom / 2); // Center in the bottom padding area
            const maxWidth = canvas.width * 0.9;

            wrapText(ctx, `"${verse}"`, textX, textY, maxWidth, fontSize * 1.2);
        }

        // 4. Download
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
