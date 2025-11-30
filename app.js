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
        // CSS: top 20px, left 20px, right 20px, bottom 140px (approx relative to viewport)
        // We'll use proportional padding
        const paddingX = canvas.width * 0.05; // 5%
        const paddingTop = canvas.height * 0.03; // 3%
        const paddingBottom = canvas.height * 0.2; // 20% space at bottom

        const frameX = paddingX;
        const frameY = paddingTop;
        const frameW = canvas.width - (paddingX * 2);
        const frameH = canvas.height - paddingTop - paddingBottom;

        ctx.strokeStyle = '#d4af37'; // Gold
        ctx.lineWidth = canvas.width * 0.01; // Responsive border width
        ctx.strokeRect(frameX, frameY, frameW, frameH);

        // Draw Corners (Decorative)
        const cornerSize = canvas.width * 0.08;
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(frameX + cornerSize, frameY - 2);
        ctx.lineTo(frameX - 2, frameY - 2);
        ctx.lineTo(frameX - 2, frameY + cornerSize);
        // Bottom-Right
        ctx.moveTo(frameX + frameW - cornerSize, frameY + frameH + 2);
        ctx.lineTo(frameX + frameW + 2, frameY + frameH + 2);
        ctx.lineTo(frameX + frameW + 2, frameY + frameH - cornerSize);
        ctx.stroke();

        // 3. Draw Verse
        const verse = verses[currentVerseIndex];
        if (verse) {
            const fontSize = canvas.width * 0.05;
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
            const textY = frameY + frameH + (paddingBottom / 2);
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
