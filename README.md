# AlumniConnect — Campus Alumni & Career Network

**AlumniConnect** is a full-stack web application designed to connect undergraduate college students with university alumni. Powered by **Neo4j Graph Database**, **Node.js/Express**, and **React (Vite)**, the platform allows students to explore career trajectories, discover hiring companies, search verified graduates, and visualize campus graph relationships.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │   AlumniConnect Web Application      │
                      └──────────────────┬───────────────────┘
                                         │
                   HTTP REST API (JSON)  │  Port 5173 / Proxy
                                         ▼
                      ┌──────────────────────────────────────┐
                      │       Express Backend API            │
                      │  (Node.js • Parameterized Cypher)    │
                      └──────────────────┬───────────────────┘
                                         │
             Official neo4j-driver       │  Port 7687 (Bolt/Neo4j)
                                         ▼
                      ┌──────────────────────────────────────┐
                      │     Neo4j Desktop Graph DBMS         │
                      │  (:Alumni, :Company, :Student)       │
                      │  [:WORKS_AT, :INTERESTED_IN]         │
                      └──────────────────────────────────────┘
```

---

## Features

1. **Editorial Warm-Ivory Visual Design**
   - Light theme with warm ivory/off-white backgrounds (`#FAF8F5`).
   - Deep charcoal typography with muted teal (`#0F766E`) and sage emerald accents.
   - Fully responsive for mobile, tablet, and desktop viewports.

2. **Searchable Alumni Directory (`/api/alumni`)**
   - Real-time search across alumni names (e.g. Arun Kumar), hiring companies (e.g. Google), and departments (e.g. CSE).
   - Filter dropdowns dynamically populated from existing database records (Departments, Companies, Graduation Years).
   - In-memory sorting by Name (A-Z, Z-A) and Graduation Year (Newest, Oldest).

3. **Alumni Profile Detail Drawer**
   - Displays authentic properties stored on Neo4j nodes (Name, Company, Department, Graduation Year, raw node properties).
   - Shows colleagues at the same company and students interested via graph links.
   - Mentorship inquiry form and profile sharing.

4. **Companies Showcase & Rosters (`/api/companies`)**
   - Directory of companies associated with alumni.
   - Calculated alumni headcounts per company.
   - Expandable rosters listing every alumni employed at that organization.

5. **Interactive Neo4j Knowledge Graph (`/api/stats/graph`)**
   - Interactive SVG canvas rendering graph nodes (`:Alumni`, `:Company`, `:Student`) and edges (`:WORKS_AT`, `:INTERESTED_IN`).
   - Entity filtering and live node property inspector sidebar.

6. **Neo4j Connection Assistant**
   - Header status pill showing real-time connectivity to Neo4j Desktop.
   - Diagnostic modal displaying connection URI, database name, and live ping checks.

---

## Project Structure

```
AlumniConnect/
├── backend/
│   ├── config/
│   │   └── neo4j.js            # Neo4j driver initialization & session helpers
│   ├── routes/
│   │   ├── alumni.js           # Alumni search & profile Cypher queries
│   │   ├── companies.js        # Company aggregation & alumni rosters
│   │   ├── health.js           # Express & Neo4j connectivity healthcheck
│   │   └── stats.js            # Platform statistics & graph network routes
│   ├── .env                    # Local environment variables (ignored by Git)
│   ├── .env.example            # Template for environment configuration
│   ├── package.json            # Backend dependencies (express, neo4j-driver, etc.)
│   └── server.js               # Express application entrypoint
├── frontend/
│   ├── public/
│   │   └── favicon.svg         # AlumniConnect graduation & node emblem
│   ├── src/
│   │   ├── components/         # Reusable React components (Navbar, Hero, Modals, etc.)
│   │   ├── pages/              # ExploreAlumni, Companies, NetworkGraph, About
│   │   ├── services/           # api.js HTTP client service
│   │   ├── App.css
│   │   ├── App.jsx             # Main application state & routing
│   │   ├── index.css           # Design tokens, color system, and typography
│   │   └── main.jsx
│   ├── index.html              # HTML shell with Google Fonts & SEO metadata
│   ├── package.json            # React 19, Vite 8, Lucide React icons
│   └── vite.config.js          # Vite config with backend proxy (/api -> localhost:5000)
├── .gitignore                  # Git exclusions (node_modules, .env, build output)
└── README.md                   # Project documentation & setup instructions
```

