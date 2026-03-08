# Birøkt-system: Teknisk Arkitektur & API-spesifikasjon

**Versjon:** 1.0  
**Dato:** 31. januar 2026  
**Forfatter:** Teknisk arkitekt

---

## 📋 Innholdsfortegnelse

1. [Systemarkitektur](#systemarkitektur)
2. [Teknologistack](#teknologistack)
3. [Database Design](#database-design)
4. [API Spesifikasjon](#api-spesifikasjon)
5. [Autentisering & Sikkerhet](#autentisering--sikkerhet)
6. [Filhåndtering](#filhåndtering)
7. [Offline-sync Strategi](#offline-sync-strategi)
8. [Deployment & Infrastruktur](#deployment--infrastruktur)
9. [Skalerbarhet & Ytelse](#skalerbarhet--ytelse)
10. [Testing & Kvalitetssikring](#testing--kvalitetssikring)

---

## 1. Systemarkitektur

### 1.1 High-Level Arkitektur

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTASJONSLAG                      │
├─────────────────────┬───────────────────────────────────┤
│  Web/PC Client      │     Mobil/Nettbrett Client       │
│  (React/Next.js)    │     (React Native + Expo)        │
└─────────────┬───────┴───────────────┬──────────────────┘
              │                       │
              │    HTTPS/REST API     │
              │                       │
┌─────────────┴───────────────────────┴──────────────────┐
│                   API Gateway / BFF                     │
│            (Backend for Frontend - Optional)            │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                  APPLIKASJONSAG                         │
│                 Backend API Server                      │
│              (Node.js + Express/Fastify)                │
├─────────────────────────────────────────────────────────┤
│  • REST API Endpoints                                   │
│  • Forretningslogikk                                    │
│  • Validering & Transformasjon                          │
│  • Autentisering & Autorisasjon                         │
└─────────────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐  ┌──────▼──────┐  ┌──────▼──────┐
│   Database    │  │ File Storage│  │  External   │
│  (PostgreSQL) │  │ (S3/R2/Local│  │  Services   │
│               │  │  + CDN)     │  │  (Vær-API)  │
└───────────────┘  └─────────────┘  └─────────────┘
```

### 1.2 Arkitekturprinsipper

1. **API-First Design**: Backend eksponerer RESTful API som alle klienter konsumerer
2. **Offline-First Mobile**: Mobil-app fungerer uten internett, synkroniserer når tilgjengelig
3. **Stateless Backend**: Backend holder ingen sesjonstilstand (JWT tokens)
4. **Dataeierskapet**: Brukeren eier sine data, kan eksportere alt
5. **Privacy by Design**: Sensitiv data krypteres, minimalt med logging
6. **Horizontal Scalability**: Stateless design gjør horisontalt scaling enkelt

### 1.3 Komponentoversikt

| Komponent | Ansvar | Teknologi |
|-----------|--------|-----------|
| Web Client | Desktop brukergrensesnitt | React/Next.js 14+, TailwindCSS |
| Mobile Client | Felt-applikasjon | React Native, Expo SDK 50+ |
| API Server | Business logic & data access | Node.js 20+, Express/Fastify |
| Database | Persistent storage | PostgreSQL 15+ |
| File Storage | Bilde- og dokumentlagring | S3-compatible (Cloudflare R2, MinIO) |
| Cache Layer | Performance optimization | Redis (optional, for production) |
| Background Jobs | Async tasks (notifikasjoner, rapporter) | Bull/BullMQ (Redis-based) |

---

## 2. Teknologistack

### 2.1 Backend Stack

```yaml
Runtime: Node.js 20.x LTS
Framework: Express 4.x eller Fastify 4.x
Database: PostgreSQL 15.x
ORM: Prisma 5.x eller Drizzle ORM
Validation: Zod
Authentication: JWT (jsonwebtoken + bcrypt)
File Upload: Multer
Image Processing: Sharp
Testing: Jest + Supertest
Documentation: OpenAPI 3.0 (Swagger)
```

**Valg av Fastify vs Express:**
- **Express**: Mer moden, større community, enklere å finne resources
- **Fastify**: Raskere, bedre TypeScript-støtte, innebygd validering
- **Anbefaling**: Start med Express for raskere utvikling, migrer til Fastify om nødvendig

### 2.2 Frontend Stack - Web

```yaml
Framework: Next.js 14.x (App Router)
Language: TypeScript 5.x
Styling: TailwindCSS 3.x
State Management: Zustand eller React Context + React Query
Data Fetching: TanStack Query (React Query)
Forms: React Hook Form + Zod
Date Handling: date-fns
Maps: Leaflet eller Mapbox GL JS
Charts: Recharts eller Chart.js
```

### 2.3 Frontend Stack - Mobil

```yaml
Framework: React Native + Expo SDK 50+
Language: TypeScript 5.x
Navigation: Expo Router (file-based routing)
State Management: Zustand + React Query
Local Database: SQLite (expo-sqlite)
Camera: expo-camera
QR Scanner: expo-barcode-scanner
File System: expo-file-system
Location: expo-location
Styling: NativeWind (TailwindCSS for RN)
```

### 2.4 Database & Storage

```yaml
Primary DB: PostgreSQL 15+
  - Extensions: uuid-ossp, pg_trgm (full-text search)
File Storage: S3-compatible
  - Development: MinIO (local)
  - Production: Cloudflare R2 eller AWS S3
CDN: Cloudflare (for bilde-optimalisering)
Backup: pg_dump (daglig automatisk backup)
```

### 2.5 DevOps & Deployment

```yaml
Containerization: Docker + Docker Compose
CI/CD: GitHub Actions
Hosting (Backend):
  - Option 1: Railway.app (enklest for MVP)
  - Option 2: DigitalOcean App Platform
  - Option 3: Self-hosted VPS (Hetzner/DigitalOcean)
Hosting (Frontend):
  - Web: Vercel eller Netlify
  - Mobile: Expo EAS (Build & Submit)
Monitoring: Sentry (error tracking)
Analytics: Plausible eller PostHog (privacy-friendly)
```

---

## 3. Database Design

### 3.1 ER Diagram

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    users     │         │   apiaries   │         │    hives     │
├──────────────┤         ├──────────────┤         ├──────────────┤
│ id (PK)      │────┐    │ id (PK)      │         │ id (PK)      │
│ email        │    │    │ user_id (FK) │────┐    │ apiary_id(FK)│
│ name         │    │    │ name         │    │    │ hive_number  │
│ password_hash│    │    │ location_lat │    │    │ qr_code      │
│ created_at   │    │    │ location_lng │    │    │ status       │
│ updated_at   │    │    │ description  │    │    │ strength     │
└──────────────┘    │    │ type         │    │    │ queen_info   │
                    │    │ created_at   │    │    │ created_at   │
                    │    └──────────────┘    │    │ updated_at   │
                    │                        │    └──────────────┘
                    │    ┌──────────────┐    │            │
                    └────│ user_apiaries│    │            │
                         ├──────────────┤    │            │
                         │ user_id (FK) │    │            │
                         │ apiary_id(FK)│────┘            │
                         │ role         │                 │
                         │ created_at   │                 │
                         └──────────────┘                 │
                                                          │
┌─────────────────────────────────────────────────────────┘
│
├────┐    ┌──────────────┐         ┌──────────────┐
│    └────│ inspections  │         │  treatments  │
│         ├──────────────┤         ├──────────────┤
│         │ id (PK)      │         │ id (PK)      │
│         │ hive_id (FK) │         │ hive_id (FK) │
│         │ user_id (FK) │         │ user_id (FK) │
│         │ date         │         │ date         │
│         │ weather      │         │ product      │
│         │ strength     │         │ dosage       │
│         │ queen_seen   │         │ withholding  │
│         │ queen_laying │         │ notes        │
│         │ brood_frames │         │ created_at   │
│         │ honey_frames │         │ updated_at   │
│         │ health_status│         └──────────────┘
│         │ temperament  │
│         │ notes        │         ┌──────────────┐
│         │ created_at   │         │   feedings   │
│         │ updated_at   │         ├──────────────┤
│         └──────────────┘         │ id (PK)      │
│                │                 │ hive_id (FK) │
│                │                 │ user_id (FK) │
│                │                 │ date         │
│         ┌──────┴──────┐          │ feed_type    │
│         │             │          │ amount_kg    │
│         │             │          │ notes        │
│ ┌───────▼──────┐ ┌────▼──────┐  │ created_at   │
│ │    photos    │ │  actions  │  │ updated_at   │
│ ├──────────────┤ ├───────────┤  └──────────────┘
│ │ id (PK)      │ │ id (PK)   │
│ │ inspection_id│ │ insp_id   │  ┌──────────────┐
│ │ hive_id (FK) │ │ action    │  │  production  │
│ │ url          │ │ details   │  ├──────────────┤
│ │ thumbnail_url│ │ created_at│  │ id (PK)      │
│ │ file_size    │ └───────────┘  │ hive_id (FK) │
│ │ mime_type    │                │ user_id (FK) │
│ │ created_at   │                │ date         │
│ └──────────────┘                │ type         │
│                                 │ amount_kg    │
│                                 │ quality      │
└─────────────────────────────────│ price_per_kg │
                                  │ notes        │
                                  │ created_at   │
                                  │ updated_at   │
                                  └──────────────┘
```

### 3.2 Tabelldefinisjoner (PostgreSQL)

#### 3.2.1 Users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

#### 3.2.2 Apiaries

```sql
CREATE TABLE apiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    type VARCHAR(50) DEFAULT 'permanent', -- permanent, seasonal, heather_route
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}', -- Flexible additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_apiaries_location ON apiaries USING GIST (
    ll_to_earth(location_lat, location_lng)
); -- Geospatial indexing for location queries
```

#### 3.2.3 User_Apiaries (Many-to-Many)

```sql
CREATE TABLE user_apiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    apiary_id UUID NOT NULL REFERENCES apiaries(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'owner', -- owner, collaborator, viewer
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, apiary_id)
);

CREATE INDEX idx_user_apiaries_user ON user_apiaries(user_id);
CREATE INDEX idx_user_apiaries_apiary ON user_apiaries(apiary_id);
```

#### 3.2.4 Hives

```sql
CREATE TABLE hives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apiary_id UUID NOT NULL REFERENCES apiaries(id) ON DELETE CASCADE,
    hive_number VARCHAR(50) NOT NULL, -- User-friendly identifier (K12, A04, etc)
    qr_code VARCHAR(255) UNIQUE, -- QR code data
    status VARCHAR(50) DEFAULT 'active', -- active, nuc, inactive, dead, sold
    strength VARCHAR(50), -- weak, medium, strong
    hive_type VARCHAR(50) DEFAULT 'langstroth', -- langstroth, topbar, warre
    box_count INTEGER DEFAULT 1,
    
    -- Queen information
    queen_year INTEGER,
    queen_marked BOOLEAN DEFAULT false,
    queen_color VARCHAR(50), -- white, yellow, red, green, blue
    queen_race VARCHAR(50), -- buckfast, carnica, italian, etc
    
    -- Current stats
    current_brood_frames INTEGER DEFAULT 0,
    current_honey_frames INTEGER DEFAULT 0,
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_hives_apiary ON hives(apiary_id);
CREATE INDEX idx_hives_qr_code ON hives(qr_code);
CREATE INDEX idx_hives_status ON hives(status);
```

#### 3.2.5 Inspections

```sql
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Weather conditions
    temperature DECIMAL(4, 1),
    wind_speed DECIMAL(4, 1),
    weather_condition VARCHAR(100), -- sunny, cloudy, rainy, etc
    
    -- Colony assessment
    strength VARCHAR(50), -- weak, medium, strong
    temperament VARCHAR(50), -- calm, nervous, aggressive
    queen_seen BOOLEAN DEFAULT false,
    queen_laying BOOLEAN DEFAULT false,
    
    -- Frame counts
    brood_frames INTEGER DEFAULT 0,
    honey_frames INTEGER DEFAULT 0,
    pollen_frames INTEGER DEFAULT 0,
    empty_frames INTEGER DEFAULT 0,
    
    -- Health assessment
    health_status VARCHAR(50) DEFAULT 'healthy', -- healthy, warning, critical
    varroa_level VARCHAR(50), -- none, low, medium, high
    diseases TEXT[], -- Array of diseases observed
    pests TEXT[], -- Array of pests observed
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inspections_hive ON inspections(hive_id);
CREATE INDEX idx_inspections_date ON inspections(inspection_date DESC);
CREATE INDEX idx_inspections_user ON inspections(user_id);
```

#### 3.2.6 Photos

```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    file_path TEXT NOT NULL, -- S3 key or file path
    url TEXT NOT NULL, -- Public URL
    thumbnail_url TEXT,
    
    file_size INTEGER, -- bytes
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    
    caption TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_photos_inspection ON photos(inspection_id);
CREATE INDEX idx_photos_hive ON photos(hive_id);
CREATE INDEX idx_photos_created ON photos(created_at DESC);
```

#### 3.2.7 Actions (What was done during inspection)

```sql
CREATE TABLE inspection_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL, -- added_frames, removed_frames, added_super, etc
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_actions_inspection ON inspection_actions(inspection_id);
```

#### 3.2.8 Treatments

```sql
CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    treatment_date DATE NOT NULL,
    
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(100), -- organic_acid, essential_oil, chemical, etc
    target VARCHAR(100), -- varroa, nosema, foulbrood, etc
    dosage VARCHAR(255),
    
    start_date DATE NOT NULL,
    end_date DATE,
    withholding_period_days INTEGER, -- Karenstid
    withholding_end_date DATE,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_treatments_hive ON treatments(hive_id);
CREATE INDEX idx_treatments_date ON treatments(treatment_date DESC);
```

#### 3.2.9 Feedings

```sql
CREATE TABLE feedings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    feeding_date DATE NOT NULL,
    
    feed_type VARCHAR(100) NOT NULL, -- sugar_syrup, fondant, pollen_patty, etc
    amount_kg DECIMAL(6, 2) NOT NULL,
    sugar_concentration DECIMAL(4, 1), -- For syrup (e.g., 1:1 = 50.0)
    
    reason VARCHAR(255), -- spring_buildup, winter_prep, emergency, etc
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feedings_hive ON feedings(hive_id);
CREATE INDEX idx_feedings_date ON feedings(feeding_date DESC);
```

#### 3.2.10 Production

```sql
CREATE TABLE production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID REFERENCES hives(id) ON DELETE SET NULL, -- Nullable if bulk harvest
    apiary_id UUID REFERENCES apiaries(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    harvest_date DATE NOT NULL,
    
    product_type VARCHAR(100) NOT NULL, -- honey, wax, propolis, pollen, royal_jelly
    honey_type VARCHAR(100), -- spring_blossom, heather, mixed, etc (if honey)
    amount_kg DECIMAL(8, 2) NOT NULL,
    
    quality_grade VARCHAR(50), -- premium, standard, bulk
    moisture_content DECIMAL(4, 1), -- for honey
    
    -- Economics
    price_per_kg DECIMAL(8, 2),
    total_revenue DECIMAL(10, 2),
    sold_to VARCHAR(255),
    sale_date DATE,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_production_hive ON production(hive_id);
CREATE INDEX idx_production_date ON production(harvest_date DESC);
```

### 3.3 Database Views (for common queries)

```sql
-- View: Latest inspection per hive
CREATE VIEW latest_inspections AS
SELECT DISTINCT ON (hive_id)
    hive_id,
    id as inspection_id,
    inspection_date,
    strength,
    health_status,
    queen_seen
FROM inspections
ORDER BY hive_id, inspection_date DESC;

-- View: Hive summary with latest data
CREATE VIEW hive_summary AS
SELECT 
    h.*,
    li.inspection_date as last_inspection_date,
    li.strength as current_strength,
    li.health_status as current_health,
    a.name as apiary_name,
    COUNT(DISTINCT i.id) as total_inspections,
    COALESCE(SUM(p.amount_kg), 0) as total_production_kg
FROM hives h
LEFT JOIN apiaries a ON h.apiary_id = a.id
LEFT JOIN latest_inspections li ON h.id = li.hive_id
LEFT JOIN inspections i ON h.id = i.hive_id
LEFT JOIN production p ON h.id = p.hive_id
GROUP BY h.id, li.inspection_date, li.strength, li.health_status, a.name;
```

---

## 4. API Spesifikasjon

### 4.1 API Design Principles

- **RESTful**: Ressurs-basert URL-struktur
- **JSON**: All kommunikasjon i JSON-format
- **Stateless**: JWT tokens for autentisering
- **Versioning**: `/api/v1/` prefix for fremtidig versjonering
- **Pagination**: Cursor-based eller offset-based for lister
- **Filtering**: Query parameters for filtrering
- **Sorting**: `?sort_by=field&order=asc|desc`
- **Error Format**: Konsistent error response struktur

### 4.2 Base URL

```
Development:  http://localhost:3000/api/v1
Production:   https://api.birokt.no/api/v1
```

### 4.3 Response Format

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-31T10:30:00Z",
    "request_id": "uuid"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "meta": {
    "timestamp": "2026-01-31T10:30:00Z",
    "request_id": "uuid"
  }
}
```

#### Pagination Meta
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 100,
      "total_pages": 5,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

### 4.4 Authentication Endpoints

#### POST `/auth/register`
Registrer ny bruker.

**Request:**
```json
{
  "email": "lars@example.com",
  "password": "SecurePass123!",
  "name": "Lars Johansen",
  "phone": "+47 987 65 432"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "lars@example.com",
      "name": "Lars Johansen",
      "created_at": "2026-01-31T10:30:00Z"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

#### POST `/auth/login`
Logg inn eksisterende bruker.

**Request:**
```json
{
  "email": "lars@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "lars@example.com",
      "name": "Lars Johansen"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

#### POST `/auth/refresh`
Fornye access token.

**Request:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "expires_in": 3600
  }
}
```

#### POST `/auth/logout`
Logg ut bruker (invaliderer tokens).

**Headers:**
```
Authorization: Bearer {access_token}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

### 4.5 Apiary Endpoints

#### GET `/apiaries`
Hent alle bigårder for innlogget bruker.

**Headers:**
```
Authorization: Bearer {access_token}
```

**Query Parameters:**
- `include_inactive` (boolean): Inkluder inaktive bigårder
- `type` (string): Filter på type (permanent, seasonal, heather_route)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Heimebigård",
      "description": "Hovedbigård ved hjemmet",
      "location": {
        "name": "Sandsli, Vestland",
        "lat": 60.3456,
        "lng": 5.2345
      },
      "type": "permanent",
      "active": true,
      "hive_count": 18,
      "stats": {
        "healthy": 16,
        "warning": 2,
        "critical": 0
      },
      "last_visit": "2026-01-31T14:30:00Z",
      "created_at": "2025-03-15T10:00:00Z"
    }
  ]
}
```

#### POST `/apiaries`
Opprett ny bigård.

**Request:**
```json
{
  "name": "Lyngbigård",
  "description": "Sesongbigård for lynghonning",
  "location": {
    "name": "Arna",
    "lat": 60.4234,
    "lng": 5.4567
  },
  "type": "seasonal"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Lyngbigård",
    "description": "Sesongbigård for lynghonning",
    "location": {
      "name": "Arna",
      "lat": 60.4234,
      "lng": 5.4567
    },
    "type": "seasonal",
    "active": true,
    "created_at": "2026-01-31T15:00:00Z"
  }
}
```

#### GET `/apiaries/:id`
Hent detaljer om en spesifikk bigård.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Heimebigård",
    "description": "Hovedbigård ved hjemmet",
    "location": {
      "name": "Sandsli, Vestland",
      "lat": 60.3456,
      "lng": 5.2345
    },
    "type": "permanent",
    "active": true,
    "hives": [
      {
        "id": "uuid",
        "hive_number": "K12",
        "status": "active",
        "strength": "strong",
        "last_inspection": "2026-01-31T14:30:00Z"
      }
    ],
    "collaborators": [
      {
        "user_id": "uuid",
        "name": "Lars Johansen",
        "role": "owner"
      }
    ],
    "created_at": "2025-03-15T10:00:00Z"
  }
}
```

#### PUT `/apiaries/:id`
Oppdater bigård.

**Request:**
```json
{
  "name": "Heimebigård (oppdatert)",
  "active": true
}
```

**Response:** `200 OK`

#### DELETE `/apiaries/:id`
Slett bigård (soft delete hvis kuber finnes).

**Response:** `204 No Content`

### 4.6 Hive Endpoints

#### GET `/hives`
Hent alle kuber for bruker.

**Query Parameters:**
- `apiary_id` (uuid): Filter på bigård
- `status` (string): active, nuc, inactive, dead
- `strength` (string): weak, medium, strong
- `health_status` (string): healthy, warning, critical
- `sort_by` (string): hive_number, last_inspection, strength
- `order` (string): asc, desc
- `page` (int): Side nummer
- `per_page` (int): Antall per side (default: 20, max: 100)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "hive_number": "K12",
      "qr_code": "QR-K12-2025",
      "apiary": {
        "id": "uuid",
        "name": "Heimebigård"
      },
      "status": "active",
      "strength": "strong",
      "hive_type": "langstroth",
      "box_count": 2,
      "queen": {
        "year": 2023,
        "marked": true,
        "color": "blue",
        "race": "Buckfast"
      },
      "current_frames": {
        "brood": 5,
        "honey": 3
      },
      "last_inspection": {
        "date": "2026-01-31T14:30:00Z",
        "health_status": "healthy",
        "strength": "strong"
      },
      "stats": {
        "total_inspections": 18,
        "total_production_kg": 28
      },
      "created_at": "2025-04-01T12:00:00Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 48,
      "total_pages": 3
    }
  }
}
```

#### POST `/hives`
Opprett ny kube.

**Request:**
```json
{
  "apiary_id": "uuid",
  "hive_number": "K24",
  "hive_type": "langstroth",
  "status": "active",
  "queen": {
    "year": 2024,
    "marked": true,
    "color": "green",
    "race": "Buckfast"
  },
  "notes": "Ny kube fra avlegger"
}
```

**Response:** `201 Created`

#### GET `/hives/:id`
Hent detaljert info om en kube.

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "hive_number": "K12",
    "qr_code": "QR-K12-2025",
    "apiary": {
      "id": "uuid",
      "name": "Heimebigård",
      "location": {
        "name": "Sandsli, Vestland",
        "lat": 60.3456,
        "lng": 5.2345
      }
    },
    "status": "active",
    "strength": "strong",
    "hive_type": "langstroth",
    "box_count": 2,
    "queen": {
      "year": 2023,
      "marked": true,
      "color": "blue",
      "race": "Buckfast"
    },
    "current_frames": {
      "brood": 5,
      "honey": 3,
      "pollen": 1,
      "empty": 1
    },
    "inspections": [
      {
        "id": "uuid",
        "date": "2026-01-31T14:30:00Z",
        "strength": "strong",
        "health_status": "healthy",
        "notes": "Meget sterk koloni"
      }
    ],
    "treatments": [
      {
        "id": "uuid",
        "date": "2026-01-17T00:00:00Z",
        "product": "Apivar",
        "withholding_end": "2026-02-28"
      }
    ],
    "stats": {
      "total_inspections": 18,
      "total_production_kg": 28,
      "total_treatments": 2,
      "total_feedings": 5
    },
    "created_at": "2025-04-01T12:00:00Z"
  }
}
```

#### PUT `/hives/:id`
Oppdater kube.

**Request:**
```json
{
  "status": "active",
  "strength": "strong",
  "box_count": 3,
  "notes": "Lagt til honningsutkaster"
}
```

**Response:** `200 OK`

#### DELETE `/hives/:id`
Slett kube (soft delete).

**Response:** `204 No Content`

#### GET `/hives/qr/:qr_code`
Hent kube via QR-kode (for mobil-scanning).

**Response:** `200 OK` (samme som GET `/hives/:id`)

### 4.7 Inspection Endpoints

#### GET `/inspections`
Hent inspeksjoner.

**Query Parameters:**
- `hive_id` (uuid): Filter på kube
- `apiary_id` (uuid): Filter på bigård
- `start_date` (date): Fra dato
- `end_date` (date): Til dato
- `health_status` (string): healthy, warning, critical
- `page`, `per_page`: Paginering

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "hive": {
        "id": "uuid",
        "hive_number": "K12",
        "apiary_name": "Heimebigård"
      },
      "user": {
        "id": "uuid",
        "name": "Lars Johansen"
      },
      "inspection_date": "2026-01-31T14:30:00Z",
      "weather": {
        "temperature": 18.5,
        "wind_speed": 3.2,
        "condition": "partly_cloudy"
      },
      "assessment": {
        "strength": "strong",
        "temperament": "calm",
        "queen_seen": true,
        "queen_laying": true
      },
      "frames": {
        "brood": 5,
        "honey": 3,
        "pollen": 1,
        "empty": 1
      },
      "health": {
        "status": "healthy",
        "varroa_level": "low",
        "diseases": [],
        "pests": []
      },
      "photos": [
        {
          "id": "uuid",
          "url": "https://cdn.example.com/photos/abc123.jpg",
          "thumbnail_url": "https://cdn.example.com/photos/abc123_thumb.jpg"
        }
      ],
      "notes": "Meget sterk koloni. God aktivitet.",
      "created_at": "2026-01-31T14:45:00Z"
    }
  ]
}
```

#### POST `/inspections`
Opprett ny inspeksjon.

**Request:**
```json
{
  "hive_id": "uuid",
  "inspection_date": "2026-01-31T14:30:00Z",
  "weather": {
    "temperature": 18.5,
    "wind_speed": 3.2,
    "condition": "partly_cloudy"
  },
  "assessment": {
    "strength": "strong",
    "temperament": "calm",
    "queen_seen": true,
    "queen_laying": true
  },
  "frames": {
    "brood": 5,
    "honey": 3,
    "pollen": 1,
    "empty": 1
  },
  "health": {
    "status": "healthy",
    "varroa_level": "low",
    "diseases": [],
    "pests": []
  },
  "actions": [
    {
      "action_type": "added_super",
      "details": {
        "frame_count": 10
      }
    }
  ],
  "notes": "Meget sterk koloni. God aktivitet."
}
```

**Response:** `201 Created`

#### GET `/inspections/:id`
Hent en spesifikk inspeksjon.

**Response:** `200 OK`

#### PUT `/inspections/:id`
Oppdater inspeksjon.

**Response:** `200 OK`

#### DELETE `/inspections/:id`
Slett inspeksjon.

**Response:** `204 No Content`

### 4.8 Photo Endpoints

#### POST `/photos/upload`
Last opp foto(er).

**Headers:**
```
Authorization: Bearer {access_token}
Content-Type: multipart/form-data
```

**Request (multipart/form-data):**
```
files: [File, File, ...]
hive_id: uuid
inspection_id: uuid (optional)
captions: ["Caption 1", "Caption 2", ...]
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "url": "https://cdn.example.com/photos/abc123.jpg",
      "thumbnail_url": "https://cdn.example.com/photos/abc123_thumb.jpg",
      "file_size": 2456789,
      "mime_type": "image/jpeg",
      "width": 3024,
      "height": 4032,
      "created_at": "2026-01-31T14:50:00Z"
    }
  ]
}
```

#### GET `/photos`
Hent bilder.

**Query Parameters:**
- `hive_id` (uuid)
- `inspection_id` (uuid)
- `start_date`, `end_date`
- `page`, `per_page`

**Response:** `200 OK`

#### DELETE `/photos/:id`
Slett foto.

**Response:** `204 No Content`

### 4.9 Treatment Endpoints

#### GET `/treatments`
Hent behandlinger.

**Query Parameters:**
- `hive_id` (uuid)
- `active_only` (boolean): Kun aktive behandlinger med karensliste
- `start_date`, `end_date`

**Response:** `200 OK`

#### POST `/treatments`
Registrer ny behandling.

**Request:**
```json
{
  "hive_id": "uuid",
  "treatment_date": "2026-01-17",
  "product_name": "Apivar",
  "product_type": "chemical",
  "target": "varroa",
  "dosage": "2 strips per brood box",
  "start_date": "2026-01-17",
  "withholding_period_days": 42,
  "notes": "Forebyggende behandling"
}
```

**Response:** `201 Created`

#### PUT `/treatments/:id`
Oppdater behandling.

**Response:** `200 OK`

#### DELETE `/treatments/:id`
Slett behandling.

**Response:** `204 No Content`

### 4.10 Feeding Endpoints

#### GET `/feedings`
Hent fôringer.

**Query Parameters:**
- `hive_id` (uuid)
- `start_date`, `end_date`
- `feed_type` (string)

**Response:** `200 OK`

#### POST `/feedings`
Registrer ny fôring.

**Request:**
```json
{
  "hive_id": "uuid",
  "feeding_date": "2026-01-31",
  "feed_type": "sugar_syrup",
  "amount_kg": 5.0,
  "sugar_concentration": 50.0,
  "reason": "spring_buildup",
  "notes": "1:1 sirup"
}
```

**Response:** `201 Created`

#### DELETE `/feedings/:id`
Slett fôring.

**Response:** `204 No Content`

### 4.11 Production Endpoints

#### GET `/production`
Hent produksjon (høsting).

**Query Parameters:**
- `hive_id` (uuid)
- `apiary_id` (uuid)
- `product_type` (string): honey, wax, propolis
- `year` (int)
- `start_date`, `end_date`

**Response:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "hive": {
        "id": "uuid",
        "hive_number": "K12",
        "apiary_name": "Heimebigård"
      },
      "harvest_date": "2025-08-15",
      "product_type": "honey",
      "honey_type": "heather",
      "amount_kg": 28.0,
      "quality_grade": "premium",
      "moisture_content": 17.5,
      "price_per_kg": 300.0,
      "total_revenue": 8400.0,
      "sold_to": "Lokal matbutikk",
      "sale_date": "2025-08-20",
      "notes": "Utmerket kvalitet",
      "created_at": "2025-08-15T16:00:00Z"
    }
  ],
  "meta": {
    "summary": {
      "total_honey_kg": 342.5,
      "total_wax_kg": 12.3,
      "total_revenue": 120000.0
    }
  }
}
```

#### POST `/production`
Registrer ny produksjon.

**Request:**
```json
{
  "hive_id": "uuid",
  "harvest_date": "2025-08-15",
  "product_type": "honey",
  "honey_type": "heather",
  "amount_kg": 28.0,
  "quality_grade": "premium",
  "moisture_content": 17.5,
  "price_per_kg": 300.0,
  "notes": "Utmerket kvalitet"
}
```

**Response:** `201 Created`

#### PUT `/production/:id`
Oppdater produksjon.

**Response:** `200 OK`

#### DELETE `/production/:id`
Slett produksjon.

**Response:** `204 No Content`

### 4.12 Statistics & Analytics Endpoints

#### GET `/stats/overview`
Hent generell statistikk for bruker.

**Query Parameters:**
- `year` (int): Spesifikt år (default: inneværende år)
- `apiary_id` (uuid): Filter på bigård

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "year": 2025,
    "apiaries": {
      "total": 5,
      "active": 5
    },
    "hives": {
      "total": 48,
      "active": 45,
      "nuc": 3,
      "by_strength": {
        "strong": 32,
        "medium": 10,
        "weak": 3
      },
      "by_health": {
        "healthy": 42,
        "warning": 4,
        "critical": 2
      }
    },
    "inspections": {
      "total": 342,
      "this_month": 28,
      "avg_per_hive": 7.1
    },
    "production": {
      "honey_kg": 342.5,
      "wax_kg": 12.3,
      "total_revenue": 120000.0
    },
    "treatments": {
      "total": 48,
      "active_withholdings": 3
    }
  }
}
```

#### GET `/stats/hive/:id`
Hent statistikk for en spesifikk kube.

**Query Parameters:**
- `year` (int)

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "hive_id": "uuid",
    "hive_number": "K12",
    "year": 2025,
    "inspections": {
      "total": 18,
      "avg_strength": "strong",
      "health_issues": 0
    },
    "production": {
      "honey_kg": 28.0,
      "wax_kg": 1.2
    },
    "treatments": {
      "total": 2,
      "types": ["varroa"]
    },
    "feedings": {
      "total": 5,
      "total_kg": 25.0
    },
    "timeline": [
      {
        "date": "2025-03-15",
        "type": "inspection",
        "strength": "medium"
      },
      {
        "date": "2025-04-01",
        "type": "feeding",
        "amount_kg": 5.0
      }
    ]
  }
}
```

### 4.13 Export Endpoints

#### GET `/export/data`
Eksporter alle data for bruker.

**Query Parameters:**
- `format` (string): json, csv
- `year` (int): Spesifikt år (optional)

**Response:** `200 OK`
- For JSON: Returnerer JSON-fil
- For CSV: Returnerer ZIP med multiple CSV-filer

### 4.14 Weather Integration Endpoint

#### GET `/weather/current`
Hent gjeldende vær for en lokasjon.

**Query Parameters:**
- `lat` (float): Latitude
- `lng` (float): Longitude

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "temperature": 18.5,
    "wind_speed": 3.2,
    "wind_direction": "SW",
    "condition": "partly_cloudy",
    "humidity": 65,
    "precipitation": 0.0,
    "suitable_for_inspection": true,
    "source": "yr.no",
    "timestamp": "2026-01-31T14:30:00Z"
  }
}
```

### 4.15 Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | User doesn't have permission |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `DUPLICATE_ENTRY` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

---

## 5. Autentisering & Sikkerhet

### 5.1 JWT Token Structure

**Access Token (1 hour expiry):**
```json
{
  "sub": "user_uuid",
  "email": "lars@example.com",
  "type": "access",
  "iat": 1706712600,
  "exp": 1706716200
}
```

**Refresh Token (30 days expiry):**
```json
{
  "sub": "user_uuid",
  "type": "refresh",
  "iat": 1706712600,
  "exp": 1709304600
}
```

### 5.2 Password Requirements

- Minimum 8 tegn
- Minst én stor bokstav
- Minst én liten bokstav
- Minst ett tall
- Minst ett spesialtegn
- Hashet med bcrypt (cost factor: 12)

### 5.3 API Rate Limiting

| Endpoint Type | Rate Limit |
|---------------|------------|
| Auth endpoints | 5 req/min per IP |
| Read endpoints | 100 req/min per user |
| Write endpoints | 30 req/min per user |
| Upload endpoints | 10 req/min per user |

### 5.4 CORS Policy

```javascript
// Allowed origins
const allowedOrigins = [
  'https://birokt.no',
  'https://app.birokt.no',
  'exp://localhost:8081', // Expo development
  'http://localhost:3000'  // Local development
];
```

### 5.5 Data Encryption

- **In Transit**: TLS 1.3 for all API communication
- **At Rest**: Database encryption via PostgreSQL transparent data encryption
- **Passwords**: bcrypt with cost factor 12
- **Files**: Optional encryption for sensitive photos

### 5.6 Privacy & GDPR Compliance

- **Data Minimization**: Kun nødvendige data samles inn
- **User Consent**: Eksplisitt samtykke for databehandling
- **Right to Access**: Bruker kan eksportere alle sine data
- **Right to Erasure**: Bruker kan slette sin konto og alle data
- **Data Retention**: Inspeksjoner og bilder beholdes inntil bruker sletter
- **Logging**: Minimal logging, ingen sensitive data i logger

---

## 6. Filhåndtering

### 6.1 File Upload Flow

```
Mobile/Web Client
    │
    ├─► POST /photos/upload (multipart/form-data)
    │       │
    │       ├─► Validate file type & size
    │       │
    │       ├─► Generate unique filename (UUID + extension)
    │       │
    │       ├─► Resize & compress original (max 2048x2048)
    │       │
    │       ├─► Generate thumbnail (400x400)
    │       │
    │       ├─► Upload to S3 (original + thumbnail)
    │       │
    │       └─► Save metadata to database
    │
    └─► Response: Photo URLs
```

### 6.2 Supported File Types

**Images:**
- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- HEIC (.heic) - Converted to JPEG

**Max File Size:** 20 MB per image

### 6.3 Image Processing

```javascript
// Using Sharp library
const processImage = async (inputBuffer) => {
  // Full size (max 2048x2048, preserve aspect ratio)
  const fullSize = await sharp(inputBuffer)
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  // Thumbnail (400x400, cover crop)
  const thumbnail = await sharp(inputBuffer)
    .resize(400, 400, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toBuffer();
  
  return { fullSize, thumbnail };
};
```

### 6.4 Storage Structure (S3)

```
birokt-storage/
├── users/
│   └── {user_id}/
│       └── avatar/
│           └── {filename}.jpg
├── photos/
│   └── {year}/
│       └── {month}/
│           ├── {photo_id}.jpg
│           └── {photo_id}_thumb.jpg
└── exports/
    └── {user_id}/
        └── {export_id}.zip
```

### 6.5 CDN Configuration

- **Cloudflare Images**: Automatic optimization & transformation
- **Responsive Images**: Auto-generate multiple sizes via URL parameters
- **Cache TTL**: 7 days for photos, 1 day for avatars
- **Geo-replication**: Serve from nearest edge location

---

## 7. Offline-sync Strategi

### 7.1 Mobile Offline Architecture

```
┌─────────────────────────────────────┐
│        React Native App             │
├─────────────────────────────────────┤
│  UI Components                      │
├─────────────────────────────────────┤
│  State Management (Zustand)         │
├─────────────────────────────────────┤
│  Sync Manager                       │
│  ├─ Queue Manager                   │
│  ├─ Conflict Resolver               │
│  └─ Network Monitor                 │
├─────────────────────────────────────┤
│  Local Database (SQLite)            │
│  ├─ Cached API Responses            │
│  ├─ Pending Operations Queue        │
│  └─ Offline-created Records         │
└─────────────────────────────────────┘
```

### 7.2 Sync Strategy

**Optimistic UI Updates:**
1. User performs action (e.g., create inspection)
2. Update local SQLite database immediately
3. Update UI instantly (optimistic)
4. Queue operation for sync
5. When online: sync to backend
6. On success: mark as synced
7. On failure: retry or show conflict resolution UI

**Data Sync Priorities:**
1. **Critical**: Inspections, treatments (highest priority)
2. **High**: Photos, feedings
3. **Medium**: Hive updates, notes
4. **Low**: Statistics, analytics

### 7.3 Conflict Resolution

**Last-Write-Wins (Simple):**
- Default strategy for most fields
- Server timestamp determines winner

**Manual Resolution (Complex):**
- For critical data (queen status, hive strength)
- Show user both versions, let them choose

**Example Conflict:**
```javascript
{
  "conflict": {
    "resource_type": "inspection",
    "resource_id": "uuid",
    "local_version": {
      "strength": "strong",
      "updated_at": "2026-01-31T14:30:00Z"
    },
    "server_version": {
      "strength": "medium",
      "updated_at": "2026-01-31T14:35:00Z"
    },
    "resolution_required": true
  }
}
```

### 7.4 Sync Queue Table (SQLite)

```sql
CREATE TABLE sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE
    resource_type TEXT NOT NULL, -- inspection, hive, photo, etc
    resource_id TEXT,
    payload TEXT NOT NULL, -- JSON payload
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending', -- pending, syncing, synced, failed
    created_at INTEGER NOT NULL,
    last_attempt_at INTEGER,
    error TEXT
);
```

### 7.5 Sync API Endpoints

#### POST `/sync/batch`
Batch sync multiple operations.

**Request:**
```json
{
  "operations": [
    {
      "id": "local_uuid_1",
      "operation": "CREATE",
      "resource": "inspection",
      "data": { ... },
      "created_at": "2026-01-31T14:30:00Z"
    },
    {
      "id": "local_uuid_2",
      "operation": "UPDATE",
      "resource": "hive",
      "resource_id": "server_uuid",
      "data": { ... },
      "updated_at": "2026-01-31T15:00:00Z"
    }
  ]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "data": {
    "synced": [
      {
        "local_id": "local_uuid_1",
        "server_id": "server_uuid_new",
        "status": "success"
      }
    ],
    "conflicts": [
      {
        "local_id": "local_uuid_2",
        "server_id": "server_uuid",
        "status": "conflict",
        "conflict_data": { ... }
      }
    ],
    "failed": []
  }
}
```

---

## 8. Deployment & Infrastruktur

### 8.1 Deployment Architecture (Production)

```
┌────────────────────────────────────────────┐
│         Cloudflare (CDN + WAF)            │
│  - DDoS Protection                         │
│  - Image Optimization                      │
│  - Global Edge Cache                       │
└───────────────┬────────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
┌───────▼─────┐  ┌──────▼──────┐
│  Vercel     │  │  Railway    │
│  (Frontend) │  │  (Backend)  │
│             │  │             │
│  Next.js    │  │  Node.js    │
│  Static     │  │  Express    │
│  Assets     │  │  API Server │
└─────────────┘  └──────┬──────┘
                        │
                ┌───────┼───────┐
                │       │       │
         ┌──────▼──┐  ┌─▼───────▼─┐
         │PostgreSQL│  │ R2/S3    │
         │(Railway) │  │(Cloudflare│
         │          │  │  or AWS)  │
         └──────────┘  └───────────┘
```

### 8.2 Environment Variables

**Backend (.env):**
```bash
# Application
NODE_ENV=production
PORT=3000
API_BASE_URL=https://api.birokt.no

# Database
DATABASE_URL=postgresql://user:pass@host:5432/birokt?sslmode=require

# JWT
JWT_SECRET=your-super-secret-key-change-this
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=30d

# File Storage
S3_ENDPOINT=https://s3.eu-west-1.amazonaws.com
S3_BUCKET=birokt-photos
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_REGION=eu-west-1

# External APIs
WEATHER_API_URL=https://api.met.no/weatherapi
WEATHER_API_USER_AGENT=Birokt/1.0 (contact@birokt.no)

# Monitoring
SENTRY_DSN=https://your-sentry-dsn

# Rate Limiting
REDIS_URL=redis://localhost:6379 (optional)
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=https://api.birokt.no/api/v1
NEXT_PUBLIC_CDN_URL=https://cdn.birokt.no
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
```

**Mobile (app.config.js):**
```javascript
export default {
  expo: {
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "https://api.birokt.no/api/v1",
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN
    }
  }
}
```

### 8.3 Docker Setup

**Dockerfile (Backend):**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**docker-compose.yml (Development):**
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://birokt:password@db:5432/birokt
      - NODE_ENV=development
    depends_on:
      - db
      - minio
    volumes:
      - ./src:/app/src

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: birokt
      POSTGRES_USER: birokt
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  minio_data:
```

### 8.4 CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: birokt-api
```

---

## 9. Skalerbarhet & Ytelse

### 9.1 Performance Targets

| Metric | Target |
|--------|--------|
| API Response Time (p95) | < 200ms |
| Database Query Time (p95) | < 50ms |
| Image Upload Time | < 3s |
| Mobile App Launch | < 2s |
| Concurrent Users | 10,000+ |
| Database Connections | Pool of 20-50 |

### 9.2 Caching Strategy

**1. API Response Caching (Redis):**
```javascript
// Cache frequently accessed, rarely changing data
const getCachedApiaries = async (userId) => {
  const cacheKey = `apiaries:${userId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) return JSON.parse(cached);
  
  const apiaries = await db.apiaries.findMany({ where: { userId } });
  await redis.setex(cacheKey, 3600, JSON.stringify(apiaries)); // 1 hour TTL
  
  return apiaries;
};
```

**2. Database Query Optimization:**
```sql
-- Index for common query patterns
CREATE INDEX idx_inspections_hive_date ON inspections(hive_id, inspection_date DESC);
CREATE INDEX idx_photos_hive_created ON photos(hive_id, created_at DESC);

