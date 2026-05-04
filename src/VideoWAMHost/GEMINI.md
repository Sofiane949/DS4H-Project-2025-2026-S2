# VideoWAMHost

A host environment for **Web Audio Modules (WAMs)** that supports **Video Extensions**. This project allows loading WAMs that can produce video frames (using WebGL) and renders them onto a central canvas synchronized with the audio context.

## Project Overview

-   **Purpose:** To provide a demonstration and development environment for WAMs that include a video component (e.g., visualizers, video effects).
-   **Main Technologies:**
    -   **Web Audio Modules (WAM) SDK 2.0:** Foundation for the plugin architecture.
    -   **WebGL/WebGL2:** Used for high-performance video rendering.
    -   **Vanilla JavaScript (ES Modules):** The project is built without a heavy framework or build step.
-   **Architecture:**
    -   **Host side:** Initializes the WAM host and a custom `VideoExtension`. It uses a `CanvasRenderer` to display textures provided by plugins.
    -   **Extensions:** A custom `VideoExtension` mechanism allows plugins to register a "delegate" that handles video frame generation and connection to the host's WebGL context.

## Project Structure

-   `index.html`: The main entry point and UI layout.
-   `js/index.js`: Orchestrates the host initialization, extension setup, and plugin loading.
-   `js/extensions/`:
    -   `VideoExtension.js`: Manages the mapping between plugin instances and their video delegates.
    -   `videoExtensionHostSide.js`: Contains the `CanvasRenderer` and WebGL shaders for compositing and displaying video frames.
-   `my_video_wam/`: Contains local examples or tests of WAMs.
    -   `quadrafuzz_without_builder/`: A standard audio-only WAM example used for testing the host environment.

## Building and Running

This is a static web project and does not require a build step for the host.

### Running Locally
You can serve the project using any static web server:
```bash
# Using Node.js (serve)
npx serve .

# Using Python
python3 -m http.server
```
Access the application at `http://localhost:3000` (or the port provided by your server).

## Development Conventions

-   **ES Modules:** All JavaScript files are treated as ES modules. Use `import`/`export` and ensure file extensions (e.g., `.js`) are included in import statements.
-   **WAM SDK:** Follows the [Web Audio Modules SDK](https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/docs/) conventions.
-   **Video Extension:** Plugins that wish to display video must implement a `connectVideo(options)` and `render(inputs, currentTime)` method in their extension delegate.
-   **No Build Step:** The project favors raw source code over bundled/minified assets for easier debugging and experimentation in a research/education context.

## Key Files to Reference

-   `js/index.js`: Main logic for loading plugins and starting the render loop.
-   `js/extensions/videoExtensionHostSide.js`: WebGL rendering logic.
-   `my_video_wam/quadrafuzz_without_builder/src/index.js`: Reference for how a WAM is structured.
