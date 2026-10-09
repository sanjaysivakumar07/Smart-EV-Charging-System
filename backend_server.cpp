#include <algorithm>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <queue>
#include <sstream>
#include <stack>
#include <string>
#include <vector>
#include <windows.h>
#include <winsock2.h>

#pragma comment(lib, "ws2_32.lib")

using namespace std;

// ============================================================
// 1. DATA STRUCTURES & DEFINITIONS
// ============================================================

struct Vehicle {
  int id;
  int batteryLevel;
  string connectorType;
  string chargingRequirement;
  string priority;
  string departureTime;
  string membership;
  string reservation;
  string status;         // "Charging", "Waiting", "Completed"
  int assignedStationId; // -1 if not charging
  string queuedAt;
};

struct ChargingStation {
  int id;
  string connectorType;
  string chargingSpeed;
  bool available;
  bool maintenance;
  int vehicleId;
};

struct VehicleNode {
  Vehicle vehicle;
  VehicleNode *next;
};

struct SystemLog {
  string time;
  string type; // "ASSIGN", "QUEUE", "RELEASE", "MAINTENANCE", "SYSTEM"
  string message;
};

// ============================================================
// 2. PRIORITY COMPARATOR
// ============================================================

int getPriorityValue(const string &priority) {
  if (priority == "Emergency")
    return 3;
  if (priority == "Reserved")
    return 2;
  return 1;
}

struct PriorityCompare {
  bool operator()(const Vehicle &a, const Vehicle &b) const {
    int priorityA = getPriorityValue(a.priority);
    int priorityB = getPriorityValue(b.priority);
    if (priorityA != priorityB) {
      return priorityA < priorityB; // Higher priority on top
    }
    return a.departureTime > b.departureTime; // Earlier departure time on top
  }
};

// ============================================================
// 3. GLOBAL STATE
// ============================================================

ChargingStation stations[5] = {{1, "CCS", "Fast", true, false, -1},
                               {2, "Type2", "Medium", true, false, -1},
                               {3, "CCS", "Fast", false, true, -1},
                               {4, "Type2", "Fast", true, false, -1},
                               {5, "CCS", "Medium", true, false, -1}};

VehicleNode *head = nullptr;
priority_queue<Vehicle, vector<Vehicle>, PriorityCompare> priorityWaiting;
queue<Vehicle> normalWaiting;
stack<int> completedVehicles;
vector<SystemLog> systemLogs;

// Helper: current timestamp string
string getCurrentTimeString() {
  time_t now = time(nullptr);
  tm *ltm = localtime(&now);
  stringstream ss;
  ss << setfill('0') << setw(2) << ltm->tm_hour << ":" << setfill('0')
     << setw(2) << ltm->tm_min << ":" << setfill('0') << setw(2) << ltm->tm_sec;
  return ss.str();
}

void addLog(const string &type, const string &msg) {
  SystemLog log;
  log.time = getCurrentTimeString();
  log.type = type;
  log.message = msg;
  systemLogs.push_back(log);
  if (systemLogs.size() > 100) {
    systemLogs.erase(systemLogs.begin());
  }
  cout << "[" << log.time << "] [" << log.type << "] " << log.message << "\n";
}

// ============================================================
// 4. LINKED LIST & CORE ALGORITHMS
// ============================================================

Vehicle *findVehicle(int id) {
  VehicleNode *curr = head;
  while (curr != nullptr) {
    if (curr->vehicle.id == id)
      return &(curr->vehicle);
    curr = curr->next;
  }
  return nullptr;
}

void addToLinkedList(Vehicle vehicle) {
  VehicleNode *newNode = new VehicleNode;
  newNode->vehicle = vehicle;
  newNode->next = nullptr;
  if (head == nullptr) {
    head = newNode;
  } else {
    VehicleNode *curr = head;
    while (curr->next != nullptr) {
      curr = curr->next;
    }
    curr->next = newNode;
  }
}

void updateStatus(int id, string status, int stationId = -1) {
  VehicleNode *curr = head;
  while (curr != nullptr) {
    if (curr->vehicle.id == id) {
      curr->vehicle.status = status;
      curr->vehicle.assignedStationId = stationId;
      return;
    }
    curr = curr->next;
  }
}

int findBestStation(const Vehicle &vehicle) {
  int bestStation = -1;
  int bestSpeed = 0;

  for (int i = 0; i < 5; i++) {
    if (stations[i].maintenance)
      continue;
    if (!stations[i].available)
      continue;
    if (stations[i].connectorType != vehicle.connectorType)
      continue;
    if (vehicle.chargingRequirement == "Fast" &&
        stations[i].chargingSpeed != "Fast")
      continue;

    int speed = 1;
    if (stations[i].chargingSpeed == "Medium")
      speed = 2;
    if (stations[i].chargingSpeed == "Fast")
      speed = 3;

    if (speed > bestSpeed) {
      bestSpeed = speed;
      bestStation = i;
    }
  }
  return bestStation;
}

