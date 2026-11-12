# ⚡ VoltGrid Pro — Smart EV Charging System (DSA Engine)

<p align="left">
  <img src="https://img.shields.io/badge/Language-C%2B%2B11%20%2F%20C%2B%2B20-00599C?style=for-the-badge&logo=c%2B%2B&logoColor=white" />
  <img src="https://img.shields.io/badge/Networking-Winsock%20API-0078D6?style=for-the-badge&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20JS%20%2F%20CSS3-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/Architecture-Client--Server%20REST-0284C7?style=for-the-badge" />
</p>

A full-stack, real-time Smart Electric Vehicle (EV) Charging Slot Management System powered by a native **C++ Winsock HTTP Server** and a live interactive web dashboard.

---

## 🌟 Key Highlights

- **Native C++ Winsock Backend:** Custom-built HTTP server utilizing Windows Sockets (`ws2_32`) for sub-millisecond connection handling.
- **DSA Priority Dispatching:** Utilizes a priority queue (max-heap) to triage emergency and reserved vehicles dynamically.
- **Real-Time Telemetry Dashboard:** Live browser HUD displaying slot availability, charging duration, and live INR invoicing.
- **Zero-Dependency Startup:** Includes one-click `start.bat` that automatically verifies port availability and launches the dashboard.

---

## 🧬 Data Structures & Algorithms (DSA) Engine

| Data Structure | Implementation | Purpose & Logic |
|---|---|---|
| **Priority Queue (Max-Heap)** | `std::priority_queue<Vehicle, vector, PriorityCompare>` | Prioritizes emergency vehicles (`Emergency` = 3 > `Reserved` = 2 > `Normal` = 1), tie-broken by earliest **departure time**. |
| **FIFO Queue** | `std::queue<Vehicle>` | Standard commuter waiting line dispatched in First-In-First-Out order. |
| **Linked List** | `VehicleNode* head` | Master vehicle registry storing and tracking complete vehicle lifecycles (`Waiting` ➔ `Charging` ➔ `Completed`). |
| **Stack (LIFO)** | `std::stack<int>` | Completed session history stack for generating digital invoices and session receipts. |

---

## 🛠️ Project Structure

```text
├── start.bat          # 1-Click Launcher (auto port-check, compiles & launches browser)
├── backend_server.cpp # Native C++ Winsock REST API Server & DSA Engine
├── server.exe         # Pre-compiled standalone C++ executable (no compiler required)
├── index.html         # Responsive VoltGrid Pro Dashboard UI
├── app.js             # Real-time client & DSA visualizer (INR billing, AM/PM time)
├── style.css          # Cyberpunk / clean dark theme UI styling
├── server.py          # Pure Python fallback server
└── README.md          # Project documentation
```

---

## ⚡ Quick Start (Windows)

### Option 1: One-Click Launch (Recommended)
Simply **double-click `start.bat`**:
1. Checks and frees port `8080` if needed.
2. Boots the native C++ backend server.
3. Automatically opens **`http://localhost:8080/`** in your default web browser.

### Option 2: Run C++ Server Manually
```powershell
.\server.exe 8080
```
Then visit `http://localhost:8080` in your browser.

### Option 3: Compile from Source (MinGW GCC)
```powershell
g++ -std=c++11 -O2 backend_server.cpp -o server.exe -lws2_32
.\server.exe 8080
```

### Option 4: Python Fallback
```powershell
python server.py 8080
```

---

## 💰 Billing & Invoicing (India / INR)
- **Tariff Rate**: ₹8.00 / kWh
- **Premium Member Discount**: 15%
- **GST Rate**: 18%
- **Format**: Digital invoice generated from the LIFO Completed Stack with 12-hour AM/PM timestamps.

---

## 👥 Authors & Maintainers
- **Sanjay Sivakumar** ([@sanjaysivakumar07](https://github.com/sanjaysivakumar07)) — *Systems & Backend Architecture*
