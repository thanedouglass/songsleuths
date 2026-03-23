# SongSleuths — Project Scaffold Prompt
# Run this with: claude (in your empty repo root)
# Paste the full contents below as your first message.

---

You are scaffolding **SongSleuths**, a full-stack web application for a Howard University CSCI 375 Software Engineering course project. The app is a Spotify-powered music word puzzle game — Wordle meets Wheel of Fortune meets Name That Tune.

## Your task

Scaffold the complete project structure for a monorepo containing a React frontend and a Django backend. Do not implement any feature logic yet. The goal is a working, runnable skeleton with all config files, environment templates, and dependencies installed — ready for the team to start building features immediately.

---

## Monorepo structure to create

```
songsleuths/
├── README.md
├── .gitignore                  # already exists — do not overwrite
├── LICENSE                     # already exists — do not overwrite
├── .env.example                # root-level example showing ALL required env vars
│
├── frontend/                   # React 18 app
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css            # Tailwind directives only
│       ├── firebase.js          # Firebase app init (reads from env vars)
│       ├── routes/
│       │   └── index.jsx        # React Router v6 route definitions
│       ├── pages/
│       │   ├── Landing.jsx
│       │   ├── Login.jsx
│       │   ├── Dashboard.jsx
│       │   ├── CreateChallenge.jsx
│       │   ├── ChallengeDetail.jsx
│       │   ├── Gameplay.jsx
│       │   ├── Results.jsx
│       │   └── Explore.jsx
│       ├── components/
│       │   ├── NavBar.jsx
│       │   ├── TileBoard.jsx
│       │   ├── Keyboard.jsx
│       │   ├── AttemptCounter.jsx
│       │   ├── HintButton.jsx
│       │   └── Leaderboard.jsx
│       ├── store/
│       │   └── gameStore.js     # Zustand store skeleton
│       ├── hooks/
│       │   ├── useAuth.js       # Firebase auth hook
│       │   └── useGame.js       # Game state hook
│       └── api/
│           └── client.js        # Axios instance pointed at Django backend
│
└── backend/                     # Django app
    ├── requirements.txt
    ├── manage.py
    ├── .env.example
    ├── songsleuths/             # Django project (settings, urls, wsgi)
    │   ├── __init__.py
    │   ├── settings.py          # reads all secrets from env vars via python-dotenv
    │   ├── urls.py
    │   └── wsgi.py
    └── api/                     # Django app for all REST endpoints
        ├── __init__.py
        ├── urls.py
        ├── views.py             # stub views only
        ├── serializers.py       # stub serializers only
        ├── firebase_auth.py     # Firebase Admin SDK token verification helper
        └── tests/
            ├── __init__.py
            └── test_views.py    # stub test file with one passing smoke test
```

---

## Exact specifications per file

### Frontend

**package.json dependencies:**
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.24.0",
    "firebase": "^10.12.0",
    "axios": "^1.7.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "vite": "^5.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0"
  }
}
```

**tailwind.config.js** must include the full SongSleuths design token system:
```js
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        green:  { DEFAULT: '#1DB954', light: '#1ED760', dark: '#169C46' },
        black:  { DEFAULT: '#121212', surface: '#282828', deep: '#191414' },
        gray:   { body: '#535353', light: '#B3B3B3' },
      },
      fontFamily: {
        mono:  ['"Courier New"', 'monospace'],
        serif: ['Georgia', 'serif'],
      },
      maxWidth: { content: '640px' },
      borderRadius: { tile: '4px', pill: '500px' },
    }
  }
}
```

**src/firebase.js** — initialize Firebase from env vars, export `auth` and `db`:
```js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
```

**src/api/client.js** — Axios instance with Firebase token injection:
```js
import axios from 'axios';
import { auth } from '../firebase';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
});

client.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
```

**src/store/gameStore.js** — Zustand skeleton with the shape of game state:
```js
import { create } from 'zustand';

const useGameStore = create((set) => ({
  challenge:       null,   // current challenge object
  currentSongIndex: 0,     // which song we're on
  guessedLetters:  [],     // all letters guessed so far
  incorrectCount:  0,      // 0-3
  score:           0,      // running score
  hintsUsed:       0,      // audio hints used this challenge
  status:          'idle', // 'idle' | 'playing' | 'won' | 'lost' | 'revealed'

  setChallenge:    (challenge) => set({ challenge }),
  guessLetter:     (letter)    => set((state) => ({
    guessedLetters: [...state.guessedLetters, letter.toUpperCase()]
  })),
  incrementIncorrect: ()       => set((state) => ({
    incorrectCount: state.incorrectCount + 1,
    status: state.incorrectCount + 1 >= 3 ? 'lost' : state.status
  })),
  useHint:         ()          => set((state) => ({ hintsUsed: state.hintsUsed + 1 })),
  resetPuzzle:     ()          => set({
    guessedLetters: [], incorrectCount: 0, status: 'idle', hintsUsed: 0
  }),
}));

