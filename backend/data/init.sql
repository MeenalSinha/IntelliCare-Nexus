-- IntelliCare Nexus Database Initialization
-- This script runs on first PostgreSQL container start

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search

-- Indexes will be created by SQLAlchemy on startup via create_all()
-- This file sets up extensions only

COMMENT ON DATABASE intellicare IS 'IntelliCare Nexus - Autonomous Clinical Decision Platform';
