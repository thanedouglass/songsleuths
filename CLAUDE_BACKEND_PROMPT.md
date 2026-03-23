# SongSleuths — Backend Implementation Prompt
# Prerequisite: CLAUDE_SCAFFOLD_PROMPT.md has been run and all checklist items pass.
# Run this with: claude (from the repo root)
# Paste the full contents below as your first message.

---

You are implementing the **Django REST API backend** for SongSleuths — a Spotify-powered music word puzzle game. The project scaffold already exists. Do not re-scaffold. Do not touch anything in `frontend/`. Work exclusively inside `backend/`.

Read the existing files in `backend/` before writing anything. Understand what's already there, then build on top of it.

---

## Context

SongSleuths is a Wordle + Wheel of Fortune + Name That Tune hybrid. Users:
1. Create challenges by pasting a Spotify playlist URL (backend fetches track metadata)
2. Play challenges — guessing blanked-out song titles letter by letter (3 incorrect guesses max)
3. Use a 15-second Spotify audio preview as a hint (costs points)
4. Submit scores that feed a per-challenge leaderboard

All data lives in **Firebase Firestore**. Django does not use a relational database. Django's job is:
- Verify Firebase ID tokens on every authenticated request
- Proxy all Spotify API calls (keeps credentials server-side)
- Handle score calculation and leaderboard queries
- Enforce privacy rules (public vs. private challenges)

---

## What to build

### 1. Firebase Admin authentication (`backend/api/firebase_auth.py`)

Replace the stub with the full implementation:

```python
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import os

_cred_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
if _cred_path and not firebase_admin._apps:
    cred = credentials.Certificate(_cred_path)
    firebase_admin.initialize_app(cred)

class FirebaseAuthentication(BaseAuthentication):
    """
    Reads Authorization: Bearer <firebase_id_token>
    Returns (uid_string, None) on success.
    Returns None (anonymous) if no header present.
    Raises AuthenticationFailed if token is present but invalid.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None
        id_token = auth_header.split('Bearer ', 1)[1].strip()
        try:
            decoded = firebase_auth.verify_id_token(id_token)
            return (decoded['uid'], None)
        except firebase_auth.ExpiredIdTokenError:
            raise AuthenticationFailed('Firebase token has expired.')
        except firebase_auth.InvalidIdTokenError:
            raise AuthenticationFailed('Firebase token is invalid.')
        except Exception as e:
            raise AuthenticationFailed(f'Firebase authentication failed: {str(e)}')
```

---

### 2. Firestore client (`backend/api/firestore_client.py`)

Create this file. It initializes the Firestore client once and exposes a single `db` instance used by all views.

```python
import firebase_admin
from firebase_admin import firestore
import os

# Firebase Admin is already initialized in firebase_auth.py
# This module just exposes the Firestore client.

def get_db():
    """Returns the Firestore client. Safe to call multiple times."""
    return firestore.client()

db = get_db()
```

---

### 3. Spotify service (`backend/api/spotify_service.py`)

Create this file. It handles all Spotify Web API communication.

**Implement these functions:**

```python
import os
import requests
from django.core.cache import cache

SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
SPOTIFY_API_BASE  = 'https://api.spotify.com/v1'
CLIENT_ID     = os.getenv('SPOTIFY_CLIENT_ID')
CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')

def get_access_token() -> str:
    """
    Gets a Spotify Client Credentials access token.
    Caches it for 50 minutes (tokens expire in 60).
    Uses Django's cache framework (in-memory cache is fine).
    """
    ...

def get_playlist_tracks(playlist_id: str) -> list[dict]:
    """
    Fetches all tracks from a Spotify playlist.
    Handles pagination (Spotify returns max 100 tracks per page).
    
    Returns a list of dicts, each containing:
    {
        'spotify_id':   str,   # track ID
        'title':        str,   # track name
        'artist':       str,   # primary artist name
        'album':        str,   # album name
        'preview_url':  str | None,  # 30-second preview URL (may be null)
        'album_art':    str | None,  # album art URL (640px image)
    }
    
    Raises ValueError if the playlist is private or not found (404).
    Raises requests.HTTPError for other Spotify API errors.
    """
    ...

def extract_playlist_id(url_or_id: str) -> str:
    """
    Accepts either a full Spotify playlist URL or a bare playlist ID.
    
    Valid inputs:
      - 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
      - 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123'
      - '37i9dQZF1DXcBWIGoYBM5M'
    
    Returns the playlist ID string.
    Raises ValueError if the input cannot be parsed as a playlist URL or ID.
    """
    ...
```

