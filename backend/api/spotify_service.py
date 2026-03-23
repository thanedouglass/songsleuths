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
    token = cache.get('spotify_access_token')
    if token:
        return token
    
    if not CLIENT_ID or not CLIENT_SECRET:
        raise ValueError("Spotify credentials not configured")

    response = requests.post(
        SPOTIFY_TOKEN_URL,
        data={'grant_type': 'client_credentials'},
        auth=(CLIENT_ID, CLIENT_SECRET),
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    response.raise_for_status()
    data = response.json()
    token = data['access_token']
    
    # Cache for 50 minutes (3000 seconds)
    cache.set('spotify_access_token', token, 3000)
    return token

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
    token = get_access_token()
    headers = {'Authorization': f'Bearer {token}'}
    
    url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks"
    tracks = []
    
    while url:
        response = requests.get(url, headers=headers)
        if response.status_code == 404:
            raise ValueError("Playlist not found or is private")
        response.raise_for_status()
        
        data = response.json()
        
        for item in data.get('items', []):
            track = item.get('track')
            if not track or not track.get('id'):
                continue
                
            album_art = None
            if track.get('album') and track['album'].get('images'):
                # Try to get the 640px image (usually the first one)
                images = track['album']['images']
                album_art = images[0]['url'] if images else None
                
            tracks.append({
                'spotify_id': track['id'],
                'title': track['name'],
                'artist': track['artists'][0]['name'] if track.get('artists') else 'Unknown Artist',
                'album': track['album']['name'] if track.get('album') else 'Unknown Album',
                'preview_url': track.get('preview_url'),
                'album_art': album_art
            })
            
        url = data.get('next')
        
    return tracks

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
    if not url_or_id:
        raise ValueError("Empty string provided")
        
    if 'spotify.com/playlist/' in url_or_id:
        try:
            # Extract everything after /playlist/
            path_part = url_or_id.split('/playlist/')[1]
            # Strip off any query params
            return path_part.split('?')[0]
        except IndexError:
            raise ValueError(f"Invalid Spotify playlist URL: {url_or_id}")
            
    # If it's just an alphanumeric string (no slashes), assume it's an ID
    if '/' not in url_or_id and url_or_id.isalnum():
        return url_or_id
        
    raise ValueError(f"Could not parse playlist ID from: {url_or_id}")
