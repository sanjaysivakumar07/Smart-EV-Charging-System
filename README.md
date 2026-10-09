# ⚡ VoltGrid Pro — Smart EV Charging System (DSA Engine)

A full-stack, real-time Smart Electric Vehicle (EV) Charging Slot Management System powered by a native **C++ Winsock HTTP Server** and modern web dashboard.

---

## 🚀 Live GitHub Repository
🔗 **[https://github.com/sanjaysivakumar07/Smart-EV-Charging-System](https://github.com/sanjaysivakumar07/Smart-EV-Charging-System)**

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
Simply **double-click** [`start.bat`](file:///C:/CPP/Smart_EV_Charging_System/DS%20PROJECT/start.bat):
1. Automatically checks and frees port `8080` if needed.
2. Starts the C++ backend server.
3. Automatically opens **`http://localhost:8080/`** in your default browser.

### Option 2: Run C++ Server Manually
```powershell
.\server.exe 8080
```

### Option 3: Compile from Source (MinGW GCC)
```powershell
g++ -std=c++11 -O2 backend_server.cpp -o server.exe -lws2_32
.\server.exe 8080
```

---

## 💰 Billing & Invoicing (India / INR)
- **Tariff Rate**: ₹8.00 / kWh
- **Premium Member Discount**: 15%
- **GST Rate**: 18%
- **Format**: Digital invoice generated from the LIFO Completed Stack with 12-hour AM/PM timestamps.

---

## 👥 Authors
- **Sanjay Sivakumar** ([@sanjaysivakumar07](https://github.com/sanjaysivakumar07))
