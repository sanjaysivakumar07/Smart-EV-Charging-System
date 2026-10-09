import sys
import json
import os
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ============================================================
# SMART EV CHARGING SYSTEM - PYTHON 
# ============================================================

class EVSystem:
    def __init__(self):
        self.reset()

    def reset(self):
        self.stations = [
            {"id": 1, "connectorType": "CCS",   "chargingSpeed": "Fast",   "available": True,  "maintenance": False, "vehicleId": -1},
            {"id": 2, "connectorType": "Type2", "chargingSpeed": "Medium", "available": True,  "maintenance": False, "vehicleId": -1},
            {"id": 3, "connectorType": "CCS",   "chargingSpeed": "Fast",   "available": False, "maintenance": True,  "vehicleId": -1},
            {"id": 4, "connectorType": "Type2", "chargingSpeed": "Fast",   "available": True,  "maintenance": False, "vehicleId": -1},
            {"id": 5, "connectorType": "CCS",   "chargingSpeed": "Medium", "available": True,  "maintenance": False, "vehicleId": -1}
        ]
        self.vehicles = [] # Linked list equivalent
        self.priority_waiting = [] # Priority queue equivalent (Emergency > Reserved > Normal, then departure time)
        self.normal_waiting = [] # Normal queue (FIFO)
        self.completed_vehicles = [] # Stack (LIFO)
        self.logs = []
        self.add_log("SYSTEM", "System initialized with 5 charging stations.")

    def add_log(self, log_type, message):
        t_str = time.strftime("%H:%M:%S")
        entry = {"time": t_str, "type": log_type, "message": message}
        self.logs.append(entry)
        if len(self.logs) > 100:
            self.logs.pop(0)
        print(f"[{t_str}] [{log_type}] {message}")

    def find_vehicle(self, v_id):
        for v in self.vehicles:
            if v["id"] == v_id:
                return v
        return None

    def find_best_station(self, vehicle):
        best_station_idx = -1
        best_speed = 0

        for i, station in enumerate(self.stations):
            if station["maintenance"]:
                continue
            if not station["available"]:
                continue
            if station["connectorType"] != vehicle["connectorType"]:
                continue
            if vehicle["chargingRequirement"] == "Fast" and station["chargingSpeed"] != "Fast":
                continue

            speed_val = 1
            if station["chargingSpeed"] == "Medium":
                speed_val = 2
            elif station["chargingSpeed"] == "Fast":
                speed_val = 3

            if speed_val > best_speed:
                best_speed = speed_val
                best_station_idx = i

        return best_station_idx

    def assign_vehicle(self, vehicle):
        idx = self.find_best_station(vehicle)
        if idx == -1:
            return False

        st = self.stations[idx]
        st["available"] = False
        st["vehicleId"] = vehicle["id"]
        vehicle["status"] = "Charging"
        vehicle["assignedStationId"] = st["id"]

        self.add_log("ASSIGN", f"Vehicle #{vehicle['id']} assigned to Station {st['id']} ({st['connectorType']} {st['chargingSpeed']})")
        return True

    def sort_priority_queue(self):
        def priority_weight(p):
            if p == "Emergency": return 3
            if p == "Reserved": return 2
            return 1

        # Higher priority first, then earlier departure time
        self.priority_waiting.sort(
            key=lambda v: (-priority_weight(v.get("priority", "Normal")), v.get("departureTime", "99:99"))
        )

    def process_waiting_vehicles(self):
        # 1. Check priority queue
        if self.priority_waiting:
            top_v = self.priority_waiting[0]
            if self.assign_vehicle(top_v):
                self.priority_waiting.pop(0)
                self.add_log("AUTO-DISPATCH", f"Auto-dispatched Vehicle #{top_v['id']} from Priority Queue")
                return

        # 2. Check normal queue
        if self.normal_waiting:
            top_v = self.normal_waiting[0]
            if self.assign_vehicle(top_v):
                self.normal_waiting.pop(0)
                self.add_log("AUTO-DISPATCH", f"Auto-dispatched Vehicle #{top_v['id']} from Normal Queue")

    def add_vehicle(self, data):
        v_id = int(data.get("id", 0))
        if v_id <= 0:
            v_id = max([v["id"] for v in self.vehicles], default=100) + 1

        if self.find_vehicle(v_id) is not None:
            return False, "Vehicle ID already exists!"

        vehicle = {
            "id": v_id,
            "batteryLevel": int(data.get("batteryLevel", 50)),
            "connectorType": data.get("connectorType", "CCS"),
            "chargingRequirement": data.get("chargingRequirement", "Normal"),
            "priority": data.get("priority", "Normal"),
            "departureTime": data.get("departureTime", "12:00"),
            "membership": data.get("membership", "Regular"),
            "reservation": data.get("reservation", "No"),
            "status": "Waiting",
            "assignedStationId": -1,
            "queuedAt": time.strftime("%H:%M:%S")
        }

        self.vehicles.append(vehicle)

        assigned = self.assign_vehicle(vehicle)
        queue_type = "None"

        if not assigned:
            if vehicle["priority"] in ["Emergency", "Reserved"]:
                self.priority_waiting.append(vehicle)
                self.sort_priority_queue()
                queue_type = "Priority"
                self.add_log("QUEUE", f"Vehicle #{vehicle['id']} queued in PRIORITY QUEUE ({vehicle['priority']}, Dep: {vehicle['departureTime']})")
            else:
                self.normal_waiting.append(vehicle)
                queue_type = "Normal"
                self.add_log("QUEUE", f"Vehicle #{vehicle['id']} queued in NORMAL QUEUE")

        return True, {"assigned": assigned, "queueType": queue_type, "vehicle": vehicle}

    def release_station(self, station_id):
        idx = -1
        for i, s in enumerate(self.stations):
            if s["id"] == station_id:
                idx = i
                break

        if idx == -1:
            return False, "Invalid station ID"
        if self.stations[idx]["maintenance"]:
            return False, "Station is under maintenance"
        if self.stations[idx]["available"]:
            return False, "Station is already available"

        v_id = self.stations[idx]["vehicleId"]
        v = self.find_vehicle(v_id)
        if v:
            v["status"] = "Completed"
            v["assignedStationId"] = -1

        self.completed_vehicles.append(v_id)
        self.stations[idx]["available"] = True
        self.stations[idx]["vehicleId"] = -1

        self.add_log("RELEASE", f"Station {station_id} released. Vehicle #{v_id} completed.")
        self.process_waiting_vehicles()
        return True, "Station released successfully"

    def toggle_maintenance(self, station_id):
        idx = -1
        for i, s in enumerate(self.stations):
            if s["id"] == station_id:
                idx = i
                break

        if idx == -1:
            return False, "Invalid station ID"

        s = self.stations[idx]
        s["maintenance"] = not s["maintenance"]
        if s["maintenance"]:
            s["available"] = False
            self.add_log("MAINTENANCE", f"Station {station_id} placed under MAINTENANCE.")
        else:
            s["available"] = (s["vehicleId"] == -1)
            self.add_log("MAINTENANCE", f"Station {station_id} resumed online.")
            if s["available"]:
                self.process_waiting_vehicles()

        return True, f"Station {station_id} maintenance toggled"

    def simulate(self):
        presets = [
            {"id": 201, "batteryLevel": 15, "connectorType": "CCS",   "chargingRequirement": "Fast",   "priority": "Emergency", "departureTime": "08:15", "membership": "Premium", "reservation": "Yes"},
            {"id": 202, "batteryLevel": 30, "connectorType": "Type2", "chargingRequirement": "Normal", "priority": "Reserved",  "departureTime": "09:00", "membership": "Premium", "reservation": "Yes"},
            {"id": 203, "batteryLevel": 45, "connectorType": "CCS",   "chargingRequirement": "Normal", "priority": "Normal",    "departureTime": "10:30", "membership": "Regular", "reservation": "No"},
            {"id": 204, "batteryLevel": 20, "connectorType": "Type2", "chargingRequirement": "Fast",   "priority": "Normal",    "departureTime": "11:00", "membership": "Regular", "reservation": "No"},
            {"id": 205, "batteryLevel": 10, "connectorType": "CCS",   "chargingRequirement": "Fast",   "priority": "Emergency", "departureTime": "07:45", "membership": "Premium", "reservation": "No"},
            {"id": 206, "batteryLevel": 60, "connectorType": "CCS",   "chargingRequirement": "Medium", "priority": "Reserved",  "departureTime": "09:30", "membership": "Regular", "reservation": "Yes"}
        ]
        added = 0
        for p in presets:
            if self.find_vehicle(p["id"]) is None:
                self.add_vehicle(p)
        return added

    def rebuild_queues(self):
        self.priority_waiting = []
        self.normal_waiting = []
        for v in self.vehicles:
            if v.get("status") == "Waiting":
                if v.get("priority") in ["Emergency", "Reserved"]:
                    self.priority_waiting.append(v)
                else:
                    self.normal_waiting.append(v)
        self.sort_priority_queue()

    def tick_charging(self):
        fully_charged = []
        for s in self.stations:
            if not s["available"] and s["vehicleId"] != -1:
                v = self.find_vehicle(s["vehicleId"])
                if v and v.get("status") == "Charging":
                    inc = 5 if s["chargingSpeed"] == "Fast" else 3
                    v["batteryLevel"] = min(100, v.get("batteryLevel", 0) + inc)
                    if v["batteryLevel"] == 100:
                        fully_charged.append(v["id"])
        return fully_charged

    def escalate_vehicle(self, v_id, new_priority="Emergency"):
        v = self.find_vehicle(v_id)
        if not v:
            return False, "Vehicle not found"
        v["priority"] = new_priority
        self.rebuild_queues()
        self.add_log("ESCALATE", f"Vehicle #{v_id} escalated to priority [{new_priority}]")
        return True, "Vehicle priority escalated"

    def cancel_vehicle(self, v_id):
        v = self.find_vehicle(v_id)
        if not v:
            return False, "Vehicle not found"
        if v.get("status") == "Charging":
            for s in self.stations:
                if s["vehicleId"] == v_id:
                    return self.release_station(s["id"])
        elif v.get("status") == "Waiting":
            v["status"] = "Cancelled"
            self.rebuild_queues()
            self.add_log("CANCEL", f"Vehicle #{v_id} cancelled and removed from queue")
            return True, "Vehicle cancelled successfully"
        return False, "Vehicle cannot be cancelled"

    def export_csv(self):
        lines = ["ID,BatteryPercent,ConnectorType,ChargingRequirement,Priority,DepartureTime,Membership,Reservation,Status,AssignedBay"]
        for v in self.vehicles:
            bay_str = f"Bay {v['assignedStationId']}" if v.get("assignedStationId", -1) != -1 else "N/A"
            lines.append(f"{v['id']},{v['batteryLevel']}%,{v['connectorType']},{v['chargingRequirement']},{v['priority']},{v['departureTime']},{v['membership']},{v['reservation']},{v['status']},{bay_str}")
        return "\n".join(lines)

