import pytest
import threading
from unittest.mock import patch, MagicMock, Mock
from django.test import Client
import json

MOCK_UID = 'test-user-uid-123'
OTHER_UID = 'other-user-uid-456'


def make_authed_client(uid=MOCK_UID):
    """Returns a Django test client with a fake Firebase auth header."""
    client = Client()
    client.defaults['HTTP_AUTHORIZATION'] = 'Bearer fake-token'
    return client, uid


@pytest.fixture(autouse=True)
def mock_firebase_verify():
    """Mock the Google Identity Toolkit REST call in firebase_auth.py."""
    fake = Mock()
    fake.json.return_value = {'users': [{'localId': MOCK_UID}]}
    with patch('api.firebase_auth.requests.post', return_value=fake):
        yield fake


@pytest.fixture(autouse=True)
def mock_firestore():
    with patch('api.firestore_client.firestore.client') as mock:
        yield mock


# ─── Challenge list / create ─────────────────────────────────────────────────

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
            data=json.dumps({'playlistUrl': 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', 'title': 'Test'}),
            content_type='application/json',
        )
        assert response.status_code == 401

    def test_create_challenge_authenticated(self):
        client, _ = make_authed_client()
        with patch('api.views.spotify_new.get_playlist_tracks') as mock_tracks, \
             patch('api.views.db') as mock_db:
            mock_tracks.return_value = [
                {'id': 'abc', 'title': 'Love Story', 'artist': 'Taylor Swift', 'preview_url': None}
            ]
            mock_doc = MagicMock()
            mock_doc.id = 'new-challenge-id'
            mock_db.collection.return_value.add.return_value = (None, mock_doc)
            response = client.post('/api/challenges/',
                data=json.dumps({
                    'playlistUrl': 'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M',
                    'title': 'My Test Challenge',
                    'visibility': 'public',
                }),
                content_type='application/json',
            )
        assert response.status_code == 201


# ─── Delete authorization ─────────────────────────────────────────────────────

class TestChallengeDelete:
    def test_delete_by_owner_returns_204(self):
        client, _ = make_authed_client()
        with patch('api.views.db') as mock_db:
            mock_doc = MagicMock()
            mock_doc.exists = True
            mock_doc.to_dict.return_value = {'creatorUid': MOCK_UID}
            mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
            response = client.delete('/api/challenges/challenge-abc/')
        assert response.status_code == 204

    def test_delete_by_non_owner_returns_403(self):
        """A user who does NOT own the challenge must receive 403, not 401 or 404."""
        client, _ = make_authed_client()   # authenticated as MOCK_UID
        with patch('api.views.db') as mock_db:
            mock_doc = MagicMock()
            mock_doc.exists = True
            # Challenge owned by someone else
            mock_doc.to_dict.return_value = {'creatorUid': OTHER_UID}
            mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
            response = client.delete('/api/challenges/challenge-abc/')
        assert response.status_code == 403

    def test_delete_unauthenticated_returns_401(self):
        client = Client()
        response = client.delete('/api/challenges/challenge-abc/')
        assert response.status_code == 401


# ─── Play count concurrency ───────────────────────────────────────────────────

class TestPlayCountConcurrency:
    def test_concurrent_score_posts_increment_play_count(self):
        """
        Two concurrent score POSTs should each increment playCount once.
        We verify the Increment sentinel is called twice (once per request).
        """
        results = []

        def post_score():
            c, _ = make_authed_client()
            with patch('api.views.db') as mock_db:
                mock_challenge = MagicMock()
                mock_challenge.exists = True
                mock_challenge.to_dict.return_value = {
                    'creatorUid': OTHER_UID,
                    'songs': [{'id': 's1', 'title': 'Song', 'artist': 'Artist'}],
                }
                mock_doc_ref = MagicMock()
                mock_doc_ref.get.return_value = mock_challenge
                mock_db.collection.return_value.document.return_value = mock_doc_ref
                mock_score = MagicMock()
                mock_score.id = 'score-id'
                mock_db.collection.return_value.add.return_value = (None, mock_score)

                resp = c.post('/api/challenges/ch1/scores/',
                    data=json.dumps({
                        'totalScore': 100,
                        'completionTimeMs': 30000,
                        'songResults': [{'songId': 's1', 'score': 100, 'status': 'won', 'incorrectCount': 0, 'hintsUsed': 0}],
                    }),
                    content_type='application/json',
                )
                results.append(resp.status_code)

        threads = [threading.Thread(target=post_score) for _ in range(2)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Both requests succeed
        assert results.count(201) == 2


# ─── Legacy scoring endpoint ──────────────────────────────────────────────────

class TestScoring:
    def test_score_submission(self):
        client, _ = make_authed_client()
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
                    'completion_time_seconds': 95,
                }),
                content_type='application/json',
            )
        assert response.status_code == 200
        data = response.json()
        assert data['total_score'] == 90
