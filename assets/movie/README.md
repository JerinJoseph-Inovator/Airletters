# Movie Assets

## Adding Your Movie

To use your own movie file:

1. **Copy your movie file** to this folder as `movie.mp4`
   - The file should be named exactly `movie.mp4`
   - Supported formats: MP4, MOV, M4V
   - Recommended: H.264 codec for best compatibility

2. **Add a thumbnail** (optional):
   - Copy a thumbnail image as `movie1-thumb.jpg`
   - Recommended size: 300x200 pixels
   - This will be used as the movie poster

3. **Update movie details** in `src/lib/movieService.js`:
   - Change the duration to match your movie's length (in minutes)
   - Update the title and description
   - Adjust the file size display

## Current Setup

The app is configured to use your local `movie.mp4` file. If you haven't added it yet, you may see loading errors.

## Features Added

✅ **Scroll Support**: The movie screen now has scrolling for better navigation
✅ **Fullscreen Mode**: Tap the "⛶ Fullscreen" button for immersive viewing
✅ **Touch Controls**: In fullscreen, tap the screen to show/hide controls
✅ **Play/Pause**: Easy video controls with play/pause button
✅ **Landscape Support**: Fullscreen automatically rotates to landscape

## File Structure

```
assets/movie/
├── movie.mp4          (your movie file - add this)
├── movie1-thumb.jpg   (thumbnail - optional)
└── README.md          (this file)
```

## How to Use

1. **Regular View**: Use the play/pause button to control playback
2. **Fullscreen**: Tap "⛶ Fullscreen" for cinematic experience
3. **Controls**: In fullscreen, tap anywhere to show/hide controls
4. **Exit**: Use "✕ Exit Fullscreen" button or back gesture

## Troubleshooting

- If the video doesn't load, ensure the file is named exactly `movie.mp4`
- Check that the file is a valid video format
- Try restarting the Expo app after adding the file
- For large files, ensure you have enough device storage
4. Use "Full Screen" button to test full-screen mode