bool assignVehicle(Vehicle vehicle) {
  int stationIdx = findBestStation(vehicle);
  if (stationIdx == -1)
    return false;

  stations[stationIdx].available = false;
  stations[stationIdx].vehicleId = vehicle.id;
  updateStatus(vehicle.id, "Charging", stations[stationIdx].id);

  stringstream ss;
  ss << "Vehicle #" << vehicle.id << " assigned to Station "
     << stations[stationIdx].id << " (" << stations[stationIdx].connectorType
     << " " << stations[stationIdx].chargingSpeed << ")";
  addLog("ASSIGN", ss.str());
  return true;
}

void processWaitingVehicles() {
  // 1. Check priority queue
  if (!priorityWaiting.empty()) {
    Vehicle v = priorityWaiting.top();
    if (assignVehicle(v)) {
      priorityWaiting.pop();
      stringstream ss;
      ss << "Auto-dispatched Vehicle #" << v.id << " from Priority Queue";
      addLog("AUTO-DISPATCH", ss.str());
      return;
    }
  }

  // 2. Check normal queue
  if (!normalWaiting.empty()) {
    Vehicle v = normalWaiting.front();
    if (assignVehicle(v)) {
      normalWaiting.pop();
      stringstream ss;
      ss << "Auto-dispatched Vehicle #" << v.id << " from Normal Queue";
      addLog("AUTO-DISPATCH", ss.str());
    }
  }
}

bool releaseStationById(int stationId, string &errorMsg) {
  int idx = -1;
  for (int i = 0; i < 5; i++) {
    if (stations[i].id == stationId) {
      idx = i;
      break;
    }
  }

  if (idx == -1) {
    errorMsg = "Invalid station ID";
    return false;
  }
  if (stations[idx].maintenance) {
    errorMsg = "Station is under maintenance";
    return false;
  }
  if (stations[idx].available) {
    errorMsg = "Station is already available";
    return false;
  }

  int vId = stations[idx].vehicleId;
  updateStatus(vId, "Completed", -1);
  completedVehicles.push(vId);

  stations[idx].available = true;
  stations[idx].vehicleId = -1;

  stringstream ss;
  ss << "Station " << stationId << " released. Vehicle #" << vId
     << " marked Completed";
  addLog("RELEASE", ss.str());

  processWaitingVehicles();
  return true;
}

bool toggleMaintenance(int stationId, string &errorMsg) {
  int idx = -1;
  for (int i = 0; i < 5; i++) {
    if (stations[i].id == stationId) {
      idx = i;
      break;
    }
  }
  if (idx == -1) {
    errorMsg = "Invalid station ID";
    return false;
  }

  stations[idx].maintenance = !stations[idx].maintenance;
  if (stations[idx].maintenance) {
    stations[idx].available = false;
    stringstream ss;
    ss << "Station " << stationId << " placed under MAINTENANCE";
    addLog("MAINTENANCE", ss.str());
  } else {
    stations[idx].available = (stations[idx].vehicleId == -1);
    stringstream ss;
    ss << "Station " << stationId << " taken out of maintenance -> "
       << (stations[idx].available ? "AVAILABLE" : "OCCUPIED");
    addLog("MAINTENANCE", ss.str());
    if (stations[idx].available) {
      processWaitingVehicles();
    }
  }
  return true;
}

void resetSystem() {
  // Clear stations
  stations[0] = {1, "CCS", "Fast", true, false, -1};
  stations[1] = {2, "Type2", "Medium", true, false, -1};
  stations[2] = {3, "CCS", "Fast", false, true, -1};
  stations[3] = {4, "Type2", "Fast", true, false, -1};
  stations[4] = {5, "CCS", "Medium", true, false, -1};

  // Free linked list
  VehicleNode *curr = head;
  while (curr != nullptr) {
    VehicleNode *next = curr->next;
    delete curr;
    curr = next;
  }
  head = nullptr;

  // Clear queues and stack
  while (!priorityWaiting.empty())
    priorityWaiting.pop();
  while (!normalWaiting.empty())
    normalWaiting.pop();
  while (!completedVehicles.empty())
    completedVehicles.pop();

  addLog("SYSTEM", "System reset to default initial state.");
}

void rebuildQueuesFromLinkedList() {
  while (!priorityWaiting.empty())
    priorityWaiting.pop();
  while (!normalWaiting.empty())
    normalWaiting.pop();

  VehicleNode *curr = head;
  while (curr != nullptr) {
    if (curr->vehicle.status == "Waiting") {
      if (curr->vehicle.priority == "Emergency" ||
          curr->vehicle.priority == "Reserved") {
        priorityWaiting.push(curr->vehicle);
      } else {
        normalWaiting.push(curr->vehicle);
      }
    }
    curr = curr->next;
  }
}