-- Materialized view for dashboard stats
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
    user_id,
    COUNT(DISTINCT h.id) as total_hives,
    COUNT(DISTINCT i.id) as total_inspections,
    SUM(p.amount_kg) as total_production
FROM users u
LEFT JOIN user_apiaries ua ON u.id = ua.user_id
LEFT JOIN hives h ON ua.apiary_id = h.apiary_id
LEFT JOIN inspections i ON h.id = i.hive_id
LEFT JOIN production p ON h.id = p.hive_id
GROUP BY user_id;

REFRESH MATERIALIZED VIEW dashboard_stats; -- Run nightly
```

**3. Image Delivery (CDN):**
- Cloudflare CDN caches images globally
- Responsive images via URL transforms: `?width=800&quality=85`
- WebP auto-conversion for supported browsers
- Cache headers: `Cache-Control: public, max-age=604800` (7 days)

### 9.3 Database Connection Pooling

```javascript
// Using Prisma
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  connection: {
    connectionLimit: 20,
    idleTimeoutMillis: 30000,
  },
});
```

### 9.4 Horizontal Scaling

**API Server:**
- Stateless design allows multiple instances
- Load balancer (Railway/Nginx) distributes requests
- Session state in JWT tokens, not server memory

**Database:**
- Read replicas for analytics queries
- Connection pooler (PgBouncer) for efficient connection usage

---

## 10. Testing & Kvalitetssikring

### 10.1 Testing Strategy

**Unit Tests (Jest):**
```javascript
// Example: Hive service tests
describe('HiveService', () => {
  describe('createHive', () => {
    it('should create a new hive with valid data', async () => {
      const hiveData = {
        apiary_id: 'uuid',
        hive_number: 'K24',
        hive_type: 'langstroth',
      };
      
      const hive = await HiveService.createHive(hiveData);
      
      expect(hive.id).toBeDefined();
      expect(hive.hive_number).toBe('K24');
    });
    
    it('should generate QR code automatically', async () => {
      const hive = await HiveService.createHive({ ... });
      expect(hive.qr_code).toMatch(/^QR-K\d+-\d{4}$/);
    });
  });
});
```

**Integration Tests (Supertest):**
```javascript
describe('POST /api/v1/inspections', () => {
  it('should create inspection with valid token', async () => {
    const response = await request(app)
      .post('/api/v1/inspections')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        hive_id: testHiveId,
        inspection_date: '2026-01-31T14:30:00Z',
        strength: 'strong',
        queen_seen: true,
      })
      .expect(201);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data.id).toBeDefined();
  });
});
```

**E2E Tests (Playwright for Web):**
```javascript
test('should create inspection via web UI', async ({ page }) => {
  await page.goto('https://app.birokt.no/login');
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'password');
  await page.click('[type=submit]');
  
  await page.click('text=Ny inspeksjon');
  // ... fill form and submit
  
  await expect(page.locator('text=Inspeksjon lagret')).toBeVisible();
});
```

### 10.2 Test Coverage Goals

| Category | Target Coverage |
|----------|----------------|
| Unit Tests | > 80% |
| Integration Tests | > 70% |
| E2E Tests | Critical paths only |

### 10.3 Continuous Integration

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## 11. Monitoring & Observability

### 11.1 Error Tracking (Sentry)

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});

// Error middleware
app.use(Sentry.Handlers.errorHandler());
```