system = EVSystem()

class RequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, status_code, data):
        content = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def serve_file(self, filename, content_type):
        paths_to_check = [
            os.path.join(os.path.dirname(__file__), "public", filename),
            os.path.join(os.path.dirname(__file__), filename)
        ]
        for p in paths_to_check:
            if os.path.exists(p):
                with open(p, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", f"{content_type}; charset=utf-8")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
        self.send_response(404)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path in ["/", "/index.html"]:
            self.serve_file("index.html", "text/html")
        elif path == "/style.css":
            self.serve_file("style.css", "text/css")
        elif path == "/app.js":
            self.serve_file("app.js", "text/javascript")
        elif path == "/api/status":
            charging_count = sum(1 for s in system.stations if not s["available"] and not s["maintenance"])
            avail_count = sum(1 for s in system.stations if s["available"])
            maint_count = sum(1 for s in system.stations if s["maintenance"])
            grid_power = 10
            for s in system.stations:
                if not s["available"] and not s["maintenance"]:
                    grid_power += 120 if s["chargingSpeed"] == "Fast" else 45

            comp_count = len(system.completed_vehicles)
            co2_saved = round((comp_count * 14.5) + (charging_count * 4.2), 1)
            total_kwh = round((comp_count * 48.0) + (charging_count * 18.5), 1)

            self.send_json(200, {
                "server": "Python Standard Backend",
                "status": "online",
                "totalVehicles": len(system.vehicles),
                "chargingCount": charging_count,
                "waitingCount": len(system.priority_waiting) + len(system.normal_waiting),
                "priorityQueueCount": len(system.priority_waiting),
                "normalQueueCount": len(system.normal_waiting),
                "completedCount": comp_count,
                "availableStations": avail_count,
                "maintenanceStations": maint_count,
                "totalStations": 5,
                "gridPowerKW": grid_power,
                "gridCapacityKW": 500,
                "solarMixPercent": 48,
                "co2SavedKg": co2_saved,
                "totalKwhDelivered": total_kwh,
                "tariffRate": 0.25
            })
        elif path == "/api/export":
            csv_data = system.export_csv().encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", "attachment; filename=\"voltgrid_vehicles.csv\"")
            self.send_header("Content-Length", str(len(csv_data)))
            self.end_headers()
            self.wfile.write(csv_data)
        elif path == "/api/stations":
            result = []
            for s in system.stations:
                st_data = dict(s)
                if s["vehicleId"] != -1:
                    st_data["vehicle"] = system.find_vehicle(s["vehicleId"])
                else:
                    st_data["vehicle"] = None
                result.append(st_data)
            self.send_json(200, result)
        elif path == "/api/vehicles":
            v_list = list(system.vehicles)
            if "sort" in query and "departure" in query["sort"]:
                v_list.sort(key=lambda x: x.get("departureTime", "99:99"))
            self.send_json(200, v_list)
        elif path == "/api/queues":
            self.send_json(200, {
                "priorityQueue": system.priority_waiting,
                "normalQueue": system.normal_waiting
            })
        elif path == "/api/completed":
            res = []
            for v_id in reversed(system.completed_vehicles):
                v = system.find_vehicle(v_id)
                res.append(v if v else {"id": v_id, "status": "Completed"})
            self.send_json(200, res)
        elif path == "/api/logs":
            self.send_json(200, system.logs)
        else:
            self.send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length)
        body = {}
        if post_data:
            try:
                body = json.loads(post_data.decode("utf-8"))
            except Exception:
                pass

        if path == "/api/vehicles":
            ok, res = system.add_vehicle(body)
            if ok:
                self.send_json(201, {"success": True, **res})
            else:
                self.send_json(400, {"success": False, "error": res})
        elif path == "/api/vehicles/tick":
            charged = system.tick_charging()
            self.send_json(200, {"success": True, "fullyCharged": charged})
        elif path == "/api/vehicles/escalate":
            v_id = int(body.get("id", query.get("id", [-1])[0]))
            new_p = body.get("priority", query.get("priority", ["Emergency"])[0])
            ok, msg = system.escalate_vehicle(v_id, new_p)
            if ok:
                self.send_json(200, {"success": True, "message": msg})
            else:
                self.send_json(400, {"success": False, "error": msg})
        elif path == "/api/vehicles/cancel":
            v_id = int(body.get("id", query.get("id", [-1])[0]))
            ok, msg = system.cancel_vehicle(v_id)
            if ok:
                self.send_json(200, {"success": True, "message": msg})
            else:
                self.send_json(400, {"success": False, "error": msg})
        elif path == "/api/stations/release":
            station_id = int(body.get("stationId", query.get("stationId", [-1])[0]))
            ok, msg = system.release_station(station_id)
            if ok:
                self.send_json(200, {"success": True, "message": msg})
            else:
                self.send_json(400, {"success": False, "error": msg})
        elif path == "/api/stations/maintenance":
            station_id = int(body.get("stationId", query.get("stationId", [-1])[0]))
            ok, msg = system.toggle_maintenance(station_id)
            if ok:
                self.send_json(200, {"success": True, "message": msg})
            else:
                self.send_json(400, {"success": False, "error": msg})
        elif path == "/api/reset":
            system.reset()
            self.send_json(200, {"success": True, "message": "System reset"})
        elif path == "/api/simulate":
            added = system.simulate()
            self.send_json(200, {"success": True, "added": added, "message": f"{added} vehicles added to simulation"})
        else:
            self.send_json(404, {"error": "Endpoint not found"})

def run_server(port=8080):
    server_address = ("", port)
    httpd = HTTPServer(server_address, RequestHandler)
    print("=" * 60)
    print("  SMART EV CHARGING SYSTEM - PYTHON BACKEND SERVER")
    print("=" * 60)
    print(f" Server running at: http://localhost:{port}")
    print(" Serving dashboard and REST API.")
    print(" Press Ctrl+C to stop.")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == "__main__":
    p = 8080
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except ValueError:
            pass
    run_server(p)
