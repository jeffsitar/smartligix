# SmartLogix Enterprise – Logistics Management System (LMS)

Production-oriented Logistics Management System built on **Node.js, Express.js, SQLite (`sql.js` WebAssembly), JWT HTTP-Only Cookie Authentication, RBAC, Chart.js, and Leaflet.js**.

---

## 1. Prerequisites
- **Node.js** `v18+` (includes `npm`) — zero external database servers, Java, Maven, or native C++ build tools required.

---

## 2. Quick Start
```bash
npm install
npm start
```
Open **`http://localhost:8080`** in your browser.

To run the automated end-to-end API smoke test suite:
```bash
npm test
```

---

## 3. Seeded Role-Based Accounts (Development / Demo)
*(Credentials are intentionally excluded from all frontend code.)*

| Role | Email | Password | Access Scope |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@smartlogix.in` | `admin123` | Full platform, pricing settings, user/RBAC admin, audit logs |
| **Dispatcher** | `dispatcher@smartlogix.in` | `dispatch123` | Bookings, dispatch assignment, fleet, customers, billing, analytics |
| **Warehouse** | `warehouse@smartlogix.in` | `warehouse123` | Bookings, dispatch queue, milestone updates, fleet & customer view |
| **Driver** | `driver@smartlogix.in` | `driver123` | Assigned trips, live status updates, Proof of Delivery (POD) capture |
| **Customer** | `customer@traders.in` | `customer123` | Customer portal: own bookings, live tracking, invoices & payments |

*(Legacy `staff@smartlogix.in` / `staff123` is also preserved with `DISPATCHER` permissions.)*

Sample tracking IDs: `TRK-2026-88912`, `TRK-2026-89902`, `TRK-2026-89903`, `TRK-2026-89904`, `TRK-2026-89905`.

---

## 4. Environment Configuration
Copy `.env.example` to `.env` for production deployments:
```env
PORT=8080
NODE_ENV=production
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=12h
DB_PATH=./data/smartlogix.sqlite
```

## 5. Deployment (Render / Railway / Docker)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Health Check:** `GET /api/health`