vector<int> tickCharging() {
  vector<int> fullyCharged;
  for (int i = 0; i < 5; i++) {
    if (!stations[i].available && stations[i].vehicleId != -1) {
      Vehicle *v = findVehicle(stations[i].vehicleId);
      if (v != nullptr && v->status == "Charging") {
        int increment = (stations[i].chargingSpeed == "Fast") ? 5 : 3;
        v->batteryLevel = min(100, v->batteryLevel + increment);
        if (v->batteryLevel == 100) {
          fullyCharged.push_back(v->id);
        }
      }
    }
  }
  return fullyCharged;
}

bool escalateVehicle(int vId, const string &newPriority, string &err) {
  Vehicle *v = findVehicle(vId);
  if (v == nullptr) {
    err = "Vehicle not found";
    return false;
  }
  v->priority = newPriority;
  rebuildQueuesFromLinkedList();
  stringstream ss;
  ss << "Vehicle #" << vId << " escalated to priority [" << newPriority << "]";
  addLog("ESCALATE", ss.str());
  return true;
}

bool cancelVehicle(int vId, string &err) {
  Vehicle *v = findVehicle(vId);
  if (v == nullptr) {
    err = "Vehicle not found";
    return false;
  }
  if (v->status == "Charging") {
    for (int i = 0; i < 5; i++) {
      if (stations[i].vehicleId == vId) {
        return releaseStationById(stations[i].id, err);
      }
    }
  } else if (v->status == "Waiting") {
    v->status = "Cancelled";
    rebuildQueuesFromLinkedList();
    stringstream ss;
    ss << "Vehicle #" << vId << " cancelled and removed from queue";
    addLog("CANCEL", ss.str());
    return true;
  }
  err = "Vehicle is already completed or cancelled";
  return false;
}

string exportVehiclesCsv() {
  stringstream ss;
  ss << "ID,BatteryPercent,ConnectorType,ChargingRequirement,Priority,"
        "DepartureTime,Membership,Reservation,Status,AssignedBay\n";
  VehicleNode *curr = head;
  while (curr != nullptr) {
    Vehicle v = curr->vehicle;
    ss << v.id << "," << v.batteryLevel << "%," << v.connectorType << ","
       << v.chargingRequirement << "," << v.priority << "," << v.departureTime
       << "," << v.membership << "," << v.reservation << "," << v.status << ",";
    if (v.assignedStationId != -1)
      ss << "Bay " << v.assignedStationId;
    else
      ss << "N/A";
    ss << "\n";
    curr = curr->next;
  }
  return ss.str();
}

// ============================================================
// 5. JSON SERIALIZATION UTILITIES
// ============================================================

string jsonEscape(const string &s) {
  stringstream ss;
  for (char c : s) {
    if (c == '"')
      ss << "\\\"";
    else if (c == '\\')
      ss << "\\\\";
    else if (c == '\b')
      ss << "\\b";
    else if (c == '\f')
      ss << "\\f";
    else if (c == '\n')
      ss << "\\n";
    else if (c == '\r')
      ss << "\\r";
    else if (c == '\t')
      ss << "\\t";
    else
      ss << c;
  }
  return ss.str();
}

string vehicleToJson(const Vehicle &v) {
  stringstream ss;
  ss << "{"
     << "\"id\":" << v.id << ","
     << "\"batteryLevel\":" << v.batteryLevel << ","
     << "\"connectorType\":\"" << jsonEscape(v.connectorType) << "\","
     << "\"chargingRequirement\":\"" << jsonEscape(v.chargingRequirement)
     << "\","
     << "\"priority\":\"" << jsonEscape(v.priority) << "\","
     << "\"departureTime\":\"" << jsonEscape(v.departureTime) << "\","
     << "\"membership\":\"" << jsonEscape(v.membership) << "\","
     << "\"reservation\":\"" << jsonEscape(v.reservation) << "\","
     << "\"status\":\"" << jsonEscape(v.status) << "\","
     << "\"assignedStationId\":" << v.assignedStationId << ","
     << "\"queuedAt\":\"" << jsonEscape(v.queuedAt) << "\""
     << "}";
  return ss.str();
}

string stationToJson(const ChargingStation &s) {
  stringstream ss;
  ss << "{"
     << "\"id\":" << s.id << ","
     << "\"connectorType\":\"" << jsonEscape(s.connectorType) << "\","
     << "\"chargingSpeed\":\"" << jsonEscape(s.chargingSpeed) << "\","
     << "\"available\":" << (s.available ? "true" : "false") << ","
     << "\"maintenance\":" << (s.maintenance ? "true" : "false") << ","
     << "\"vehicleId\":" << s.vehicleId << ",";

  // If occupied, attach vehicle details
  if (s.vehicleId != -1) {
    Vehicle *v = findVehicle(s.vehicleId);
    if (v != nullptr) {
      ss << "\"vehicle\":" << vehicleToJson(*v);
    } else {
      ss << "\"vehicle\":null";
    }
  } else {
    ss << "\"vehicle\":null";
  }
  ss << "}";
  return ss.str();
}