export default useGameStore;
```

**Each page component** should be a minimal stub returning a placeholder div:
```jsx
// Example: src/pages/Landing.jsx
export default function Landing() {
  return (
    <div className="min-h-screen bg-black-DEFAULT text-white font-mono">
      <h1 className="text-green-DEFAULT">Landing — stub</h1>
    </div>
  );
}
```

**src/routes/index.jsx** — full React Router v6 route tree:
```jsx
import { createBrowserRouter } from 'react-router-dom';
import Landing          from '../pages/Landing';
import Login            from '../pages/Login';
import Dashboard        from '../pages/Dashboard';
import CreateChallenge  from '../pages/CreateChallenge';
import ChallengeDetail  from '../pages/ChallengeDetail';
import Gameplay         from '../pages/Gameplay';
import Results          from '../pages/Results';
import Explore          from '../pages/Explore';

export const router = createBrowserRouter([
  { path: '/',              element: <Landing /> },
  { path: '/login',         element: <Login /> },
  { path: '/dashboard',     element: <Dashboard /> },
  { path: '/create',        element: <CreateChallenge /> },
  { path: '/challenge/:id', element: <ChallengeDetail /> },
  { path: '/play/:id/:songIndex', element: <Gameplay /> },
  { path: '/results/:id',   element: <Results /> },
  { path: '/explore',       element: <Explore /> },
]);
```

---

### Backend

**requirements.txt:**
```
django>=4.2,<5.0
djangorestframework>=3.15.0
django-cors-headers>=4.3.0
python-dotenv>=1.0.0
firebase-admin>=6.5.0
requests>=2.31.0
gunicorn>=22.0.0
whitenoise>=6.7.0
pytest-django>=4.8.0
```

**backend/songsleuths/settings.py** must:
- Load all secrets from `.env` via `python-dotenv`
- Have `CORS_ALLOWED_ORIGINS` reading from an env var
- Register `rest_framework`, `corsheaders`, and `api` in `INSTALLED_APPS`
- Set `REST_FRAMEWORK` default authentication to use a custom `FirebaseAuthentication` class (stub)
- Never hardcode any secret, key, or credential

**backend/api/firebase_auth.py** — Firebase Admin SDK init + DRF authentication class stub:
```python
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import os

# Initialize Firebase Admin SDK once
_cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
if _cred_path and not firebase_admin._apps:
    cred = credentials.Certificate(_cred_path)
    firebase_admin.initialize_app(cred)

class FirebaseAuthentication(BaseAuthentication):
    """
    Verifies the Firebase ID token passed in the Authorization: Bearer <token> header.
    Returns (uid_string, None) on success or raises AuthenticationFailed.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        id_token = auth_header.split('Bearer ')[1]
        try:
            decoded = firebase_auth.verify_id_token(id_token)
            return (decoded['uid'], None)
        except Exception:
            raise AuthenticationFailed('Invalid or expired Firebase token.')
```

**backend/api/urls.py** — stub URL patterns for all planned endpoints:
```python
from django.urls import path
from . import views

urlpatterns = [
    # Challenges
    path('challenges/',           views.ChallengeListCreateView.as_view()),
    path('challenges/<str:pk>/',  views.ChallengeDetailView.as_view()),

    # Spotify proxy
    path('spotify/playlist/',     views.SpotifyPlaylistView.as_view()),
    path('spotify/preview/<str:track_id>/', views.SpotifyPreviewView.as_view()),

    # Scores
    path('scores/',               views.ScoreSubmitView.as_view()),
    path('leaderboard/<str:challenge_id>/', views.LeaderboardView.as_view()),
]
```

**backend/api/views.py** — stub class-based views for every URL above:
```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class ChallengeListCreateView(APIView):
    def get(self, request):
        return Response({'message': 'ChallengeListCreate — stub'})
    def post(self, request):
        return Response({'message': 'ChallengeListCreate — stub'}, status=status.HTTP_201_CREATED)

# ... repeat pattern for all views
```

**backend/api/tests/test_views.py** — one smoke test that confirms the server responds:
```python
import pytest
from django.test import Client

@pytest.mark.django_db
def test_challenges_endpoint_returns_200():
    client = Client()
    response = client.get('/api/challenges/')
    assert response.status_code == 200
```

---

## Environment variable templates

**Root `.env.example`:**
```
# Copy to .env and fill in values — never commit .env

# Django
DJANGO_SECRET_KEY=your-secret-key-here
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173

# Firebase Admin (backend)
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json

# Spotify API (backend)
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
```

**frontend/.env.example:**
```
# Copy to .env.local and fill in values — never commit .env.local

VITE_API_URL=http://localhost:8000/api
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## README.md

Write a README with these sections:
1. Project description (one paragraph — Wordle + Wheel of Fortune + Name That Tune, Spotify-powered)
2. Tech stack table (Frontend / Backend / Auth & DB / Music API)
3. Local development setup — step by step for both frontend and backend
4. Environment variables — point to `.env.example` files
5. Running tests — `pytest` for Django, `npm test` for React
6. Team members
7. Course info (CSCI 375, Howard University, Spring 2026)

---

## Completion checklist

Before finishing, verify ALL of the following:

- [ ] `cd frontend && npm install` completes without errors
- [ ] `cd frontend && npm run dev` starts Vite on port 5173
- [ ] `cd backend && pip install -r requirements.txt` completes without errors
- [ ] `cd backend && python manage.py check` passes with no errors
- [ ] `cd backend && pytest` runs and the smoke test passes
- [ ] Every page component renders without crashing (stub content is fine)
- [ ] No hardcoded secrets, API keys, or credentials anywhere in the codebase
- [ ] Both `.env.example` files exist and document every required variable
- [ ] `README.md` exists with setup instructions

Do not move on until every item on this checklist passes.