---

## Step-by-Step Setup Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Neo4j Desktop](https://neo4j.com/download/) with your `AlumniConnect` database instance created.

---

### Step 1: Start your Neo4j Database
1. Open **Neo4j Desktop**.
2. Locate your **AlumniConnect** project and DBMS instance.
3. Click the **Start** button and ensure the DBMS status is green (**Active** on `bolt://127.0.0.1:7687`).

---

### Step 2: Configure Backend Environment Variables
1. Navigate to the `backend/` folder.
2. Open `backend/.env` (or copy `backend/.env.example` to `backend/.env`).
3. Set your Neo4j password:

```env
PORT=5000
NEO4J_URI=neo4j://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_neo4j_password_here
NEO4J_DATABASE=neo4j
```

> **Note:** The password is the one you specified when creating the Neo4j DBMS in Neo4j Desktop.

---

### Step 3: Install Dependencies

Open a terminal in the root `AlumniConnect/` directory:

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd ../frontend
npm install
```

---

### Step 4: Seed Sample Dataset (DA3 Requirement #3)

To initialize or verify graph schema, unique constraints, sample nodes, and relationships:

```bash
cd backend
npm run seed
```

*Note: This script uses idempotent Cypher `MERGE` queries, preserving existing database records while ensuring complete data coverage for academic evaluation.*

---

### Step 5: Run Automated Verification Tests

To run the complete automated test suite checking health, Cypher parameterized queries, graduation year filters, and write persistence:

```bash
cd backend
npm test
```

---

### Step 6: Run the Application

Open two terminal windows:

**Terminal 1 — Backend Server:**
```bash
cd backend
npm run dev
```
*The backend runs on `http://localhost:5000` and displays Neo4j connection status in the console.*

**Terminal 2 — Frontend Application:**
```bash
cd frontend
npm run dev
```
*The frontend development server launches at `http://localhost:5173`.*

Open `http://localhost:5173` in your browser.

---

## Verifying Real Database Connection

1. In the top-right navbar of AlumniConnect, check the **Neo4j Status Pill**:
   - **Green ("Neo4j Live")**: Backend is successfully authenticated and reading data from your database.
   - **Amber ("Neo4j Setup")**: Click the pill to open the Diagnostics Modal and verify your password.
2. In the **Explore Alumni** page, search for **Arun Kumar** or filter by **Class of 2022**; only verified records from Neo4j are displayed.
3. Open an alumni card to inspect verified properties, colleagues, and interested students.
4. Express interest or register a new profile: changes are written and persisted live to Neo4j.
5. Click on **Network Graph** in the navbar to see the interactive force-directed graph map of your database nodes.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check reporting backend status & Neo4j connectivity |
| `GET` | `/api/alumni` | Retrieve alumni with optional query params (`q`, `department`, `company`, `graduationYear`) |
| `GET` | `/api/alumni/search?q=...` | Fast parameterized keyword search across name, company, department, and graduation year |
| `GET` | `/api/alumni/:id` | Detailed profile for an alumni including colleagues & interested students |
| `POST` | `/api/alumni` | Persist new Alumni or Student nodes and `WORKS_AT` edges in Neo4j (CRUD Write) |
| `POST` | `/api/alumni/:id/interest` | Persist `(:Student)-[:INTERESTED_IN]->(:Alumni)` mentorship relationship in Neo4j |
| `GET` | `/api/companies` | List all hiring companies with alumni counts |
| `GET` | `/api/companies/:name/alumni` | List alumni employed at a specific company |
| `GET` | `/api/stats` | Network statistics (counts of alumni, companies, students, departments) |
| `GET` | `/api/stats/graph` | Node and link graph data for visual relationship exploration |

---

## DBMS DA3 Documentation & Technology Comparison

Detailed technical comparisons (Neo4j vs PostgreSQL vs MongoDB), handwritten report notes, and the step-by-step faculty demonstration script are available in:
- [`docs/TECHNOLOGY_COMPARISON.md`](./docs/TECHNOLOGY_COMPARISON.md)
- [`backend/schema.cypher`](./backend/schema.cypher)
