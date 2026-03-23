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
