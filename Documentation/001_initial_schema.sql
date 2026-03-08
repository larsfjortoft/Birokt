-- Migration: 001_initial_schema
-- Description: Initial database schema for Birøkt system
-- Created: 2026-01-31

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For full-text search

-- =====================================================
-- USERS TABLE
-- =====================================================
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

-- =====================================================
-- APIARIES TABLE
-- =====================================================
CREATE TABLE apiaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_name VARCHAR(255),
    location_lat DECIMAL(10, 8),
    location_lng DECIMAL(11, 8),
    type VARCHAR(50) DEFAULT 'permanent', -- permanent, seasonal, heather_route
    active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Geospatial indexing (requires PostGIS extension - optional)
-- CREATE INDEX idx_apiaries_location ON apiaries USING GIST (
--     ll_to_earth(location_lat, location_lng)
-- );

CREATE INDEX idx_apiaries_active ON apiaries(active);

-- =====================================================
-- USER_APIARIES (Many-to-Many)
-- =====================================================
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

-- =====================================================
-- HIVES TABLE
-- =====================================================
CREATE TABLE hives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    apiary_id UUID NOT NULL REFERENCES apiaries(id) ON DELETE CASCADE,
    hive_number VARCHAR(50) NOT NULL,
    qr_code VARCHAR(255) UNIQUE,
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
CREATE INDEX idx_hives_qr_code ON hives(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX idx_hives_status ON hives(status);
CREATE INDEX idx_hives_strength ON hives(strength) WHERE strength IS NOT NULL;

-- =====================================================
-- INSPECTIONS TABLE
-- =====================================================
CREATE TABLE inspections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Weather conditions
    temperature DECIMAL(4, 1),
    wind_speed DECIMAL(4, 1),
    weather_condition VARCHAR(100),
    
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
    diseases TEXT[], -- Array of diseases
    pests TEXT[], -- Array of pests
    
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inspections_hive ON inspections(hive_id);
CREATE INDEX idx_inspections_date ON inspections(inspection_date DESC);
CREATE INDEX idx_inspections_user ON inspections(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_inspections_hive_date ON inspections(hive_id, inspection_date DESC);

-- =====================================================
-- PHOTOS TABLE
-- =====================================================
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID REFERENCES inspections(id) ON DELETE CASCADE,
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    file_path TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    file_size INTEGER,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    
    caption TEXT,
    tags TEXT[],
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_photos_inspection ON photos(inspection_id) WHERE inspection_id IS NOT NULL;
CREATE INDEX idx_photos_hive ON photos(hive_id);
CREATE INDEX idx_photos_created ON photos(created_at DESC);

-- =====================================================
-- INSPECTION_ACTIONS TABLE
-- =====================================================
CREATE TABLE inspection_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inspection_id UUID NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_actions_inspection ON inspection_actions(inspection_id);

-- =====================================================
-- TREATMENTS TABLE
-- =====================================================
CREATE TABLE treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    treatment_date DATE NOT NULL,
    
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(100),
    target VARCHAR(100),
    dosage VARCHAR(255),
    
    start_date DATE NOT NULL,
    end_date DATE,
    withholding_period_days INTEGER,
    withholding_end_date DATE,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_treatments_hive ON treatments(hive_id);
CREATE INDEX idx_treatments_date ON treatments(treatment_date DESC);
CREATE INDEX idx_treatments_withholding ON treatments(withholding_end_date) 
    WHERE withholding_end_date IS NOT NULL AND withholding_end_date >= CURRENT_DATE;

-- =====================================================
-- FEEDINGS TABLE
-- =====================================================
CREATE TABLE feedings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID NOT NULL REFERENCES hives(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    feeding_date DATE NOT NULL,
    
    feed_type VARCHAR(100) NOT NULL,
    amount_kg DECIMAL(6, 2) NOT NULL,
    sugar_concentration DECIMAL(4, 1),
    
    reason VARCHAR(255),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_feedings_hive ON feedings(hive_id);
CREATE INDEX idx_feedings_date ON feedings(feeding_date DESC);

-- =====================================================
-- PRODUCTION TABLE
-- =====================================================
CREATE TABLE production (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hive_id UUID REFERENCES hives(id) ON DELETE SET NULL,
    apiary_id UUID REFERENCES apiaries(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    harvest_date DATE NOT NULL,
    
    product_type VARCHAR(100) NOT NULL,
    honey_type VARCHAR(100),
    amount_kg DECIMAL(8, 2) NOT NULL,
    
    quality_grade VARCHAR(50),
    moisture_content DECIMAL(4, 1),
    
    -- Economics
    price_per_kg DECIMAL(8, 2),
    total_revenue DECIMAL(10, 2),
    sold_to VARCHAR(255),
    sale_date DATE,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_production_hive ON production(hive_id) WHERE hive_id IS NOT NULL;
CREATE INDEX idx_production_apiary ON production(apiary_id) WHERE apiary_id IS NOT NULL;
CREATE INDEX idx_production_date ON production(harvest_date DESC);
CREATE INDEX idx_production_user_year ON production(user_id, EXTRACT(YEAR FROM harvest_date));

-- =====================================================
-- VIEWS
-- =====================================================

-- Latest inspection per hive
CREATE VIEW latest_inspections AS
SELECT DISTINCT ON (hive_id)
    hive_id,
    id as inspection_id,
    inspection_date,
    strength,
    health_status,
    queen_seen,
    varroa_level
FROM inspections
ORDER BY hive_id, inspection_date DESC;

-- Hive summary with latest data
CREATE VIEW hive_summary AS
SELECT 
    h.*,
    a.name as apiary_name,
    a.location_name as apiary_location,
    li.inspection_date as last_inspection_date,
    li.strength as current_strength,
    li.health_status as current_health,
    li.varroa_level as current_varroa_level,
    COUNT(DISTINCT i.id) as total_inspections,
    COALESCE(SUM(p.amount_kg), 0) as total_production_kg
FROM hives h
LEFT JOIN apiaries a ON h.apiary_id = a.id
LEFT JOIN latest_inspections li ON h.id = li.hive_id
LEFT JOIN inspections i ON h.id = i.hive_id
LEFT JOIN production p ON h.id = p.hive_id AND EXTRACT(YEAR FROM p.harvest_date) = EXTRACT(YEAR FROM CURRENT_DATE)
GROUP BY h.id, a.name, a.location_name, li.inspection_date, li.strength, li.health_status, li.varroa_level;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_apiaries_updated_at BEFORE UPDATE ON apiaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_hives_updated_at BEFORE UPDATE ON hives
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inspections_updated_at BEFORE UPDATE ON inspections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_feedings_updated_at BEFORE UPDATE ON feedings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_production_updated_at BEFORE UPDATE ON production
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to generate QR code for new hives
CREATE OR REPLACE FUNCTION generate_hive_qr_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_code IS NULL THEN
        NEW.qr_code := 'QR-' || NEW.hive_number || '-' || EXTRACT(YEAR FROM NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_hive_qr_code_trigger BEFORE INSERT ON hives
    FOR EACH ROW EXECUTE FUNCTION generate_hive_qr_code();

-- =====================================================
-- SEED DATA (Optional - for development)
-- =====================================================

-- Insert test user (password: 'TestPass123!')
-- Note: This is a bcrypt hash with cost factor 12
INSERT INTO users (email, name, password_hash) VALUES
('test@birokt.no', 'Test Bruker', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5LS2LhQY5/jbK');

-- Get test user ID for subsequent inserts
DO $$
DECLARE
    test_user_id UUID;
    apiary1_id UUID;
    apiary2_id UUID;
    hive1_id UUID;
    hive2_id UUID;
BEGIN
    -- Get test user ID
    SELECT id INTO test_user_id FROM users WHERE email = 'test@birokt.no';
    
    -- Insert test apiaries
    INSERT INTO apiaries (name, location_name, location_lat, location_lng, type)
    VALUES 
        ('Heimebigård', 'Sandsli, Vestland', 60.3456, 5.2345, 'permanent')
    RETURNING id INTO apiary1_id;
    
    INSERT INTO apiaries (name, location_name, location_lat, location_lng, type)
    VALUES
        ('Lyngbigård', 'Arna', 60.4234, 5.4567, 'seasonal')
    RETURNING id INTO apiary2_id;
    
    -- Link user to apiaries
    INSERT INTO user_apiaries (user_id, apiary_id, role)
    VALUES 
        (test_user_id, apiary1_id, 'owner'),
        (test_user_id, apiary2_id, 'owner');
    
    -- Insert test hives
    INSERT INTO hives (apiary_id, hive_number, status, strength, hive_type, queen_year, queen_marked, queen_color, queen_race)
    VALUES
        (apiary1_id, 'K12', 'active', 'strong', 'langstroth', 2023, true, 'blue', 'Buckfast')
    RETURNING id INTO hive1_id;
    
    INSERT INTO hives (apiary_id, hive_number, status, strength, hive_type, queen_year, queen_marked, queen_color, queen_race)
    VALUES
        (apiary2_id, 'K07', 'active', 'medium', 'langstroth', 2024, true, 'green', 'Buckfast')
    RETURNING id INTO hive2_id;
    
    -- Insert test inspection
    INSERT INTO inspections (
        hive_id, user_id, inspection_date,
        temperature, wind_speed, weather_condition,
        strength, temperament, queen_seen, queen_laying,
        brood_frames, honey_frames, pollen_frames, empty_frames,
        health_status, varroa_level,
        notes
    ) VALUES (
        hive1_id, test_user_id, NOW(),
        18.5, 3.2, 'partly_cloudy',
        'strong', 'calm', true, true,
        5, 3, 1, 1,
        'healthy', 'low',
        'Meget sterk koloni. God aktivitet.'
    );
    
END $$;

-- =====================================================
-- GRANTS (Adjust as needed for your setup)
-- =====================================================

-- Grant permissions to application user (create this user first)
-- CREATE USER birokt_app WITH PASSWORD 'your-secure-password';
-- GRANT CONNECT ON DATABASE birokt TO birokt_app;
-- GRANT USAGE ON SCHEMA public TO birokt_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO birokt_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO birokt_app;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Full-text search on hive notes
CREATE INDEX idx_hives_notes_fts ON hives USING gin(to_tsvector('norwegian', notes))
    WHERE notes IS NOT NULL;

-- Full-text search on inspection notes
CREATE INDEX idx_inspections_notes_fts ON inspections USING gin(to_tsvector('norwegian', notes))
    WHERE notes IS NOT NULL;

-- =====================================================
-- COMMENTS (Documentation)
-- =====================================================

COMMENT ON TABLE users IS 'Application users (beekeepers)';
COMMENT ON TABLE apiaries IS 'Bigårder (apiary locations)';
COMMENT ON TABLE user_apiaries IS 'Many-to-many relationship between users and apiaries';
COMMENT ON TABLE hives IS 'Bikuber (individual hives)';
COMMENT ON TABLE inspections IS 'Kubeinspeksjoner (hive inspections)';
COMMENT ON TABLE photos IS 'Photos from inspections';
COMMENT ON TABLE treatments IS 'Behandlinger (treatments for diseases/pests)';
COMMENT ON TABLE feedings IS 'Fôringer (feedings)';
COMMENT ON TABLE production IS 'Produksjon/høsting (honey harvests)';

-- =====================================================
-- END OF MIGRATION
-- =====================================================