string getStationsJson() {
  stringstream ss;
  ss << "[";
  for (int i = 0; i < 5; i++) {
    if (i > 0)
      ss << ",";
    ss << stationToJson(stations[i]);
  }
  ss << "]";
  return ss.str();
}

string getVehiclesJson(bool sortByDeparture = false) {
  vector<Vehicle> vList;
  VehicleNode *curr = head;
  while (curr != nullptr) {
    vList.push_back(curr->vehicle);
    curr = curr->next;
  }

  if (sortByDeparture) {
    sort(vList.begin(), vList.end(), [](const Vehicle &a, const Vehicle &b) {
      return a.departureTime < b.departureTime;
    });
  }

  stringstream ss;
  ss << "[";
  for (size_t i = 0; i < vList.size(); i++) {
    if (i > 0)
      ss << ",";
    ss << vehicleToJson(vList[i]);
  }
  ss << "]";
  return ss.str();
}

string getQueuesJson() {
  // Copy priority queue
  priority_queue<Vehicle, vector<Vehicle>, PriorityCompare> pCopy =
      priorityWaiting;
  vector<Vehicle> pList;
  while (!pCopy.empty()) {
    pList.push_back(pCopy.top());
    pCopy.pop();
  }

  // Copy normal queue
  queue<Vehicle> nCopy = normalWaiting;
  vector<Vehicle> nList;
  while (!nCopy.empty()) {
    nList.push_back(nCopy.front());
    nCopy.pop();
  }

  stringstream ss;
  ss << "{\"priorityQueue\":[";
  for (size_t i = 0; i < pList.size(); i++) {
    if (i > 0)
      ss << ",";
    ss << vehicleToJson(pList[i]);
  }
  ss << "],\"normalQueue\":[";
  for (size_t i = 0; i < nList.size(); i++) {
    if (i > 0)
      ss << ",";
    ss << vehicleToJson(nList[i]);
  }
  ss << "]}";
  return ss.str();
}

string getCompletedJson() {
  stack<int> sCopy = completedVehicles;
  vector<int> ids;
  while (!sCopy.empty()) {
    ids.push_back(sCopy.top());
    sCopy.pop();
  }

  stringstream ss;
  ss << "[";
  for (size_t i = 0; i < ids.size(); i++) {
    if (i > 0)
      ss << ",";
    Vehicle *v = findVehicle(ids[i]);
    if (v != nullptr) {
      ss << vehicleToJson(*v);
    } else {
      ss << "{\"id\":" << ids[i] << ",\"status\":\"Completed\"}";
    }
  }
  ss << "]";
  return ss.str();
}

string getLogsJson() {
  stringstream ss;
  ss << "[";
  for (size_t i = 0; i < systemLogs.size(); i++) {
    if (i > 0)
      ss << ",";
    ss << "{\"time\":\"" << jsonEscape(systemLogs[i].time) << "\","
       << "\"type\":\"" << jsonEscape(systemLogs[i].type) << "\","
       << "\"message\":\"" << jsonEscape(systemLogs[i].message) << "\"}";
  }
  ss << "]";
  return ss.str();
}

string getSystemStatusJson() {
  int totalVehicles = 0;
  int chargingCount = 0;
  int waitingCount = (int)priorityWaiting.size() + (int)normalWaiting.size();
  int completedCount = (int)completedVehicles.size();
  int availableStations = 0;
  int maintenanceStations = 0;
  int gridPowerKW = 10; // idle base load

  VehicleNode *curr = head;
  while (curr != nullptr) {
    totalVehicles++;
    curr = curr->next;
  }

  for (int i = 0; i < 5; i++) {
    if (stations[i].maintenance)
      maintenanceStations++;
    else if (stations[i].available)
      availableStations++;
    else {
      chargingCount++;
      if (stations[i].chargingSpeed == "Fast")
        gridPowerKW += 120;
      else
        gridPowerKW += 45;
    }
  }

  double co2SavedKg = (completedCount * 14.5) + (chargingCount * 4.2);
  double totalKwhDelivered = (completedCount * 48.0) + (chargingCount * 18.5);

  stringstream ss;
  ss << "{"
     << "\"server\":\"C++ Winsock Backend\","
     << "\"status\":\"online\","
     << "\"totalVehicles\":" << totalVehicles << ","
     << "\"chargingCount\":" << chargingCount << ","
     << "\"waitingCount\":" << waitingCount << ","
     << "\"priorityQueueCount\":" << priorityWaiting.size() << ","
     << "\"normalQueueCount\":" << normalWaiting.size() << ","
     << "\"completedCount\":" << completedCount << ","
     << "\"availableStations\":" << availableStations << ","
     << "\"maintenanceStations\":" << maintenanceStations << ","
     << "\"totalStations\":5,"
     << "\"gridPowerKW\":" << gridPowerKW << ","
     << "\"gridCapacityKW\":500,"
     << "\"solarMixPercent\":48,"
     << "\"co2SavedKg\":" << fixed << setprecision(1) << co2SavedKg << ","
     << "\"totalKwhDelivered\":" << fixed << setprecision(1)
     << totalKwhDelivered << ","
     << "\"tariffRate\":0.25"
     << "}";
  return ss.str();
}

