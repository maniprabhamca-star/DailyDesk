-- DailyDesk Database Schema
-- Run this once on a fresh PostgreSQL database

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- File Vault (also used by PDF Workspace uploads)
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT NOT NULL DEFAULT 0,
  minio_key VARCHAR(500) NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  folder VARCHAR(255) DEFAULT '/',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Smart Notes
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  content TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habit Tracker
CREATE TABLE IF NOT EXISTS habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(7) DEFAULT '#6366f1',
  frequency VARCHAR(10) DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(habit_id, logged_date)
);

-- Budget Tracker / Receipts
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(10, 2) NOT NULL,
  category VARCHAR(100),
  description VARCHAR(500),
  merchant VARCHAR(255),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- (An earlier abandoned Link-in-Bio scaffold — bio_pages/bio_links with
-- title/avatar_url columns — was removed here. The authoritative Link in Bio
-- schema is the "Link in Bio (Pro)" block further down.)

-- Indexes
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit_id ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);

-- File Vault (Phase 2) — ciphertext-only storage. header/sealed_name/wrapped_fk
-- are opaque client-encrypted blobs; the server holds no key material, ever.
CREATE TABLE IF NOT EXISTS vault_config (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  header JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vault_files (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES vault_files(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('file','folder')),
  sealed_name TEXT NOT NULL,
  wrapped_fk TEXT,
  size BIGINT NOT NULL DEFAULT 0,
  uploaded BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading','ready')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vault_files_user_idx ON vault_files(user_id);
CREATE INDEX IF NOT EXISTS vault_files_parent_idx ON vault_files(parent_id);

-- Vault Phase 4: recycle bin (soft delete; blobs purge after VAULT_BIN_DAYS).
ALTER TABLE vault_files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Link in Bio (Pro) — one public page per account at /u/<slug>. config is a
-- sanitized JSONB blob (display name, avatar data-URL, bio, theme, links).
CREATE TABLE IF NOT EXISTS bio_pages (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  views BIGINT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bio_pages_slug_idx ON bio_pages(slug);