---

### 4. Score calculation (`backend/api/scoring.py`)

Create this file. Pure Python, no Django or Firebase imports needed here.

```python
BASE_SCORE          = 100   # points for solving a puzzle
HINT_PENALTY        = 25    # deducted per audio hint used
INCORRECT_PENALTY   = 10    # deducted per wrong letter guess
REVEAL_SCORE        = 0     # always 0 if answer was revealed

def calculate_puzzle_score(
    solved: bool,
    revealed: bool,
    incorrect_count: int,
    hints_used: int,
) -> int:
    """
    Returns the score for a single puzzle (one song).
    
    Rules:
    - If revealed: always 0
    - If not solved and not revealed: 0 (ran out of attempts)
    - If solved: BASE_SCORE minus penalties, floor of 0
    """
    ...

def calculate_challenge_score(puzzle_scores: list[int]) -> int:
    """
    Sums puzzle scores across all songs in a challenge.
    """
    return sum(puzzle_scores)
```

---

### 5. Views (`backend/api/views.py`)

Replace the stubs with full implementations. Every authenticated view must check `request.user` (the Firebase UID returned by `FirebaseAuthentication`). Unauthenticated requests to protected endpoints return 401.

#### `GET /api/challenges/`
- Returns all **public** challenges from Firestore, ordered by `created_at` descending
- No auth required
- Response shape:
```json
[
  {
    "id": "firestore_doc_id",
    "title": "string",
    "description": "string",
    "creator_uid": "string",
    "song_count": 0,
    "play_count": 0,
    "created_at": "ISO8601",
    "privacy": "public"
  }
]
```

#### `POST /api/challenges/`
- **Auth required**
- Request body:
```json
{
  "playlist_url": "https://open.spotify.com/playlist/...",
  "title": "string",
  "description": "string (optional)",
  "privacy": "public | private | restricted",
  "allowed_uids": ["uid1", "uid2"]  // only when privacy = "restricted"
}
```
- Backend calls `spotify_service.get_playlist_tracks()` to fetch track data
- Creates a Firestore document in `challenges/` collection with:
  - All request fields
  - `creator_uid` set to `request.user` (the Firebase UID)
  - `tracks` array (the Spotify track data)
  - `play_count: 0`
  - `created_at` server timestamp
- Returns the created challenge document (201)
- Returns 400 if playlist URL is invalid or playlist is empty
- Returns 400 if title is missing

#### `GET /api/challenges/<id>/`
- Returns a single challenge by Firestore document ID
- Enforces privacy: private/restricted challenges return 403 if requester is not the creator or not in `allowed_uids`
- Public challenges: no auth required
- Returns 404 if document doesn't exist

#### `DELETE /api/challenges/<id>/`
- **Auth required**
- Only the creator (`creator_uid == request.user`) may delete
- Deletes the Firestore document
- Returns 403 if requester is not the creator
- Returns 204 on success

#### `POST /api/spotify/playlist/`
- **Auth required**
- Preview endpoint — fetches track list WITHOUT creating a challenge
- Used by the frontend "preview before publishing" feature
- Request body: `{ "playlist_url": "..." }`
- Returns the track list (same shape as `tracks` in a challenge doc)
- Returns 400 if URL is invalid

#### `GET /api/spotify/preview/<track_id>/`
- **Auth required**
- Returns the Spotify preview URL for a given track ID
- Fetches fresh from Spotify API (preview URLs can expire)
- Response: `{ "preview_url": "https://..." }` or `{ "preview_url": null }`

#### `POST /api/scores/`
- **Auth required**
- Called when a user finishes a full challenge
- Request body:
```json
{
  "challenge_id": "firestore_doc_id",
  "puzzle_results": [
    {
      "song_index": 0,
      "solved": true,
      "revealed": false,
      "incorrect_count": 1,
      "hints_used": 0
    }
  ],
  "completion_time_seconds": 142
}
```
- Backend calculates the total score using `scoring.calculate_puzzle_score()`
- Writes a document to Firestore `scores/` collection:
  - `challenge_id`, `user_uid`, `total_score`, `puzzle_results`, `completion_time_seconds`, `created_at`
- Increments `play_count` on the challenge document (use Firestore `INCREMENT`)
- Returns `{ "total_score": int, "score_id": "firestore_doc_id" }`
- A user can submit multiple scores for the same challenge (retries allowed)

