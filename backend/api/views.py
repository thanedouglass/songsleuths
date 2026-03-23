from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .firestore_client import db
from . import spotify_service
from . import scoring
from .serializers import (
    CreateChallengeSerializer, 
    PlaylistPreviewSerializer, 
    ScoreSubmitSerializer
)
from datetime import datetime, timezone
from google.cloud.firestore_v1 import Increment
import requests

def _is_authenticated(user):
    """Returns True when FirebaseAuthentication set request.user to a UID string."""
    return isinstance(user, str) and bool(user)

class ChallengeListCreateView(APIView):
    def get(self, request):
        """Returns all public challenges."""
        try:
            challenges_ref = db.collection('challenges')
            query = challenges_ref.where('privacy', '==', 'public').order_by('created_at', direction='DESCENDING').limit(50)
            results = []
            for doc in query.stream():
                data = doc.to_dict()
                data['id'] = doc.id
                # Only return the high level metadata, not the full tracks
                results.append({
                    'id': doc.id,
                    'title': data.get('title'),
                    'description': data.get('description'),
                    'creator_uid': data.get('creator_uid'),
                    'song_count': len(data.get('tracks', [])),
                    'play_count': data.get('play_count', 0),
                    'created_at': data.get('created_at'),
                    'privacy': data.get('privacy')
                })
            return Response(results)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Creates a new challenge from a Spotify playlist URL."""
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            
        serializer = CreateChallengeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        data = serializer.validated_data
        
        try:
            playlist_id = spotify_service.extract_playlist_id(data['playlist_url'])
            tracks = spotify_service.get_playlist_tracks(playlist_id)
            
            if not tracks:
                return Response({'error': 'Playlist is empty'}, status=status.HTTP_400_BAD_REQUEST)
                
            challenge_data = {
                'title': data['title'],
                'description': data.get('description', ''),
                'privacy': data['privacy'],
                'creator_uid': request.user,
                'tracks': tracks,
                'play_count': 0,
                'created_at': datetime.now(timezone.utc).isoformat(),
            }
            
            if data['privacy'] == 'restricted':
                challenge_data['allowed_uids'] = data.get('allowed_uids', [])
                
            _, doc_ref = db.collection('challenges').add(challenge_data)
            
            challenge_data['id'] = doc_ref.id
            return Response(challenge_data, status=status.HTTP_201_CREATED)
            
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.HTTPError as e:
            return Response({'error': f"Spotify API error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ChallengeDetailView(APIView):
    def get(self, request, pk):
        try:
            doc_ref = db.collection('challenges').document(pk)
            doc = doc_ref.get()
            
            if not doc.exists:
                return Response({'error': 'Challenge not found'}, status=status.HTTP_404_NOT_FOUND)
                
            data = doc.to_dict()
            data['id'] = doc.id
            
            # Enforce privacy
            privacy = data.get('privacy', 'public')
            if privacy != 'public':
                if not _is_authenticated(request.user):
                    return Response({'error': 'Authentication required for private challenge'}, status=status.HTTP_401_UNAUTHORIZED)
                
                is_creator = data.get('creator_uid') == request.user
                is_allowed = privacy == 'restricted' and request.user in data.get('allowed_uids', [])
                
                if not (is_creator or is_allowed):
                    return Response({'error': 'Not authorized to view this challenge'}, status=status.HTTP_403_FORBIDDEN)
                    
            return Response(data)
            
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
                
            if doc.to_dict().get('creator_uid') != request.user:
                return Response({'error': 'Not authorized to delete this challenge'}, status=status.HTTP_403_FORBIDDEN)
                
            doc_ref.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            return Response({'error': f"Spotify API error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class SpotifyPreviewView(APIView):
    def get(self, request, track_id):
        if not _is_authenticated(request.user):
            return Response({'error': 'Authentication required'}, status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            token = spotify_service.get_access_token()
            headers = {'Authorization': f'Bearer {token}'}
            url = f"{spotify_service.SPOTIFY_API_BASE}/tracks/{track_id}"
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            track_data = response.json()
            return Response({'preview_url': track_data.get('preview_url')})
            
        except requests.HTTPError as e:
            if e.response.status_code == 404:
                return Response({'error': 'Track not found'}, status=status.HTTP_404_NOT_FOUND)
            return Response({'error': f"Spotify API error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
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
            # Check if challenge exists and user has access
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
            
            # Calculate total score
            puzzle_scores = []
            for p in data['puzzle_results']:
                score = scoring.calculate_puzzle_score(
                    solved=p['solved'],
                    revealed=p['revealed'],
                    incorrect_count=p['incorrect_count'],
                    hints_used=p['hints_used']
                )
                puzzle_scores.append(score)
                
            total_score = scoring.calculate_challenge_score(puzzle_scores)
            
            # Save score
            score_data = {
                'challenge_id': data['challenge_id'],
                'user_uid': request.user,
                'total_score': total_score,
                'puzzle_results': data['puzzle_results'],
                'completion_time_seconds': data['completion_time_seconds'],
                'created_at': datetime.now(timezone.utc).isoformat()
            }
            
            _, score_ref = db.collection('scores').add(score_data)
            
            # Increment play count
            challenge_ref.update({'play_count': Increment(1)})
            
            return Response({
                'total_score': total_score,
                'score_id': score_ref.id
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LeaderboardView(APIView):
    def get(self, request, challenge_id):
        try:
            # Query scores for this challenge
            scores_ref = db.collection('scores')
            query = scores_ref.where('challenge_id', '==', challenge_id) \
                            .order_by('total_score', direction='DESCENDING') \
                            .order_by('completion_time_seconds', direction='ASCENDING') \
                            .limit(50)
                            
            results = []
            rank = 1
            for doc in query.stream():
                data = doc.to_dict()
                results.append({
                    'rank': rank,
                    'user_uid': data.get('user_uid'),
                    'total_score': data.get('total_score'),
                    'completion_time_seconds': data.get('completion_time_seconds'),
                    'created_at': data.get('created_at')
                })
                rank += 1
                
            return Response(results)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