// Flexible JSON / Query extraction helper for string values
string extractJsonString(const string &json, const string &key) {
  size_t pos = json.find(key);
  if (pos == string::npos)
    return "";
  size_t sep = json.find_first_of(":=", pos + key.length());
  if (sep == string::npos)
    return "";
  pos = sep + 1;
  while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t' ||
                               json[pos] == '\r' || json[pos] == '\n'))
    pos++;
  if (pos >= json.size())
    return "";

  if (json[pos] == '"') {
    pos++;
    size_t endPos = json.find('"', pos);
    if (endPos == string::npos)
      return "";
    return json.substr(pos, endPos - pos);
  } else {
    size_t endPos = pos;
    while (endPos < json.size() && json[endPos] != ',' && json[endPos] != '&' &&
           json[endPos] != '}' && json[endPos] != ' ' && json[endPos] != '\r' &&
           json[endPos] != '\n') {
      endPos++;
    }
    return json.substr(pos, endPos - pos);
  }
}

// Flexible JSON / Query extraction helper for integer values
int extractJsonInt(const string &json, const string &key, int defaultVal = 0) {
  size_t pos = json.find(key);
  if (pos == string::npos)
    return defaultVal;
  size_t sep = json.find_first_of(":=", pos + key.length());
  if (sep == string::npos)
    return defaultVal;
  pos = sep + 1;
  while (pos < json.size() &&
         (json[pos] == ' ' || json[pos] == '\t' || json[pos] == '\r' ||
          json[pos] == '\n' || json[pos] == '"'))
    pos++;
  if (pos >= json.size())
    return defaultVal;

  int sign = 1;
  if (json[pos] == '-') {
    sign = -1;
    pos++;
  }
  int val = 0;
  bool found = false;
  while (pos < json.size() && isdigit(json[pos])) {
    val = val * 10 + (json[pos] - '0');
    found = true;
    pos++;
  }
  return found ? (val * sign) : defaultVal;
}

// ============================================================
// 6. HTTP SERVER & REQUEST HANDLING
// ============================================================

string readFileContents(const string &path) {
  ifstream f(path.c_str(), ios::in | ios::binary);
  if (!f.is_open())
    return "";
  stringstream ss;
  ss << f.rdbuf();
  return ss.str();
}

string makeHttpResponse(int statusCode, const string &contentType,
                        const string &body) {
  stringstream ss;
  ss << "HTTP/1.1 " << statusCode << " ";
  if (statusCode == 200)
    ss << "OK\r\n";
  else if (statusCode == 201)
    ss << "Created\r\n";
  else if (statusCode == 204)
    ss << "No Content\r\n";
  else if (statusCode == 400)
    ss << "Bad Request\r\n";
  else if (statusCode == 404)
    ss << "Not Found\r\n";
  else
    ss << "OK\r\n";

  ss << "Content-Type: " << contentType << "; charset=utf-8\r\n";
  ss << "Content-Length: " << body.length() << "\r\n";
  ss << "Access-Control-Allow-Origin: *\r\n";
  ss << "Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE\r\n";
  ss << "Access-Control-Allow-Headers: Content-Type, Authorization\r\n";
  ss << "Connection: close\r\n\r\n";
  ss << body;
  return ss.str();
}

