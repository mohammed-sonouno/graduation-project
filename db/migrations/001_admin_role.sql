-- Admin role: full access to this database and all objects (current and future).
-- Run as postgres, connected to database "Graduation Project".

-- Create admin role (cluster-wide) with login.
CREATE ROLE admin WITH
  LOGIN
  PASSWORD 'Admin@2024!'
  CREATEROLE
  CREATEDB
  INHERIT;

-- Full access to this database.
GRANT ALL PRIVILEGES ON DATABASE "Graduation Project" TO admin;

-- Full access to public schema (create objects, use existing ones).
GRANT ALL ON SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL ROUTINES IN SCHEMA public TO admin;

-- Default privileges: admin gets full access to objects created in the future by postgres.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO admin;

-- So objects created by admin are also fully accessible to admin (no change) and to postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE admin IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES FOR ROLE admin IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;
