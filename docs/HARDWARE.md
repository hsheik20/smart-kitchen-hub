# Hardware purchase plan (do not purchase until confirmed)

## Preferred configuration
- Raspberry Pi 5 **2GB** if overall cost dominates and browser is lightweight; **4GB** if price is acceptable for kiosk headroom
- Official Camera Module 3 (autofocus) plus **correct Raspberry Pi 5 camera adapter cable** — verify retailer bundle contents
- Official Raspberry Pi Touch Display 2 **7-inch**; includes appropriate 22-way-to-15-way display cable and GPIO power cable for Pi 5 (verify package)
- Official compatible 27W USB-C power supply
- 32GB+ quality microSD card, Pi 5 active cooling, mount/stand, possibly a longer camera cable

## Price planning (USD, not live quotes)
- Pi 5 2GB: official Oct 2026 list $77.50 (4GB official published list $110; verify retailer price)
- Camera Module 3: ~$25–35, plus any needed cable
- 7-inch Touch Display 2: official list $60
- PSU, SD, cooling, cables, mount: ~$35–65
- Estimated 2GB assembled total: about $198–238 before tax/shipping, subject to local price, stock, bundles and accessories
- 4GB variation adds $32.50 to the 2GB board, so the fully equipped total will likely approach or exceed $250 after tax and shipping.

## Do not buy duplicate cables
Touch Display 2 7-inch kits normally include display FFC, GPIO cable and screws. Camera Module 3 requires the Pi 5-compatible camera cable; check separately.

## Risks and validation
1. Verify screen orientation for a recipe reader; display is portrait-native.
2. Check enclosure clearance for camera and dual ports.
3. Avoid soldering and building custom power electronics in this project.
4. Test camera (`rpicam-still` or Picamera2) before backend linking.
5. If Pi delivery delayed, demonstrate with Mac photo upload / simulator.

## Official resources
- https://www.raspberrypi.com/documentation/accessories/touch-display-2.html
- https://www.raspberrypi.com/documentation/accessories/camera-software.html
- https://www.raspberrypi.com/news/price-increases-for-2gb-raspberry-pi-4-and-raspberry-pi-5/