### 11.2 Application Metrics

**Key Metrics to Track:**
- API request rate (req/sec)
- API response time (p50, p95, p99)
- Error rate (%)
- Database query time
- File upload success rate
- Sync queue length (mobile)
- Active users (DAU, MAU)

### 11.3 Logging

```javascript
// Using Winston
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Log structure
logger.info('Inspection created', {
  user_id: 'uuid',
  hive_id: 'uuid',
  inspection_id: 'uuid',
  timestamp: new Date().toISOString(),
});
```

---

## 12. Fremtidige Forbedringer

### 12.1 Phase 2 Features

1. **AI-basert Bildekjennelse**
   - Automatisk oppdagelse av varroa i bilder
   - Analyse av yngelmønster
   - Estimering av koloniestørrelse

2. **Værvarsler & Anbefalinger**
   - Push-notifikasjoner for optimale inspeksjonsdager
   - Svarmsesong-varsler
   - Høsting-timing basert på vær

3. **Samarbeidsfunksjoner**
   - Dele bigårder med flere brukere
   - Kommentarer og diskusjoner
   - Roller og tilgangsstyring

4. **Avansert Analyse**
   - Prediktiv modellering av honningproduksjon
   - Trend-analyse over flere sesonger
   - Benchmarking mot andre birøktere

5. **Integrasjoner**
   - Mattilsynet rapportering
   - Salgsplattformer (for honning)
   - Regnskapsystemer

### 12.2 Teknisk Gjeld & Refaktorering

- Migrere fra REST til GraphQL (vurderes)
- Implementere WebSocket for real-time updates
- Microservices-arkitektur (ved høy vekst)
- Kubernetes for orkestrering (ved stor skala)

---

## Vedlegg A: API Postman Collection

(Se egen fil: `birokt-api.postman_collection.json`)

## Vedlegg B: Database Migration Scripts

(Se egen mappe: `/migrations/`)

## Vedlegg C: Deployment Runbook

(Se egen fil: `DEPLOYMENT.md`)

---

**Dokumentversjon:** 1.0  
**Sist oppdatert:** 31. januar 2026  
**Neste review:** Ved behov for endringer
