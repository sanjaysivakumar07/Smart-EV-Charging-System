================================================================
  VOLTGRID PRO - Smart EV Charging System
  DSA-Powered C++ Backend + Live Web Dashboard
================================================================

FOLDER CONTENTS
---------------
  start.bat          <- DOUBLE-CLICK THIS TO RUN THE APP
  backend_server.cpp <- C++ backend source code
  server.exe         <- Pre-compiled C++ server (ready to use)
  index.html         <- Web dashboard UI
  app.js             <- Dashboard JavaScript logic
  style.css          <- Dashboard styles
  server.py          <- Python fallback server (if no g++)
  SmartEV.cpp        <- Console-only version (no web)

================================================================
  HOW TO RUN (EASY WAY)
================================================================

  1. Double-click  start.bat
  2. A terminal window opens (keep it open!)
  3. Browser opens automatically to http://localhost:8080
  4. Use the dashboard!
  5. Press Ctrl+C in the terminal to stop.

================================================================
  HOW TO RUN (MANUAL WAY)
================================================================

  Option A - Use pre-compiled server.exe:
    > server.exe 8080
    Then open: http://localhost:8080

  Option B - Compile yourself (requires MinGW g++):
    > g++ -std=c++11 -O2 backend_server.cpp -o server.exe -lws2_32
    > server.exe 8080

  Option C - Python (no compilation needed):
    > python server.py 8080
    Then open: http://localhost:8080

================================================================
  REQUIREMENTS
================================================================

  For C++ server (recommended):
    - Windows 10/11
    - MinGW g++ (https://www.mingw-w64.org/)
      OR just use the included server.exe (no install needed)

  For Python fallback:
    - Python 3.7+ installed
    - No extra pip packages needed (uses stdlib only)

================================================================
  FEATURES
================================================================

  - 5 Charging Bays (CCS & Type 2 connectors)
  - Priority Queue (Emergency > Reserved > Normal)
  - Normal FIFO Queue
  - Completed Stack (LIFO)
  - Vehicle Registry (Linked List)
  - Battery Simulation (+10% per tick)
  - Digital Invoice (Indian Rupees ₹ + 18% GST)
  - Rush Hour simulation (batch vehicle inject)
  - Export to CSV
  - Live event console log

================================================================
  BILLING
================================================================

  Tariff Rate : ₹8.00 / kWh
  Premium Discount : 15% for Premium members
  GST : 18%

================================================================
