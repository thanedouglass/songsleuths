import logging
import re
import requests
from datetime import datetime, timezone

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from google.cloud.firestore_v1 import Increment
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import scoring
from . import spotify as spotify_new  # new module for M2 challenge endpoints
from . import spotify_service         # kept for existing preview/score endpoints
from .firestore_client import db
from .serializers import PlaylistPreviewSerializer, ScoreSubmitSerializer

logger = logging.getLogger(__name__)


class HealthCheckView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


def _is_authenticated(user):
    """Returns True when FirebaseAuthenticated set request.user to a UID string."""
    return isinstance(user, str) and bool(user)


def _parse_playlist_id(url: str) -> str | None:
    """
    Extracts the Spotify playlist ID from a URL or URI.
    Accepts:
      https://open.spotify.com/playlist/{id}?si=...
      spotify:playlist:{id}
    Returns None if unrecognisable.
    """
    # URL format
    match = re.search(r'open\.spotify\.com/playlist/([A-Za-z0-9]+)', url)
    if match:
        return match.group(1)
    # URI format
    match = re.match(r'^spotify:playlist:([A-Za-z0-9]+)$', url.strip())
    if match:
        return match.group(1)
    return None


def _ts_to_iso(value) -> str | None:
    """Convert a Firestore DatetimeWithNanoseconds or plain datetime to ISO string."""
    if value is None:
        return None
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


def _build_puzzle_tokens(title: str) -> list:
    """Converts a song title into puzzle tokens (no actual letters for hidden chars)."""
    tokens = []
    for i, char in enumerate(title):
        if char == ' ':
            tokens.append({'type': 'space', 'char': ' '})
        elif char.isalpha():
            tokens.append({'type': 'letter', 'char': '_', 'position': i})
        else:
            tokens.append({'type': 'punctuation', 'char': char})
    return tokens


def _calc_expected_score(song_results: list) -> int:
    total = 0
    for r in song_results:
        if r.get('status') == 'revealed':
            total += 0
        else:
            total += max(0, 100 - 20 * int(r.get('incorrectCount', 0))
                                  - 25 * int(r.get('hintsUsed', 0)))
    return total


def _get_song(pk: str, song_index: int):
    """Returns (challenge_dict, song_dict) or raises ValueError."""
    doc = db.collection('challenges').document(pk).get()
    if not doc.exists:
        raise ValueError('Challenge not found')
    d = doc.to_dict()
    songs = d.get('songs', [])
    if song_index < 0 or song_index >= len(songs):
        raise ValueError('Song not found')
    return d, songs[song_index]


# ─── M3 Gameplay endpoints ───────────────────────────────────────────────────