void handleClient(SOCKET clientSocket) {
  char buffer[8192];
  int bytesReceived = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
  if (bytesReceived <= 0) {
    closesocket(clientSocket);
    return;
  }
  buffer[bytesReceived] = '\0';
  string request(buffer, bytesReceived);

  // Parse method and path
  stringstream reqStream(request);
  string method, path, protocol;
  reqStream >> method >> path >> protocol;

  // Separate body
  string body = "";
  size_t bodyPos = request.find("\r\n\r\n");
  if (bodyPos != string::npos) {
    body = request.substr(bodyPos + 4);
  }

  // Ensure full body is read if Content-Length is specified
  size_t clPos = request.find("Content-Length:");
  if (clPos == string::npos)
    clPos = request.find("content-length:");
  if (clPos != string::npos) {
    size_t colon = request.find(':', clPos);
    int expectedLen = atoi(request.c_str() + colon + 1);
    while ((int)body.length() < expectedLen) {
      int more = recv(clientSocket, buffer, sizeof(buffer) - 1, 0);
      if (more <= 0)
        break;
      body.append(buffer, more);
    }
  }

  string response;

  // Handle CORS preflight
  if (method == "OPTIONS") {
    response = makeHttpResponse(204, "text/plain", "");
    send(clientSocket, response.c_str(), (int)response.length(), 0);
    closesocket(clientSocket);
    return;
  }

  // Extract path without query parameters
  string cleanPath = path;
  string query = "";
  size_t qPos = path.find('?');
  if (qPos != string::npos) {
    cleanPath = path.substr(0, qPos);
    query = path.substr(qPos + 1);
  }

  // API Routes
  if (cleanPath == "/api/status" && method == "GET") {
    response = makeHttpResponse(200, "application/json", getSystemStatusJson());
  } else if (cleanPath == "/api/stations" && method == "GET") {
    response = makeHttpResponse(200, "application/json", getStationsJson());
  } else if (cleanPath == "/api/vehicles" && method == "GET") {
    bool sortDep = (query.find("sort=departure") != string::npos);
    response =
        makeHttpResponse(200, "application/json", getVehiclesJson(sortDep));
  } else if (cleanPath == "/api/queues" && method == "GET") {
    response = makeHttpResponse(200, "application/json", getQueuesJson());
  } else if (cleanPath == "/api/completed" && method == "GET") {
    response = makeHttpResponse(200, "application/json", getCompletedJson());
  } else if (cleanPath == "/api/logs" && method == "GET") {
    response = makeHttpResponse(200, "application/json", getLogsJson());
  } else if (cleanPath == "/api/vehicles" && method == "POST") {
    int vId = extractJsonInt(body, "id");
    if (vId <= 0) {
      // Auto generate ID if not supplied
      static int autoId = 100;
      while (findVehicle(++autoId) != nullptr) {
      }
      vId = autoId;
    }

    if (findVehicle(vId) != nullptr) {
      string err =
          "{\"success\":false,\"error\":\"Vehicle ID already exists!\"}";
      response = makeHttpResponse(400, "application/json", err);
    } else {
      Vehicle v;
      v.id = vId;
      v.batteryLevel = extractJsonInt(body, "batteryLevel", 50);
      v.connectorType = extractJsonString(body, "connectorType");
      if (v.connectorType.empty())
        v.connectorType = "CCS";
      v.chargingRequirement = extractJsonString(body, "chargingRequirement");
      if (v.chargingRequirement.empty())
        v.chargingRequirement = "Normal";
      v.priority = extractJsonString(body, "priority");
      if (v.priority.empty())
        v.priority = "Normal";
      v.departureTime = extractJsonString(body, "departureTime");
      if (v.departureTime.empty())
        v.departureTime = "12:00";
      v.membership = extractJsonString(body, "membership");
      if (v.membership.empty())
        v.membership = "Regular";
      v.reservation = extractJsonString(body, "reservation");
      if (v.reservation.empty())
        v.reservation = "No";
      v.status = "Waiting";
      v.assignedStationId = -1;
      v.queuedAt = getCurrentTimeString();

      addToLinkedList(v);

      bool assigned = assignVehicle(v);
      string queueType = "None";

      if (!assigned) {
        if (v.priority == "Emergency" || v.priority == "Reserved") {
          priorityWaiting.push(v);
          queueType = "Priority";
          stringstream ss;
          ss << "Vehicle #" << v.id << " added to PRIORITY QUEUE ("
             << v.priority << ", Departure " << v.departureTime << ")";
          addLog("QUEUE", ss.str());
        } else {
          normalWaiting.push(v);
          queueType = "Normal";
          stringstream ss;
          ss << "Vehicle #" << v.id << " added to NORMAL QUEUE";
          addLog("QUEUE", ss.str());
        }
      }

      stringstream ss;
      ss << "{\"success\":true,"
         << "\"assigned\":" << (assigned ? "true" : "false") << ","
         << "\"queueType\":\"" << queueType << "\","
         << "\"vehicle\":" << vehicleToJson(v) << "}";
      response = makeHttpResponse(201, "application/json", ss.str());
    }
  } else if ((cleanPath == "/api/stations/release" ||
              cleanPath.find("/release") != string::npos) &&
             method == "POST") {
    int stId = extractJsonInt(body, "stationId", -1);
    if (stId == -1)
      stId = extractJsonInt(query, "stationId", -1);
    if (stId == -1) {
      for (char c : cleanPath) {
        if (isdigit(c)) {
          stId = c - '0';
          break;
        }
      }
    }
    string err;
    bool ok = releaseStationById(stId, err);
    if (ok) {
      response = makeHttpResponse(
          200, "application/json",
          "{\"success\":true,\"message\":\"Station released successfully\"}");
    } else {
      stringstream ss;
      ss << "{\"success\":false,\"error\":\"" << jsonEscape(err) << "\"}";
      response = makeHttpResponse(400, "application/json", ss.str());
    }
  } else if ((cleanPath == "/api/stations/maintenance" ||
              cleanPath.find("/maintenance") != string::npos) &&
             method == "POST") {
    int stId = extractJsonInt(body, "stationId", -1);
    if (stId == -1)
      stId = extractJsonInt(query, "stationId", -1);
    if (stId == -1) {
      for (char c : cleanPath) {
        if (isdigit(c)) {
          stId = c - '0';
          break;
        }
      }
    }
    string err;
    bool ok = toggleMaintenance(stId, err);
    if (ok) {
      response = makeHttpResponse(
          200, "application/json",
          "{\"success\":true,\"message\":\"Maintenance status toggled\"}");
    } else {
      stringstream ss;
      ss << "{\"success\":false,\"error\":\"" << jsonEscape(err) << "\"}";
      response = makeHttpResponse(400, "application/json", ss.str());
    }
  } else if (cleanPath == "/api/reset" && method == "POST") {
    resetSystem();
    response =
        makeHttpResponse(200, "application/json",
                         "{\"success\":true,\"message\":\"System reset\"}");
  } else if (cleanPath == "/api/simulate" && method == "POST") {
    // Generate a diverse sample batch
    struct SamplePreset {
      int id;
      int battery;
      string connector;
      string req;
      string priority;
      string dep;
      string member;
      string res;
    };

    SamplePreset presets[] = {
        {201, 15, "CCS", "Fast", "Emergency", "08:15", "Premium", "Yes"},
        {202, 30, "Type2", "Normal", "Reserved", "09:00", "Premium", "Yes"},
        {203, 45, "CCS", "Normal", "Normal", "10:30", "Regular", "No"},
        {204, 20, "Type2", "Fast", "Normal", "11:00", "Regular", "No"},
        {205, 10, "CCS", "Fast", "Emergency", "07:45", "Premium", "No"},
        {206, 60, "CCS", "Medium", "Reserved", "09:30", "Regular", "Yes"}};

    int addedCount = 0;
    for (const auto &p : presets) {
      if (findVehicle(p.id) != nullptr)
        continue;
      Vehicle v;
      v.id = p.id;
      v.batteryLevel = p.battery;
      v.connectorType = p.connector;
      v.chargingRequirement = p.req;
      v.priority = p.priority;
      v.departureTime = p.dep;
      v.membership = p.member;
      v.reservation = p.res;
      v.status = "Waiting";
      v.assignedStationId = -1;
      v.queuedAt = getCurrentTimeString();
      addToLinkedList(v);
      if (!assignVehicle(v)) {
        if (v.priority == "Emergency" || v.priority == "Reserved") {
          priorityWaiting.push(v);
        } else {
          normalWaiting.push(v);
        }
      }
      addedCount++;
    }

    stringstream ss;
    ss << "{\"success\":true,\"added\":" << addedCount
       << ",\"message\":\"Simulation batch dispatched\"}";
    response = makeHttpResponse(200, "application/json", ss.str());
  } else if ((cleanPath == "/api/vehicles/tick" ||
              cleanPath.find("/tick") != string::npos) &&
             method == "POST") {
    vector<int> fullyCharged = tickCharging();
    stringstream ss;
    ss << "{\"success\":true,\"fullyCharged\":[";
    for (size_t i = 0; i < fullyCharged.size(); i++) {
      if (i > 0)
        ss << ",";
      ss << fullyCharged[i];
    }
    ss << "]}";
    response = makeHttpResponse(200, "application/json", ss.str());
  } else if ((cleanPath == "/api/vehicles/escalate" ||
              cleanPath.find("/escalate") != string::npos) &&
             method == "POST") {
    int vId = extractJsonInt(body, "id", -1);
    if (vId == -1)
      vId = extractJsonInt(query, "id", -1);
    string newP = extractJsonString(body, "priority");
    if (newP.empty())
      newP = extractJsonString(query, "priority");
    if (newP.empty())
      newP = "Emergency";
    string err;
    bool ok = escalateVehicle(vId, newP, err);
    if (ok) {
      response = makeHttpResponse(
          200, "application/json",
          "{\"success\":true,\"message\":\"Vehicle priority escalated\"}");
    } else {
      stringstream ss;
      ss << "{\"success\":false,\"error\":\"" << jsonEscape(err) << "\"}";
      response = makeHttpResponse(400, "application/json", ss.str());
    }
  } else if ((cleanPath == "/api/vehicles/cancel" ||
              cleanPath.find("/cancel") != string::npos) &&
             method == "POST") {
    int vId = extractJsonInt(body, "id", -1);
    if (vId == -1)
      vId = extractJsonInt(query, "id", -1);
    string err;
    bool ok = cancelVehicle(vId, err);
    if (ok) {
      response = makeHttpResponse(
          200, "application/json",
          "{\"success\":true,\"message\":\"Vehicle cancelled successfully\"}");
    } else {
      stringstream ss;
      ss << "{\"success\":false,\"error\":\"" << jsonEscape(err) << "\"}";
      response = makeHttpResponse(400, "application/json", ss.str());
    }
  } else if (cleanPath == "/api/export" && method == "GET") {
    string csv = exportVehiclesCsv();
    stringstream ss;
    ss << "HTTP/1.1 200 OK\r\n"
       << "Content-Type: text/csv; charset=utf-8\r\n"
       << "Content-Disposition: attachment; "
          "filename=\"voltgrid_vehicles.csv\"\r\n"
       << "Content-Length: " << csv.length() << "\r\n"
       << "Access-Control-Allow-Origin: *\r\n"
       << "Connection: close\r\n\r\n"
       << csv;
    response = ss.str();
  }
  // Static file routes
  else if (cleanPath == "/" || cleanPath == "/index.html") {
    string content = readFileContents("public/index.html");
    if (content.empty())
      content = readFileContents("index.html");
    if (!content.empty()) {
      response = makeHttpResponse(200, "text/html", content);
    } else {
      response = makeHttpResponse(404, "text/plain", "index.html not found");
    }
  } else if (cleanPath == "/style.css") {
    string content = readFileContents("public/style.css");
    if (content.empty())
      content = readFileContents("style.css");
    if (!content.empty()) {
      response = makeHttpResponse(200, "text/css", content);
    } else {
      response = makeHttpResponse(404, "text/plain", "style.css not found");
    }
  } else if (cleanPath == "/app.js") {
    string content = readFileContents("public/app.js");
    if (content.empty())
      content = readFileContents("app.js");
    if (!content.empty()) {
      response = makeHttpResponse(200, "text/javascript", content);
    } else {
      response = makeHttpResponse(404, "text/plain", "app.js not found");
    }
  } else {
    response =
        makeHttpResponse(404, "application/json", "{\"error\":\"Not Found\"}");
  }

  send(clientSocket, response.c_str(), (int)response.length(), 0);
  closesocket(clientSocket);
}

