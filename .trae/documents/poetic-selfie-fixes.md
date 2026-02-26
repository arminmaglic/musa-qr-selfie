# Poetic Selfie Frame App - Fixes Plan

## Overview
Fix two issues in the Musa Ćazim Ćatić selfie app:
1. Add heading at the top
2. Fix camera rotation in landscape mode

---

## Issue 1: Add Heading

### Problem
No heading is displayed at the top of the app.

### Solution
Add heading element "Spomen soba Musa Ćazim Ćatić Tešanj" at the top of the app.

### Implementation
**File: index.html**
- Add heading element before `#frame-overlay`:
  ```html
  <h1 id="app-heading">Spomen soba Musa Ćazim Ćatić Tešanj</h1>
  ```

**File: style.css**
- Style the heading:
  - Position absolute at top
  - Width 100%, text-align center
  - Font: Georgia, italic, gold color (#d4af37)
  - Text shadow for readability
  - z-index: 5 (above camera, below frame)
  - Padding for spacing
- Update `#frame-overlay` to move down below heading (adjust top padding)
- Update responsive layout for landscape mode

---

## Issue 2: Camera Rotation in Landscape Mode

### Problem
Camera displays incorrectly rotated when device is in landscape orientation.

### Root Cause Analysis
1. CSS mirror transform `scaleX(-1)` is static (applies regardless of orientation)
2. Front-facing camera needs different rotation handling in landscape
3. Device orientation changes don't trigger camera stream reconfiguration

### Solution
Handle camera rotation based on device orientation and update video element transform dynamically.

### Implementation
**File: app.js**
1. Add orientation detection:
   ```javascript
   function updateCameraTransform() {
       const isLandscape = window.innerWidth > window.innerHeight;
       if (isLandscape) {
           // Landscape: rotate -90deg and mirror
           video.style.transform = 'scaleX(-1) rotate(-90deg)';
       } else {
           // Portrait: just mirror
           video.style.transform = 'scaleX(-1)';
       }
   }
   ```

2. Listen for orientation changes:
   ```javascript
   window.addEventListener('resize', updateCameraTransform);
   window.addEventListener('orientationchange', updateCameraTransform);
   ```

3. Update `takePhoto()` function to handle landscape mirroring:
   - Modify canvas transform logic based on current orientation
   - Rotate canvas context -90deg when landscape

**File: style.css**
- Update `#camera` transform to be applied via JS (remove static `transform: scaleX(-1)`)

---

## Implementation Steps

1. Add heading HTML element to index.html
2. Add heading styles to style.css (portrait mode)
3. Add heading styles for landscape mode (media query)
4. Adjust #frame-overlay positioning for both orientations
5. Remove static transform from #camera in style.css
6. Add updateCameraTransform() function to app.js
7. Add orientation change listeners to app.js
8. Update takePhoto() canvas logic for landscape rotation
9. Test in both portrait and landscape orientations

---

## Testing Checklist
- [ ] Heading displays correctly at top in portrait mode
- [ ] Heading displays correctly at top in landscape mode
- [ ] Heading text is readable on camera feed
- [ ] Camera mirrors correctly in portrait mode
- [ ] Camera mirrors and rotates correctly in landscape mode
- [ ] Photo capture works in both orientations
- [ ] Captured photos have correct frame/verse overlay