class SongPuzzleView(APIView):
    def get(self, request, pk, song_index):
        try:
            challenge, song = _get_song(pk, song_index)
            title = song.get('title', '')
            doc = db.collection('challenges').document(pk).get()
            song_count = len(challenge.get('songs', []))
            return Response({
                'songId': song.get('id'),
                'puzzleTokens': _build_puzzle_tokens(title),
                'artist': song.get('artist', ''),
                'previewUrl': song.get('previewUrl'),
                'songCount': song_count,
            })
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SongGuessView(APIView):
    def post(self, request, pk, song_index):
        letter = (request.data.get('letter') or '').strip().upper()
        if not letter or len(letter) != 1 or not letter.isalpha():
            return Response({'error': 'Invalid letter'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            _, song = _get_song(pk, song_index)
            title = song.get('title', '')
            positions = [i for i, c in enumerate(title) if c.upper() == letter and c.isalpha()]
            return Response({'correct': bool(positions), 'positions': positions})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SongAnswerView(APIView):
    def get(self, request, pk, song_index):
        try:
            _, song = _get_song(pk, song_index)
            return Response({'title': song.get('title', '')})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChallengeScoreView(APIView):
    def post(self, request, pk):
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        total_score = request.data.get('totalScore')
        completion_time_ms = request.data.get('completionTimeMs')
        song_results = request.data.get('songResults', [])

        if total_score is None or completion_time_ms is None:
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        expected = _calc_expected_score(song_results)
        if expected != int(total_score):
            return Response(
                {'error': f'Score mismatch: expected {expected}, got {total_score}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            doc_ref = db.collection('challenges').document(pk)
            _, score_ref = db.collection('scores').add({
                'challengeId': pk,
                'userId': request.user,
                'totalScore': int(total_score),
                'completionTimeMs': int(completion_time_ms),
                'songResults': song_results,
                'completedAt': datetime.now(timezone.utc),
            })
            doc_ref.update({'playCount': Increment(1)})

            # Calculate rank after write
            all_scores = (
                db.collection('scores')
                .where('challengeId', '==', pk)
                .order_by('totalScore', direction='DESCENDING')
                .order_by('completionTimeMs', direction='ASCENDING')
                .stream()
            )
            rank = 1
            for s in all_scores:
                if s.id == score_ref.id:
                    break
                rank += 1

            return Response({'scoreId': score_ref.id, 'rank': rank}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SongPreviewProxyView(APIView):
    """
    Proxies the Spotify audio preview so the raw CDN URL is never exposed
    in the browser network tab.
    """
    def get(self, request, pk, song_index):
        from django.http import StreamingHttpResponse, HttpResponse
        try:
            _, song = _get_song(pk, song_index)
            preview_url = song.get('previewUrl')
            if not preview_url:
                return Response({'available': False}, status=status.HTTP_404_NOT_FOUND)

            # Fetch audio from Spotify CDN server-side
            audio_resp = requests.get(preview_url, stream=True, timeout=15)
            audio_resp.raise_for_status()

            def audio_stream():
                for chunk in audio_resp.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk

            response = StreamingHttpResponse(audio_stream(), content_type='audio/mpeg')
            response['Cache-Control'] = 'public, max-age=3600'
            response['Content-Length'] = audio_resp.headers.get('Content-Length', '')
            return response

        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
        except requests.RequestException as e:
            return Response({'error': f'Preview unavailable: {str(e)}'}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChallengeLeaderboardView(APIView):
    def get(self, request, pk):
        try:
            docs = (
                db.collection('scores')
                .where('challengeId', '==', pk)
                .order_by('totalScore', direction='DESCENDING')
                .order_by('completionTimeMs', direction='ASCENDING')
                .limit(10)
                .stream()
            )
            results = []
            rank = 1
            for doc in docs:
                d = doc.to_dict()
                # Never expose userId
                display_name = d.get('displayName') or f'Player {rank}'
                results.append({
                    'rank': rank,
                    'displayName': display_name,
                    'totalScore': d.get('totalScore', 0),
                    'completionTimeMs': d.get('completionTimeMs', 0),
                    'completedAt': _ts_to_iso(d.get('completedAt')),
                })
                rank += 1
            return Response(results)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# ─── Challenge endpoints (M2) ────────────────────────────────────────────────

@method_decorator(csrf_exempt, name='dispatch')
class PlaylistFetchSongsView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        playlist_url = request.data.get('playlistUrl', '').strip()
        playlist_id = _parse_playlist_id(playlist_url)

        logger.info('[fetch_songs] url=%r → extracted id=%r', playlist_url, playlist_id)

        if not playlist_id:
            return Response({'error': 'Invalid Spotify playlist URL'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_tracks = spotify_new.get_playlist_tracks(playlist_id)
        except ValueError as e:
            logger.error('[fetch_songs] Spotify ValueError for id=%r: %s', playlist_id, e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error('[fetch_songs] Spotify unexpected error for id=%r: %s', playlist_id, e, exc_info=True)
            return Response({'error': f'Spotify error: {e}'}, status=status.HTTP_502_BAD_GATEWAY)

        if not raw_tracks:
            return Response({'error': 'No tracks found in playlist'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'songs': [t['title'] for t in raw_tracks]})

@method_decorator(csrf_exempt, name='dispatch')
class ChallengeListCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """
        ?creator=me  → returns the authenticated user's challenges (auth required).
        no param     → returns public challenges sorted by createdAt desc, limit 20.
        """
        if request.query_params.get('creator') == 'me':
            if not _is_authenticated(request.user):
                return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            try:
                docs = (
                    db.collection('challenges')
                    .where('creatorUid', '==', request.user)
                    .order_by('createdAt', direction='DESCENDING')
                    .stream()
                )
                results = []
                for doc in docs:
                    d = doc.to_dict()
                    results.append({
                        'id': doc.id,
                        'title': d.get('title', ''),
                        'songCount': len(d.get('songs', [])),
                        'createdAt': _ts_to_iso(d.get('createdAt')),
                        'playCount': d.get('playCount', 0),
                        'visibility': d.get('visibility', 'public'),
                    })
                return Response(results)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            # Public feed — no auth required
            try:
                docs = (
                    db.collection('challenges')
                    .where('visibility', '==', 'public')
                    .order_by('createdAt', direction='DESCENDING')
                    .limit(20)
                    .stream()
                )
                results = []
                for doc in docs:
                    d = doc.to_dict()
                    results.append({
                        'id': doc.id,
                        'title': d.get('title', ''),
                        'songCount': len(d.get('songs', [])),
                        'createdAt': _ts_to_iso(d.get('createdAt')),
                        'playCount': d.get('playCount', 0),
                    })
                return Response(results)
            except Exception as e:
                return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Creates a new challenge from a Spotify playlist URL. Auth required."""
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        body = request.data

        # Validate required fields
        playlist_url = (body.get('playlistUrl') or '').strip()
        title = (body.get('title') or '').strip()
        description = (body.get('description') or '').strip()
        visibility = (body.get('visibility') or 'public').strip()

        if not title:
            print("Challenge validation failed: Missing title")
            return Response({'error': 'Title is required'}, status=status.HTTP_400_BAD_REQUEST)
        if len(title) > 100:
            print(f"Challenge validation failed: Title too long ({len(title)} chars)")
            return Response({'error': 'Title must be 100 characters or fewer'}, status=status.HTTP_400_BAD_REQUEST)

        playlist_id = _parse_playlist_id(playlist_url)
        if not playlist_id:
            print(f"Challenge validation failed: Invalid playlist URL ({playlist_url})")
            return Response({'error': 'Invalid playlist URL'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            raw_tracks = spotify_new.get_playlist_tracks(playlist_id)
        except ValueError as e:
            logger.error('[create challenge] Spotify ValueError for id=%r: %s', playlist_id, e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error('[create challenge] Spotify unexpected error for id=%r: %s', playlist_id, e, exc_info=True)
            return Response({'error': f'Spotify error: {e}'}, status=status.HTTP_502_BAD_GATEWAY)

        if not raw_tracks:
            return Response({'error': 'No tracks found or playlist invalid.'}, status=status.HTTP_400_BAD_REQUEST)

        songs = [
            {
                'id': t['id'],
                'title': t['title'],
                'artist': t['artist'],
                'previewUrl': t.get('preview_url'),
            }
            for t in raw_tracks
        ]

        challenge_doc = {
            'creatorUid': request.user,
            'title': title,
            'description': description,
            'playlistUrl': playlist_url,
            'songs': songs,
            'visibility': visibility if visibility in ('public', 'private', 'restricted') else 'public',
            'allowedUsers': [],
            'createdAt': datetime.now(timezone.utc),
            'playCount': 0,
        }

        try:
            _, doc_ref = db.collection('challenges').add(challenge_doc)
            return Response(
                {'challengeId': doc_ref.id, 'title': title, 'songCount': len(songs)},
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ChallengeDetailView(APIView):
    def get(self, request, pk):
        try:
            doc = db.collection('challenges').document(pk).get()
            if not doc.exists:
                return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

            d = doc.to_dict()
            visibility = d.get('visibility', 'public')

            if visibility == 'restricted':
                if not _is_authenticated(request.user):
                    return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
                if request.user != d.get('creatorUid') and request.user not in d.get('allowedUsers', []):
                    return Response({'error': 'Not authorised'}, status=status.HTTP_403_FORBIDDEN)

            return Response({
                'id': doc.id,
                'title': d.get('title', ''),
                'description': d.get('description', ''),
                'songCount': len(d.get('songs', [])),
                'songs': d.get('songs', []),
                'creatorUid': d.get('creatorUid', ''),
                'createdAt': _ts_to_iso(d.get('createdAt')),
                'playCount': d.get('playCount', 0),
                'visibility': visibility,
                'playlistUrl': d.get('playlistUrl', ''),
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request, pk):
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            doc_ref = db.collection('challenges').document(pk)
            doc = doc_ref.get()
            if not doc.exists:
                return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)
            if doc.to_dict().get('creatorUid') != request.user:
                return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
            doc_ref.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExploreView(APIView):
    def get(self, request):
        try:
            docs = (
                db.collection('challenges')
                .where('visibility', '==', 'public')
                .order_by('playCount', direction='DESCENDING')
                .order_by('createdAt', direction='DESCENDING')
                .limit(20)
                .stream()
            )
            results = []
            for doc in docs:
                d = doc.to_dict()
                results.append({
                    'id': doc.id,
                    'title': d.get('title', ''),
                    'songCount': len(d.get('songs', [])),
                    'createdAt': _ts_to_iso(d.get('createdAt')),
                    'playCount': d.get('playCount', 0),
                })
            return Response(results)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─── Existing endpoints (M1 — unchanged logic) ───────────────────────────────

class SpotifyPlaylistView(APIView):
    def post(self, request):
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = PlaylistPreviewSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            playlist_id = spotify_service.extract_playlist_id(serializer.validated_data['playlist_url'])
            tracks = spotify_service.get_playlist_tracks(playlist_id)
            return Response(tracks)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.HTTPError as e:
            return Response({'error': f'Spotify API error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class SpotifyPreviewView(APIView):
    def get(self, request, track_id):
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        try:
            token = spotify_service.get_access_token()
            headers = {'Authorization': f'Bearer {token}'}
            url = f'{spotify_service.SPOTIFY_API_BASE}/tracks/{track_id}'
            resp = requests.get(url, headers=headers)
            resp.raise_for_status()
            return Response({'preview_url': resp.json().get('preview_url')})
        except requests.HTTPError as e:
            if e.response.status_code == 404:
                return Response({'error': 'Track not found'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'error': f'Spotify API error: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ScoreSubmitView(APIView):
    def post(self, request):
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        serializer = ScoreSubmitSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data

        try:
            challenge_ref = db.collection('challenges').document(data['challenge_id'])
            challenge = challenge_ref.get()
            if not challenge.exists:
                return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)

            c_data = challenge.to_dict()
            if c_data.get('privacy') != 'public':
                is_creator = c_data.get('creator_uid') == request.user
                is_allowed = c_data.get('privacy') == 'restricted' and request.user in c_data.get('allowed_uids', [])
                if not (is_creator or is_allowed):
                    return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

            puzzle_scores = [
                scoring.calculate_puzzle_score(
                    solved=p['solved'],
                    revealed=p['revealed'],
                    incorrect_count=p['incorrect_count'],
                    hints_used=p['hints_used'],
                )
                for p in data['puzzle_results']
            ]
            total_score = scoring.calculate_challenge_score(puzzle_scores)

            score_data = {
                'challenge_id': data['challenge_id'],
                'user_uid': request.user,
                'total_score': total_score,
                'puzzle_results': data['puzzle_results'],
                'completion_time_seconds': data['completion_time_seconds'],
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            _, score_ref = db.collection('scores').add(score_data)
            challenge_ref.update({'play_count': Increment(1)})

            return Response({'total_score': total_score, 'score_id': score_ref.id}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LeaderboardView(APIView):
    def get(self, request, challenge_id):
        try:
            docs = (
                db.collection('scores')
                .where('challenge_id', '==', challenge_id)
                .order_by('total_score', direction='DESCENDING')
                .order_by('completion_time_seconds', direction='ASCENDING')
                .limit(50)
                .stream()
            )
            results = []
            rank = 1
            for doc in docs:
                d = doc.to_dict()
                results.append({
                    'rank': rank,
                    'user_uid': d.get('user_uid'),
                    'total_score': d.get('total_score'),
                    'completion_time_seconds': d.get('completion_time_seconds'),
                    'created_at': d.get('created_at'),
                })
                rank += 1
            return Response(results)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
