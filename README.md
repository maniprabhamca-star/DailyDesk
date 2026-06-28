# DailyDesk

All-in-one productivity multi-tool — one app replacing six.

## Modules

| Tier | Module | Description |
|------|--------|-------------|
| 1 | PDF Workspace | Merge, split, compress, edit, annotate, e-sign PDFs |
| 1 | QR Code Generator | Custom QR codes with logo, colors, bulk export |
| 1 | Image Compressor | JPG/PNG/WebP batch compression |
| 1 | Background Remover | AI-powered background removal |
| 1 | Password Generator | Secure passwords with strength meter |
| 2 | Smart Notes | Voice-to-text + AI categorization |
| 2 | Habit Tracker | Daily streaks, progress charts |
| 2 | Budget Tracker | Receipt scanning + expense tracking |
| 3 | File Vault | Personal cloud storage, AES-256 encrypted |
| 3 | Link in Bio | Linktree alternative, custom pages |

## Tech Stack

- **Frontend:** Next.js 14 + Tailwind CSS + Shadcn/UI
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Cache:** Redis
- **File Storage:** MinIO (self-hosted S3)
- **Background Jobs:** BullMQ
- **Auth:** JWT + bcrypt

## Subscription

- **Free:** Limited features, 1GB storage
- **Pro — $4.99/month:** Unlimited + AI features

## Project Structure

```
DailyDesk/
├── frontend/          # Next.js app
│   ├── app/
│   ├── components/
│   └── lib/
└── backend/           # Node.js + Express API
    ├── src/
    │   ├── routes/
    │   ├── controllers/
    │   ├── middleware/
    │   ├── models/
    │   └── utils/
    └── uploads/
```

## Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- Redis 7
- MinIO (optional for local dev)

### Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```
