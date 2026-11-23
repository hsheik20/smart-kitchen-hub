# Raspberry Pi device adapter (planned)

Hardware status (Nov 22): the Pi 5 and Arducam IMX708 camera are set up and a test image has been captured on the Pi, but no Pi-specific modules (capture/upload) are implemented in this folder yet. Do not install Picamera2 on macOS; develop and test the backend/frontend independently. Nothing in `backend/` may import from this folder.

Role in the system: capture a still image and send it to `POST /api/scans` (planned) with `source = pi_camera`. Recognition, confirmation, quantities, inventory, and recipes are all handled by the backend and UI. Until hardware works, scans use `source = simulated` (manual selection) or `upload` (image file from a Mac), and the UI labels them as such.

Week 2 tasks (backlog SKH-07):
1. Install Raspberry Pi OS and connect the official camera/display per official cable instructions.
2. Verify capture with `rpicam-still` or Picamera2 using native Raspberry Pi OS packages.
3. Build the capture module and upload to the backend over the local network; delete the local image after upload (no photo retention by default).
4. Keep the simulator/upload fallback working for demo resilience.

Official camera docs: https://www.raspberrypi.com/documentation/accessories/camera-software.html
