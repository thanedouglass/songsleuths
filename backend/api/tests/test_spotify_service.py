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