// ============================================================
// 7. MAIN FUNCTION
// ============================================================

int main(int argc, char *argv[]) {
  int port = 8080;
  if (argc > 1) {
    port = atoi(argv[1]);
    if (port <= 0)
      port = 8080;
  }

  WSADATA wsa;
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
    cerr << "Failed to initialize Winsock.\n";
    return 1;
  }

  SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, 0);
  if (serverSocket == INVALID_SOCKET) {
    cerr << "Failed to create server socket.\n";
    WSACleanup();
    return 1;
  }

  int opt = 1;
  setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, (char *)&opt, sizeof(opt));

  sockaddr_in serverAddr;
  serverAddr.sin_family = AF_INET;
  serverAddr.sin_addr.s_addr = INADDR_ANY;
  serverAddr.sin_port = htons(port);

  if (bind(serverSocket, (struct sockaddr *)&serverAddr, sizeof(serverAddr)) ==
      SOCKET_ERROR) {
    cerr << "Bind failed on port " << port << ". Error: " << WSAGetLastError()
         << "\n";
    closesocket(serverSocket);
    WSACleanup();
    return 1;
  }

  if (listen(serverSocket, 10) == SOCKET_ERROR) {
    cerr << "Listen failed.\n";
    closesocket(serverSocket);
    WSACleanup();
    return 1;
  }

  addLog("SYSTEM", "VoltGrid C++ Smart EV Backend Server started.");
  cout << "\n======================================================\n";
  cout << "   SMART EV CHARGING SYSTEM - C++ BACKEND SERVER\n";
  cout << "======================================================\n";
  cout << " Server is running at: http://localhost:" << port << "\n";
  cout << " Open your browser to view the Live Dashboard!\n";
  cout << " Press Ctrl+C in this console to stop the server.\n";
  cout << "======================================================\n\n";

  // Seed initial demo log
  addLog("SYSTEM", "5 Charging Stations initialized (CCS & Type2).");

  while (true) {
    sockaddr_in clientAddr;
    int clientLen = sizeof(clientAddr);
    SOCKET clientSocket =
        accept(serverSocket, (struct sockaddr *)&clientAddr, &clientLen);
    if (clientSocket == INVALID_SOCKET) {
      continue;
    }
    handleClient(clientSocket);
  }

  closesocket(serverSocket);
  WSACleanup();
  return 0;
}