#### `GET /api/leaderboard/<challenge_id>/`
- No auth required
- Queries Firestore `scores/` collection where `challenge_id == <challenge_id>`
- Orders by `total_score` DESC, then `completion_time_seconds` ASC
- Returns top 50 results
- Response shape:
```json
[
  {
    "rank": 1,
    "user_uid": "string",
    "total_score": 0,
    "completion_time_seconds": 0,
    "created_at": "ISO8601"
  }
]
```

---

### 6. Serializers (`backend/api/serializers.py`)

Implement DRF serializers for request validation only (Firestore handles storage, not Django models):

```python
from rest_framework import serializers

class CreateChallengeSerializer(serializers.Serializer):
    playlist_url = serializers.URLField()
    title        = serializers.CharField(max_length=100)
    description  = serializers.CharField(max_length=500, required=False, allow_blank=True)
    privacy      = serializers.ChoiceField(choices=['public', 'private', 'restricted'])
    allowed_uids = serializers.ListField(
        child=serializers.CharField(), required=False, default=list
    )

class PlaylistPreviewSerializer(serializers.Serializer):
    playlist_url = serializers.URLField()

class PuzzleResultSerializer(serializers.Serializer):
    song_index      = serializers.IntegerField(min_value=0)
    solved          = serializers.BooleanField()
    revealed        = serializers.BooleanField()
    incorrect_count = serializers.IntegerField(min_value=0, max_value=3)
    hints_used      = serializers.IntegerField(min_value=0)

class ScoreSubmitSerializer(serializers.Serializer):
    challenge_id             = serializers.CharField()
    puzzle_results           = PuzzleResultSerializer(many=True)
    completion_time_seconds  = serializers.IntegerField(min_value=0)
```

---

### 7. URL routing (`backend/songsleuths/urls.py`)

```python
from django.urls import path, include

urlpatterns = [
    path('api/', include('api.urls')),
]
```

---

### 8. Settings (`backend/songsleuths/settings.py`)

Ensure these are all present and correct:

```python
from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv('DJANGO_SECRET_KEY', 'dev-insecure-key-change-in-production')
DEBUG      = os.getenv('DJANGO_DEBUG', 'True') == 'True'
ALLOWED_HOSTS = os.getenv('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'api.firebase_auth.FirebaseAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
}

CORS_ALLOWED_ORIGINS = os.getenv(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:5173'
).split(',')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# No database needed — Firestore handles all persistence
DATABASES = {}
```

---

### 9. Tests (`backend/api/tests/`)

Replace the smoke test stub with a proper test suite. Use `pytest-django` and `unittest.mock` to mock all Firebase and Spotify calls — tests must run without any real credentials.

**`test_scoring.py`** — unit tests for the scoring module (no mocking needed):
```python
from api.scoring import calculate_puzzle_score, calculate_challenge_score

def test_solved_no_penalties():
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=0, hints_used=0) == 100

def test_solved_with_hint():
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=0, hints_used=1) == 75

def test_solved_with_incorrect_and_hint():
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=2, hints_used=1) == 55

def test_revealed_always_zero():
    assert calculate_puzzle_score(solved=False, revealed=True, incorrect_count=0, hints_used=0) == 0

def test_failed_no_reveal():
    assert calculate_puzzle_score(solved=False, revealed=False, incorrect_count=3, hints_used=0) == 0

def test_score_floor_is_zero():
    # Heavy penalties should never go negative
    assert calculate_puzzle_score(solved=True, revealed=False, incorrect_count=3, hints_used=10) == 0

def test_challenge_score_sums_puzzles():
    assert calculate_challenge_score([100, 75, 0, 50]) == 225
```

**`test_spotify_service.py`** — unit tests for URL parsing and token caching:
```python
from unittest.mock import patch, MagicMock
from api.spotify_service import extract_playlist_id

def test_extract_id_from_full_url():
    url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'
    assert extract_playlist_id(url) == '37i9dQZF1DXcBWIGoYBM5M'

def test_extract_id_from_url_with_query_params():
    url = 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123'
    assert extract_playlist_id(url) == '37i9dQZF1DXcBWIGoYBM5M'

def test_extract_bare_id_passthrough():
    assert extract_playlist_id('37i9dQZF1DXcBWIGoYBM5M') == '37i9dQZF1DXcBWIGoYBM5M'

def test_extract_invalid_raises():
    import pytest
    with pytest.raises(ValueError):
        extract_playlist_id('not-a-spotify-url')
```

