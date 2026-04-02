"""
Spotify API utilities — for server-side use only.
Credentials are read from environment variables and never exposed to the client.
"""
import logging
import os
import time
import requests

logger = logging.getLogger(__name__)

SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
SPOTIFY_API_BASE = 'https://api.spotify.com/v1'
MAX_TRACKS = 500

# Module-level token cache: { 'token': str, 'expires_at': float }
_token_cache: dict = {}


def get_spotify_token() -> str:
    """
    Returns a valid Spotify client-credentials bearer token.
    Caches the token in memory and refreshes automatically when expired.
    """
    now = time.time()
    if _token_cache.get('token') and _token_cache.get('expires_at', 0) > now + 60:
        return _token_cache['token']

    client_id = os.getenv('SPOTIFY_CLIENT_ID')
    client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
    if not client_id or not client_secret:
        raise ValueError('Spotify credentials not configured')

    resp = requests.post(
        SPOTIFY_TOKEN_URL,
        data={'grant_type': 'client_credentials'},
        auth=(client_id, client_secret),
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        timeout=10,
    )
    if not resp.ok:
        logger.error(
            '[Spotify token] %s %s — body: %s',
            resp.status_code, resp.reason, resp.text,
        )
    resp.raise_for_status()
    data = resp.json()

    _token_cache['token'] = data['access_token']
    _token_cache['expires_at'] = now + data.get('expires_in', 3600)
    return _token_cache['token']


def get_playlist_tracks(playlist_id: str) -> list[dict]:
    """
    Fetches all tracks from a Spotify playlist (handles pagination).
    Returns a list of dicts: { id, title, artist, preview_url }.
    Raises ValueError for private/invalid playlists.
    """
    token = get_spotify_token()
    headers = {'Authorization': f'Bearer {token}'}
    url = f'{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks'
    tracks = []

    while url and len(tracks) < MAX_TRACKS:
        resp = requests.get(url, headers=headers, timeout=10)
        if not resp.ok:
            logger.error(
                '[Spotify tracks] %s %s — playlist_id=%r url=%r — body: %s',
                resp.status_code, resp.reason, playlist_id, url, resp.text,
            )
        if resp.status_code in (401, 403, 404):
            raise ValueError(
                f'Spotify returned {resp.status_code} for playlist {playlist_id!r}. '
                f'Reason: {resp.reason}. Body: {resp.text}'
            )
        resp.raise_for_status()
        data = resp.json()

        for item in data.get('items', []):
            track = item.get('track')
            if not track or not track.get('id'):
                continue
            tracks.append({
                'id': track['id'],
                'title': track['name'].strip(),
                'artist': track['artists'][0]['name'] if track.get('artists') else 'Unknown Artist',
                'preview_url': track.get('preview_url'),
            })
            if len(tracks) >= MAX_TRACKS:
                break

        url = data.get('next')

    return tracks
