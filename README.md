# SongSleuths

SongSleuths is a full-stack web application for the Howard University CSCI 375 Software Engineering course project. It is a Spotify-powered music word puzzle game — combining elements of Wordle, Wheel of Fortune, and Name That Tune.

## Tech Stack
| Component | Technology |
| --- | --- |
| Frontend | React 18, Vite, TailwindCSS, Zustand, React Router v6 |
| Backend | Django, Django REST Framework |
| Auth & DB | Firebase Authentication, Firebase Firestore |
| Music API | Spotify Web API |

## Local Development Setup

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)

### Frontend Setup
1. Navigate to the frontend directory: `cd frontend`
2. Install dependencies: `npm install`
3. Copy the environment variables template: `cp .env.example .env.local`
4. Fill in the required environment variables in `.env.local`.
5. Start the development server: `npm run dev`

### Backend Setup
1. Navigate to the backend directory: `cd backend`
2. Create a virtual environment (optional but recommended): `python -m venv venv`
3. Activate the virtual environment: `source venv/bin/activate` (or `venv\Scripts\activate` on Windows)
4. Install dependencies: `pip install -r requirements.txt`
5. Copy the environment variables template in the project root: `cp ../.env.example ../.env`
6. Fill in the required environment variables in the root `.env` file.
7. Run checks to ensure everything is configured: `python manage.py check`
8. Run migrations: `python manage.py migrate`
9. Start the development server: `python manage.py runserver`

## Environment Variables
- Root backend configuration: `/.env.example` -> `/.env`
- Frontend configuration: `/frontend/.env.example` -> `/frontend/.env.local`

## Running Tests
- **Backend:** `cd backend && pytest`
- **Frontend:** `cd frontend && npm test` (to be configured)

## Team Members
- Thane Douglass
- Miles James
- Paris Alston
- Adele Mugadza
- Langyia Philemon

## Course Info
- **Course:** CSCI 375 Software Engineering
- **Institution:** Howard University
- **Term:** Spring 2026