**`test_views.py`** — integration tests for all endpoints using Django test client with mocked Firebase and Spotify:
```python
import pytest
from unittest.mock import patch, MagicMock
from django.test import Client
import json

# Mock Firebase token verification globally for auth tests
MOCK_UID = 'test-user-uid-123'

def make_authed_client():
    """Returns a Django test client with a fake Firebase auth header."""
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = 'Bearer fake-token'
    return client

@pytest.fixture(autouse=True)
def mock_firebase_verify(monkeypatch):
    with patch('api.firebase_auth.firebase_auth.verify_id_token') as mock:
        mock.return_value = {'uid': MOCK_UID}
        yield mock

@pytest.fixture(autouse=True)
def mock_firestore(monkeypatch):
    with patch('api.firestore_client.firestore.client') as mock:
        yield mock

class TestChallengeList:
    def test_get_public_challenges_no_auth(self):
        client = Client()
        with patch('api.views.db') as mock_db:
            mock_db.collection.return_value.where.return_value \
                .order_by.return_value.limit.return_value \
                .stream.return_value = []
            response = client.get('/api/challenges/')
        assert response.status_code == 200

    def test_create_challenge_requires_auth(self):
        client = Client()
        response = client.post('/api/challenges/',
            data=json.dumps({'playlist_url': 'https://open.spotify.com/playlist/abc', 'title': 'Test', 'privacy': 'public'}),
            content_type='application/json'
        )
        assert response.status_code == 401

    def test_create_challenge_authenticated(self):
        client = make_authed_client()
        with patch('api.views.spotify_service.get_playlist_tracks') as mock_tracks, \
             patch('api.views.db') as mock_db:
            mock_tracks.return_value = [
                {'spotify_id': 'abc', 'title': 'Love Story', 'artist': 'Taylor Swift',
                 'album': 'Fearless', 'preview_url': None, 'album_art': None}
            ]
            mock_doc = MagicMock()
            mock_doc.id = 'new-challenge-id'
            mock_db.collection.return_value.add.return_value = (None, mock_doc)
            response = client.post('/api/challenges/',
                data=json.dumps({
                    'playlist_url': 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
                    'title': 'My Test Challenge',
                    'privacy': 'public'
                }),
                content_type='application/json'
            )
        assert response.status_code == 201

class TestScoring:
    def test_score_submission(self):
        client = make_authed_client()
        with patch('api.views.db') as mock_db:
            mock_challenge_doc = MagicMock()
            mock_challenge_doc.exists = True
            mock_challenge_doc.to_dict.return_value = {
                'privacy': 'public', 'creator_uid': 'other-uid'
            }
            mock_db.collection.return_value.document.return_value \
                .get.return_value = mock_challenge_doc
            mock_score_ref = MagicMock()
            mock_score_ref.id = 'score-doc-id'
            mock_db.collection.return_value.add.return_value = (None, mock_score_ref)

            response = client.post('/api/scores/',
                data=json.dumps({
                    'challenge_id': 'challenge-123',
                    'puzzle_results': [
                        {'song_index': 0, 'solved': True, 'revealed': False,
                         'incorrect_count': 1, 'hints_used': 0}
                    ],
                    'completion_time_seconds': 95
                }),
                content_type='application/json'
            )
        assert response.status_code == 200
        data = response.json()
        assert data['total_score'] == 90  # 100 - 10 (one incorrect)
```

---

## Completion checklist

Before finishing, run all of the following and confirm they pass:

- [ ] `cd backend && python manage.py check` — no errors
- [ ] `cd backend && pytest` — all tests pass, 0 failures
- [ ] `cd backend && python manage.py shell -c "from api.scoring import calculate_puzzle_score; print(calculate_puzzle_score(True,False,0,0))"` prints `100`
- [ ] `cd backend && python manage.py shell -c "from api.spotify_service import extract_playlist_id; print(extract_playlist_id('https://open.spotify.com/playlist/abc123'))"` prints `abc123`
- [ ] Every view returns JSON (not HTML) — confirm with `curl http://localhost:8000/api/challenges/`
- [ ] No hardcoded credentials anywhere — run `grep -r "CLIENT_SECRET\|API_KEY\|serviceAccount" backend/ --include="*.py"` and confirm no matches outside of `settings.py` env var reads
- [ ] `pytest --cov=api --cov-report=term-missing` shows coverage above 70% on `scoring.py` and `spotify_service.py`

Do not mark this complete until every checklist item passes.
